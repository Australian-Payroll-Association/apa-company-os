# Payroll IQ → Company OS database consolidation plan

Status: **draft for review** — 2026-09-08
Scope: move the Payroll IQ database (Supabase project `vgwampgffykiuzsoyevn`, repo
`payroll-training-au`) into the Company OS Supabase project (`wwchefrgkkxmhlkntufm`,
repo `apa-company-os`), move the Payroll IQ admin console into Company OS `/admin`,
and define the pattern every future APA app follows to attach to the one database.

Sections: 1 what exists today · 2 target design · 3 connection method · 4 migration
plan · 5 code changes · 6 risks and decisions · 7 execution checklist.

---

## 1. What exists today (facts from both repos)

| | Company OS | Payroll IQ |
|---|---|---|
| Supabase project | `wwchefrgkkxmhlkntufm` | `vgwampgffykiuzsoyevn` |
| App schemas | `company_os` (141 tables), `htt` (9) — `public` is **empty** | `public` (34 tables) + `app_security` (RLS helper fns) |
| Schema source of truth | `supabase/01-schema.sql` pg_dump snapshot (15k lines), no `migrations/` dir | 26 migrations in `website/supabase/migrations/`, applied via MCP, ledger in `supabase_migrations` |
| RLS model | RLS on, **339 policies all `USING (true)`** for 3 chatbot roles only. Browser key has no grants. Everything goes through service role + app gates (`requireAdmin`, `requireTeamMember`, `requirePortalActor`) | **Real RLS**: 72 policies keyed on `auth.uid()` via `app_security.is_admin/is_org_member/owns_*`. `authenticated` has table grants, `anon` revoked everywhere |
| Identity spine | `company_os.people` (`auth_user_id` → auth.users), `company_os.admins` (email + `can_view_sensitive`), `team_members`, `portal_members` | `public.users.id` **is** `auth.users.id` (PK = FK, cascade). `role ∈ admin/manager/learner`. `organisations` is the tenant |
| Extensions | `citext`, `pgcrypto`, `uuid-ossp`, `vector` (in `extensions`) | `pg_trgm` only. No pgvector, no pg_cron |
| Storage buckets | avatars, event-media, gallery, marketing, id-documents, passports, resumes, meeting-transcripts, onboarding-plans, program-documents | blueprints, e2-module-archives (video, 5 GB), module-posters (public) |
| DB roles | `chatbot_reader`, `team_chatbot_reader`, `chatbot_writer` (direct pg, 5s timeouts) | none custom |
| Custom types | none (text + CHECK) | none (text + CHECK) |
| Client pattern | `lib/supabase.ts`: one service client, `companyOs = supabase.schema("company_os")` | 46 files each build an inline service client; browser/SSR clients typed against `public` |
| Schemas exposed to PostgREST | `public, graphql_public, company_os, htt` (`supabase/config.toml:8`) | default (`public`) |
| Cron | 18 Vercel crons | 4 Vercel crons (`invite-digest`, `cycle-milestones`, `notifications`, `billing`) |
| Stripe | present (orders/subscriptions in company_os) | webhook writes `organisations`, `invoice_records`, `hubspot_outbox` |

Two facts shape everything below:

1. **Company OS already runs the schema-per-app pattern** (`company_os`, `htt`). Payroll IQ
   becomes the third schema. No new architecture is invented.
2. **The two apps have opposite security postures.** Company OS is internal-only and trusts the
   service role. Payroll IQ is a customer-facing product with learners in the browser and must
   keep real RLS. Both postures can live in one project because grants and policies are
   per-schema.

---

## 2. Target database design

### 2.1 One project, one schema per app

```
Supabase project wwchefrgkkxmhlkntufm
├── auth.*             shared user pool (one login for all APA apps)
├── storage.*          shared buckets, prefixed per app going forward
├── extensions.*       citext, pgcrypto, uuid-ossp, vector, pg_trgm
├── app_security.*     NEW shared: cross-app helpers (is_platform_admin, current_person_id)
├── company_os.*       internal ops (unchanged)
├── htt.*              human token tracker (unchanged)
├── payroll_iq.*       Payroll IQ — the 34 tables + 1 view + RPCs + triggers, moved from public
└── public             stays EMPTY. Rule: no app table is ever created in public.
```

Rules for every current and future app:

