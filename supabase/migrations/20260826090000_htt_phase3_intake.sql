-- NOT YET APPLIED; apply via supabase db query --linked before merge.
-- Human Token Tracker integration, Phase 3: two optional questions on the New
-- Member Onboarding survey so contributor identity is captured at the source.
--
--   1. GitHub username  -> company_os.people.github_login (column exists since
--      Phase 0). maps_to is 'people.github_login', so the generic onboarding
--      applier (lib/onboarding.ts) writes it; a hardcoded normalizer strips a
--      pasted profile URL / leading '@' and lowercases before the write.
--   2. Git commit email -> company_os.person_git_emails (child table, exists
--      since Phase 0). The generic applier has no branch for that table, so the
--      maps_to 'person_git_emails.git_email' is safely ignored by it; a
--      dedicated post-submit step in lib/onboarding.ts finds the field by that
--      exact maps_to and inserts the row with source='intake'.
--
-- Positions 22 and 23 append them after the existing fields (base survey uses
-- -2..21). Idempotent: guarded on maps_to, same pattern as
-- 20260812223017_onboarding_add_preferred_name.sql.

insert into company_os.survey_fields (survey_id, position, type, label, help_text, required, config)
select
  'e1b2c3d4-0000-4000-8000-000000000001',
  22,
  'short_text',
  'GitHub username',
  'Your GitHub account, e.g. octocat. Pasting your profile URL is fine too. Leave blank if you do not have one.',
  false,
  '{"maps_to":"people.github_login"}'::jsonb
where not exists (
  select 1 from company_os.survey_fields
  where survey_id = 'e1b2c3d4-0000-4000-8000-000000000001'
    and config->>'maps_to' = 'people.github_login'
);

insert into company_os.survey_fields (survey_id, position, type, label, help_text, required, config)
select
  'e1b2c3d4-0000-4000-8000-000000000001',
  23,
  'short_text',
  'Git commit email',
  'The email address on your git commits, if it differs from your work email. Leave blank if you are not sure.',
  false,
  '{"maps_to":"person_git_emails.git_email"}'::jsonb
where not exists (
  select 1 from company_os.survey_fields
  where survey_id = 'e1b2c3d4-0000-4000-8000-000000000001'
    and config->>'maps_to' = 'person_git_emails.git_email'
);
