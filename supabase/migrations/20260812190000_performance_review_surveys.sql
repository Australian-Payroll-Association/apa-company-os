-- Performance review capture forms (docs/plans/2026-08-12-performance-reviews.md, PR 2).
-- Four seeded surveys with purpose 'performance_review', taken through the
-- existing one-question-at-a-time runner. The survey is only the pen: the
-- submit API writes straight into company_os.performance_reviews (via each
-- field's maps_to) and never creates survey_responses rows, so nothing here
-- ever appears in the generic survey results.
--
--   perf-review-self               the subject, any cycle type
--   perf-review-manager-probation  manager form + probation decision
--   perf-review-manager-midyear    manager form + keeper question
--   perf-review-manager-renewal    manager form + renewal decision
--
-- All four share the same eleven 1-5 dimensions (six Performance Pulse
-- behaviors kept verbatim + five AI craft skills from the AI Officer
-- curriculum). Rating configs carry per-level anchor text (config.levels) and
-- the AI dimensions carry expected_marker so the runner can draw the
-- expectation line from the subject's career_level.

insert into company_os.surveys (id, slug, name, description, status, is_anonymous, purpose, intro_text, thank_you_text)
values
  ('ea110000-0000-4000-8000-000000000001', 'perf-review-self',
   'Performance Pulse: Self-Assessment',
   'Your side of the review, on the same scale your manager uses.',
   'published', false, 'performance_review',
   'Rate yourself on the same scale your manager uses, and put your achievements on the record. Your manager sees this only after submitting their own draft.',
   'Submitted. You will see your manager''s review once it is finalized.'),
  ('ea110000-0000-4000-8000-000000000002', 'perf-review-manager-probation',
   'Performance Pulse: Probation Review',
   'The probation decision for your report.',
   'published', false, 'performance_review',
   'Rate, comment, decide. Your report sees this review only once you finalize it. An extension schedules the follow-up review automatically.',
   'Submitted. Finalize it from Reviews when you are ready; your report sees it only once finalized.'),
  ('ea110000-0000-4000-8000-000000000003', 'perf-review-manager-midyear',
   'Performance Pulse: Mid-Year Check-In',
   'The development check. No employment decision attaches.',
   'published', false, 'performance_review',
   'No employment decision attaches to this review: rate honestly, name the growth move, and answer the keeper question.',
   'Submitted. Finalize it from Reviews when you are ready; your report sees it only once finalized.'),
  ('ea110000-0000-4000-8000-000000000004', 'perf-review-manager-renewal',
   'Performance Pulse: Renewal Review',
   'The contract decision, made with the full year on record.',
   'published', false, 'performance_review',
   'The contract decision, made with the full year on record. Salary is handled separately, never here.',
   'Submitted. Finalize it from Reviews when you are ready; your report sees it only once finalized.')
on conflict (id) do nothing;

-- Shared dimensions for all four surveys, then the per-survey decision
-- questions. Idempotent at survey granularity: fields are only inserted for a
-- survey that has none yet.
do $$
declare
  sid uuid;
  is_self boolean;
  pos int;
  behavior_levels jsonb := '{
    "1": "Not meeting expectations, needs intervention",
    "2": "Below expectations, clear gaps",
    "3": "Meets expectations, solid",
    "4": "Exceeds expectations, would be missed",
    "5": "Exceptional, a role model for others"}'::jsonb;
