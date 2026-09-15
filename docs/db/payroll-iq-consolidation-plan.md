# Payroll IQ → Company OS database consolidation plan

Status: **reviewed and agreed** — drafted 2026-09-08, target corrected 2026-09-15,
authorisation model revised 2026-09-16
Scope: move the Payroll IQ database (Supabase project `vgwampgffykiuzsoyevn`, repo
`payroll-training-au`) into the **APA Company OS** Supabase project
(`nubxrrzwcbhgpvvmbioh`, repo `apa-company-os`), leave the Payroll IQ admin console
inside the Payroll IQ app, and define the pattern every future APA app follows to
attach to the one database.

> **Correction, 2026-09-15.** Every draft before this one named `wwchefrgkkxmhlkntufm`
> as the target. **That is Edge8's own internal company database, in a different Supabase
> organisation and a different region — not APA's.** APA's Company OS is
> `nubxrrzwcbhgpvvmbioh`, which is what the `apa-company-os` repo actually deploys
> against (confirmed from its Vercel production environment and
> `supabase/.temp/linked-project.json`). The confusion was easy to miss because **both
> projects have a `company_os` schema and an `htt` schema**, so a wrong ref looks right
> to every structural check. Tell them apart by organisation, region and data:
> `wwchef` is org `afazlvyacsijthammztl`, Singapore, 29 boards and 927 people;
> `nubxr` is org `lmprzbyhxbazwrrpdxrt` (the same org as payroll-iq), Sydney.
>
> Correcting the target also removed three risks earlier drafts carried: a Postgres
> 17 → 15 downgrade (both projects are 17), an Australian-payroll-data move from Sydney
> to Singapore, and mixing a client's customer data into Edge8's own tenant.

Sections: 1 what exists today · 2 target design · 3 connection method · 4 migration
plan · 5 code changes · 6 risks and decisions · 7 execution checklist.

---

## 1. What exists today (facts from both repos)

| | Company OS | Payroll IQ |
|---|---|---|
| Supabase project | `nubxrrzwcbhgpvvmbioh` ("apa-company-os") | `vgwampgffykiuzsoyevn` ("payroll-iq") |
| Supabase org / region | `lmprzbyhxbazwrrpdxrt` · ap-southeast-2 (Sydney) | `lmprzbyhxbazwrrpdxrt` · ap-southeast-2 (Sydney) |
| Postgres | **17.6** | **17.6** — same major, so the dump direction is supported |
| Compute | **Small** (2 GB RAM, 90 direct / 400 pooler) — raised from Micro 2026-09-15 | Micro |
| App schemas | `company_os` (153 tables), `htt` (9) — `public` is **empty** | `public` (34 tables) + `app_security` (RLS helper fns) |
| Schema source of truth | `supabase/01-schema.sql` pg_dump snapshot (15k lines), no `migrations/` dir | 26 migrations in `website/supabase/migrations/`, applied via MCP, ledger in `supabase_migrations` |
| RLS model | RLS on, **339 policies all `USING (true)`** for 3 chatbot roles only. Browser key has no grants. Everything goes through service role + app gates (`requireAdmin`, `requireTeamMember`, `requirePortalActor`) | **Real RLS**: 72 policies keyed on `auth.uid()` via `app_security.is_admin/is_org_member/owns_*`. `authenticated` has table grants, `anon` revoked everywhere |
| Identity spine | `company_os.people` (`auth_user_id` → auth.users), `company_os.admins` (email + `can_view_sensitive`), `team_members`, `portal_members` | `public.users.id` **is** `auth.users.id` (PK = FK, cascade). `role ∈ admin/manager/learner`. `organisations` is the tenant |
| Authorisation, after this work | `company_os.app_access` grants, read through `app_security.has_app_role()` — replaces both `company_os.admins` and `payroll_iq.users.role = 'admin'` (see 2.3) | same table, same function; `payroll_iq.users.role` collapses to `manager \| learner \| staff` |
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
Supabase project nubxrrzwcbhgpvvmbioh  (APA Company OS)
├── auth.*             shared user pool (one login for all APA apps)
├── storage.*          shared buckets, prefixed per app going forward
├── extensions.*       citext, pgcrypto, uuid-ossp, vector, pg_trgm
├── app_security.*     NEW shared: has_app_role() - the one authorisation contract
│                    every app calls. Backed by company_os.app_access (see 2.3).
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
  `company_os.companies`. App schemas reference them by
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

