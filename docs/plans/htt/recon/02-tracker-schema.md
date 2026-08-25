# Human Token Tracker: Supabase schema recon (02)

**Purpose:** ground-truth map of the Human Token Tracker DB (dashboard `public` schema)
ahead of migrating it into an edge8 `htt` schema.

- **Ground truth:** 45 migration files in
  `/Users/infinite-leverage/code-projects/human-token-tracker/website/supabase/migrations/*.sql`
  (task said 44; there are **45**).
- **Verified live** against Supabase project `znnnxubopsbvpvtvrtne` (the "tracker" project),
  MCP read-only, on 2026-08-24.
- **Two schemas live in this one DB:** `public` (the dashboard = HTT, what we migrate) and
  `tracker` (the GitHub-App telemetry channel, `work_spans`, `app_installations`, etc.).
  The `public` SECURITY DEFINER functions read cross-schema into `tracker`. `tracker` is a
  separate concern; this file maps `public`/HTT and flags the `tracker` dependency.

---

## 0. Table inventory & reconciliation

**19 non-backup base tables live in `public`** (+ 1 backup = 20 rows from
`information_schema.tables`). The task brief says "20 live tables"; the true count of
*non-backup* tables is **19**, the "20" only reconciles if you count the backup, or if you
count `project_repo_aliases` as a table (it is **not**, see gotcha below).

The plan names 23 tables. Reconciliation: **23 planned − 4 never-live = 19 live**, and those
19 are exactly the 19 non-backup live tables. Clean, no orphans.

| Plan table | In plan bucket | Live? | Rows |
|---|---|---|---|
| clients | DROP | ✅ live | 5 |
| team_members | DROP | ✅ live | 14 |
| invitations | DROP | ✅ live | 7 |
| notifications | DROP | ❌ **NOT live** (dropped) |, |
| subscriptions | DROP | ❌ **NOT live** (dropped) |, |
| chat_sessions | DROP | ❌ **NOT live** (dropped) |, |
| chat_messages | DROP | ❌ **NOT live** (dropped) |, |
| projects → repo | KEEP | ✅ live | 22 |
| pull_requests | KEEP | ✅ live | 5341 |
| token_entries | KEEP | ✅ live | 1133 |
| man_hour_entries | KEEP | ✅ live | 268 |
| work_sessions | KEEP | ✅ live | 0 |
| client_identities | KEEP | ✅ live | 20 |
| contributor_aliases | KEEP | ✅ live | 14 |
| pr_attribution_overrides | KEEP | ✅ live | 1 |
| sync_runs | KEEP | ✅ live | 612 |
| roi_actuals | GROUP-D | ✅ live | 0 |
| scenarios | GROUP-D | ✅ live | 0 |
| project_goals | GROUP-D | ✅ live | 56 |
| goal_events | GROUP-D | ✅ live | 2 |
| project_summaries | GROUP-D | ✅ live | 42 |
| survey_invitations | GROUP-D | ✅ live | 0 |
| token_allocations | CREDITS | ✅ live | 7 |

**Live tables NOT in the plan / flags:**
- `man_hour_entries_backup_20260819`, **backup table, 569 rows, RLS DISABLED** (flagged by
  Supabase advisor as fully exposed to anon/authenticated). Not in plan → **DROP, do not migrate.**
- `project_repo_aliases`, **NOT a table.** Migration `20260819010000_project_repo_aliases.sql`
  adds a **column** `projects.github_repo_aliases text[] not null default '{}'`. Any plan text
  treating it as a standalone table is wrong.

**No enums, no domains** anywhere in `public` (all categorical fields are `text` + CHECK).
**No standalone sequences**, only 2 identity sequences auto-owned by columns:
`project_goals_seq_seq` (project_goals.seq) and `token_allocations_seq_seq`
(token_allocations.seq), both `bigint GENERATED ALWAYS AS IDENTITY`; they travel with their
tables automatically.

---

## 1. Functions needing `public.` → `htt.` rewrite (CRITICAL: item 3)

**12 functions in `public`.** Every one either sets a `search_path` and/or hard-codes
`public.` prefixes; all must be recreated as `htt.*` and rewritten. Grouped by `search_path`:

