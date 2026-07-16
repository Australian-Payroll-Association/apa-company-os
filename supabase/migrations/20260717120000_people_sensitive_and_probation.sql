-- 20260717120000_people_sensitive_and_probation.sql
--
-- Two additions for team onboarding:
--
-- 1. company_os.people_sensitive — a restricted, one-row-per-person store for
--    legal/payroll PII (national ID + card images, bank details, tax code,
--    social insurance, home addresses, marital status, full DOB). This data is
--    NOT on `people` on purpose: `people` is read broadly (directory, org
--    chart, the /team portal), and this must never be. The security boundary is
--    the same service-role-only convention as the rest of company_os (RLS on,
--    no policies), PLUS an explicit revoke from the admin chatbot_reader role so
--    the NL->SQL assistant can never surface it — even though admins see it in
--    a dedicated, audited UI.
--
-- 2. team_members.employment_stage + probation_ends_on — probation is orthogonal
--    to status (someone is `active` AND on probation). probation_ends_on drives
--    both the badge and the future "probation review" workflow (fire 2 weeks
--    before it lands).

-- ── team_members: probation ────────────────────────────────────────────────
alter table company_os.team_members
  add column if not exists employment_stage text,   -- e.g. 'probation'; null = regular
  add column if not exists probation_ends_on date;  -- start + 2 months; past = passed

comment on column company_os.team_members.employment_stage is
  'Orthogonal to status. ''probation'' while under review; null once confirmed.';
comment on column company_os.team_members.probation_ends_on is
  'Probation end (start + ~2 months). Drives the probation-review workflow.';

-- ── people_sensitive: restricted PII ───────────────────────────────────────
create table if not exists company_os.people_sensitive (
  person_id uuid primary key references company_os.people(id) on delete cascade,
  date_of_birth date,
  national_id_number text,
  national_id_issue_date date,
  national_id_issue_place text,
  permanent_address text,
  current_address text,
  marital_status text,
  bank_name text,
  bank_account_number text,
  bank_branch text,
  tax_code text,
  social_insurance_number text,
  -- Paths within the private `id-documents` bucket (not public URLs).
  id_front_path text,
  id_back_path text,
  id_selfie_path text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table company_os.people_sensitive is
  'Restricted legal/payroll PII. Service-role + admin-audited UI only. Explicitly hidden from chatbot_reader. Never join into directory/portal reads.';

create trigger set_updated_at
  before update on company_os.people_sensitive
  for each row execute function company_os.handle_updated_at();

-- Service-role-only convention: RLS on, no policies (the app uses the
-- service-role key, which bypasses RLS; every other role gets empty results).
alter table company_os.people_sensitive enable row level security;

-- The app reaches this table through the service-role key. Grant it explicitly
-- (new company_os tables are not auto-granted — see prior migrations).
grant select, insert, update, delete on company_os.people_sensitive to service_role;

-- HARD exclusion from the admin NL->SQL assistant. The chatbot_reader migration
-- set `alter default privileges ... grant select` for future tables, so without
-- this revoke a fresh table would be auto-readable by the assistant. Revoke it,
-- and (unlike every other base table) do NOT add a chatbot_reader_select policy,
-- so even the grant path stays closed. Result: RLS returns empty AND the grant
-- is gone — the assistant cannot read a single row.
revoke all on company_os.people_sensitive from chatbot_reader;

-- ── Storage: private bucket for ID-card images ─────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'id-documents', 'id-documents', false, 10485760,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do nothing;
