-- Add a "Preferred name" question to the New Member Onboarding survey so the
-- name a person goes by is captured at the source. Until now the survey's
-- built-in identity step collected only the full/legal name; preferred_name was
-- left null for survey-sourced hires (e.g. "Ash Ly", "Viha Nghiem" came through
-- with an empty "Goes by"). The onboarding processor already writes any
-- people.<column> maps_to straight onto the people row (see lib/onboarding.ts),
-- so no application change is needed: the answer lands in people.preferred_name.
--
-- position 0 places it first, ahead of the existing fields (rendered
-- `order by position asc`), without renumbering any of them. Idempotent: guarded
-- on the maps_to so a replay never inserts a duplicate.

insert into company_os.survey_fields (survey_id, position, type, label, help_text, required, config)
select
  'e1b2c3d4-0000-4000-8000-000000000001',
  0,
  'short_text',
  'Preferred name',
  'What should we call you? A nickname or English name is perfect. If you don''t have one, just your first name.',
  true,
  '{"maps_to":"people.preferred_name"}'::jsonb
where not exists (
  select 1 from company_os.survey_fields
  where survey_id = 'e1b2c3d4-0000-4000-8000-000000000001'
    and config->>'maps_to' = 'people.preferred_name'
);
