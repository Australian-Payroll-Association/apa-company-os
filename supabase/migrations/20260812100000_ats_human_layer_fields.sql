-- ATS human layer (docs/plans/2026-08-11-ats-recruiter-feedback-plan.md, PR 2).
-- The AI screen stays read-only; humans write to a parallel layer that overrides
-- the AI values on display and survives a re-scan. All columns inherit their
-- table's existing service_role grant, so no extra grant is needed.

-- HR Assessment: the recruiter's own editable, overwritable assessment for THIS
-- application (per role). Distinct from the AI screen and the notes thread.
alter table company_os.applications
  add column if not exists hr_assessment text;
comment on column company_os.applications.hr_assessment is
  'Recruiter-owned free-text assessment for this application. Overrides/augments the read-only AI screen; edited freely.';

-- Per-person recruiter overrides for the three fields the AI extracts from the
-- resume. Shown in place of the AI value once set; persist across the person''s
-- applications. Salary is structured (minor units + currency), matching the
-- legacy candidates.desired_salary_cents convention.
alter table company_os.candidate_profile
  add column if not exists english_proficiency text;
alter table company_os.candidate_profile
  add column if not exists salary_expectation_cents bigint;
alter table company_os.candidate_profile
  add column if not exists salary_expectation_currency text;
alter table company_os.candidate_profile
  add column if not exists notice_period text;
