# Team Coaching Cycle — 1-1s in the company OS

**Date:** 2026-07-25 · **Owner:** Dave · **Status:** Approved & built 2026-07-25 (schema applied, data migrated; Lark child-page second pass pending)
**Replaces:** the Lark wiki "1-1 Coaching" space + the local `leadership-coach/1-1-coach` skill workflow
**Source of truth for the process:** https://edge8.ai/workflows/one-on-one/

## Why

All 1-1 documentation lives in Lark today (dashboard + per-person pages), tied to the calendar,
with private coaching reads in Dave's personal space. Lark cannot enforce the visibility rules the
data needs: who sees a private coaching note vs. a shared recap is a matter of discipline, not
access control. Rebuild the whole cycle inside the company OS on Supabase, where the two-tier
security model is enforced by code.

## Decisions (Dave, 2026-07-25)

1. **Full cycle with AI in v1**: AI prep, transcript → summary + commitments, cron mid-cycle
   check-ins, monthly AI trend reports. The complete `/workflows/one-on-one` loop.
2. **Two-tier visibility**: the coach sees everything for their people, including private notes.
   The team member sees their own page: FAST goal, commitments, and the shared version of each
   recap. Never the private tier.
3. **In-DB cadence + email**: no external calendar dependency. Cadence lives on the coaching
   record; the daily cron flags overdue 1-1s and sends nudges.
4. **Migrate everything**: roster + FAST goals from the Lark dashboard, historical
   summaries/check-ins from the local notes folders (Mai, Khoa, Ginny, Trac), foundation docs.

## The cycle (from /workflows/one-on-one)

| # | Step | Cadence | Actor |
|---|------|---------|-------|
| 01 | AI Prep | Friday before the 1-1 | AI |
| 02 | The 1-1 meeting | Wednesday | Human (the only human step) |
| 03 | Summary & commitments | Right after | AI (from transcript) |
| 04 | Mid-cycle check-in | The Wednesday in between | System |
| 05 | Trend analysis | Monthly | AI |

## Coach ≠ manager (dotted lines are first-class)

The Lark roster is Dave coaching 5 people, but in `team_members` two of them (Ginny, My Pham)
have `manager_id` = Mai. Dave's call (2026-07-25): dotted-line relationships are supported —
e.g. My reports to Mai on the org chart but is Dave's assistant, so Dave coaches her. The
coaching relationship is therefore explicit: `coaching_profiles.coach_id` (a `team_members.id`),
independent of `manager_id`. New reports default their coach to their manager, but the
assignment is editable. All coach-side scope checks are `coach_id = actor.teamMemberId` —
never the manager embed. Verified against live DB 2026-07-25: Mai/Khoa/Quan Chau report to
Dave; Ginny/My report to Mai; Trác (status notice, under Khoa) still has a row for history
migration.

## Data model (company_os)

New tables, all with service_role grants (see company-os-table-grants):

### `coaching_profiles` — one row per coached person
- `id` uuid PK, `team_member_id` uuid FK unique, `coach_id` uuid FK (team_members)
- `fast_goal` text, `fast_goal_status` check: `not_set | draft | set` (default not_set)
- `okrs_markdown` text — the person's OKRs (member-visible)
- `private_profile_markdown` text — "how they're wired" coaching reads (**coach-only**)
- `cadence_days` int default 14, `next_one_on_one_on` date
- `active` boolean default true, timestamps

### `one_on_ones` — one row per meeting
- `id`, `coaching_profile_id` FK, `held_on` date, `status` check: `scheduled | held | skipped`
- `prep_markdown` text (**coach-only**), `prep_generated_at`
- `transcript` text (**coach-only**), raw paste/upload
- `summary_markdown` text (**coach-only**, incl. emotional/personal notes section)
- `shared_summary_markdown` text (member-visible recap)
- `ai_model`, `ai_error`, timestamps