### A. `SET search_path = public` (4 fns): change search_path to `htt`, and note they lean on DROP-bucket tables
| Function | `public.` refs in body | Notes for migration |
|---|---|---|
| `current_user_client_ids()` → setof uuid | `public.team_members` | **team_members is DROP** → repoint to `htt.people`/edge8 membership. SECURITY DEFINER. |
| `current_user_is_internal()` → bool | `public.team_members`, `public.clients` | **both DROP** → repoint to companies/people. SECURITY DEFINER. |
| `current_user_is_admin()` → bool | `public.team_members` | **DROP dep.** SECURITY DEFINER. |
| `current_user_can_admin_client(uuid)` → bool | `public.team_members` **+ unqualified** `current_user_is_internal()`, `current_user_is_admin()` | search_path=public makes the unqualified sibling calls resolve; if you flip search_path you must fully-qualify them to `htt.`. **DROP dep.** |

### B. `SET search_path = ''` with fully-qualified `public.` prefixes (7 fns): swap every `public.` → `htt.`; keep `tracker.` and `auth.`
| Function | `public.` refs | `tracker.` refs (cross-schema, preserve) | `auth.` refs |
|---|---|---|---|
| `resolve_team_member(text)` → uuid | `public.team_members`, `public.contributor_aliases` |, | `auth.users` |
| `resolve_contributor(text)` → uuid | `public.team_members`, `public.contributor_aliases` |, | `auth.users` |
| `resolve_team_member_by_login(text)` → uuid | `public.team_members` |, |, |
| `client_burnable_tokens(uuid)` → numeric | `public.projects`, `public.man_hour_entries`, `public.current_user_is_internal()`, `public.current_user_client_ids()` | `tracker.work_spans`, `tracker.projects`, `tracker.app_installations` |, |
| `client_burn_breakdown(uuid)` → table | `public.projects`, `public.man_hour_entries`, `public.current_user_*` | `tracker.work_spans`, `tracker.projects`, `tracker.app_installations` |, |
| `project_burnable_by_period(uuid,text,int)` → table | `public.projects`, `public.man_hour_entries`, `public.current_user_*` | `tracker.work_spans`, `tracker.projects`, `tracker.app_installations` |, |
| `project_pr_git_pulls(uuid)` → table | `public.projects`, `public.current_user_*` | `tracker.projects`, `tracker.work_spans` |, |

### C. `SET search_path = ''`, no table refs (1 fn)
| Function | Notes |
|---|---|
| `set_updated_at()` → trigger (plpgsql) | No schema refs (only `NEW.updated_at = now()`). No `public.` to rewrite, but it lives in `public` → recreate as `htt.set_updated_at()` and repoint all 8 triggers (below). |

**Cross-schema flag:** the 4 burn/git-pull functions join `tracker.work_spans` /
`tracker.projects` (join key `tracker.projects.repo_full = public.projects.github_repo`) and
`tracker.app_installations`. On migration these `tracker.*` refs must still resolve, open
question whether edge8 keeps a `tracker` schema or those tables move too.

**Grants to preserve:** `resolve_*` fns are `service_role`-only (revoked from
public/anon/authenticated). `current_user_*`, `client_burnable_tokens`,
`client_burn_breakdown` are granted to `authenticated`, revoked from anon/public.

---

## 2. Foreign-key re-point map (CRITICAL: item 5)

Every FK that references `public.clients`, `public.team_members`, or `public.projects`.
Re-point targets: **client_id → companies.id · team_member_id → people.id · project_id → repo**.
(`ON DELETE` from migrations shown; enforce equivalents on the edge8 side.)