- **One schema per app**, named after the product in `snake_case` (`payroll_iq`, later e.g.
  `roi_calculator`, `discovery_360` if they are split out). An app reads and writes only its own
  schema, except through explicit views or functions another schema publishes.
- **Cross-app reads go through views or functions, never raw tables.** Example: Company OS admin
  needs Payroll IQ org billing; Payroll IQ publishes `payroll_iq.admin_org_directory()` (already
  exists) and Company OS calls it. This keeps each app free to refactor its own tables.
- **Shared nouns live in one place.** People → `company_os.people`. Companies →
  `company_os.companies`. Platform admins → `company_os.admins`. App schemas reference them by
  `uuid` column plus an FK where the schema owner agrees to it (see 2.3).
- **Grants are the boundary, RLS is the row filter.**
  - `service_role`: full access to every app schema (server code).
  - `authenticated`: `USAGE` + table grants **only** on schemas that have real RLS (`payroll_iq`
    yes, `company_os` no).
  - `anon`: nothing, anywhere.
  - Chatbot roles: `company_os` only, unless a future ticket grants read on a specific
    `payroll_iq` view.
- **Every schema is listed in `supabase/config.toml` `[api].schemas`** or PostgREST returns
  PGRST106. This is the one step `psql` verification cannot catch.

### 2.2 `payroll_iq` schema contents

Straight lift of Payroll IQ `public`, renamed:

- 34 tables (organisations, users, invites, signup_prospects, topics, levels, modules,
  module_topics, module_transcripts, blueprints, questions, question_remediation,
  quiz_attempts, quiz_responses, topic_mastery, cycles, plans, plan_items, module_progress,
  watch_sessions, completions, seat_tiers, invoice_records, hubspot_outbox, discount_codes,
  pricing_events, chat_sessions, chat_messages, team_insights, audit_log, ingest_runs,
  ingest_items, platform_settings, notification_rules, notification_events).
- 1 view `topic_serving_readiness` (`security_invoker = true`).
- RPCs: `admin_org_directory`, `org_seat_usage`, `search_modules`, `touch_last_seen`,
  `set_updated_at`, `topics_one_level_deep`.
- 18 triggers, 63 indexes, 72 policies, the `modules.search` generated tsvector.
- Payroll-specific RLS helpers move **from `app_security` into `payroll_iq`**:
  `is_org_member`, `is_org_manager`, `learner_owns`, `owns_attempt`, `owns_cycle`,
  `owns_plan`, `manages_learner`, `org_seats_used`, `assert_org_within_seats`, the seat and
  billing guard trigger functions, `users_guard_privileged_columns`.

Name collisions with `company_os`: `audit_log`, `subscriptions`-adjacent billing tables and
`users`-like tables exist in both. **Schemas make this a non-issue**; nothing is renamed.

### 2.3 Identity: who is a user, who is an admin

Keep `payroll_iq.users.id = auth.users.id`. It is the cleanest possible bridge: the same uuid
identifies a person in `auth.users`, `payroll_iq.users`, and `company_os.people.auth_user_id`.

Two phases, so the cutover does not depend on an authorisation redesign:

**Phase 1 (cutover): keep Payroll IQ's `users.role` as-is.** `payroll_iq.is_admin()` still reads
`payroll_iq.users.role = 'admin'`. Zero behaviour change for learners and managers.

**Phase 2 (after cutover): platform admin = `company_os.admins`.**

```sql
-- shared, in app_security
create or replace function app_security.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from company_os.admins a
    join auth.users u on lower(u.email) = lower(a.email::text)
    where u.id = auth.uid()
  );
$$;
```

`payroll_iq.is_admin()` becomes `select app_security.is_platform_admin()`. The `role = 'admin'`
value on `payroll_iq.users` is then retired (constraint `users_admin_is_orgless` and the
`025`/`026` relaxations go with it). Result: one list of APA staff, managed once in Company OS
`/admin/admins`, honoured by every app's RLS.

Optional, recommended once Phase 2 lands: add `payroll_iq.organisations.company_id uuid
references company_os.companies(id)` so a Payroll IQ customer org links to the CRM company
record. Nullable, backfilled by email domain match, never required by the app.

### 2.4 Shared Auth consequences (one user pool)

- A Payroll IQ learner can technically load `/admin/login` on Company OS. Company OS gates
  (`requireAdmin`, `requireTeamMember`) already deny non-members. No change needed, but note
  that "sign in succeeded, then denied" is now a possible UX for cross-app users.
