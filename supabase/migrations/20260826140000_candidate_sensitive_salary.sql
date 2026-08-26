-- 20260826140000_candidate_sensitive_salary.sql
--
-- Candidate salary is sensitive: it must be visible only to super admins
-- (Dave + Mai, i.e. canViewSensitive), the same bar as employee wages and PII.
-- Mirror the company_os.people_sensitive convention exactly:
--
--   company_os.candidate_sensitive — one row per person, holding a candidate's
--   salary expectation (the recruiter-verified structured figure AND the
--   AI-extracted string from resume screening). This data is NOT on
--   candidate_profile or applications on purpose: those are read broadly across
--   the ATS (application detail, candidate pool, job-req ranking, interview
--   kits, the interview-panelist AI prompt). The security boundary is the same
--   service-role-only convention as the rest of company_os (RLS on, no
--   policies), PLUS an explicit revoke from chatbot_reader so the NL->SQL
--   assistant can never surface it. The app gates every read/write on
--   canViewSensitive() in lib/admin/candidate-sensitive.ts.
--
-- Forward-looking: today zero candidates have a structured salary and zero
-- ai_summary rows carry a real salary value (47 carry only "Not stated"), so
-- nothing is migrated, only relocated for future writes.
--
-- The now-unused candidate_profile.salary_expectation_cents/_currency columns
-- are intentionally LEFT in place here: the currently-deployed app still selects
-- them, so dropping them in the same migration would break it mid-deploy. They
-- are empty and no longer read or written after this change; drop them in a
-- follow-up migration once this ships.

-- ── candidate_sensitive: restricted candidate comp ─────────────────────────
create table if not exists company_os.candidate_sensitive (
  person_id uuid primary key references company_os.people(id) on delete cascade,
  -- Recruiter-verified structured expectation.
  salary_expectation_cents bigint,
  salary_expectation_currency text,
  -- AI-extracted salary string from resume screening (e.g. '32M VND'), moved
  -- out of applications.ai_summary so that jsonb stays broadly readable.
  ai_salary_expectation text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table company_os.candidate_sensitive is
  'Restricted candidate salary. Service-role + super-admin-audited UI only (canViewSensitive). Explicitly hidden from chatbot_reader. Never join into ATS list/detail reads.';

drop trigger if exists set_updated_at on company_os.candidate_sensitive;
create trigger set_updated_at
  before update on company_os.candidate_sensitive
  for each row execute function company_os.handle_updated_at();

-- Service-role-only convention: RLS on, no policies (the app uses the
-- service-role key, which bypasses RLS; every other role gets empty results).
alter table company_os.candidate_sensitive enable row level security;

-- New company_os tables are not auto-granted to service_role; grant explicitly.
grant select, insert, update, delete on company_os.candidate_sensitive to service_role;

-- HARD exclusion from the admin NL->SQL assistant: revoke the default select
-- and add NO chatbot_reader_select policy, so both the grant and RLS paths stay
-- closed (same as people_sensitive).
revoke all on company_os.candidate_sensitive from chatbot_reader;

-- ── scrub the salary key from existing ai_summary blobs ────────────────────
-- All 47 rows that carry it hold only "Not stated"; going forward resume-screen
-- routes the value into candidate_sensitive instead of ai_summary.
update company_os.applications
  set ai_summary = ai_summary - 'salary_expectation'
  where ai_summary ? 'salary_expectation';
