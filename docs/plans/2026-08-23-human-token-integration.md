# Human Token Tracker → edge8 integration

**Status:** model agreed, not yet built. Decision doc.
**Date:** 2026-08-23
**Branch:** `human-token-integration`
**Owner:** Dave

## Why

Two problems, one root cause:

1. A client (Australian Payroll Association / Tracy) could not log into the Human Token
   Tracker. The tracker is a **separate app with its own Supabase Auth**, so it is a
   second login edge8 clients do not have. This is the symptom.
2. We want clients to **see their human tokens inside the edge8 client portal** (`/portal`),
   not in a separate product.

Goal: **one login (edge8's), one platform**, with human-token delivery numbers surfaced to
clients in the portal.

## What the two systems are

- **edge8** (`edge8-web`): Next.js App Router + one Supabase project. `/admin`, `/team`,
  `/portal` share the same Supabase Auth. Portal identity chain:
  `auth user → company_os.people (auth_user_id) → company_os.portal_members → PortalActor`
  scoped to `companies.id`. All portal data read server-side via a service-role client
  filtered by company scope. `company_os` has RLS enabled with **no policies** (app-code
  gating is the boundary).
- **Human Token Tracker** (`human-token-tracker/website`): same stack (Next.js 16 + Supabase
  + Vercel), **separate Supabase project**. Ingests Claude Code telemetry via a git
  `telemetry` branch → GitHub Actions → `/api/ingest` → Supabase Edge Functions. Measures
  two numbers per repo: **AI tokens** (Claude usage) and **human tokens** (active hours).
  Data is small (low thousands of rows).

## Naming: "project" means two different things

- **Tracker `projects`** = *one GitHub repo* (unique index on `github_repo`). Called a
  **repo** in this doc.
- **edge8 "Project"** (Dave's term) = a *delivery engagement* that owns exactly 1 Roadmap and
  1 Workboard. A repo is a thing a Project tracks, not the Project itself.

## Decisions (agreed)

1. **Human tokens** are the same unit on both sides: 1 token = 1 hour of skilled human work.
   Purchased tokens are **credits**; tracked delivered hours are **debits**.
2. **Credits come from two sources** and must both be kept: Stripe (`token_purchases`) and
   **invoice/manual** (`token_allocations`). Unify into one credits ledger with a `source`.
3. **Group D is client-critical** and is kept in full (goals, ROI, scenarios, summaries,
   surveys). Not optional.
4. **`is_ai_program` indicator on the client** (`companies`). If true: Human Token Tracker is
   on by default and the client must have **≥1 GitHub repo**. Repos are tracked in client info.
5. **The Project = an AI Program.** The existing `ai_programs` table is the Project layer
   (open item A resolved). A client can hold several: Australian Payroll Association runs
   **Fair Pay** and **PayrollIQ** as two separate AI Programs, each with its own repo.
6. **Spine is 1:1:1:1.** 1 repo = 1 AI Program = 1 Workboard = 1 Roadmap. A repo gets one
   board. Re-key Roadmap + Workboard from `company_id` to `ai_program_id`.
7. **Group D grain: both.** Clients see a rolled-up engagement summary with an optional
   per-repo drill-down. Stored at repo grain, rolled up to the AI Program.
8. **Fully transparent.** Clients see Planned vs Delivered in full (open item E resolved).
9. **Tracker scope = code only.** A repo is code development. Retreats and consulting are
   separate work, out of scope here; design is legacy, ignored (open item D resolved).
10. **Clients/people/programs are mastered in edge8.** The tracker's identity/entity tables are
    dropped and their references re-pointed to edge8's structures.

## Target model

```
companies  (+ is_ai_program)                         [master client, edge8]
  └─ ai_programs  (many per company)                 [Project layer = AI Program]
       ├─ Roadmap:   client_roadmap_overview (1:1)    ← re-keyed company_id → ai_program_id
       │             client_backlog_items   (many)    ← re-keyed company_id → ai_program_id
       ├─ Workboard: boards (1 per program)           ← re-keyed client_company_id → ai_program_id
       │             board_columns / sprints / tasks
       └─ repo  (exactly 1 per AI Program)            [tracker `projects`, re-pointed]
            ├─ pull_requests
            ├─ token_entries        (client + person denormalized)
            ├─ man_hour_entries
            ├─ work_sessions
            ├─ client_identities / contributor_aliases / pr_attribution_overrides
            └─ Group D:  project_goals · roi_actuals · scenarios ·
                         project_summaries · goal_events · survey_invitations

Credits ledger (company grain):  token_purchases (stripe) + token_allocations (invoice/manual)
```

**Key win:** every Group C and Group D table in the tracker already FKs to `project_id`
(= repo). Anchoring the repo grain brings all of Group D along for free; it rolls up to the
Project the same way tokens do.

## Table disposition (all 23 tracker tables)

**Drop (edge8 already owns):**
`clients` → `companies` · `team_members` → `people` + `portal_members` (role) +
`compensation` (rate) · `invitations` → portal invites · `notifications` · `subscriptions` ·
`chat_sessions` · `chat_messages`.

**Keep at repo grain (re-point FKs: client_id → companies.id, team_member_id → people.id,
project_id → new repo table):**
`projects` (→ repo table, + `project_id` = owning Project) · `pull_requests` ·
`token_entries` · `man_hour_entries` · `work_sessions` · `client_identities` ·
`contributor_aliases` · `pr_attribution_overrides` · `sync_runs`.

**Group D, repo grain, re-pointed:**
`roi_actuals` · `scenarios` · `project_goals` · `goal_events` · `project_summaries` ·
`survey_invitations`.

**Credits:** keep `token_allocations` (invoice/manual) alongside edge8 `token_purchases`
(Stripe); unify into one balance view. Do **not** drop `token_allocations`.

## Migration approach (phased)

Move the tracker's tables into a **dedicated schema** (e.g. `htt`) inside edge8's Supabase
project, not `public` — this sidesteps every table-name collision (`clients`, `projects`,
`team_members`, `notifications`, `subscriptions`, `pull_requests`, ...). Requires rewriting
the 42 migrations' `public.` prefixes and RPC/search_path references.

- **Phase 0 — schema.** Add `is_ai_program` to `companies`. Create the Project layer
  (open item A). Create `htt` repo + tracking + Group D tables with FKs to
  `companies`/`people`/Project.
- **Phase 1 — re-key roadmap + board to Project.** Create a default Project per existing client
  that has a roadmap/board; move `client_roadmap_overview`, `client_backlog_items`, `boards`
  onto it. Live-feature migration — needs care and QA.
- **Phase 2 — bring tracker data in.** Copy tracker rows into `htt`, re-pointing `client_id →
  companies.id`, `team_member_id → people.id`, `project_id → repo`. Assign each repo to its
  client's default Project initially.
- **Phase 3 — portal surface.** `/portal/tokens` (+ a per-Project view) shows Bought / Planned
  / Delivered + leverage ratio, rolled up with per-repo drill-down. Reads via `PortalActor`
  company scope + service-role client. Strip the tracker's `auth.uid()` RLS; gate through
  edge8's app-code model.
- **Phase 4 — re-home ingestion + retire the second login.** Redeploy the 2 Supabase Edge
  Functions to edge8's project, re-create ~6 CI/cron secrets, repoint hardcoded
  `human-tokens.com` URLs and the default telemetry repo. Migrate/re-invite tracker users into
  edge8 auth, then delete the tracker's standalone login.

Phases 0–3 give clients the visible win. Phase 4 is the riskier auth/pipeline cutover and comes
last.

## Resolved

- **A. Project layer.** The Project = an **AI Program**; reuse/extend `ai_programs`.
- **D. Non-code work.** Tracker scope is code only. Retreats/consulting are separate work, out
  of scope; design is legacy. The client view states that tracked delivery is code, so numbers
  are not read as total effort.
- **E. Exposure.** Fully transparent: clients see Planned vs Delivered.

## Open items (technical reconciliation, not decisions)

- **B. People / attribution reconciliation.** The tracker attributes by **`github_login`** and
  **git email**, which edge8's `people` does not store today. Need `people.github_login` (or a
  `people_git_identities` table for login + emails). `contributor_aliases` (git_email → person)
  and `team_members.default_rate_cents` map to `people` + `compensation`.
- **C. Credits unification.** Final shape of the one balance view over `token_purchases` +
  `token_allocations` (dedupe, currency, per-company vs per-AI-Program).

## Risks

- Table-name collisions (mitigated by the `htt` schema).
- Two auth/RLS philosophies; user migration across Supabase projects (Phase 4).
- Re-keying live roadmap/board features (Phase 1).
- Ingestion pipeline re-homing: edge functions, secrets, hardcoded URLs (Phase 4).
- Blast radius: folding a telemetry pipeline into the production edge8 deploy.

## Strategic note

Full absorption forecloses running the Human Token Tracker as a standalone product
(`human-tokens.com`, its own customers). If that standalone path still matters, stop at
shared-auth instead of full migration.