**Authorisation is a grant, not a table membership.** A single table records who may use which
app and in what capacity; every app's RLS asks one shared function.

> **Revised 2026-09-16, at the client's request.** Two earlier positions are superseded. The
> first draft proposed one shared admin list read from `company_os.admins` — rejected, correctly,
> because the Payroll IQ admins and the APA Company OS admins are different departments and one
> list would have given each department the other's access. The second draft therefore kept the
> two admin lists wholly separate — which left two sources of truth for "who is staff".
>
> **A grant table resolves both.** Membership is not the permission; the grant is. All admin
> records move into Company OS, and access to each app is an explicit row. The consoles stay
> where they are: Payroll IQ's `/admin` is **not** ported (see D7), it simply asks a different
> question about who is allowed in.

```sql
create table company_os.app_access (
  id         uuid primary key default gen_random_uuid(),
  person_id  uuid not null references company_os.people(id) on delete cascade,
  app        text not null check (app in ('company_os','payroll_iq')),
  role       text not null,                    -- app-defined: admin, sensitive, support…
  granted_by uuid references company_os.people(id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  note       text
);
-- One live grant per person/app/role; revocation is a timestamp, never a delete, so the
-- history of who held what and when survives.
create unique index app_access_live on company_os.app_access (person_id, app, role)
  where revoked_at is null;

-- The contract. Apps call THIS, never the table - so Company OS can restructure grants
-- without touching Payroll IQ's 88 policies.
create or replace function app_security.has_app_role(app_param text, role_param text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from company_os.app_access a
    join company_os.people p on p.id = a.person_id
    where p.auth_user_id = auth.uid()
      and a.app = app_param and a.role = role_param
      and a.revoked_at is null);
$$;
```

Each app then delegates, and that is the whole change:

| App | Gate becomes | Was |
|---|---|---|
| Payroll IQ | `payroll_iq.is_admin()` → `app_security.has_app_role('payroll_iq','admin')` | `payroll_iq.users.role = 'admin'` |
| Company OS `/admin` | `has_app_role('company_os','admin')` | `company_os.admins` matched **by email** (`lib/admin-auth.ts:41-45`) |
| Sensitive data | `has_app_role('company_os','sensitive')` | `company_os.admins.can_view_sensitive` boolean |

**Why this is cheap:** 88 of Payroll IQ's RLS policies call `app_security.is_admin()`, and
exactly one place inlines the role check — the body of `is_admin()` itself. Rewriting that one
function body flips all 88 policies at once. Verified by grep over the 26 migrations.

**Three consequences worth stating:**

1. **`payroll_iq.users.role` collapses to `manager | learner | staff`.** `admin` stops being an
   authorisation value. `staff` exists only so an APA admin's row can survive for attribution —
   `questions.authored_by`, `blueprints.uploaded_by`, `ingest_runs.triggered_by`,
   `audit_log.actor_id` and the rest are all `on delete set null`, so deleting those rows would
   not fail, it would **silently blank** who authored what. Ten inert rows are cheaper than
   losing provenance; revisit only if a staff row leaks into a learner count or export, which a
   `where role <> 'staff'` fixes. The `users_admin_is_orgless` constraint inverts into something
   simpler: every remaining user has an org.
2. **Every Payroll IQ admin needs a `company_os.people` row**, because `app_access.person_id`
   references it. That is a handful of people, and the collision report (4.5) is what tells you
   whether any of them already exist there under a different auth uid.
3. **Payroll IQ end users never touch `company_os.people`.** Learners are product users, not
   people APA has a relationship with, and thousands of them would swamp a 927-row CRM spine.
   Managers are clients: if they need a record at all it belongs against the customer
   organisation, which is what the optional `organisations.company_id` link below provides.

**Not chosen: JWT custom claims.** Putting app roles in `raw_app_meta_data` removes the join from
RLS, but a permission change then needs a token refresh to take effect and is much harder to
audit. For roughly ten admins the join is free — `has_app_role` is `stable`, so Postgres caches
it per statement. Revisit only if profiling says so.

