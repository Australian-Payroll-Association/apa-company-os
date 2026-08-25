# HANDOFF: Human Token Tracker to edge8 integration

**Written:** 2026-08-24. **Why:** the prior session was launched from the wrong repo
(`aiolabz-fe`); restarting rooted in `edge8-web`. All work below targets **edge8 only** and
nothing ever touched aiolabz. Resume from here with zero re-derivation.

## How to resume (read this first)

1. This branch has everything: `feat/htt-phase0` (pushed to origin). A dedicated worktree
   already exists at `~/code-projects/edge8-web-wt/htt-integration` checked out to it, and it is
   already `supabase link`ed to the edge8 project. Work there.
2. Read, in order: this file; `docs/plans/htt/2026-08-24-htt-build-plan.md` (the execution plan,
   decisions, deviations, credits formula); then the six `docs/plans/htt/recon/0*.md` fact files
   as needed (full DDL of both DBs + code seams). The governing design is the tracker repo's
   `docs/plans/2026-08-23-human-token-integration.md` (settled model, do not re-decide).
3. **Next action:** apply the two Phase 0 migration files (already authored, NOT yet applied) to
   the live edge8 DB, verify, then open the Phase 0 PR. Exact commands in "Current state" below.

## Systems and access (verified working)

- **edge8 Supabase** = project `wwchefrgkkxmhlkntufm` ("Edge8 Company Database"). Custom domain
  `db.edge8.ai`. Schema `company_os`.
  - **Read:** Supabase MCP (`mcp__supabase__execute_sql` / `list_tables`, project_id above). The
    MCP is **READ-ONLY** on this project (`permission denied for database postgres` on writes).
  - **Write/DDL:** `supabase db query --linked` run from the worktree (it runs as role `postgres`).
    The worktree is already linked (`supabase/.temp/project-ref` = the ref above). No DB password
    needed; the CLI authenticates via its keychain token ("Supabase CLI" service). Example:
    `cd ~/code-projects/edge8-web-wt/htt-integration && supabase db query --linked -f <file.sql>`.
- **Tracker Supabase** = project `znnnxubopsbvpvtvrtne` ("human-token-tracker"). Source of the
  Phase 2 data copy. Read via MCP. Its dashboard tables are in `public`; a second `tracker` schema
  (GitHub-App telemetry: work_spans, app_installations) is ingestion machinery, deferred to Phase 4.
- **Do NOT touch** the aiolabz projects: `chhnbwbtwnpvvsjuasun` (prod), `dqtchqofyvtwcjtzzruf`
  (staging). Unrelated to this work.
- **Source app being merged in:** `~/code-projects/human-token-tracker/website` (Next.js 16 +
  Supabase). edge8-web itself is **Next.js 14.2.29**, App Router, path alias `@/*` -> repo root (no `src/`).

## Ship + CI rules (edge8-web)

- Git: worktree off `origin/main`; stage files by name (never `git add -A`); never force-push;
  never `--no-verify`; delete merged branches/worktrees after.
- Brand: write "Edge8" exactly (never all-caps). **No em dashes anywhere.**
- Design: read `docs/product/edge8-design-system-data.md`; copy components from `/admin/patterns`
  (`components/admin/*`: PageHead, MetricCard, Badge+statusTone, DataTable, DetailDrawer, MoneyCell,
  BarChart, DonutChart); use `--admin-*` tokens; no raw hex/radius/shadow; Manrope only.
- **CI ("green") = 3 things:** `npm run check:design` passes, `npm run check:crons` passes, and the
  **Vercel preview build succeeds** (`next build` runs TS strict + eslint; that IS the typecheck,
  there is no GitHub Actions typecheck/test job, and no `tsc`/`test` npm script). Reproduce locally:
  `npm run check:design && npm run check:crons && npm run build`. `authorship-guard.yml` is advisory
  only; still add `<!-- author: dhajdu dave@edge8.co -->` to the PR body for token attribution.
- Migrations: commit each to `supabase/migrations/YYYYMMDDHHMMSS_*.sql` with an "Applied via ..."
  header AFTER applying via the CLI. New tables need `enable row level security` +
  `grant ... to service_role` (+ `grant select ... to supabase_read_only_user`).
- Verify a deploy with `curl` against `https://www.edge8.ai/...` (the in-app browser blocks edge8.ai).
- No dev server: verify with `npx tsc --noEmit` (optional) + `next build`.

## Settled model (summary) and deviations from the design doc

Model: AI Program = the Project (reuse `company_os.ai_programs`, many per company).
Spine **1 repo = 1 AI Program = 1 board = 1 roadmap**. `companies.is_ai_program` flag. GitHub
identity at 3 levels (company_github_orgs; ai_programs.github_repo; people.github_login +
person_git_emails). Tracker data moves into a new **`htt`** schema, re-pointed to
companies/people/ai_programs. Credits = Stripe `token_purchases` + manual `token_allocations`;
debits = tracked delivery. Group D kept, rolled up to the AI Program with per-repo drill-down.

Deviations (flagged for Dave; details in the build plan):
1. **Consolidated forward migration**, not a 45-file `public.`->`htt.` replay (safer, same end state).
2. **Phase order 0, 2, 3, 1, 4**, token win first; the roadmap/board re-key (Phase 1, 30+ live
   sites) is highest-risk and not required for the token DoD, so it is isolated last and done additively.