| Table | FK column | References (current) | ON DELETE | Re-point to |
|---|---|---|---|---|
| team_members | client_id | clients.id | RESTRICT | companies.id *(team_members itself is DROP)* |
| projects | client_id | clients.id | RESTRICT | companies.id |
| token_entries | client_id | clients.id | RESTRICT | companies.id |
| man_hour_entries | client_id | clients.id | RESTRICT | companies.id |
| work_sessions | client_id | clients.id | CASCADE | companies.id |
| survey_invitations | client_id | clients.id | CASCADE | companies.id |
| token_allocations | client_id | clients.id | RESTRICT | companies.id |
| invitations | client_id | clients.id | NO ACTION | companies.id *(invitations is DROP)* |
| token_entries | team_member_id | team_members.id | SET NULL | people.id |
| man_hour_entries | team_member_id | team_members.id | RESTRICT *(NOT NULL later dropped)* | people.id |
| work_sessions | team_member_id | team_members.id | SET NULL | people.id |
| contributor_aliases | team_member_id | team_members.id | CASCADE | people.id |
| pull_requests | project_id | projects.id | CASCADE | repo.id |
| token_entries | project_id | projects.id | SET NULL | repo.id |
| man_hour_entries | project_id | projects.id | SET NULL | repo.id |
| work_sessions | project_id | projects.id | CASCADE | repo.id |
| roi_actuals | project_id | projects.id | CASCADE | repo.id |
| scenarios | project_id | projects.id | CASCADE | repo.id |
| client_identities | project_id | projects.id | CASCADE | repo.id |
| survey_invitations | project_id | projects.id | CASCADE | repo.id |
| project_summaries | project_id | projects.id | CASCADE | repo.id |
| project_goals | project_id | projects.id | CASCADE | repo.id |
| goal_events | project_id | projects.id | CASCADE | repo.id |
| pr_attribution_overrides | project_id | projects.id | CASCADE | repo.id |

**FKs that stay internal to HTT (not re-point targets, but note they cascade off `pull_requests`):**
- `token_entries.pull_request_id → pull_requests.id` (SET NULL)
- `pr_attribution_overrides.pull_request_id → pull_requests.id` (CASCADE)

**FKs to `auth.users` (Supabase auth, separate migration decision, not a named re-point target):**
`clients.created_by`, `team_members.{user_id,invited_by,created_by}`, `projects.created_by`,
`pull_requests.{author_human_user_id,created_by}`, `token_entries.created_by`,
`roi_actuals.created_by`, `scenarios.created_by`, `man_hour_entries.created_by`,
`invitations.invited_by`. These map to edge8 identity/`people`, TBD.

---

## 3. Per-table detail (columns, PK, unique, indexes, RLS)

Full column lists live in the live `list_tables` output; below is the migration-critical
layer (PK / uniques / indexes / RLS) plus notable columns. All 19 non-backup tables have
**RLS enabled**; the backup does not.

### DROP bucket

**clients** (5), PK `id`. Unique: `clients_slug_key(slug)`; partial unique
`clients_one_internal(is_internal) WHERE is_internal=true` (only one internal org). Index
`clients_status_idx(status)`. Trigger `clients_set_updated_at`. Cols incl. `human_hours_limit`,
`token_cost_per_million numeric(10,4) default 3.00`, `is_internal`, status CHECK
(prospect/active/ramping/paused/churned/archived). FK `created_by→auth.users`.

**team_members** (14), PK `id`. Unique constraint `team_members_user_client_unique(user_id,client_id)`;
partial unique `team_members_github_login_uniq(lower(github_login)) WHERE github_login IS NOT NULL`.
Indexes: user_status, client_status, client_role, `team_members_github_login_idx(lower(github_login))`.
Trigger `team_members_set_updated_at`. `user_id` is **nullable** (lightweight contributors).
role CHECK (super_admin/admin/member/contributor/guest), status CHECK
(invited/active/on_leave/contractor/suspended/departed). FKs client_id→clients,
user_id/invited_by/created_by→auth.users.

**invitations** (7), PK `id`. Partial unique
`invitations_one_pending_per_email_client(lower(email),client_id) WHERE status='pending'`.
No updated_at trigger. role CHECK (admin/contributor/member), status CHECK
(pending/accepted/revoked/expired). FKs client_id→clients, invited_by→auth.users.

*(notifications, subscriptions, chat_sessions, chat_messages, in migrations only, NOT live.)*

### KEEP (repo-grain)

**projects** (22) → **repo**, PK `id`. Partial uniques
`projects_github_repo_uniq(github_repo) WHERE NOT NULL`,
`projects_client_slug_uniq(client_id,slug) WHERE slug NOT NULL`. Index client_status.
Trigger `projects_set_updated_at`. Notable cols: `github_repo`, `github_repo_id bigint`,
`github_repo_aliases text[] default '{}'` (the "project_repo_aliases" migration),
`last_synced_at`, `live_url`, FAST-goal `roi_metric_*` (unit CHECK count/money/percent,
period CHECK monthly/quarterly/annual), status CHECK
(planned/active/ramping/paused/complete/archived). Note: `human_hours_limit` was added then
**dropped** (moved to clients). FK client_id→clients, created_by→auth.users.

