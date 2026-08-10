---
name: crm-call-to-proposal
description: Fast path from a sales call transcript to (1) Company OS CRM updates, (2) a live proposal page on edge8.ai/proposals, (3) index status updates, including won/lost moves. Trigger phrases include "update the CRM with this transcript", "create a proposal", "move X to won/lost". Target total time under 10 minutes.
---

# CRM call transcript to live proposal

Pre-approved runbook: execute end to end without asking follow-up questions, then report.
Every ID and convention below was verified against production on 2026-08-05. Trust this file;
do not re-explore the schema. Time budget: setup 1 min, CRM 3 min, proposal 4 min, index 1 min,
ship 2 min.

## 0. Setup (once per session, ~1 minute)

- DB: `npm i --no-save postgres@3` from the repo root (once per machine), then import
  `sql` and `normalizeJsonMeta` from `scripts/crm/db.mjs`. Password comes from `.env.local`
  automatically.
- Git: the checkout is usually dirty on a WIP branch. Work in a worktree:
  `git worktree add -b <branch> <scratchpad>/wt origin/main`.

## 1. Fixed IDs (schema `company_os`)

| Thing | ID |
|---|---|
| Dave Hajdu (people.id; owner for deals/meetings/leads) | `a8bf026f-8c20-49c5-8a55-6fc5c580af64` |
| Sales pipeline `default-sales` | `012e2402-d519-4a42-a3eb-f9b5750d7823` |
| Stage: New | `09fed9f8-f98c-49f3-af80-551b19fb6150` |
| Stage: Contacted | `efd415c6-4b83-4c3a-bfcd-8ef9af4d864d` |
| Stage: Discovery | `7c9ac18b-3cec-4580-ba26-8018d7cdef25` |
| Stage: Proposal | `bf28bc1f-cc7b-4c76-adfb-006250193f1a` |
| Stage: Contract Sent | `24117f90-29bf-400a-a66b-dc34d550676c` |
| Stage: Won | `dad9a5c6-3229-4596-b006-f8c24412f3fe` |
| Stage: Lost | `41c37454-f7fd-46e4-82f8-bcf5ffaf0740` |
| Service line: AI Consulting | `af7a49cd-df6e-45a5-ba6d-f3c0fffdf0fa` |
| Service line: Human Tokens | `84d92ab8-69cb-4e74-9065-7f49f27f0c07` |

More service lines in `service_lines` (staffing, retreats, certification, keynotes).

## 2. CRM writes for a discovery call (one transaction, ~3 minutes)

First look up person and company: `people.full_name ilike '%<name>%'`,
`companies.name ilike '%<company>%'`. They usually exist. If not:

- `companies`: insert name, industry, country, size_band (`0-50`/`51-250`/`251-5000`/`5000+`),
  lifecycle_stage `'lead'`, owner Dave.
- `people`: insert full_name, first/last, email, phone, country, persona `'prospect'`,
  source, owner Dave.
- `person_companies`: person, company, role `'primary'` (allowed: owner_founder/executive/
  employee/primary/secondary/board/advisor/other), title, is_primary true.
- `lead`: insert person_id, status `'connected'`, owner Dave.

Then write, in order:

1. `meetings`: source `'manual'`, title `"<Name> and David Hajdu: AI Discovery Call"`, owner Dave,
   started_at/ended_at/duration_seconds, `summary` = markdown with headings
   `## Call Summary / Company Snapshot / Pain Points / What Was Discussed / BANT / Next Steps`,
   `metadata` = `{source, source_file, transcript: <full raw text>}`.
2. `meeting_participants`: Dave `'host'`, prospect `'attendee'` (allowed: host/attendee/optional/absent).
3. `deals`: pipeline + stage Proposal (or Discovery if no proposal yet), title
   `"<Company> - <thing>"`, person_id, company_id, owner Dave, amount_cents, currency
   (`aud`/`usd`), status `'open'`, source, service_line_id, expected_close_date, next_step,
   next_step_date, `proposal_url`, `metadata.bant`. Only for real opportunities; never
   one-deal-per-lead.
