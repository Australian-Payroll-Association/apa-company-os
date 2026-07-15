-- AI resume screening columns on applications.
-- One screen result per application, overwritten on re-scan. ai_summary holds
-- the templated output (overview, skills, english, salary_expectation,
-- notice_period); ai_rating is the 0-5 fit score used to stack-rank a req's
-- applicants. ai_screen_status: pending | done | failed.
alter table company_os.applications
  add column if not exists ai_summary jsonb,
  add column if not exists ai_rating numeric(3, 1),
  add column if not exists ai_screen_status text,
  add column if not exists ai_screen_error text,
  add column if not exists ai_screened_at timestamptz,
  add column if not exists ai_model text;

create index if not exists applications_ai_rating_idx
  on company_os.applications (job_requisition_id, ai_rating desc nulls last);