3. **htt column renames:** client_id->company_id, team_member_id->person_id, project_id->repo_id;
   `created_by` (was auth.users uuid) -> text.
4. The `tracker` schema + 4 burn/git-pull functions + `current_user_*`/`resolve_*` RLS helpers are
   NOT migrated in Phases 0-3 (ingestion-time; Phase 4). Portal computes from base tables directly.

## Credits balance (open item C: DEFAULT IMPLEMENTED, confirm with Dave)

```
credits (Bought) = SUM(company_os.token_purchases.tokens WHERE status='paid')   -- Stripe, additive
                 + current htt.token_allocations.tokens                          -- manual: highest seq per company (NULL tokens = removed)
delivered (human debit) = SUM(htt.man_hour_entries.hours WHERE status <> 'excluded')
balance = credits - delivered
AI leverage = SUM(htt.token_entries.amount WHERE kind IN ('claude','app')) / delivered_human_hours
Planned = SUM(company_os.client_backlog_items.token_high)  -- company grain until Phase 1 keys backlog to ai_program
```
Company grain, also viewable per AI Program (delivered/AI roll up from htt.repos; credits are the
company pool). Confirm this in the Phase 3 PR.

## Current state (per phase)

- **Phase 0, AUTHORED, NOT APPLIED.** Two migration files exist:
  - `supabase/migrations/20260824120000_htt_phase0_company_os.sql` (companies.is_ai_program;
    ai_programs repo fields; company_github_orgs; people.github_login; person_git_emails).
  - `supabase/migrations/20260824120001_htt_phase0_schema.sql` (the `htt` schema: repos + 14
    re-pointed data/Group-D/credits tables, `htt.set_updated_at` + triggers, indexes, CHECKs, RLS
    on, service_role grants).
  - Pre-flight checks PASSED on the live DB: `company_os.handle_updated_at` exists,
    `service_role` + `supabase_read_only_user` roles exist, `citext` installed, and every Phase 0
    object is confirmed net-new (no half-finished prior attempt).
  - **To finish Phase 0** (from the worktree):
    ```
    supabase db query --linked -f supabase/migrations/20260824120000_htt_phase0_company_os.sql
    supabase db query --linked -f supabase/migrations/20260824120001_htt_phase0_schema.sql
    ```
    Then verify: introspect `htt` (15 tables) + the new company_os columns/tables via MCP; run
    `npm run check:design && npm run check:crons && npm run build`. Then open the PR (docs + both
    migration files are already committed on this branch).
- **Phase 2, NOT STARTED. The crux is the tracker->edge8 identity map.** Build a mapping:
  tracker `clients`(5) -> `company_os.companies` (by name/domain), tracker `team_members`(14) ->
  `company_os.people` (by email/github_login), tracker `projects`(22 repos) -> create one
  `ai_programs` row + one `htt.repos` row each (join by github_repo). Then copy data into htt
  re-pointing ids. Volumes: 22 repos, 5341 PRs, 1133 token_entries, 268 man-hours, 7
  token_allocations, 56 goals, 42 summaries, 20 client_identities, 14 contributor_aliases (->
  company_os.person_git_emails, source='discovered'). Copy identity-sequence tables (project_goals,
  token_allocations) ordered by original seq so "latest wins" is preserved.
- **Phase 3, NOT STARTED.** Extend the EXISTING `/portal/tokens`
  (`app/portal/(dashboard)/tokens/page.tsx`, `lib/portal/tokens.ts` `getTokenBalance`) to
  Bought/Planned/Delivered/leverage, rolled up + per-AI-Program drill-down. Add `export const htt =
  supabase.schema("htt")` to `lib/supabase.ts`. Add the two intake questions (migrations for
  survey_fields + the onboarding post-submit handler in `lib/onboarding.ts`: github_login
  normalization after ~:111, person_git_emails upsert after ~:173, see recon/04). Add a "Tokens"
  nav item (`components/portal/PortalSidebar.tsx` NAV + layout entitlements). Reads go through
  `requirePortalMember()` + `companyOs`/`htt` service-role client scoped by `actor.companyScope`.
- **Phase 1, NOT STARTED (do last, additive, with tests).** Add `ai_program_id` to
  client_roadmap_overview/client_backlog_items/client_roadmap_groups (col `company_id`) and boards
  (col **`client_company_id`**, the naming exception), backfill from a default AI Program per
  company, migrate ~30 read/write sites program-aware (enumerated in recon/03 section 5).
  Multi-program companies (Australian Payroll: Fair Pay + PayrollIQ) need a human split decision.
- **Phase 4, CODE + RUNBOOK ONLY; STOP before secrets/auth/deletion.** Port the 2 edge functions
  + cron routes to write edge8 `htt` via service role; repoint hardcoded `human-tokens.com` URLs +
  default telemetry repo (all sites in recon/06 section 4); build htt versions of
  resolve_contributor/resolve_team_member. Then WRITE A RUNBOOK for Dave for: re-creating ~6
  CI/cron/edge secrets (recon/06 section 5), migrating tracker auth users, deleting the standalone
  login. Do NOT enter secrets, delete an auth system, or hard-delete data.

## Definition of done (from the task)

Phases 0-3 merged to main and verified live; intake collecting GitHub username + commit email; a
client (e.g. Australian Payroll Association) sees Bought/Planned/Delivered per AI Program in
`/portal`; Phase 4 delivered as code + a runbook. Report what shipped, what's behind the runbook,
and any deviation from the design doc.