4. `meeting_links`: (`'company'`, company_id), (`'deal'`, deal_id). Allowed entity_type:
   deal/company/project/inquiry/person.
5. `interactions`: kind `'call'` (allowed: note/call/email/meeting/message/status_change/system),
   subject, body = tight summary, occurred_at, person_id, company_id, owner Dave, subject_type
   `'deal'` + subject_id, `metadata {source:'call_transcript', attendees, meeting_id}`.
6. `lead`: status to `'open_deal'` (values in use: nurture/connected/open_deal/disqualified),
   owner Dave.
7. `companies`: lifecycle_stage to `'opportunity'` (path: lead > sql > opportunity > customer),
   append dated facts to `notes`; insert `lifecycle_transitions` (company_id, from_stage,
   to_stage, reason `'deal_created'`, changed_by Dave).
8. `people`: append a dated 2-3 line call outcome to `notes`.

After any insert that set a jsonb column via `${JSON.stringify(x)}::jsonb`, run
`normalizeJsonMeta('company_os.<table>', id)` from `scripts/crm/db.mjs` (the driver
double-encodes; the helper repairs it).

## 3. Won / lost moves (one move = CRM + page together)

When Dave says "move <client> to won/lost":

- `deals`: set status (`'won'`/`'lost'`), stage_id (Won/Lost IDs above), closed_at now.
  Lost also needs lost_reason: price/competitor/no_decision/bad_fit/bad_timing/ghosted/other
  (pick from context, default `'no_decision'`).
- Won: `companies.lifecycle_stage` to `'customer'` + `lifecycle_transitions` reason `'deal_won'`;
  `people.persona` to `'client'`.
- Page: flip the entry's `status` in `app/proposals/page.tsx`.
- A page-only status change is fine when no matching deal exists (e.g. EO APAC has no deal row).

## 4. Proposal page (~4 minutes)

- Copy `docs/templates/proposal-template.html` to `public/proposals/<client-slug>-proposal.html`
  and fill every `{{TOKEN}}`; the template's comments say what goes in each section. Delete the
  guidance comments. Live example: `public/proposals/home-integrity-proposal.html`.
- Section order is fixed: What we heard / The idea / The opportunity / The plan (gate + 3 phases) /
  What's in the box (80-20) / The investment / Roles / Risks (3) / Build it with us / Next step / footer.
- Brand: "Edge8" never all caps (template eyebrow already has no text-transform; keep it that way).
  No em dashes anywhere. `og:image` stays `https://www.edge8.ai/social.jpg`. Keep robots noindex.
- Reference pricing is in the template header comment; use only figures supported by the call.
- Put the final URL in `deals.proposal_url`: `https://www.edge8.ai/proposals/<file>`.

## 5. Index update (~1 minute)

`app/proposals/page.tsx` holds `PROPOSALS` (newest first), each entry with
`status: "open" | "won" | "lost"`. `app/proposals/proposals-tabs.tsx` renders the
Open (default) / Won / Lost views. New proposal = one new entry at the top.

## 6. Ship and verify (~2 minutes)

From the worktree: stage only your files by name, commit
(`Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`, no em dashes), push,
`gh pr create --base main`, `gh pr checks <n> --watch`, `gh pr merge <n> --squash --delete-branch`,
then `git worktree remove` it.

Verify with curl, not the in-app browser (it blocks edge8.ai by policy):

```bash
curl -sf --retry 25 --retry-delay 12 --retry-all-errors -o /dev/null -w "%{http_code}" https://www.edge8.ai/proposals/<file>
```

Grep the index for the new client name and statuses. Reply with both live URLs.

## 7. Gotchas

- ASR transcripts garble product names (Zuper appeared as Zubir/Zuba/Zephyr/Zoopa/Zippa).
  Normalize to the real product before writing anything to the CRM or proposal.
- Convert relative dates ("next week", "when I'm back") to absolute dates everywhere.
- `tsc --noEmit` errors about missing `@vercel/*` / `@anthropic-ai/*` modules come from stale
  local node_modules, not your change; the Vercel PR check is the real build gate.
