-- AI screening training log (docs/plans/2026-08-11-ats-recruiter-feedback-plan.md, PR 3).
-- Append-only record of every human correction to an AI-extracted field, capturing
-- the AI's value AT CORRECTION TIME so the training pair survives a later re-scan
-- (which overwrites applications.ai_summary). Paired with the application outcome,
-- this is the eval set for tuning the resume-screening agent (lib/resume-screen.ts).
create table if not exists company_os.ai_screen_corrections (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references company_os.applications(id) on delete cascade,
  person_id      uuid references company_os.people(id) on delete set null,
  ai_model       text,
  field          text not null,          -- english | salary | notice
  ai_value       text,                    -- what the AI extracted, snapshotted now
  human_value    text,                    -- what the recruiter set it to
  corrected_by   text,                    -- acting admin email
  created_at     timestamptz not null default now()
);

create index if not exists ai_screen_corrections_application_idx
  on company_os.ai_screen_corrections (application_id);
create index if not exists ai_screen_corrections_created_idx
  on company_os.ai_screen_corrections (created_at);

-- New table needs explicit grants (company_os is service-role only). Append-only:
-- select + insert, no update/delete.
grant select, insert on company_os.ai_screen_corrections to service_role;
