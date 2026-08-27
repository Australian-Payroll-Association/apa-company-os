# Zoom coaching transcript ingestion + actionable summaries

Date: 2026-08-27
Status: MVP built, Zoom half verified live, DB write and LLM summary runnable but not yet run
Owner: Quan

## Why

Coaching sessions (starting with the recurring "AIOlabz Coaching") run on Zoom
with cloud recording and audio transcription on. Zoom produces a full WebVTT
transcript plus its own AI summary. The AI summary is generic and not useful for
running the program. We want the full transcript in our own database, and our
own summary written for the people who act on it: the engineers who were coached
and the leaders who run the program.

Two things did not exist before this change:

1. Any Zoom to database ingestion. The three existing transcript routes into
   Company OS all come from Lark (the daily coaching cycle's Minutes pull, a
   paste into the coach page, and the lark-cli task on Dave's machine). None read
   Zoom.
2. An internal, actionable summary. `lib/ai/meeting-summary.ts` exists but is
   deliberately client-facing (neutral, short, shown in the portal). It is the
   wrong shape for an internal coaching debrief.

## Where the data lands

The canonical meetings table is `company_os.meetings` (357 rows, multi-source by
design: `source`, `external_id`, `transcript_url`, `recording_url`,
`minutes_url`, `summary`, `metadata`). It already has sibling tables
`meeting_participants` and `meeting_action_items` (both empty). This is the same
table the `crm-call-to-proposal` runbook writes sales calls into, so we follow
its verified conventions rather than inventing a new store.

Note: `company_os.meeting_notes` is a separate, newer, client-portal feature
(inline transcript plus client-facing `ai_summary`). It is not the target here.

### Row mapping (per Zoom recording)

`meetings`
- `source` = `'zoom'`
- `external_id` = the Zoom recording UUID (dedup key, so re-runs are safe)
- `title` = our summary's title, falling back to the Zoom topic
- `meeting_type` = `'coaching'`
- `summary` = our actionable markdown (see below); `summary_encrypted` = false
- `recording_url` = the Zoom share URL
- `owner_id` = Dave Hajdu (`a8bf026f-8c20-49c5-8a55-6fc5c580af64`)
- `started_at` / `ended_at` / `duration_seconds` = from the recording
- `metadata` = `{ source, source_file, zoom_meeting_id, zoom_uuid, meeting_date,
  speakers, transcript: <full cleaned text> }`

Storing the full transcript inline in `metadata.transcript` (the CRM skill's
convention) is what lets us regenerate the summary later whenever the prompt
improves. Zoom's own summary can never be re-derived like that.

`meeting_participants`: one row per distinct speaker detected in the transcript.
`role` is `host` for Dave, `attendee` for everyone else. `person_id` stays null
for now (see open questions).

`meeting_action_items`: one row per action item the summariser extracts, in
order, `status` = `'open'`, `assignee_id` null (owner name kept in `detail`).

## Component 1: Zoom ingestion

Files:
- `scripts/crm/zoom.mjs`: read-only Zoom Server-to-Server client. Token, list
  account users, list recordings per host, download the `audio_transcript` VTT,
  clean it to text, detect speakers.
- `scripts/crm/companyos.mjs`: Company OS DB access via the Supabase client with
  the service (secret) key, scoped to the `company_os` schema, the same way the
  app writes (`lib/supabase.ts`). This avoids needing the raw Postgres password.
- `scripts/crm/zoom-ingest.mjs`: orchestrator. Scans hosts, filters by topic,
  dedups against `meetings`, fetches the transcript, summarises, and writes the
  three tables.

It runs from an operator's machine. Zoom creds come from `~/.claude/.env`;
`SUPABASE_URL` + `SUPABASE_SECRET_KEY` and `OPENROUTER_API_KEY` come from
`.env.local` at the repo root. Nothing needs to be added to Vercel for the MVP.

One-time DB grant: the meeting tables were built for the direct-Postgres path,
so `service_role` needs table grants to write them via the Data API:

```sql
grant select, insert, update, delete on
  company_os.meetings, company_os.meeting_participants,
  company_os.meeting_action_items, company_os.meeting_links
to service_role;
```

Because the Supabase client cannot run a multi-statement transaction, the writer
inserts the meeting, then participants, then action items, and on any child
failure deletes the meeting again (a compensating cleanup) so a partial write
never leaves an orphan the dedup would skip.

Note: the `meetings` table has a trigger that normalises `meeting_type`; an
inserted `'coaching'` lands as `'General'` with the original preserved in
`metadata.source_meeting_type`.

Run:

```
# dry run: last 30 days, topics matching /coaching/i, writes nothing
node scripts/crm/zoom-ingest.mjs

# real ingest
node scripts/crm/zoom-ingest.mjs --write

# scope it
node scripts/crm/zoom-ingest.mjs --from=2026-08-01 --topic=aiolabz --host=dave@edge8.co

# transcript only, summarise later
node scripts/crm/zoom-ingest.mjs --write --no-summary

# regenerate one summary from the stored transcript
node scripts/crm/zoom-ingest.mjs --resummarize=<zoom-uuid> --write
```

Dry run is the default. Summarising is failure-isolated: if the LLM step fails,
the transcript still lands and the row is marked pending, so a summary can be
added later with `--resummarize`. This matches the app's fire-and-forget
contract.

## Component 2: actionable summary

File: `scripts/crm/meeting-summarize.mjs`. One model call through OpenRouter
(OpenAI-compatible chat completions, so it is provider-neutral and needs no
Anthropic SDK). Model set by `OPENROUTER_MODEL` (default `anthropic/claude-3.7-sonnet`,
override with any OpenRouter slug); key from `OPENROUTER_API_KEY`. It requests a
JSON object and validates the parsed result. It returns:

- `title`, `meeting_date`, `attendees`
- `summary_markdown` with fixed sections: TL;DR, Decisions, Blockers,
  For engineers, For leaders
- `action_items[]`: `{ title, owner, detail, due_date }`

The prompt is grounded strictly in the transcript (no invented decisions,
owners, or figures), normalises speech-to-text garbles of tool names, and
follows the Edge8 no-em-dash rule.

## Verified vs pending

- Done and verified live: both AIOlabz Coaching sessions (2026-08-27 and
  2026-08-20 with Dave, Quan, Khoa) are ingested into `company_os.meetings` with
  transcripts inline and participants written. `ai_status` is `pending` on both.
- Pending: the OpenRouter summary pass. Once `OPENROUTER_API_KEY` is set, run
  `--resummarize=<zoom-uuid> --write` per row (or a full `--write` for new
  sessions) to fill `summary` and the action items.

## Open questions (confirm before the first --write)

1. Is `company_os.meetings` with `meeting_type = 'coaching'` the right home for
   group coaching, or should these sit apart from CRM sales meetings? The table
   is general and has the action-item and participant tables we want, so it is
   the natural fit, but it is a data-modelling choice on a live table.
2. Should a coaching session link to a client company via `meeting_links`? For
   AIOlabz that likely maps to one company; the script can set it with a
   `--company=<id>` flag once we decide the mapping.
3. Participant `person_id` is null for now. Matching speaker names to `people`
   rows is a known intake hazard (duplicate and ASCII-named rows), so the MVP
   keeps display names only. A later pass can match safely on email once we pull
   the Zoom participants report.

## Gate before the first --write (from QA review of PR #936)

Two checks need the live database (a read-only Company OS connection is enough),
so they are not resolved in-repo:

1. Confirm the CHECK-constraint allowed values before writing, since the base
   tables predate the in-repo migrations. Run:

   ```sql
   select conname, pg_get_constraintdef(oid) from pg_constraint
   where conrelid in ('company_os.meetings'::regclass,
                      'company_os.meeting_action_items'::regclass,
                      'company_os.meeting_participants'::regclass)
     and contype = 'c';
   ```

   Verify `meeting_type='coaching'`, action-item `status='open'`, and
   participant `role` values are allowed, and that `created_at`/`updated_at`
   have defaults. `source='zoom'` is already confirmed against
   `meetings_source_check`.

2. Optional hardening: add a partial unique index on
   `company_os.meetings(source, external_id)` (the repo already does this for
   `expenses`). It closes the small select-then-insert race and lets a future
   version use `on conflict do nothing`.

Fixed in this PR after the review: the meeting plus its participants and action
items now write in a single transaction (no orphaned half-rows), the
`--resummarize` metadata stamp no longer double-encodes, and speaker detection
only trusts name-shaped labels seen on two or more lines.

## Productionising later (out of MVP scope)

- Move ingestion to a Vercel cron (`/api/cron/zoom-transcripts`) once the Zoom
  S2S creds are added to Vercel, mirroring `/api/cron/coaching-recaps`. Or keep
  it operator-run if that is simpler to govern.
- Switch from polling to Zoom's `recording.completed` webhook for near real time.
- Add a TS lib mirror of the summariser if the app (not just the script) needs
  to trigger it.
