-- Beryl ROI Calculator (company_os Build C)
-- Two new tables + the Beryl product seed. Additive and idempotent.
-- Apply via the session-mode pooler (port 5432), or fold into the schema dump.
-- Convention: company_os schema, uuid PKs, _cents money, RLS enabled with NO app
-- policies — the public never touches the DB; all access is via the service-role
-- client behind server routes, which bypasses RLS.

begin;

-- ── roi_assumptions ─────────────────────────────────────────────────────────
-- One editable row. Tune the model with no redeploy.
create table if not exists "company_os"."roi_assumptions" (
  "id"                       uuid        not null default gen_random_uuid() primary key,
  "time_saved_min_minutes"   integer     not null default 20,
  "time_saved_max_minutes"   integer     not null default 45,
  "working_hours_year"       integer     not null default 1976,
  "typical_queries_per_user" integer     not null default 15,
  "assumptions_signed_off"   boolean     not null default false,
  "updated_by"               text,
  "updated_at"               timestamptz not null default now()
);

-- ── roi_usage_events ────────────────────────────────────────────────────────
-- One anonymous row per calculation run. No name, email, or IP — ever.
create table if not exists "company_os"."roi_usage_events" (
  "id"                        uuid        not null default gen_random_uuid() primary key,
  "team_size"                 integer     not null,
  "queries_per_user"          integer     not null,
  "salary_cents"              integer,
  "hourly_rate_cents"         integer,
  "monthly_saving_low_cents"  bigint,
  "monthly_saving_high_cents" bigint,
  "pdf_requested"             boolean     not null default false,
  "created_at"                timestamptz not null default now(),
  "metadata"                  jsonb       not null default '{}'::jsonb
);
create index if not exists "idx_roi_usage_events_created_at"
  on "company_os"."roi_usage_events" ("created_at" desc);

-- Locked down: RLS on, no app policies (service-role client only).
alter table "company_os"."roi_assumptions" enable row level security;
alter table "company_os"."roi_usage_events" enable row level security;

grant all on "company_os"."roi_assumptions"  to "service_role";
grant all on "company_os"."roi_usage_events" to "service_role";

-- ── Seeds ───────────────────────────────────────────────────────────────────
-- Assumptions: signed off — time saved 60 min/query, benchmark 15 queries/user/mo.
insert into "company_os"."roi_assumptions"
  (time_saved_min_minutes, time_saved_max_minutes, working_hours_year,
   typical_queries_per_user, assumptions_signed_off, updated_by)
select 60, 60, 1976, 15, true, 'build-c-signoff'
where not exists (select 1 from "company_os"."roi_assumptions");

-- Beryl product: the single price source ($49.95 inc GST / user / month).
insert into "company_os"."products" (type, slug, title, subtitle, amount_cents, currency, active)
select 'membership', 'beryl', 'Beryl', 'Payroll & HR answer service', 4995, 'aud', true
where not exists (select 1 from "company_os"."products" where slug = 'beryl');

commit;