- **One `site_url`, one redirect allow-list, one set of email templates, one SMTP config** per
  project. Payroll IQ must pass `emailRedirectTo` explicitly on every auth call, and its
  domains must be added to the redirect allow-list in `supabase/config.toml` and the dashboard.
  Email template branding becomes shared: templates should be neutral APA branding, or
  Payroll IQ sends its own transactional mail via Resend after `generateLink()`.
- Auth rate limits, MFA settings, and JWT expiry are shared. Company OS has `jwt_expiry 3600`
  and confirmations off. Confirm Payroll IQ is happy with both before cutover.

### 2.5 Storage

Bucket names are project-global. There is no clash today (`blueprints`,
`e2-module-archives`, `module-posters` vs the ten Company OS buckets), so **existing bucket
names are kept** to avoid rewriting stored object paths. Convention going forward: new buckets
are prefixed with the app schema (`payroll_iq-...`).

`storage.objects` policies from Payroll IQ migrations `005` and `020` are re-applied in the
target, rewritten to reference `payroll_iq.is_admin()` instead of `app_security.is_admin()`.

### 2.6 Migration ownership going forward

Today neither repo has a healthy DDL workflow: Company OS has a pg_dump snapshot and 21 loose
patch files, Payroll IQ applies migrations by hand over MCP. The consolidated DB needs one owner.

- **`apa-company-os` owns the database.** Add `supabase/migrations/` back as the single ledger,
  with the file prefix naming the app: `2026MMDDHHMMSS_payroll_iq_<what>.sql`,
  `..._company_os_<what>.sql`, `..._shared_<what>.sql`.
- Baseline: one squash migration per existing schema (`company_os` + `htt` from the current
  dump, `payroll_iq` from the transformed dump in step 4.3). Mark them applied in
  `supabase_migrations.schema_migrations` without re-running.
- App repos (`payroll-training-au`) **do not run DDL**. They consume generated types from
  the owner repo (`supabase gen types --schema payroll_iq`) published as a small package or
  copied file. `website/supabase/migrations/` becomes read-only history.
- Keep the Payroll IQ post-condition style (`do $$ ... raise exception` at the end of each
  migration). It is the best drift guard either repo has.

---

## 3. Connection method

### 3.1 How an app connects (the pattern for all APA apps)

Every app gets exactly three clients, all pointed at the one project URL, each scoped to the
app's schema at construction time:

```ts
// lib/db/clients.ts  (per app; shown for Payroll IQ)
import { createClient } from "@supabase/supabase-js";
import { createBrowserClient, createServerClient } from "@supabase/ssr";
import type { Database } from "./types";          // generated with --schema payroll_iq

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SECRET = process.env.SUPABASE_SECRET_KEY!;      // server only

// 1. Service role — server code, bypasses RLS. Single factory, never inline.
export const serviceDb = createClient<Database, "payroll_iq">(URL, SECRET, {
  db: { schema: "payroll_iq" },
  auth: { persistSession: false },
});

// 2. Session-bound RLS client — server components / actions acting as the user.
export function rlsDb(cookies) {
  return createServerClient<Database, "payroll_iq">(URL, PUBLISHABLE, {
    db: { schema: "payroll_iq" }, cookies,
  });
}

// 3. Browser — auth + learner-facing reads under RLS.
export const browserDb = () =>
  createBrowserClient<Database, "payroll_iq">(URL, PUBLISHABLE, { db: { schema: "payroll_iq" } });
```

Why `db.schema` at construction rather than `.schema()` per call: it makes it impossible to
accidentally hit another app's tables from that client, and `.rpc()` inherits the schema. Company
OS's `lib/supabase.ts` already does the equivalent with `supabase.schema("company_os")`; both
forms are fine, the invariant is *one client, one schema*.

Cross-schema access from Company OS admin:

```ts
// apa-company-os/lib/supabase.ts — add alongside companyOs and htt
export const payrollIq = supabase.schema("payroll_iq");
```

used only inside `requireAdmin()`-guarded code.

### 3.2 Keys and environment

All apps share the same three values from the one project:

