---
name: crm-call-to-proposal
description: Fast path from a sales call transcript to (1) Company OS CRM updates, (2) a live proposal page on edge8.ai/proposals, (3) index status updates. Target total time under 10 minutes. Trigger phrases include "update the CRM with this transcript", "create a proposal", "move X to won/lost".
---

# CRM call transcript to live proposal

Do all steps without re-discovering the schema. Every ID and convention below was verified against production on 2026-08-05.

## 0. Connect to the database (30 seconds)

Direct Postgres, no MCP. Password is the `SUPABASE Password:` line in `.env.local`.

```js
import postgres from 'postgres'; // npm i postgres@3 in a scratch dir, NOT the repo
const sql = postgres(
  `postgresql://postgres.wwchefrgkkxmhlkntufm:${pw}@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`,
  { ssl: 'require', prepare: false }
);
```

**jsonb gotcha:** inserting `${JSON.stringify(obj)}::jsonb` via postgres.js stores a double-encoded
JSON *string*. After inserting, normalize:
`update <t> set metadata = (metadata #>> '{}')::jsonb where id = <id> and jsonb_typeof(metadata) = 'string'`

## 1. Fixed IDs (schema `company_os`)

| Thing | ID |
|---|---|
| Dave Hajdu (people.id, deal/meeting owner) | `a8bf026f-8c20-49c5-8a55-6fc5c580af64` |
| Sales pipeline `default-sales` | `012e2402-d519-4a42-a3eb-f9b5750d7823` |
| Stage: New | `09fed9f8-f98c-49f3-af80-551b19fb6150` |
| Stage: Discovery | `7c9ac18b-3cec-4580-ba26-8018d7cdef25` |
| Stage: Proposal | `bf28bc1f-cc7b-4c76-adfb-006250193f1a` |
| Stage: Contract Sent | `24117f90-29bf-400a-a66b-dc34d550676c` |
| Stage: Won / Lost | `dad9a5c6-3229-4596-b006-f8c24412f3fe` / `41c37454-f7fd-46e4-82f8-bcf5ffaf0740` |
| Service line: AI Consulting | `af7a49cd-df6e-45a5-ba6d-f3c0fffdf0fa` |

Other service lines exist in `service_lines` (human-tokens, staffing, retreats, certification).

## 2. CRM writes for a discovery call (one transaction)

Look up the person and company first (`people.full_name ilike`, `companies.name ilike`); they usually
already exist. Then write:

1. `meetings`: source `'manual'`, title, owner Dave, started_at/ended_at/duration, `summary` =
   markdown (`## Call Summary / Company Snapshot / Pain Points / What Was Discussed / BANT / Next Steps`),
   `metadata.transcript` = full raw transcript text.
2. `meeting_participants`: Dave role `'host'`, prospect role `'attendee'` (allowed: host/attendee/optional/absent).
3. `deals`: pipeline + stage Proposal, title `"<Company> - <thing>"`, person_id, company_id, owner Dave,
   amount_cents, currency (`aud`/`usd`), status `'open'`, source, service_line_id, expected_close_date,
   next_step, next_step_date, `proposal_url`, `metadata.bant`. Never one-deal-per-lead; only for real opportunities.
4. `meeting_links`: (`'company'`, company_id) and (`'deal'`, deal_id). Allowed entity_type: deal/company/project/inquiry/person.
5. `interactions`: kind `'call'` (allowed: note/call/email/meeting/message/status_change/system), subject,
   body = tight summary, person_id, company_id, subject_type `'deal'` + subject_id, owner Dave,
   `metadata: {source:'call_transcript', attendees:[...], meeting_id}`.
6. `lead` (keyed by person_id): status to `'open_deal'` (values in use: nurture/connected/open_deal/disqualified), owner Dave.
7. `companies`: lifecycle_stage to `'opportunity'` (path: lead > sql > opportunity > customer), append dated
   facts to `notes`; insert `lifecycle_transitions` (company_id, from_stage, to_stage, reason `'deal_created'`).
8. `people`: append a dated 2-3 line call outcome to `notes`.

When a deal is later won/lost: set deals.status + stage_id, closed_at, lost_reason
(price/competitor/no_decision/bad_fit/bad_timing/ghosted/other), company lifecycle to `customer` with a
`lifecycle_transitions` reason `deal_won`, person persona to `client`.

## 3. Proposal page (minutes, not hours)

- Copy `public/proposals/bstore-proposal.html` as the template; keep its CSS and section order:
  What we heard / The idea / The opportunity (callout) / The plan (money-back gate + phases) /
  What's in the box (80-20) / The investment (table) / Roles / Risks (3) / Build it with us (retreat) /
  Next step / footer EO note.
- Filename: `public/proposals/<client-slug>-proposal.html`. URL: `https://www.edge8.ai/proposals/<file>`.
  Put that URL in `deals.proposal_url`.
- **Brand rules:** "Edge8" is never all caps; the template's `.eyebrow` has `text-transform:uppercase`,
  remove it. No em dashes anywhere, ever (commas/colons/periods instead). `og:image` is
  `https://www.edge8.ai/social.jpg`. Keep `<meta name="robots" content="noindex, nofollow">`.
- Standard commercial reference points (confirm against the call before using): foundation A$15,000
  fixed with money-back roadmap gate, human tokens A$3,000 per 40-token pack, dedicated engineer
  US$4,000 to $6,000/month, running costs ~$70/month, AI Officer cert $99/seat/month list
  ($24.75 for EO members), private retreat from A$10,500.

## 4. Index page with Open / Won / Lost views

- `app/proposals/page.tsx` holds the `PROPOSALS` array (newest first) with a
  `status: "open" | "won" | "lost"` per entry; `app/proposals/proposals-tabs.tsx` is the client
  component rendering the three views (Open is default).
- New proposal = one new array entry. Won/lost = flip the entry's `status` AND update the
  matching `deals` row in the CRM.

## 5. Ship

Branch from `origin/main` (use a worktree if the checkout is dirty), stage only your files by name,
commit, push, `gh pr create`, merge with `gh pr merge --squash` once the Vercel check is green,
then verify the live URLs and reply with them:
`https://www.edge8.ai/proposals/` and `https://www.edge8.ai/proposals/<file>`.