### `coaching_commitments` — the commitment log (member-visible)
- `id`, `coaching_profile_id` FK, `one_on_one_id` FK nullable
- `title` text, `owner` check: `coach | member`, `due_on` date nullable
- `status` check: `open | on_track | needs_attention | completed | dropped | blocked` (default open)
- `status_note` text (last update commentary), `status_updated_by` (team_members id), `closed_at`
- Language rule: they are **commitments**, never tasks or action items.

### `coaching_checkins` — mid-cycle check-in record
- `id`, `coaching_profile_id` FK, `sent_at`, `message_markdown` (the nudge content, member-visible)
- `responded_at` nullable — stamped when the member updates any commitment after the send

### `coaching_trends` — monthly AI reports (**coach-only**)
- `id`, `coaching_profile_id` FK, `period` text `YYYY-MM` unique per profile
- `report_markdown`, `ai_model`, `ai_error`, `created_at`

### `coaching_context` — the docs that feed the AI (**coach-only**)
- `id`, `coach_id` FK nullable (null = company-wide), `kind` check:
  `foundation | company | okrs`, `title`, `markdown`, `updated_at`
- Seeded from `leadership-coach/foundation/`: leadership brand, coaching profile, EQ guide,
  communication style, operating system, Edge8 2026 OKRs, plus
  `1-1-coach/context/company-context.md`.

## Visibility matrix

| Data | Coach | Member | Other admins / assistants |
|---|---|---|---|
| FAST goal, OKRs, cadence | RW | R | — |
| Commitments + statuses | RW | RW (status + note only) | — |
| Shared recap | RW | R | — |
| Prep, transcript, private summary | RW | — | — |
| Private profile, trend reports | RW | — | — |

- Enforcement is the /team pattern: service-role client + `requireTeamMember()` + explicit scope
  on every query. Coach-side: `coach_id = actor.teamMemberId`. Member-side: profile's
  `team_member_id = actor.teamMemberId`, selecting only member-visible columns.
- **Assistant lockout**: none of the six tables are added to the admin NL→SQL assistant or the
  team chat tool's readable set (same treatment as `people_sensitive`). Private coaching data
  never transits an assistant.
- /admin gets no coaching surface in v1. Dave operates it from /team like any coach.

## Routes

### Coach side (visible when the actor coaches ≥1 active profile)
- `/team/coaching` — dashboard: roster cards (person, FAST goal + status, last 1-1, next 1-1,
  open commitments count, day-8-style attention flags: overdue cadence, goal not set, check-in
  unanswered). Mirrors the Lark dashboard's "What needs attention" block.
- `/team/coaching/[profileId]` — the person page. Tabs/sections: overview (goal, cadence,
  commitments), 1-1 history (each meeting: prep → transcript → summaries), private notes,
  trends. Actions: generate prep, log a 1-1 (paste transcript → AI summary + extracted
  commitments → coach reviews/edits both tiers before the shared one is published), edit goal,
  set next date, manage commitments, run trend report now.
- Sidebar: "My Team" group gains "Coaching" next to "Onboarding" (manager/coach gate).

### Member side
- `/team/my-coaching` — own FAST goal + OKRs, open commitments (member can update status +
  note), shared recaps, check-in history. Linked from the check-in email and /team home.

## AI (lib/coaching/ai.ts)

Pattern: `@anthropic-ai/sdk` + structured output JSON schema, same as `lib/ai/idea-plan.ts`.
Model: `COACHING_CLAUDE_MODEL || "claude-opus-4-8"` (coaching nuance justifies opus; same tier
as resume screening). Every call is fail-soft (`ai_error` on the row, never throws).

