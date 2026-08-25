# Human Token Tracker to edge8 integration, build plan

**Date:** 2026-08-24
**Owner:** Dave
**Governing design:** `docs/plans/2026-08-23-human-token-integration.md` (the tracker repo's copy;
settled model, not re-decided here). This doc is the execution plan plus the reconciliations the
design doc left open. Recon evidence: `docs/plans/htt/recon/01..06`.

## Systems and how we reach them

- **edge8 Supabase** = project `wwchefrgkkxmhlkntufm` ("Edge8 Company Database"). Reads via the
  read-only Supabase MCP; **DDL/writes via `supabase db query --linked`** (runs as `postgres`)
  from this worktree, then the `.sql` is committed to `supabase/migrations/` with an
  "Applied via Supabase Management API (CLI --linked)" header, matching repo convention.
- **Tracker Supabase** = project `znnnxubopsbvpvtvrtne` ("human-token-tracker"). Source of the
  data copy (Phase 2). Its dashboard tables live in schema `public` (what migrates); a second
  `tracker` schema (GitHub-App telemetry: `work_spans`, `app_installations`, ...) is ingestion
  machinery, deferred to Phase 4.
- **edge8-web** repo (`talentedgeai/edge8-web`), Next.js 14.2.29, App Router, path alias `@/*` to
  repo root (no `src/`). Portal reads go through the service-role client `companyOs` in
  `lib/supabase.ts`, scoped by `PortalActor.companyScope` from `requirePortalMember()`
  (`lib/portal-auth.ts`). `company_os` has RLS on, no user-facing policies; app-code gates.

## Deviations from the design doc (flagged for review)

1. **Migration path: one consolidated forward migration, not a 45-file `public.`to`htt.` replay.**
   The tracker's 45 migrations carry heavy churn (dropped columns, re-created indexes, a backup
   table), an entire RLS layer coupled to `clients`+`team_members` (both dropped), and 4 functions
   that read the separate `tracker` schema. Replaying all that into edge8 drags along artifacts we
   are discarding. Instead we author the final-state `htt` schema directly (re-pointed FKs, final
   indexes/CHECKs, `htt.set_updated_at`), then copy data. End state is identical; the path is safe
   and reviewable.
2. **Phase order: 0, 2, 3, 1, 4.** The client-visible token win (Phases 0/2/3) ships first; the
   roadmap/board re-key (Phase 1) is the single highest-blast-radius change (30+ live read/write
   sites across admin/team/portal) and is **not required for the token DoD**, so it is isolated
   last among build phases and done additively. Phase 4 (ingestion cutover) stays last and is
   code + runbook only.
3. **htt column names re-pointed and renamed for the new model:** `client_id` to `company_id`
   (to `company_os.companies`), `team_member_id` to `person_id` (to `company_os.people`),
   `project_id` to `repo_id` (to `htt.repos`). The Phase-2 copy is a value-remapping transform
   regardless, so the rename adds no copy cost and removes "client_id holds a company id" confusion.
4. **`tracker` schema + the 4 burn/git-pull functions + the `current_user_*`/`resolve_*` RLS
   helpers are NOT migrated in Phases 0-3.** They are ingestion-time concerns; the portal computes
   Bought/Planned/Delivered from base tables directly. Phase 4 ports the ingestion (and needs
   `htt` versions of `resolve_contributor`/`resolve_team_member`, re-pointed to people +
   person_git_emails).
5. **Tables never migrated (dropped, per design):** `clients`, `team_members`, `invitations`,
   plus `notifications`/`subscriptions`/`chat_sessions`/`chat_messages` (these four are not even
   live in the tracker), and `man_hour_entries_backup_20260819` (a backup).

## Spine and target objects

```
company_os.companies (+ is_ai_program)
  company_os.company_github_orgs (company_id, org_login citext unique)     [new]
  company_os.ai_programs (+ repo_url, github_repo citext unique, github_repo_id bigint)
       htt.repos  (1:1 ai_program via ai_program_id unique; + company_id denorm)   [ex tracker projects]
            htt.pull_requests, token_entries, man_hour_entries, work_sessions,
            client_identities, contributor_aliases, pr_attribution_overrides, sync_runs
            Group D: roi_actuals, scenarios, project_goals, goal_events,
                     project_summaries, survey_invitations
company_os.people (+ github_login citext unique)
  company_os.person_git_emails (person_id, git_email citext, source, is_primary)   [new; ex contributor_aliases]
Credits (company grain): company_os.token_purchases (Stripe) + htt.token_allocations (invoice/manual)
```

