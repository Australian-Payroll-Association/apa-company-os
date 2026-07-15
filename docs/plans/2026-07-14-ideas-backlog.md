# Ideas Backlog — build plan

**Date:** 2026-07-14
**Status:** Built 2026-07-14 — migration applied, all four slices implemented, tsc + next build clean, live generation smoke-tested (office=operations, 22s). Awaiting Dave's push/merge.
**Owner:** Dave

**Env record:** `ANTHROPIC_API_KEY` is set in `.env.local` and Vercel Production (shared with the AI resume-screen feature). `IDEAS_CLAUDE_MODEL` is optional — `lib/ai/idea-plan.ts` defaults to `claude-sonnet-5`; set it (locally or on Vercel) only to override.

## Concept

Employees submit AI program ideas from the team portal. The submission page teaches the 5D framework from the A01 course (Mission 1: AI Program Planning) and walks them through the first four Ds — Define, Discover, Design, Determine. Deploy is deliberately omitted for v1 (submitters won't know deployment details yet).

On submit, Claude acts as Dan Shipper and turns the raw idea into a product plan, shown to the employee immediately and stored. It also classifies the idea into one of the four offices: **revenue, talent, operations, innovation** (mapped from the A01 Four Outcomes: Increased Revenue, Higher-Performing People, Cheaper Operations, Valuable Innovation).

Admins see a backlog: who submitted, when, the idea, its office, the generated plan, and a status they can move through review.

**5D source of truth:** `content-studio/educational-content/ai-officer-certification/agentic-courses/a01-ai-program-planning/a01-textbook.html`. Form copy should reuse the A01 language (workflows, program types, FAST goals) so the portal reinforces the course.

## Decisions (defaults — flag if wrong)

| Decision | Choice | Why |
|---|---|---|
| Voice input | Browser Web Speech API dictation (mic button per field) | Claude's API doesn't accept audio. Web Speech is free, no new vendor/key, works in Chrome/Edge/Safari; typing is the fallback on unsupported browsers. Whisper-style transcription can be added later if accuracy disappoints. |
| Admin location | New **Innovation** section: `/admin/innovation/ideas` | First page of the fourth office — matches the four-offices north star. (Alternative: park under Operations.) |
| Form shape | Guided 4-step form, one section per D | The page's job is to *teach* the framework; each section gets A01 helper text and a mic button. |
| Model | `claude-sonnet-5` via `@anthropic-ai/sdk`, model id in an env var so it's swappable | Plan generation is a single structured call; Sonnet is fast and cheap enough to run on every submission. |
| Generation timing | Synchronous in the submit request, with a loading state | Vercel functions allow 300s; one call takes ~15–30s. Idea is saved *before* the Claude call, so a generation failure never loses the submission. |

## 1. Database

New migration `supabase/migrations/<ts>_ideas_backlog.sql`, applied via Supabase MCP. One table:

```sql
create table company_os.ideas (
  id            uuid primary key default gen_random_uuid(),
  person_id     uuid not null references company_os.people(id),
  title         text not null,
  -- the four Ds captured from the form
  problem       text not null,      -- Define: who feels it, what it costs, why now
  data_needed   text not null,      -- Discover: datasources the AI would need
  workflow      text not null,      -- Design: high-level workflow description
  roi           text not null,      -- Determine: expected ROI / success measure
  -- Claude output
  office        text check (office in ('revenue','talent','operations','innovation')),
  ai_plan       text,               -- Dan Shipper product plan (markdown)
  ai_model      text,               -- model id used, for audit
  ai_error      text,               -- populated if generation failed
  status        text not null default 'new'
                check (status in ('new','in_review','approved','declined','archived')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists ideas_person_id_idx on company_os.ideas(person_id);
create index if not exists ideas_status_idx on company_os.ideas(status);
alter table company_os.ideas enable row level security;
grant select, insert, update, delete on company_os.ideas to service_role;
```

Notes:
- `person_id` references `people` (not `team_members`) — consistent with how the team portal resolves identity (`people.auth_user_id`), and survives employment-record changes.
- Explicit service_role grants + RLS-on-no-policies per the company_os access model (known gotcha).
- No `deploy` column — v1 skips the fifth D by design.

## 2. Claude integration (first LLM call in this app)

- Add `@anthropic-ai/sdk` to package.json.
- New env vars: `ANTHROPIC_API_KEY` (Vercel prod + preview + `.env.local`), `IDEAS_CLAUDE_MODEL` (default `claude-sonnet-5`).
- New `lib/ai/idea-plan.ts`: one exported function `generateIdeaPlan(idea)` that calls Messages API with:
  - **System prompt:** act as Dan Shipper (Every) — product-thinking, problem-first, concrete. Grounded in A01 vocabulary: restate the problem, pick a program type (Packaged AI / Automated Workflow / Agentic Workflow), sketch the workflow, propose a FAST goal and ROI framing, suggest a first build slice. Encourage the submitter — this doubles as teaching.
  - **Structured output** (tool use / JSON): `{ office: 'revenue'|'talent'|'operations'|'innovation', plan_markdown: string }`. Office classification instructions map the Four Outcomes → offices.
- Failure handling: catch, store `ai_error`, return the idea without a plan. Employee sees "your idea is saved; the plan is still generating" and admin can retry (v1 retry = simple server action that re-calls generation).

## 3. Team portal (employee side)

All under `app/team/(dashboard)/ideas/`, gated by `requireTeamMember()`:

- **`/team/ideas`** — the employee's own ideas: title, date, office badge, status. "Submit an idea" CTA. Card/link added to the team dashboard.
- **`/team/ideas/new`** — the guided 5D form (client component):
  - Intro block: what the 5D framework is, one line per D, link-out framing borrowed from A01.
  - Step 1 **Define the problem** — helper text: who feels it, what it costs (push for a number), why now.
  - Step 2 **Discover the data** — what information the AI needs and where it lives today.
  - Step 3 **Design the workflow** — high-level steps from trigger to output; where AI does the work vs. where a human stays in the loop.
  - Step 4 **Determine the ROI** — time saved / cost reduced / quality improved / speed increased, with a target number.
  - Plus a short **title** field.
  - Each textarea gets a mic button: Web Speech API (`SpeechRecognition`) dictates into the focused field; button hidden when the API is unavailable.
- **Submit flow:** server action → insert row → call `generateIdeaPlan` → update row → redirect to detail.
- **`/team/ideas/[id]`** — the payoff page: their four D answers plus the rendered Dan Shipper plan and office badge. Loading/generating state if the plan isn't ready.

## 4. Admin backlog

New office section + first feature, cloned from Vendors per `docs/engineering/admin-consistency-playbook.md`:

- Add **Innovation** to the admin sidebar nav.
- **`app/admin/(dashboard)/innovation/ideas/`** — `page.tsx` (DataTable: submitter, date, title, office badge, status; filter by office/status; search), `IdeaShelf.tsx` (client-owned shelf: full 5D answers, rendered AI plan, submitter link to person, status dropdown, retry-generation action), `actions.ts`, `ideas-shared.ts`.
- Status flow: `new → in_review → approved / declined`, plus `archived`. No notifications in v1.

## 5. Sequencing

| # | Slice | Verify |
|---|---|---|
| 1 | Migration applied via MCP + grants smoke-tested (select via service role) | MCP query returns rows |
| 2 | `lib/ai/idea-plan.ts` + env vars + SDK | One-off script call returns valid JSON plan |
| 3 | Team portal: form, dictation, submit flow, detail + list pages | `tsc --noEmit` + `next build`; manual prod test after merge (no dev server, per project convention) |
| 4 | Admin: Innovation nav + ideas backlog + shelf + status actions | same |

Local iteration, batched into PRs for Dave to push/merge (work-locally convention). `ANTHROPIC_API_KEY` must be added to Vercel envs before slice 3 merges — record the addition in env docs.

## Out of scope (v1)

- Deploy (5th D) capture
- Whisper/server-side transcription
- Notifications (email/Lark) on new ideas
- Employee editing or resubmitting ideas after generation
- Voting/commenting on ideas
