-- 20260813140000_team_pulse_survey.sql
--
-- Team Pulse: a short, person-linked survey sent periodically to learn how
-- people feel about their work, their manager, their team, and their equipment.
-- It rides the existing survey system (surveys / survey_fields / survey_responses,
-- the public /surveys/[slug] runner, the admin results view). No new tables.
--
-- Equipment is one question here. This replaces the reverted bespoke
-- equipment_check table and /team form (see docs/plans/2026-08-13-fleet-fitness-agent.md):
-- survey responses are person-linked by default, which is all the linkage needed.
-- purpose 'team_pulse' is not special-cased, so it takes the normal survey flow.

insert into company_os.surveys (id, slug, name, description, status, is_anonymous, purpose, intro_text, thank_you_text)
values
  ('fee10000-0000-4000-8000-000000000001', 'team-pulse',
   'Team Pulse',
   'A quick, twice-a-year check on how work is going.',
   'published', false, 'team_pulse',
   'A quick read on how things are going for you: your work, your manager, your team, and your equipment. About two minutes. This is not anonymous, so we can follow up and act on what you tell us.',
   'Thanks for this. It goes straight to the team so we can act on it.')
on conflict (id) do nothing;

-- Fields, idempotent at survey granularity: only seeded if the survey has none.
do $$
declare
  sid uuid := 'fee10000-0000-4000-8000-000000000001';
  agree jsonb := '{"min":1,"max":5,"min_label":"Strongly disagree","max_label":"Strongly agree"}'::jsonb;
begin
  if exists (select 1 from company_os.survey_fields where survey_id = sid) then
    return;
  end if;
  insert into company_os.survey_fields (id, survey_id, position, type, label, help_text, required, config) values
    (gen_random_uuid(), sid, 1, 'rating', 'I feel motivated and engaged in my work.', null, true, agree),
    (gen_random_uuid(), sid, 2, 'rating', 'My manager supports me and helps me grow.', null, true, agree),
    (gen_random_uuid(), sid, 3, 'rating', 'I feel part of a team that works well together.', null, true, agree),
    (gen_random_uuid(), sid, 4, 'single_choice', 'How is your work computer doing?', null, true,
     '{"choices":["Awesome, it performs great for my work","It''s ok, gets the job done but may need upgrading soon","Not so good, it slows me down at work"]}'::jsonb),
    (gen_random_uuid(), sid, 5, 'long_text', 'Anything about your equipment we should know?', 'Optional.', false, '{}'::jsonb),
    (gen_random_uuid(), sid, 6, 'long_text', 'Anything else on your mind, about your work, manager, or team?', 'Optional.', false, '{}'::jsonb);
end $$;