| Var | Who | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL` | all | `https://wwchefrgkkxmhlkntufm.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser + SSR | Payroll IQ code currently reads `NEXT_PUBLIC_SUPABASE_ANON_KEY`; standardise on `PUBLISHABLE_KEY` (Company OS README still says `ANON_KEY` in one place, fix that too) |
| `SUPABASE_SECRET_KEY` | server | Payroll IQ reads `SUPABASE_SERVICE_ROLE_KEY` in 46 files; standardise |

The publishable key is safe to share across apps **because `company_os` grants it nothing**.
Any app that later wants browser reads must earn them with real RLS on its own schema, the way
`payroll_iq` does.

### 3.3 Direct Postgres connections

Only the Company OS chatbots connect directly (three custom roles, 5s statement timeout,
`search_path = company_os`). Keep them on the transaction pooler (port 6543). Payroll IQ has no
direct pg path and should stay that way. Schema DDL runs on port 5432 only.

### 3.4 Compute and limits

Single project means shared compute, shared PostgREST `max_rows = 1000`, shared connection pool,
shared Auth rate limits. Actions:

- Upgrade compute one tier at cutover (current usage is unknown to this plan; the dashboard
  Reports tab tells you). Compute scales without downtime on Supabase Pro.
- Enable the built-in Supavisor pooler stats and set an alert on connection saturation.
- `max_rows` is fine for both apps today. Any future bulk export uses `.range()` paging.

---

## 4. Migration plan

### 4.1 Preconditions

- **Direct DB access to the Payroll IQ project.** It has never had one. Reset the DB password
  in the Supabase dashboard (Settings → Database), connect on 5432 with `psql`. Company OS
  runbook rules apply: `psql`/`pg_dump` from `libpq` by absolute path, no Docker, no
  `supabase db dump`.
- Company OS project on the compute tier you want for launch.
- A staging rehearsal: run steps 4.2 to 4.5 against a **Supabase branch** or a throwaway project
  first. The post-condition blocks and grant rewrites are where surprises live.

### 4.2 Dump Payroll IQ

```bash
PG=/opt/homebrew/opt/libpq/bin
# schema + data for the app, no owners/privileges (we re-grant explicitly)
$PG/pg_dump "$PIQ_URL" --schema=public --schema=app_security \
  --no-owner --no-privileges --format=plain > piq-app.sql
# auth users + identities for exactly the users Payroll IQ has
$PG/psql "$PIQ_URL" -c "\copy (select * from auth.users     where id in (select id from public.users)) to 'piq-auth-users.csv' csv header"
$PG/psql "$PIQ_URL" -c "\copy (select * from auth.identities where user_id in (select id from public.users)) to 'piq-auth-identities.csv' csv header"
# bucket definitions (objects are copied separately, see 4.6)
$PG/psql "$PIQ_URL" -c "\copy (select * from storage.buckets where id in ('blueprints','e2-module-archives','module-posters')) to 'piq-buckets.csv' csv header"
```

`auth.users` rows carry `encrypted_password`, so learners keep their passwords **if** they are
copied over pg, not via the Management API. Do this only in a maintenance window with Payroll
IQ writes frozen (Vercel env `MAINTENANCE=1` or pause the project).

### 4.3 Transform the dump → `payroll_iq`

A scripted rewrite (`scripts/db/piq-to-schema.mjs`, to be written), not hand edits:

1. `CREATE SCHEMA public` → `CREATE SCHEMA payroll_iq`; every `public.` qualifier →
   `payroll_iq.`, **including inside function bodies** (all Payroll IQ functions use
   `set search_path = ''` and fully qualify, so a textual rewrite is safe and complete).
2. `app_security.<payroll-specific fn>` → `payroll_iq.<fn>`; keep only `is_platform_admin`
   style shared functions in `app_security` (Phase 2).
3. Unqualified `create table signup_prospects` → qualified.
4. `pg_policies where schemaname = 'public'` and similar assertions → `'payroll_iq'`.
5. Drop the schema-wide `anon` revoke / default-privilege statements; replace with the
   per-schema grant block in 4.4.
6. `storage.objects` policies: `app_security.is_admin()` → `payroll_iq.is_admin()`.
7. Verify with a diff report: table count 34, function count, policy count 72, trigger count 18,
   index count 63 before and after.

### 4.4 Apply to Company OS project

Order matters, same reasons as the Company OS runbook:

```sql
-- 0. extensions and shared schema
create extension if not exists pg_trgm with schema extensions;
create schema if not exists app_security;
grant usage on schema app_security to authenticated, service_role;

-- 1. payroll_iq DDL + data (the transformed dump), ON_ERROR_STOP=1

-- 2. grants: the boundary
grant usage on schema payroll_iq to authenticated, service_role;
grant all on all tables    in schema payroll_iq to service_role;
grant all on all sequences in schema payroll_iq to service_role;
grant select, insert, update, delete on all tables in schema payroll_iq to authenticated;
grant usage, select on all sequences in schema payroll_iq to authenticated;
alter default privileges in schema payroll_iq grant all on tables to service_role;
alter default privileges in schema payroll_iq grant select, insert, update, delete on tables to authenticated;
-- anon gets nothing: no grant is the revoke. Nothing is granted to chatbot roles.

-- 3. expose the schema
--    supabase/config.toml: schemas = ["public","graphql_public","company_os","htt","payroll_iq"]
--    then `supabase config push` (or dashboard → API → Exposed schemas)
```

Then re-run every Payroll IQ post-condition block against the new schema as a verification
script. They were written to catch exactly this class of drift.

### 4.5 Auth users: merge, don't just insert

Some people exist in **both** projects (APA staff who are Payroll IQ admins and Company OS
team members). Rule: **Company OS `auth.users` wins on email match**.

1. Build `migration.uid_remap(old_uid, new_uid)` from `piq-auth-users.csv` joined to target
   `auth.users` on `lower(email)`.
2. Insert the non-colliding rows into `auth.users` and `auth.identities` verbatim (ids
   preserved, `encrypted_password` preserved).
3. For colliding rows, update every `payroll_iq` column that stores a user id
   (`users.id`, `invites.invited_by`, `organisations.created_by`, `*.learner_id`, `*.user_id`,
   `blueprints.uploaded_by`, `audit_log.actor_id`, `chat_sessions.user_id`, …) via the remap
   table. Generate the column list from `information_schema.columns` where the column has an FK
   to `payroll_iq.users` or `auth.users`; do not hand-type it.
4. Stamp `company_os.people.auth_user_id` for staff who now share a uid.
5. Verify: `select count(*) from payroll_iq.users u left join auth.users a on a.id=u.id where a.id is null` = 0.

Password hashes copy with the row, so **no forced reset**. Sessions and refresh tokens do not
copy: every Payroll IQ user is signed out once at cutover. Announce that.

### 4.6 Storage objects

Bucket rows come from `piq-buckets.csv`. Objects are copied with a script using both projects'
service keys: list → download → upload, preserving paths. `e2-module-archives` holds video up to
5 GB per object; run it first and in the background, it dominates the window. Verify object
counts and a checksum sample per bucket. Company OS `00-prereqs.sql` gains the three buckets so
a fresh install also has them.

### 4.7 External state

| Item | Action |
|---|---|
| Stripe webhook | Endpoint URL is the Payroll IQ Vercel app, unchanged. Rotate nothing. Confirm `hubspot_outbox` has no pending rows at freeze (or carry them; do not replay delivered ones) |
| Stripe customer/subscription ids | Live on `payroll_iq.organisations`, tied to the Stripe account, not Supabase. Nothing to do |
| `platform_settings` | Runtime config, copied as data. Do **not** re-seed defaults (`chat.research_enabled` must stay false) |
| Vercel crons | Stay in the Payroll IQ Vercel project. Only env changes |
| `.mcp.json` in payroll repo | `project_ref` → `wwchefrgkkxmhlkntufm` |
| Supabase Auth URL config | Add Payroll IQ prod/preview domains to redirect allow-list |
| Old project | Pause after 14 days of clean operation; delete after 60 |

---

## 5. Code changes

### 5.1 `payroll-training-au` (the product app)

1. **One client module** (`src/lib/supabase/clients.ts` already brands `RlsClient` /
   `ServiceClient`; make it the only mint site). Replace the 46 inline
   `createClient(url, SERVICE_ROLE_KEY)` calls with the `serviceDb` factory. This is the largest
   diff and is mechanical; do it with a codemod and a lint rule that bans importing
   `@supabase/supabase-js` outside that module.
2. **Schema on every client**: `db: { schema: "payroll_iq" }` in browser, server, proxy and
   service factories. `.rpc()` calls need no change once the client is schema-scoped.