The one genuinely shared thing is `auth.users` — one login per human, not one permission set per
human. That distinction is the whole design.

Optional and independent of the above: add `payroll_iq.organisations.company_id uuid
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
| `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL` | all | `https://nubxrrzwcbhgpvvmbioh.supabase.co` |
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

- **Done 2026-09-15: `nubxrrzwcbhgpvvmbioh` raised Micro → Small** (1 → 2 GB RAM, 60 → 90
  direct connections, 200 → 400 pooler connections; ~$10 → ~$15/month, billed hourly). The
  resize restarted the database for about 40 seconds. The pooler limit is the number that
  matters here: neither app uses direct Postgres connections for normal traffic, so a merged
  workload is bounded by PostgREST's pool, not by RAM. Review again a week after cutover.
- Enable the built-in Supavisor pooler stats and set an alert on connection saturation.
- `max_rows` is fine for both apps today. Any future bulk export uses `.range()` paging.

---

## 4. Migration plan

### 4.1 Preconditions

- **Direct DB access to the Payroll IQ project.** It has never had one. Reset the DB password
  in the Supabase dashboard (Settings → Database), connect on 5432 with `psql`. Company OS
  runbook rules apply: `psql`/`pg_dump` from `libpq` by absolute path, no Docker, no
  `supabase db dump`.
- APA Company OS project on the compute tier you want for launch. **Already done** — Small,
  see 3.4.
- A staging rehearsal: run steps 4.2 to 4.5 against a **Supabase branch** or a throwaway project
  first. The post-condition blocks and grant rewrites are where surprises live.

**No rollback plan, and that is deliberate.** Until the env flip, `payroll-iq` keeps serving
its own database untouched, so the two projects are live replicas and there is nothing to roll
back from — an abort before the flip costs nothing. The site is down during the flip, so no
customer writes land in the new database that the old one is missing. Reverting, if it ever
came to that, is the same env change backwards.

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
2. `app_security.<payroll-specific fn>` → `payroll_iq.<fn>`. Every Payroll IQ helper moves,
   including `is_admin` - nothing app-specific stays in the shared schema.
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

**Collision report, measured 2026-09-16** (this replaces the guess earlier drafts made):

| | count |
|---|---|
| `vgwampgffykiuzsoyevn` auth users | **40** (39 with a `public.users` row — one orphan) |
| `nubxrrzwcbhgpvvmbioh` auth users | **9** |
| **Same email in both** | **7** — i.e. 78% of the target's entire auth pool |
| Payroll IQ roles | 20 learner · 14 manager · 5 admin (3 orgless) |

Of the 7 collisions, **3 are Payroll IQ admins** (and so need `app_access` grants per 2.3) and
**4 are APA staff who also hold a learner or manager account** — they keep their Payroll IQ role
and get no grant. The other 2 Payroll IQ admins have no Company OS account at all and need a
`company_os.people` row created.

**Rule: the Payroll IQ `auth.users` row wins on email match.** Earlier drafts had this the other
way round, reasoning that Company OS stores its uid in one column while Payroll IQ threads it
through nineteen. That reasoning was right; the direction was wrong once the collision count
turned out to be seven rather than zero. Measured footprint:

| Side | Columns holding an auth uid | Rows actually affected |
|---|---|---|
| Company OS (`nubxr`) | `company_os.people.auth_user_id` (FK, unique) and `company_os.assistant_conversations.owner_auth_user_id` (no FK) | **4** people have a uid set; `assistant_conversations` is **empty** |
| Payroll IQ | 19 FK columns + 3 jsonb blobs + `storage.objects.owner`/`owner_id` | all 40 users, including every piece of content attribution |

The three other `auth_user_id` hits in `company_os` — `team_directory`, `current_team_members`,
`people_with_deals` — are **views** over `people`, so they follow automatically.

1. Insert the **33 non-colliding** Payroll IQ rows into `auth.users` and `auth.identities`
   verbatim: ids preserved, `encrypted_password` preserved.
2. For the **7 colliding** emails, replace the target's existing `auth.users` row with Payroll
   IQ's — delete the target's row and its `auth.identities`, insert Payroll IQ's. Every
   `payroll_iq` FK, jsonb blob and storage owner is then already correct and needs no rewriting.
