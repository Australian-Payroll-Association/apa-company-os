-- Collect the structured legal name at onboarding, so first_name / last_name are
-- populated at the source instead of guessed later. The legal full name varies
-- by culture in order (Vietnamese: Family Middle Given; Western: Given Middle
-- Family), so the given and family parts cannot be split from full_name by token
-- position: they have to be asked. Model (confirmed with HR):
--   last_name  = family name (surname, ho)
--   first_name = the given / calling name (ten); the middle name stays only in
--                the full legal name captured by the survey's identity step.
--
-- The onboarding processor already writes any people.<column> maps_to onto the
-- people row (lib/onboarding.ts), so no application change is needed.
--
-- Placed ahead of the existing fields (negative positions; rendered
-- `order by position asc`) without renumbering them: family name, then given
-- name, then the preferred name already at position 0. Idempotent: guarded on
-- each maps_to so a replay never inserts duplicates.

insert into company_os.survey_fields (survey_id, position, type, label, help_text, required, config)
select 'e1b2c3d4-0000-4000-8000-000000000001', -2, 'short_text',
  'Family name (surname)',
  'Your surname (họ), exactly as on your ID card. For most Vietnamese names this is the first word, e.g. Nguyễn in Nguyễn Văn Đức.',
  true, '{"maps_to":"people.last_name"}'::jsonb
where not exists (
  select 1 from company_os.survey_fields
  where survey_id = 'e1b2c3d4-0000-4000-8000-000000000001'
    and config->>'maps_to' = 'people.last_name'
);

insert into company_os.survey_fields (survey_id, position, type, label, help_text, required, config)
select 'e1b2c3d4-0000-4000-8000-000000000001', -1, 'short_text',
  'Given name',
  'The name you are called by (tên), the last part of your legal name, e.g. Đức in Nguyễn Văn Đức.',
  true, '{"maps_to":"people.first_name"}'::jsonb
where not exists (
  select 1 from company_os.survey_fields
  where survey_id = 'e1b2c3d4-0000-4000-8000-000000000001'
    and config->>'maps_to' = 'people.first_name'
);