**pull_requests** (5341), PK `id`. Unique `pull_requests_github_pr_id_uniq(github_pr_id)`
(PLAIN, not partial, required for ON CONFLICT; see migration 0013). Indexes:
project_idx(project_id,state), partial `pull_requests_project_head_branch_idx(project_id,head_branch)
WHERE head_branch NOT NULL`. Trigger `pull_requests_set_updated_at`. state CHECK
(open/merged/closed), status CHECK (tracked/verified/disputed/excluded). `head_branch` is the
branch-correlation join key. FKs project_id→projects (CASCADE),
author_human_user_id/created_by→auth.users.

**token_entries** (1133), PK `id`. Uniques (all PLAIN for ON CONFLICT):
`token_entries_session_kind_uniq(session_id,kind)`,
`token_entries_member_project_day_kind_uniq(team_member_id,project_id,occurred_on,kind)`;
partial `token_entries_app_project_day_source_uniq(project_id,occurred_on,source) WHERE kind='app'`.
Indexes: client_occurred, project_kind, pr, member, partial session_branch. Trigger present.
kind CHECK (human/claude/app), source CHECK
(pr_commit/pr_review/planning/design/research/manual/session/app). Idempotency keys:
`session_id`, `(team_member_id,project_id,occurred_on,kind)`. **Known NULL-member dedup gap**
(migration `20260615000000_null_proof_idempotency_keys.sql`): man_hour key was COALESCE-hardened,
token_entries daily key left PLAIN so the supabase-js upsert can infer it → NULL team_member_id
rows still escape dedup. FKs client_id→clients (RESTRICT), project_id→projects (SET NULL),
pull_request_id→pull_requests (SET NULL), team_member_id→team_members (SET NULL),
created_by→auth.users.

**man_hour_entries** (268), PK `id`. Partial unique (current)
`man_hour_auto_uniq(team_member_id,project_id,occurred_on) WHERE source='auto_session'`
,  **NOTE the churn:** original key was `(team_member_id,occurred_on,occurred_hour)`, then a
COALESCE(sentinel) form, dropped in `20260819000000`, re-created as the current
member+project+day form in `20260819020000`. Indexes: client_day, partial started_at. Trigger
present. `team_member_id` nullable. source CHECK (auto_session/manual), status CHECK
(recorded/approved/invoiced/paid/excluded). `hours numeric(6,2)`, `started_at` (precise git-pull
instant, human-token duration source). FKs client_id→clients, project_id→projects (SET NULL),
team_member_id→team_members (RESTRICT), created_by→auth.users.

**work_sessions** (0), PK `id`. Unique `work_sessions_member_session_uniq(team_member_id,session_id)`;
index contrib_day. **No updated_at trigger** despite having `updated_at`. `active_intervals jsonb
default '[]'`, `tokens_total bigint`. Additive/inert, nothing reads it yet. FKs client_id→clients
(CASCADE), project_id→projects (CASCADE), team_member_id→team_members (SET NULL).

**client_identities** (20), PK `id`. Indexes `client_identities_email_idx(lower(git_email))`,
`client_identities_login_idx(lower(github_login))`. No trigger. FK project_id→projects (CASCADE;
NULL = global exclude). RLS: internal-only ALL.

**contributor_aliases** (14), **PK is `git_email` (text)**, not a uuid id. FK
team_member_id→team_members (CASCADE, NOT NULL). No trigger. RLS: internal-only ALL.

**pr_attribution_overrides** (1), PK `id`. Partial unique
`pr_attribution_overrides_active_uniq(pull_request_id) WHERE revoked_at IS NULL` (one active
correction per PR); index project_idx. No trigger. kind CHECK (pair_session/manual_span),
`reason` CHECK non-empty. Append-only + soft revoke. FKs pull_request_id→pull_requests (CASCADE),
project_id→projects (CASCADE, denormalised). RLS SELECT internal-or-project-client.

**sync_runs** (612), PK `id`. No other indexes, no FKs, no trigger. `errors jsonb default '[]'`,
`backfill bool`. RLS: `sync_runs_internal_read` (SELECT, internal only); writes via service_role.

### GROUP-D

**roi_actuals** (0), PK `id`. Unique constraint `roi_actuals_project_period_uniq(project_id,recorded_for)`.
Trigger present. status CHECK (recorded/approved/disputed/excluded). FK project_id→projects (CASCADE),
created_by→auth.users. RLS rw internal-or-project-client.