3. **Regenerate `src/lib/db/types.ts`** with `--schema payroll_iq` and change the generic
   parameter (`Database["payroll_iq"]`). TypeScript then catches any missed `public` reference.
4. **Env rename**: `SUPABASE_SERVICE_ROLE_KEY` → `SUPABASE_SECRET_KEY`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Update
   `.env.local`, `.env.example`, Vercel.
5. **Auth calls**: audit every `signInWithOtp` / `resetPasswordForEmail` / `inviteUserByEmail`
   for an explicit `redirectTo` on the Payroll IQ domain.
6. **Remove `/admin`** (18 files under `src/app/admin`, `src/lib/admin/*`, `admin-nav.ts`)
   once 5.2 ships. Until then leave it, gated as today. Manager and learner surfaces are
   untouched.
7. `website/supabase/migrations/` → add a README line "history only; DDL now lives in
   apa-company-os".

### 5.2 `apa-company-os` (the platform and admin)

1. `lib/supabase.ts`: export `payrollIq = supabase.schema("payroll_iq")`.
2. New admin section `app/admin/payroll-iq/*` ported from Payroll IQ's `/admin/*`: modules,
   taxonomy, questions, ingest, blueprints, coverage, continuity, notifications, activity,
   users/orgs, billing, admins. Data modules from `payroll-training-au/website/src/lib/admin/*`
   port almost verbatim: swap the inline service client for `payrollIq`, swap `requireAdmin()`
   for Company OS's `requireAdmin()` from `lib/admin-auth.ts`. Server actions keep Payroll IQ's
   `guard()` shape. Storage actions (blueprints upload, posters) use the base client, buckets
   unchanged.
3. Admin nav: add a "Payroll IQ" group. Sensitive data rule: billing and invoice views sit
   behind `can_view_sensitive`, consistent with the data dictionary.
4. `supabase/config.toml`: add `payroll_iq` to schemas; add Payroll IQ redirect URLs.
5. `supabase/00-prereqs.sql`: add `pg_trgm`, `app_security` schema, three buckets.
6. `supabase/01-schema.sql` regenerated after cutover to include `payroll_iq` (or, better, the
   new `supabase/migrations/` baseline from 2.6 replaces the snapshot).
7. README and CLAUDE.md: table counts, the schema-per-app rule, the "public stays empty" rule,
   fix `ANON_KEY` naming, drop references to the non-existent `supabase/migrations/`.
8. `docs/db/data-dictionary.md`: add the `payroll_iq` schema section and rule 12: "app schemas
   reference `company_os.people` / `companies` by uuid; cross-app reads go through views or
   functions."
9. Phase 2 migration: `app_security.is_platform_admin()`, `payroll_iq.is_admin()` delegation,
   retire `users.role = 'admin'`.

---

## 6. Risks and decisions

**Decisions this plan makes (change them here if you disagree):**

| # | Decision | Alternative rejected |
|---|---|---|
| D1 | Schema per app, `public` empty | Prefixed tables in `public` (`piq_users`): loses per-schema grants, breaks Payroll IQ's `search_path=''` functions less cleanly, and Company OS already chose schemas |
| D2 | Keep `payroll_iq.users.id = auth uid` | Introduce a `people_id` indirection now: touches every table at the riskiest moment. Do it in Phase 2 if ever |
| D3 | Company OS auth user wins on email collision | Payroll IQ wins: would orphan `company_os.people.auth_user_id` and team logins |
| D4 | Bucket names unchanged | Prefixing now: rewrites stored paths and the ingest pipeline for no security gain |
| D5 | Company OS repo owns all DDL with a restored `supabase/migrations/` ledger | Each app owns its schema's migrations: two ledgers on one DB is how drift returns |
| D6 | Payroll IQ Vercel project, crons and Stripe webhook stay where they are | Folding the product app into the Company OS Next.js app: unrelated to the database goal, huge, and Company OS's public site vs app split is already strained |
| D7 | Platform admin unified into `company_os.admins` in Phase 2, not at cutover | Doing it at cutover couples a data move to an auth redesign |

**Risks:**

- **Shared blast radius.** A runaway query or a bad migration in one app now degrades every
  app. Mitigation: statement timeouts on `authenticated` for `payroll_iq`
  (`alter role authenticated set statement_timeout` is project-wide, so instead set it per
  schema via a `pg_settings` hook is not possible; rely on PostgREST's `db-pool` timeout and
  compute headroom). Keep the chatbot roles' 5s timeouts. Treat this as the price of the
  centralisation the business asked for, and say so in the README.