3. Update `company_os.people.auth_user_id` to the Payroll IQ uid for those people — one UPDATE
   touching at most 4 rows. Create `people` rows for any Payroll IQ admin who has none.
4. Verify both directions:
   `select count(*) from payroll_iq.users u left join auth.users a on a.id=u.id where a.id is null` = 0, and
   `select count(*) from company_os.people p left join auth.users a on a.id=p.auth_user_id where p.auth_user_id is not null and a.id is null` = 0.

The 9 Company OS accounts are signed out once by this — which they were getting anyway, since the
project ref changes for them too.

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
| `.mcp.json` in payroll repo | `project_ref` → `nubxrrzwcbhgpvvmbioh` |
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
6. **`/admin` stays exactly where it is.** No files move. The 18 files under `src/app/admin`,
   `src/lib/admin/*` and `admin-nav.ts` keep working unchanged once their data access is
   schema-scoped by step 2 above — the console is the same, only the database underneath it
   moves. Manager and learner surfaces are likewise untouched.
7. `website/supabase/migrations/` → add a README line "history only; DDL now lives in
   apa-company-os".

### 5.2 `apa-company-os` (the platform)

1. `lib/supabase.ts`: export `payrollIq = supabase.schema("payroll_iq")`. This exists for
   cross-app reads the internal team genuinely needs (for example a billing or seat figure
   surfaced in a Company OS report), not for an admin console. Use it only inside
   `requireAdmin()`-guarded code, and prefer a view or function Payroll IQ publishes over raw
   table reads.
2. `supabase/config.toml`: add `payroll_iq` to schemas; add Payroll IQ redirect URLs.
3. `supabase/00-prereqs.sql`: add `pg_trgm`, `app_security` schema, three buckets.
4. `supabase/01-schema.sql` regenerated after cutover to include `payroll_iq` (or, better, the
   new `supabase/migrations/` baseline from 2.6 replaces the snapshot).
5. README and CLAUDE.md: table counts, the schema-per-app rule, the "public stays empty" rule,
   fix `ANON_KEY` naming, drop references to the non-existent `supabase/migrations/`.
6. `docs/db/data-dictionary.md`: add the `payroll_iq` schema section and rule 12: "app schemas
   reference `company_os.people` / `companies` by uuid; cross-app reads go through views or
   functions."

**Not in scope, and deliberately so:** there is no `app/admin/payroll-iq/*` section, no
"Payroll IQ" group in the Company OS admin nav, and no shared platform-admin function. See the
decision box in §2.3 — separate departments, separate staff, separate admin lists.

---

## 6. Risks and decisions

**Decisions this plan makes (change them here if you disagree):**

