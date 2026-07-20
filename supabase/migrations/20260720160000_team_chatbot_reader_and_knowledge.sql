-- 20260720160000_team_chatbot_reader_and_knowledge.sql
-- Team portal assistant (/team). Two things:
--   1. company_os.team_knowledge — the assistant's knowledge base. Claude is the
--      CMS: entries are authored as markdown in docs/team-knowledge/ and synced
--      into this table (scripts/sync-team-knowledge.ts). The bot reads it via SQL.
--   2. team_chatbot_reader — a locked-down, read-only Postgres role the /team
--      assistant uses for every SELECT it runs.
--
-- SECURITY MODEL — the boundary is the DATABASE, not the app. Unlike the admin
-- assistant's chatbot_reader (which sees ALL of company_os because admins already
-- see everything), staff must NOT see payroll, compensation, or sensitive PII.
-- So this role is DEFAULT-DENY: it gets USAGE on company_os and SELECT on an
-- explicit ALLOW-LIST of tables only — never `grant ... on all tables`, and no
-- default privileges, so a table added by a later migration is invisible until
-- someone deliberately grants it here.
--
-- Open to staff (the user's call, 2026-07-20): finances (revenue, invoices,
-- expenses, deals), clients & companies, sales pipeline, people & org, time off,
-- events, ideas, CRM interaction notes, and the knowledge base.
-- Withheld: payroll/compensation, people_sensitive (bank/ID/DOB), performance
-- reviews / 1-1s / goals, recruiting & candidate data (ATS), survey responses,
-- meetings, document metadata, audit_log, admins, and the free-text
-- termination_reason / time-off reason / manager_note columns (redacted via
-- column-level grants, since who-is-off is fine but the reason may be personal).
--
-- ONE MANUAL STEP after applying (the password must never live in git):
--   alter role team_chatbot_reader with login password '<generate a strong one>';
-- then store the Supavisor pooler connection string (as team_chatbot_reader) in
-- the TEAM_CHATBOT_DB_URL env var. See lib/team-chat/db.ts.

-- ---------------------------------------------------------------------------
-- 1. Knowledge base
-- ---------------------------------------------------------------------------

create table if not exists company_os.team_knowledge (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,          -- stable id, matches the markdown filename
  title       text not null,
  category    text,                          -- e.g. "policy", "values", "benefits", "how-we-work"
  body        text not null,                 -- markdown
  tags        text[] not null default '{}',
  source      text,                          -- provenance, e.g. "docs/product/product.md"
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists team_knowledge_slug_idx on company_os.team_knowledge(slug);
create index if not exists team_knowledge_category_idx on company_os.team_knowledge(category);
-- Full-text search over title + body so the assistant can find entries by topic.
create index if not exists team_knowledge_fts_idx on company_os.team_knowledge
  using gin (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(body,'')));

-- company_os access model: RLS on with no policies; the app writes via the
-- service-role client (the sync script), the assistant reads via the permissive
-- policy granted to team_chatbot_reader below.
alter table company_os.team_knowledge enable row level security;
grant select, insert, update, delete on company_os.team_knowledge to service_role;

-- ---------------------------------------------------------------------------
-- 2. Role
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'team_chatbot_reader') then
    create role team_chatbot_reader nologin noinherit;
  end if;
end $$;

alter role team_chatbot_reader set statement_timeout = '5s';
alter role team_chatbot_reader set idle_in_transaction_session_timeout = '10s';
alter role team_chatbot_reader set search_path = company_os;

-- Scope to company_os ONLY. No usage on public means the shared instance's other
-- sites are structurally unreachable.
grant usage on schema company_os to team_chatbot_reader;
revoke create on schema company_os from team_chatbot_reader;

-- ---------------------------------------------------------------------------
-- 2a. Allow-list — full-table SELECT
-- ---------------------------------------------------------------------------
-- Everything a staff member may see in full. NOT `on all tables`: unlisted
-- tables (people_sensitive, compensation, performance_reviews, one_on_ones,
-- goals, applications, candidates, candidate_profile, application_stages,
-- surveys, survey_*, meetings, documents, audit_log, admins, job_requisitions,
-- dayoff_snapshot, skills, person_skills, ...) stay ungranted and invisible.