- **One Auth config.** Email templates, SMTP, rate limits and `site_url` are shared. The
  redirect allow-list and explicit `emailRedirectTo` handle routing; branding needs a decision
  (neutral APA templates, or app-sent mail via Resend).
- **Session logout at cutover** for every Payroll IQ user. Unavoidable; communicate.
- **`e2-module-archives` size.** Copy window could be hours. Start it before the freeze; the
  freeze then only re-syncs the delta.
- **Post-condition blocks** in the transformed dump may fail on the merged project for reasons
  unrelated to Payroll IQ (for example a policy count that now includes Company OS's). Rehearse
  on a branch.
- **PGRST106** if `config.toml` is not pushed. Verification in step 7 must include a REST call
  against `payroll_iq`, not just `psql`.
- **Payroll IQ Vercel preview deployments** now write to the production database of the whole
  company. Preview envs must point at a Supabase branch or a `payroll_iq` copy, never prod.

**Open questions for Khoa:**

1. Compute tier target at cutover, and whether the Payroll IQ Pro-plan add-ons (compute,
   storage egress) transfer or the Company OS project's plan needs upgrading.
2. Email branding: shared neutral templates, or app-sent mail?
3. Does the internal team want Payroll IQ admin under `/admin/payroll-iq` in Company OS, or as
   a top-level "Products" area that will also hold ROI calculator, Discovery 360, and future apps?
   The plan assumes the latter is where this ends up; naming now saves a rename.
4. Cutover window: Payroll IQ customers are AU business hours. Sunday 02:00 AEST is the obvious
   slot.

---

## 7. Execution checklist (ticket-sized)

Phase 0 — prepare (no customer impact)
- [ ] T0.1 Reset Payroll IQ DB password, confirm `psql` on 5432 works, record in password manager
- [ ] T0.2 Write `scripts/db/piq-to-schema.mjs` (dump transform + diff report)
- [ ] T0.3 Write `scripts/db/copy-storage.mjs` (bucket object copy with verification)
- [ ] T0.4 Write `scripts/db/merge-auth-users.sql` (remap table + FK-driven column update)
- [ ] T0.5 Rehearse 4.2 to 4.6 on a Supabase branch of the Company OS project; fix until green
- [ ] T0.6 Payroll IQ code: single client factory, schema scoping, env rename, types regenerated, behind env flag so it still works against the old project
- [ ] T0.7 Company OS: `payrollIq` export, config.toml schema + redirect URLs, prereqs (pg_trgm, app_security, buckets), admin section ported and reviewed against a branch DB
- [ ] T0.8 Restore `supabase/migrations/` in Company OS with baselines for `company_os`, `htt`, and `payroll_iq`

Phase 1 — cutover (maintenance window)
- [ ] T1.1 Pre-copy `e2-module-archives` objects
- [ ] T1.2 Freeze Payroll IQ writes; confirm `hubspot_outbox` drained
- [ ] T1.3 Dump, transform, apply, grant, expose (4.2–4.4)
- [ ] T1.4 Merge auth users (4.5); verify zero orphans
- [ ] T1.5 Delta-copy storage; verify counts
- [ ] T1.6 Swap Payroll IQ Vercel env to the Company OS project; redeploy
- [ ] T1.7 Verify: REST call to `payroll_iq` via publishable key returns RLS-filtered rows; learner login, quiz attempt, manager seat view, Stripe test webhook, one cron run; Company OS `/admin/payroll-iq` renders and `/admin` still 401s signed out
- [ ] T1.8 Unfreeze; announce the one-time sign-out

Phase 2 — unify (following weeks)
- [ ] T2.1 `app_security.is_platform_admin()`; `payroll_iq.is_admin()` delegates; retire `users.role='admin'`
- [ ] T2.2 Remove `/admin` from the Payroll IQ app
- [ ] T2.3 Optional `organisations.company_id → company_os.companies`
- [ ] T2.4 Preview-deploy isolation for Payroll IQ (Supabase branching)
- [ ] T2.5 Pause old project (+14 d), delete (+60 d)
- [ ] T2.6 Docs: README, CLAUDE.md, data dictionary, architecture overview
