-- AI Journey surveys: pre/post event pair for PR-grade roll-up data.
-- Data seed only, no schema changes. Additive per the surveys-tables rule
-- (external writer + real data on these tables).
--
--   /surveys/ai-journey           purpose ai_journey_pre   (baseline)
--   /surveys/ai-journey-feedback  purpose ai_journey_post  (NPS + outcomes)
--
-- Both are shared across events; per-event attribution rides ?cohort=<event-slug>
-- on the QR link (stamped by the submit API when it matches a real event).
--
-- Company + industry on the pre survey carry config.maps_to. For a logged-in
-- respondent the app hides a question whose maps_to value the CRM already
-- knows and injects the known value on submit; an industry answer backfills
-- companies.industry when the linked company has none (lib/ai-journey.ts).
-- Name + email come from the runner's built-in identity step, so they are not
-- fields here.

-- 1) Pre-event: Your AI Journey ----------------------------------------------
insert into company_os.surveys (id, slug, name, description, status, is_anonymous, purpose, intro_text, thank_you_text)
values (
  'a1b2c3d4-0000-4000-8000-000000000101',
  'ai-journey',
  'Your AI Journey',
  'Pre-event baseline: where attendees are on their AI journey.',
  'published',
  false,
  'ai_journey_pre',
  'Before we start, a quick snapshot of where you are on your AI journey. It takes about two minutes.',
  'Thanks, your starting point is saved. See you in the session.'
)
on conflict (id) do nothing;

insert into company_os.survey_fields (survey_id, position, type, label, help_text, required, config)
select 'a1b2c3d4-0000-4000-8000-000000000101', v.position, v.type, v.label, v.help_text, v.required, v.config::jsonb
from (values
  (1, 'short_text',    'Company name',                                                            null, true,  '{"maps_to":"companies.name"}'),
  (2, 'short_text',    'What industry do you work in?',                                           null, true,  '{"maps_to":"companies.industry"}'),
  (3, 'multi_choice',  'Which AI platforms do you currently use?',                                null, true,  '{"choices":["ChatGPT","Claude","Gemini","Microsoft Copilot","DeepSeek","An internal company tool","None yet","Other"]}'),
  (4, 'single_choice', 'How often do you use AI at work?',                                        null, true,  '{"choices":["Never","A few times a month","Weekly","Daily","Many times a day"]}'),
  (5, 'rating',        'I feel confident using AI for real work in my role.',                     null, true,  '{"min":1,"max":5,"min_label":"Strongly disagree","max_label":"Strongly agree"}'),
  (6, 'rating',        'My company has a clear AI strategy.',                                     null, true,  '{"min":1,"max":5,"min_label":"Strongly disagree","max_label":"Strongly agree"}'),
  (7, 'rating',        'My company''s workflows are clearly documented.',                         null, true,  '{"min":1,"max":5,"min_label":"Strongly disagree","max_label":"Strongly agree"}'),
  (8, 'rating',        'Our company''s information and data are organized and ready for AI to use.', null, true, '{"min":1,"max":5,"min_label":"Strongly disagree","max_label":"Strongly agree"}'),
  (9, 'long_text',     'What is your biggest pain point with AI right now?',                      null, true,  '{}')
) as v(position, type, label, help_text, required, config)
where not exists (
  select 1 from company_os.survey_fields where survey_id = 'a1b2c3d4-0000-4000-8000-000000000101'
);

-- 2) Post-event: Session Feedback --------------------------------------------
insert into company_os.surveys (id, slug, name, description, status, is_anonymous, purpose, intro_text, thank_you_text)
values (
  'a1b2c3d4-0000-4000-8000-000000000102',
  'ai-journey-feedback',
  'Session Feedback',
  'Post-event feedback: NPS plus confidence and capability.',
  'published',
  false,
  'ai_journey_post',
  'Five quick questions. Two minutes, tops.',
  'Thank you! We read every answer and use it to make the next session better.'
)
on conflict (id) do nothing;

insert into company_os.survey_fields (survey_id, position, type, label, help_text, required, config)
select 'a1b2c3d4-0000-4000-8000-000000000102', v.position, v.type, v.label, v.help_text, v.required, v.config::jsonb
from (values
  (1, 'rating',    'How likely are you to recommend this session to a friend or colleague?', null, true, '{"min":0,"max":10,"min_label":"Not likely","max_label":"Extremely likely"}'),
  (2, 'rating',    'I feel more confident in my ability to lead AI at my company.',          null, true, '{"min":1,"max":5,"min_label":"Strongly disagree","max_label":"Strongly agree"}'),
  (3, 'rating',    'I feel more capable putting AI to work in my day-to-day.',               null, true, '{"min":1,"max":5,"min_label":"Strongly disagree","max_label":"Strongly agree"}'),
  (4, 'long_text', 'What is one thing you loved?',                                           null, false, '{}'),
  (5, 'long_text', 'What is one thing you wish we would have done?',                         null, false, '{}'),
  (6, 'yes_no',    'May we quote your feedback publicly?', 'First name, role, and industry only. Never your company name.', true, '{}')
) as v(position, type, label, help_text, required, config)
where not exists (
  select 1 from company_os.survey_fields where survey_id = 'a1b2c3d4-0000-4000-8000-000000000102'
);