1. **`generatePrep(oneOnOneId)`** — inputs: foundation + company context docs, private profile,
   OKRs, last 2 summaries, open commitments. Output sections: Focus areas, Coaching questions
   (Dave's voice per the style guide), Context reminders, Open commitments.
2. **`summarizeMeeting(oneOnOneId)`** — input: transcript + prep + open commitments. Structured
   output: `summary_markdown` (private, incl. emotional/personal notes + connections),
   `shared_summary_markdown` (member-appropriate recap), `commitments[]`
   ({title, owner, due_on?}). Coach reviews before the shared tier is visible (draft flag:
   shared summary is only member-visible after the coach saves it).
3. **`generateTrendReport(profileId, period)`** — inputs: the month's summaries, commitment
   ledger, check-ins, OKRs, prior trend report. Output sections: Growth trajectory, Recurring
   themes, Commitment follow-through, Coaching opportunities, Flags, Quarter comparison.

## Cron — `/api/cron/coaching-cycle` (daily 7:45 Saigon, after onboarding-cycle)

Same bearer-auth + idempotent-stamp pattern as `runOnboardingCycle`:

1. **Prep nudge**: `next_one_on_one_on` within 4 days and no prep on the scheduled meeting →
   auto-generate the prep, email the coach a link. Stamped via `prep_generated_at`.
2. **Overdue 1-1**: today > last held 1-1 + `cadence_days` + 3 grace days and no future
   `next_one_on_one_on` → email the coach (repeats weekly, not daily).
3. **Mid-cycle check-in**: ~half of `cadence_days` after the last held 1-1, if open commitments
   exist and no check-in this cycle → AI writes the warm nudge referencing each open commitment,
   emails the member with a link to `/team/my-coaching`, records `coaching_checkins`.
4. **Monthly trends**: on the 1st, for each profile with ≥1 summary in the prior month →
   generate the trend report, email the coach.

All email via `sendTransactionalEmail` with `logMeta.source: "coaching-cycle"`.

## Migration (scripts/coaching-import-run.ts, one-off)

1. Resolve the roster against live `company_os.people` by email (verify-names-against-db):
   Mai Dang, Khoa Doan, Ginny Vo, Quan Chau, My Pham — coach = Dave's team_members id.
   Trac (departed): import history only if a team_members row exists; otherwise keep his files
   local and log the skip.
2. FAST goals + last-1-1 dates from the Lark dashboard (already captured; Mai's draft goal:
   "Automate every repetitive task").
3. Local notes → rows: `* Summary - {Name}.md` → `one_on_ones` (held_on from filename,
   private summary = full file; "(Team Member)" variant → `shared_summary_markdown` of the same
   meeting), `* Check-in - {Name}.md` → `coaching_checkins`, GROW prep html → `prep_markdown`,
   raw `.txt` transcripts → `transcript` on the matching meeting.
4. `{name}-profile.md` → `private_profile_markdown`; `{name}-okrs.md` → `okrs_markdown`.
5. Foundation + company context docs → `coaching_context`.
6. Lark per-person child pages: pending links from Dave (API can read a doc by link, but cannot
   enumerate children with tenant auth). Anything on those pages not present in local notes gets
   imported the same way in a second pass.

## Env / config

- `ANTHROPIC_API_KEY` — already used by ideas/ATS; verify it is set in Vercel prod.
- `COACHING_CLAUDE_MODEL` — optional override.
- vercel.json: add the cron entry.
- Migration SQL in `supabase/migrations/` + explicit service_role grants.

## Build order (one branch, batch PR per work-locally-batch-prs)

1. **Schema**: migration SQL, grants, types.
2. **Core lib**: `lib/coaching/data.ts` (scoped reads/writes), visibility helpers.
3. **Coach UI**: dashboard + person page + server actions (manual everything first).
4. **AI**: the three generators + review/publish flow.
5. **Member UI**: `/team/my-coaching` + commitment updates + check-in view.
6. **Cron**: `/api/cron/coaching-cycle` + emails.
7. **Migration script** + run against live data.
8. Verify: `tsc` + `next build` (no dev server), then PR for Dave to merge.

## Out of scope (later phases)

- Onboarding plan docs authored in-app (replacing pasted Lark/Google links).
- The ops onboarding checklist migration out of Lark.
- Replacing the remaining Lark webhook notifications.
- Calendar event creation (Lark/Google) for the 1-1s themselves.
- Coaching surfaces for managers other than the seeded roster (the model supports any coach;
  UI gates simply follow `coach_id`).
