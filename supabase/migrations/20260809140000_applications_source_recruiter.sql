-- The recruiter intake (add-candidates, PR #373) writes applications with
-- source='recruiter', but the CHECK constraint still had the original value
-- list — so every save from /admin/talent/applications/new failed with
-- "Could not save the application." Extend the list with 'recruiter'.

alter table company_os.applications
  drop constraint applications_source_check;

alter table company_os.applications
  add constraint applications_source_check
  check (source = any (array[
    'direct', 'referral', 'job_board', 'linkedin', 'agency',
    'sourced', 'career_site', 'event', 'recruiter', 'other'
  ]::text[]));