| # | Decision | Alternative rejected |
|---|---|---|
| D1 | Schema per app, `public` empty | Prefixed tables in `public` (`piq_users`): loses per-schema grants, breaks Payroll IQ's `search_path=''` functions less cleanly, and Company OS already chose schemas |
| D2 | Keep `payroll_iq.users.id = auth uid` | Introduce a `people_id` indirection now: touches every table at the riskiest moment. Do it later if ever |
| D3 | **Payroll IQ `auth.users` wins on email collision** (reversed 2026-09-16 on measured data) | Company OS winning: sounded right when the collision set was assumed near-empty, but it is **7 of the target's 9 users**, and remapping the Payroll IQ side means 19 FK columns + 3 jsonb blobs + 2 storage columns versus one UPDATE over at most 4 rows the other way |
| D4 | Bucket names unchanged | Prefixing now: rewrites stored paths and the ingest pipeline for no security gain |
| D5 | Company OS repo owns all DDL with a restored `supabase/migrations/` ledger | Each app owns its schema's migrations: two ledgers on one DB is how drift returns |
| D6 | Payroll IQ Vercel project, crons and Stripe webhook stay where they are | Folding the product app into the Company OS Next.js app: unrelated to the database goal, huge, and Company OS's public site vs app split is already strained |
| D8 | **Target is `nubxrrzwcbhgpvvmbioh` (APA Company OS), not `wwchefrgkkxmhlkntufm`** | Edge8's own company database: a different Supabase org, a different region, and a different company's data. See the correction note at the top |
| D9 | **No rollback procedure. Announce downtime, take the site down, flip, verify** | A staged cutover with write-divergence handling: unnecessary, because the source project stays intact and the downtime window means there are no divergent writes to reconcile |
| D10 | **Khoa emails the APA manager announcing the downtime. One message, no maintenance mode in the app** | Building a `platform_settings` maintenance gate and a proxy check: real work to avoid an email |
| D7 | **Admin CONSOLES stay separate — Payroll IQ keeps its own `/admin`, unported** (client decision, 2026-09-15, unchanged) | Porting fourteen admin route groups into Company OS: different departments run them, and the console is not what needed consolidating |
| D11 | **Admin RECORDS and authorisation unify into `company_os.app_access`, with a per-app grant** (client decision, 2026-09-16) | Two separate admin lists: leaves two sources of truth for "who is staff". A blanket shared list was rejected earlier for good reason — a grant table keeps departments separated *by row* while still having one place to look |
| D12 | **`company_os.admins` folds into `app_access` too; `requireAdmin()` reads `has_app_role`** | Only Payroll IQ reading the new table: you would build the grants screen anyway and still have two places to look. Folding also fixes the email-keyed match, which is mutable where `auth_user_id` is not |
| D13 | **`payroll_iq.users.role` collapses to `manager \| learner \| staff`; staff rows are kept, not deleted** | Deleting admin rows: the attribution FKs are `on delete set null`, so deletion silently blanks who authored each question rather than failing |

**Risks:**

- **Shared blast radius.** A runaway query or a bad migration in one app now degrades every
  app. Mitigation: statement timeouts on `authenticated` for `payroll_iq`
  (`alter role authenticated set statement_timeout` is project-wide, so instead set it per
  schema via a `pg_settings` hook is not possible; rely on PostgREST's `db-pool` timeout and
  compute headroom). Keep the chatbot roles' 5s timeouts. Treat this as the price of the
  centralisation the business asked for, and say so in the README.
- **One Auth config.** Email templates, SMTP, rate limits and `site_url` are shared. The
  redirect allow-list and explicit `emailRedirectTo` handle routing; branding is resolved by
  Payroll IQ sending its own reset mail through Resend rather than sharing a template.
- **Session logout at cutover** for every Payroll IQ user. Unavoidable — the `@supabase/ssr`
  cookie name is derived from the project ref. Covered by the downtime email (D10).
- **`e2-module-archives` size.** Objects copy one at a time through the API, so a 5 GB video
  bucket could take hours — and any of that time spent inside the window *is* the downtime.
  **Pre-copy it while payroll-iq is still live** and delta-sync during the window; module video
  barely changes, so the delta should be near zero and the downtime stays minutes.