do $$
declare
  t text;
  allowed text[] := array[
    -- People, companies & relationships (CRM interaction notes included per policy)
    'people','companies','person_companies','person_relationships',
    'interactions','lifecycle_transitions','tags','taggables',
    -- Sales pipeline
    'lead','pipelines','pipeline_stages','deals','inquiries','service_lines',
    'affiliates','affiliate_commissions','affiliate_payouts',
    -- Commerce & finance
    'products','orders','subscriptions','invoices','expenses','vendors','fx_rates',
    -- People ops (non-sensitive)
    'departments','positions','staff_assignments',
    'leave_policies','leave_adjustments','holidays',
    -- Events & content
    'events','event_registrations',
    'content_channels','content_pillars','content_items','content_ideas',
    -- Misc + knowledge base
    'ideas','company_profile','integration_sources','team_knowledge'
  ];
begin
  foreach t in array allowed loop
    -- Skip names that don't exist in this database (defensive; content_* etc.
    -- may not all be present).
    if exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'company_os' and c.relname = t and c.relkind in ('r','v')
    ) then
      execute format('grant select on company_os.%I to team_chatbot_reader', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2b. Allow-list — column-level SELECT (redacted tables)
-- ---------------------------------------------------------------------------
-- Who is off and the employment record are fine; the free-text reason / note /
-- termination_reason are not. Column grants omit exactly those columns. A column
-- added later is NOT auto-granted (safe default for a restricted role).

grant select (
  id, person_id, department_id, position_id, manager_id, employee_number,
  employment_type, work_location, status, start_date, end_date, created_at,
  updated_at, leave_policy_id, dayoff_employee_id, employment_stage, probation_ends_on
) on company_os.team_members to team_chatbot_reader;

grant select (
  id, team_member_id, leave_type, status, start_date, end_date, is_half_day,
  hours, approved_by, approved_at, created_at, updated_at, external_source,
  external_id, days, requested_at
) on company_os.time_off to team_chatbot_reader;

-- ---------------------------------------------------------------------------
-- 2c. RLS policies for the allowed tables
-- ---------------------------------------------------------------------------
-- company_os tables have RLS enabled with no policies, which yields silent EMPTY
-- results for a non-owner role. Add a permissive SELECT policy for
-- team_chatbot_reader on each ALLOWED base table (including the two
-- column-redacted ones — RLS gates rows, the column grant gates columns). Only
-- the allow-list is policied; a grant is still required, so a stray policy on an
-- ungranted table would be harmless anyway.

do $$
declare
  t text;
  allowed text[] := array[
    'people','companies','person_companies','person_relationships',
    'interactions','lifecycle_transitions','tags','taggables',
    'lead','pipelines','pipeline_stages','deals','inquiries','service_lines',
    'affiliates','affiliate_commissions','affiliate_payouts',
    'products','orders','subscriptions','invoices','expenses','vendors','fx_rates',
    'departments','positions','staff_assignments',
    'leave_policies','leave_adjustments','holidays',
    'events','event_registrations',
    'content_channels','content_pillars','content_items','content_ideas',
    'ideas','company_profile','integration_sources','team_knowledge',
    'team_members','time_off'
  ];
begin
  foreach t in array allowed loop
    if exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'company_os' and c.relname = t and c.relkind = 'r'
        and c.relrowsecurity = true
    ) and not exists (
      select 1 from pg_policies
      where schemaname = 'company_os' and tablename = t
        and policyname = 'team_chatbot_reader_select'
    ) then
      execute format(
        'create policy team_chatbot_reader_select on company_os.%I for select to team_chatbot_reader using (true)',
        t
      );
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2d. Belt-and-suspenders: hard-revoke the crown jewels
-- ---------------------------------------------------------------------------
-- These are already denied by omission (never granted). Revoke explicitly so the
-- intent is unmistakable and survives any future accidental broad grant.

revoke all on company_os.people_sensitive from team_chatbot_reader;
do $$
begin
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'company_os' and c.relname = 'compensation') then
    execute 'revoke all on company_os.compensation from team_chatbot_reader';
  end if;
end $$;