begin
  for sid, is_self in
    select * from (values
      ('ea110000-0000-4000-8000-000000000001'::uuid, true),
      ('ea110000-0000-4000-8000-000000000002'::uuid, false),
      ('ea110000-0000-4000-8000-000000000003'::uuid, false),
      ('ea110000-0000-4000-8000-000000000004'::uuid, false)
    ) v(id, self)
  loop
    if exists (select 1 from company_os.survey_fields where survey_id = sid) then
      continue;
    end if;
    pos := 0;

    -- ---- the six Performance Pulse behaviors, verbatim ----------------------
    insert into company_os.survey_fields (survey_id, position, type, label, help_text, required, config)
    values
      (sid, pos + 0, 'rating', 'Role Understanding & Application',
       case when is_self
         then 'How well you understand the duties, policies, and expectations'
         else 'How well the employee understands the duties, policies, and expectations' end,
       true, jsonb_build_object('min', 1, 'max', 5,
         'maps_to', 'performance_reviews.ratings.role_understanding', 'levels', behavior_levels)),
      (sid, pos + 1, 'rating', 'Work Quality & Output',
       'Accuracy, thoroughness, and timeliness of work delivered',
       true, jsonb_build_object('min', 1, 'max', 5,
         'maps_to', 'performance_reviews.ratings.work_quality', 'levels', behavior_levels)),
      (sid, pos + 2, 'rating', 'Collaboration & Team Fit',
       'Interaction with colleagues, contribution to a positive workplace culture',
       true, jsonb_build_object('min', 1, 'max', 5,
         'maps_to', 'performance_reviews.ratings.collaboration', 'levels', behavior_levels)),
      (sid, pos + 3, 'rating', 'Communication Skills',
       'Clarity, responsiveness, and professionalism in communication',
       true, jsonb_build_object('min', 1, 'max', 5,
         'maps_to', 'performance_reviews.ratings.communication', 'levels', behavior_levels)),
      (sid, pos + 4, 'rating', 'Problem-solving',
       'Ability to analyse issues, develop practical solutions, and implement them effectively',
       true, jsonb_build_object('min', 1, 'max', 5,
         'maps_to', 'performance_reviews.ratings.problem_solving', 'levels', behavior_levels)),
      (sid, pos + 5, 'rating', 'Learning & Innovation',
       'Willingness to take feedback, learn new skills, and adapt to change',
       true, jsonb_build_object('min', 1, 'max', 5,
         'maps_to', 'performance_reviews.ratings.learning_innovation', 'levels', behavior_levels));
    pos := pos + 6;

    -- ---- the five AI craft skills (AI Officer curriculum) -------------------
    insert into company_os.survey_fields (survey_id, position, type, label, help_text, required, config)
    values
      (sid, pos + 0, 'rating', 'AI Planning',
       'Scanning workflows for AI opportunities and turning the right one into a plan',
       true, jsonb_build_object('min', 1, 'max', 5, 'expected_marker', true,
         'maps_to', 'performance_reviews.ratings.ai_planning', 'levels', '{
           "1": "Waits to be told; AI opportunities go unspotted",
           "2": "Spots opportunities but cannot frame them: no clear problem or goal",
           "3": "Scans workflows, picks the right opportunity, writes a clear problem statement and goal",
           "4": "Plans programs others execute; keeps a roadmap across the four outcomes",
           "5": "Runs the planning rhythm for the team; the roadmaps decide what gets built"}'::jsonb)),
      (sid, pos + 1, 'rating', 'Workflow Design',
       'Seeing work as a flow and deciding where AI fits, where a human stays',
       true, jsonb_build_object('min', 1, 'max', 5, 'expected_marker', true,
         'maps_to', 'performance_reviews.ratings.workflow_design', 'levels', '{
           "1": "Does the work; does not see it as a workflow",
           "2": "Can map a workflow on paper: trigger, steps, handoffs, outputs",
           "3": "Has wired a real multi-step workflow that runs end to end",
           "4": "Designs workflows that branch and decide, with human-in-the-loop where it belongs",
           "5": "Ships workflows that run unattended in production; others copy the designs"}'::jsonb)),
      (sid, pos + 2, 'rating', 'Organizing Information',
       'Making sure AI has the right data: where it lives, is it clean, is it accessible',
       true, jsonb_build_object('min', 1, 'max', 5, 'expected_marker', true,
         'maps_to', 'performance_reviews.ratings.organizing_information', 'levels', '{
           "1": "Data lives in heads or scattered files; AI works blind",
           "2": "Gathers the reference docs and examples a prompt needs to be good",
           "3": "Keeps team data where workflows can point to it, clean and current",
           "4": "Decides what AI can see and reach on its own: access and boundaries",
           "5": "Designs the real data layer: schemas, access control, logs others rely on"}'::jsonb)),
      (sid, pos + 3, 'rating', 'Creating Instructions',
       'Writing prompts and decision criteria clear enough that AI gets it right the first time',
       true, jsonb_build_object('min', 1, 'max', 5, 'expected_marker', true,
         'maps_to', 'performance_reviews.ratings.creating_instructions', 'levels', '{
           "1": "One-off prompting; results are luck",
           "2": "Writes solid prompts: role, task, constraints, output format",
           "3": "Packages instructions others can run without help",
           "4": "Writes decision criteria, routing rules, and goals with guardrails",
           "5": "Instructions live in version control: reviewed, testable, the team standard"}'::jsonb)),
      (sid, pos + 4, 'rating', 'AI Building',
       'Turning the plan into working product by directing AI, in the role''s own medium',
       true, jsonb_build_object('min', 1, 'max', 5, 'expected_marker', true,
         'maps_to', 'performance_reviews.ratings.ai_building', 'levels', '{
           "1": "Consumes what others build; work is made by hand",
           "2": "Builds with help; prototypes with guidance",
           "3": "Builds and ships a working prototype alone",
           "4": "Ships to production on the real stack; output a clear multiple of hand-speed",
           "5": "Ships systems others build on; sets the build standard"}'::jsonb));
    pos := pos + 5;

    -- ---- the three free-text fields, verbatim from the original form -------
    insert into company_os.survey_fields (survey_id, position, type, label, help_text, required, config)
    values
      (sid, pos + 0, 'long_text', 'Achievements',
       'Key contributions, milestones reached, or positive impact noted',
       false, '{"maps_to": "performance_reviews.achievements"}'::jsonb),
      (sid, pos + 1, 'long_text', 'Areas for Improvement',
       'Specific examples of skills, behaviors, or processes that need development. Recommended support or training',
       false, '{"maps_to": "performance_reviews.improvements"}'::jsonb),
      (sid, pos + 2, 'long_text', 'Additional comments or feedback',
       'Anything else worth putting on the record',
       false, '{"maps_to": "performance_reviews.comments"}'::jsonb);
    pos := pos + 3;

    -- ---- per-survey decision questions --------------------------------------
    if sid = 'ea110000-0000-4000-8000-000000000002' then
      insert into company_os.survey_fields (survey_id, position, type, label, help_text, required, config)
      values (sid, pos, 'single_choice', 'Decision',
        'Continue: probation passed, the labor contract proceeds. Extend: a follow-up probation review is scheduled automatically. Discontinue: end at close of probation.',
        true,
        '{"choices": ["Continue to contract", "Extend probation 30 days", "Discontinue"],
          "maps_to": "performance_reviews.decision"}'::jsonb);
    elsif sid = 'ea110000-0000-4000-8000-000000000003' then
      insert into company_os.survey_fields (survey_id, position, type, label, help_text, required, config)
      values
        (sid, pos, 'yes_no', 'If they told you they were leaving, would you fight to keep them?',
         'Yes flags them as a high performer for this cycle. No employment decision attaches to this answer.',
         true, '{"maps_to": "performance_reviews.keeper"}'::jsonb),
        (sid, pos + 1, 'long_text', 'What one thing would make them twice as valuable next half?',
         'This becomes a coaching goal.',
         false, '{"maps_to": "performance_reviews.metadata.twice_as_valuable"}'::jsonb);
    elsif sid = 'ea110000-0000-4000-8000-000000000004' then
      insert into company_os.survey_fields (survey_id, position, type, label, help_text, required, config)
      values
        (sid, pos, 'single_choice', 'Decision',
         'Renew: new contract on current role and scope. Renew with changes: describe the changes in the next question. Do not renew: the contract ends at expiration.',
         true,
         '{"choices": ["Renew", "Renew with changes", "Do not renew"],
           "maps_to": "performance_reviews.decision"}'::jsonb),
        (sid, pos + 1, 'long_text', 'Role or scope changes',
         'Only if renewing with changes. Salary is handled separately, never here.',
         false, '{"maps_to": "performance_reviews.metadata.renewal_changes"}'::jsonb);
    end if;
  end loop;
end $$;