Notes locked by recon:
- Roadmap/backlog/overview link to a company via `company_id`; **`boards` uses `client_company_id`**
  (the one naming exception). `client_roadmap_overview` PK is `company_id` (no surrogate id).
- `service_role` has no DELETE on `boards`/`tasks` (soft-delete via `archived_at`). New htt tables
  get `grant select, insert, update, delete ... to service_role` + `enable row level security`.
- `contributor_aliases` PK is `git_email`; it becomes `company_os.person_git_emails`
  (source='discovered' for migrated rows). Intake adds source='intake' rows.

## Credits balance (open item C, default implemented, confirm in PR)

At **company grain**, also viewable **per AI Program**:

```
credits (Bought) = SUM(company_os.token_purchases.tokens WHERE status='paid')          -- Stripe, additive
                 + current htt.token_allocations.tokens                                 -- manual/invoice
delivered (human, debit) = SUM(htt.man_hour_entries.hours WHERE status <> 'excluded')
balance = credits - delivered
```

- `token_allocations` is an append-only "current pack size" ledger: **current = the row with the
  highest `seq` per company; a NULL `tokens` on that row means the pack was removed** (not a sum of
  rows). So manual credits = latest-seq value, Stripe credits = sum of paid purchases.
- **Delivered = man_hour_entries.hours** (the de-overlapped true human hours), not
  `token_entries kind='human'` (session-derived, less authoritative for hours).
- **AI leverage** = `SUM(token_entries.tokens WHERE kind IN ('claude','app')) / delivered_human_hours`
  (AI tokens per human hour). Shown alongside; legend always carries the raw numbers.
- **Planned** = `SUM(client_backlog_items.token_high)` (edge8's per-item estimate), company grain
  for now; per-AI-Program once Phase 1 keys the backlog to `ai_program_id`. `tasks.human_tokens`
  is the finer admin estimate and can refine this later.
- **Per-AI-Program grain** rolls up from `htt.repos` (repo to ai_program is 1:1) for delivered/AI;
  credits are company-grained (purchases/allocations have no program) so the per-program view shows
  the company credit pool with a per-program delivered/planned split.

Question for Dave: confirm balance = paid purchases + current allocation - delivered man-hours,
computed at company grain (per-program shows the same credit pool, program-split delivery).

## Phase checklist

- **Phase 0 (this PR):** `companies.is_ai_program`; `ai_programs` repo fields;
  `company_os.company_github_orgs`; `people.github_login`; `company_os.person_git_emails`;
  `htt` schema + `repos` + all re-pointed tracking + Group D + `token_allocations` tables, with
  `htt.set_updated_at` + triggers, indexes, CHECKs, RLS on, service_role grants. Additive only;
  no data. Verified by introspection + `next build`.
- **Phase 2:** build tracker to edge8 identity map (clients to companies, team_members to people,
  projects to ai_programs/repos by github_repo/email/name), create AI Programs + repos, copy data
  into htt re-pointed. Small volumes (22 repos, 5341 PRs, 1133 token_entries, 268 man-hours).
- **Phase 3:** extend `/portal/tokens` (`lib/portal/tokens.ts`, `getTokenBalance`) to Bought /
  Planned / Delivered / leverage, rolled up with per-AI-Program drill-down; add the two intake
  questions (`people.github_login`, `person_git_emails`) + onboarding post-submit handler; add the
  Tokens nav item. New `htt` service-role client in `lib/supabase.ts`.
- **Phase 1 (last, careful, additive):** add `ai_program_id` to roadmap/backlog/overview + boards,
  backfill from a default AI Program per company, migrate read/write sites program-aware with tests.
  Multi-program companies (e.g. Australian Payroll: Fair Pay + PayrollIQ) need a human split
  decision, flagged.
- **Phase 4 (code + runbook, STOP before secrets/auth/deletion):** port the 2 edge functions + cron
  routes to write edge8 `htt` via service role; repoint hardcoded `human-tokens.com` URLs and the
  default telemetry repo; re-create ~6 CI/cron/edge secrets (runbook); migrate tracker auth users
  and delete the standalone login (runbook). Build the code; hand Dave the runbook for the
  secret/auth/deletion steps.