**scenarios** (0), PK `id`. Index project_idx(project_id,status). Trigger present. impact CHECK
(low/med/high), status CHECK (active/complete/dropped/archived). FK project_id→projects (CASCADE),
created_by→auth.users. RLS rw internal-or-project-client.

**project_goals** (56), PK `id`. `seq bigint GENERATED ALWAYS AS IDENTITY` (→ seq
`project_goals_seq_seq`). Index `project_goals_latest(project_id,seq DESC)`. No trigger.
Append-only, latest-seq-wins. period CHECK (day/week/month/quarter), source CHECK
(stated/suggested/manual), quantity CHECK (null or >0). `state` (nullable) added later. FK
project_id→projects (CASCADE). RLS SELECT internal-or-project-client (role `public`).

**goal_events** (2), PK `id`. Index `goal_events_project_time(project_id,occurred_on DESC)`.
No trigger. count CHECK (>0). Matched to goal by (state,object). FK project_id→projects (CASCADE).
RLS SELECT internal-or-project-client (role `public`).

**project_summaries** (42), PK `id`. Unique constraint `project_summaries_project_id_kind_key
(project_id,kind)`. No trigger. kind CHECK (executive/latest_prs). Cache keyed by `source_key`.
FK project_id→projects (CASCADE). RLS SELECT internal-or-project-client.

**survey_invitations** (0), PK `id`. Unique constraint `survey_invitations_token_key(token)`;
index project_idx. No trigger. Single-use tokenized links; service-role writes. FKs
client_id→clients (CASCADE), project_id→projects (CASCADE). RLS ALL internal (role `public`).

### CREDITS

**token_allocations** (7), PK `id`. `seq bigint GENERATED ALWAYS AS IDENTITY` (→ seq
`token_allocations_seq_seq`). Index `token_allocations_client_seq_idx(client_id,seq DESC)`.
No trigger. Append-only, current = highest seq; `tokens` CHECK (>=0), null tokens = pack removed.
`set_by_email` from verified session. FK client_id→clients (RESTRICT). RLS SELECT
internal-or-own-client; **no write policy at all** (service-role only).

---

## 4. Triggers (8: all `set_updated_at` BEFORE UPDATE)

`clients`, `team_members`, `projects`, `pull_requests`, `token_entries`, `roi_actuals`,
`scenarios`, `man_hour_entries`. All call `set_updated_at()`. Must be recreated in `htt`
pointing at `htt.set_updated_at()`.

**Tables with `updated_at` but NO trigger** (updated_at only set on insert default): `work_sessions`.
Tables with no `updated_at` column: invitations, client_identities, contributor_aliases,
sync_runs, project_goals, goal_events, project_summaries, survey_invitations, token_allocations,
pr_attribution_overrides.

---

## 5. RLS helper dependency chain (migration ordering)

All RLS policies call `current_user_is_internal()` / `current_user_client_ids()` /
`current_user_can_admin_client()`, which read `team_members` + `clients` (both DROP-bucket).
**The entire RLS layer is coupled to the two tables being dropped**, repointing membership to
edge8 companies/people is the load-bearing step; every policy and the 4 `current_user_*`
helpers must be rewritten together or RLS breaks.

Policy shape summary (all `public` schema): internal-or-own-client on client-carrying tables
(clients, team_members, projects, token_entries, man_hour_entries, token_allocations);
internal-or-project's-client on project-carrying tables (pull_requests, roi_actuals, scenarios,
project_summaries, project_goals, goal_events, pr_attribution_overrides, survey_invitations);
internal-only (client_identities, contributor_aliases, sync_runs, survey_invitations,
invitations via `current_user_can_admin_client`). Several tables have **SELECT-only** policies
(no authenticated write), all writes go through server actions using service_role.

---

## 6. `tracker` schema (cross-schema dependency: NOT part of HTT, flag only)

Same DB, schema `tracker`, 10 tables: `app_installations`, `app_tokens`, `capture_flags`,
`engineer_keys`, `git_access_events`, `projects` (repo_id/repo_full), `pull_requests`,
`push_events`, `webhook_deliveries`, `work_spans` (span_start/span_end/tokens/pull_request_id/repo_id).
Referenced by 4 `public` functions via `tracker.projects.repo_full = public.projects.github_repo`.
Migration must ensure these still resolve from `htt`.