- **Post-condition blocks** in the transformed dump may fail on the merged project for reasons
  unrelated to Payroll IQ (for example a policy count that now includes Company OS's). Rehearse
  on a branch.
- **PGRST106** if `config.toml` is not pushed. Verification in step 7 must include a REST call
  against `payroll_iq`, not just `psql`.
- **Payroll IQ Vercel preview deployments** now write to the production database of the whole
  company. Preview envs must point at a Supabase branch or a `payroll_iq` copy, never prod.

**Settled in review, 2026-09-15** (these were the open questions):

1. **Compute** — APA Company OS raised to Small before cutover. Done; see 3.4.
2. **Email branding** — Payroll IQ moves password reset onto Resend (see the auth doc,
   Correction 2), which removes the shared-template conflict entirely and leaves each product
   sending its own mail.
3. **Downtime comms** — Khoa emails the APA manager. One message, announcing the site will be
   down. No in-app maintenance mode is built.
4. **Cutover window** — Payroll IQ customers are AU business hours, so the window is outside
   them. The whole job is one run: preparation is staged, but the switch itself is a single
   env flip.
5. **Old project** — pause `vgwampgffykiuzsoyevn` at +14 days, delete at +60, and take a
   `pg_dump` to cold storage before deleting. Pausing is reversible; deleting is not.

---

## 7. Execution checklist (ticket-sized)

**Order of operations, agreed 2026-09-15.** Copy schema, data and storage into
`nubxrrzwcbhgpvvmbioh` while payroll-iq is still serving → Khoa emails the APA manager → site
down → delta-sync → flip `NEXT_PUBLIC_SUPABASE_URL` → verify → back up. One switch, staged
preparation. The flip is necessarily atomic: one Supabase project means one URL, one auth pool
and one set of keys, so the app cannot authenticate against one project while reading from the
other — the JWT is signed by whichever project issued it.

Phase 0 — prepare (no customer impact)
- [x] T0.0 Raise APA Company OS compute Micro → Small (done 2026-09-15)
- [ ] T0.1 Reset Payroll IQ DB password, confirm `psql` on 5432 works, record in password manager
- [ ] T0.2 Write `scripts/db/piq-to-schema.mjs` (dump transform + diff report)
- [ ] T0.3 Write `scripts/db/copy-storage.mjs` (bucket object copy with verification)
- [ ] T0.4 Write `scripts/db/merge-auth-users.sql` (remap table + FK-driven column update)
- [ ] T0.5 Rehearse 4.2 to 4.6 on a Supabase branch of the Company OS project; fix until green
- [ ] T0.6 Payroll IQ code: single client factory, schema scoping, env rename, types regenerated, behind env flag so it still works against the old project
- [ ] T0.7 Company OS: `payrollIq` export, config.toml schema + redirect URLs, prereqs (pg_trgm, app_security, buckets)
- [ ] T0.8 Restore `supabase/migrations/` in Company OS with baselines for `company_os`, `htt`, and `payroll_iq`

Phase 1 — cutover (announced downtime)
- [ ] T1.1 Pre-copy `e2-module-archives` objects **while payroll-iq is still live**
- [ ] T1.2 Khoa emails the APA manager announcing the downtime; take the site down; confirm `hubspot_outbox` drained
- [ ] T1.3 Dump, transform, apply, grant, expose (4.2–4.4)
- [ ] T1.4 Merge auth users (4.5); verify zero orphans
- [ ] T1.5 Delta-copy storage; verify counts
- [ ] T1.6 Flip Payroll IQ Vercel env to `nubxrrzwcbhgpvvmbioh`; redeploy. **This is the only irreversible-ish step, and reverting it is the same change backwards**
- [ ] T1.7 Verify: REST call to `payroll_iq` via publishable key returns RLS-filtered rows; learner login, quiz attempt, manager seat view, **Payroll IQ `/admin` still renders for a Payroll IQ admin**, Stripe test webhook, one cron run; Company OS `/admin` still 401s signed out, and a Payroll IQ admin is refused there
- [ ] T1.8 Unfreeze; announce the one-time sign-out

Phase 1b — unify authorisation (after the schema lands, see 2.3)
- [ ] T1b.1 `company_os.app_access` + `app_security.has_app_role()`; backfill the 8 `company_os.admins` rows as grants, `can_view_sensitive` as a `sensitive` grant
- [ ] T1b.2 Company OS `requireAdmin()` / sensitive gate read `has_app_role`; retire the email-keyed lookup
- [ ] T1b.3 Payroll IQ `is_admin()` delegates to `has_app_role('payroll_iq','admin')` — one function body, 88 policies
- [ ] T1b.4 `payroll_iq.users.role` → `manager | learner | staff`; invert `users_admin_is_orgless`; fix the `is_learner` logic that special-cased admins
- [ ] T1b.5 `company_os.people` rows for every Payroll IQ admin (a handful; the collision report from 4.5 says whether any already exist under a different uid)
- [ ] T1b.6 Company OS grants screen under `/admin`; Payroll IQ "no access here" page for a signed-in user without the grant

Phase 2 — close out (following weeks)
- [ ] T2.1 Optional `organisations.company_id → company_os.companies`
- [ ] T2.2 Preview-deploy isolation for Payroll IQ (Supabase branching)
- [ ] T2.3 Pause `vgwampgffykiuzsoyevn` (+14 d); `pg_dump` to cold storage, then delete (+60 d)
- [ ] T2.4 Docs: README, CLAUDE.md, data dictionary, architecture overview

The Payroll IQ admin **console** is never touched — no route moves, no page is ported. What
changes is the question it asks about who may enter.
