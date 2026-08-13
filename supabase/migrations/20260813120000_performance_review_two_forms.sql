-- Consolidate the four performance-review capture forms into two
-- (docs/plans/2026-08-12-performance-reviews.md). Both feed the one
-- company_os.performance_reviews table; nothing here changes the trend data,
-- only how it is entered.
--
--   perf-review-self     the team member's self-assessment (unchanged)
--   perf-review-manager  the manager's review — ONE form for every cycle type;
--                        its decision section is shown or hidden per
--                        review_type at render time (config.show_when), so
--                        there is no longer one manager survey per type.
--
-- Replaces perf-review-manager-{probation,midyear,renewal}. Safe to drop those:
-- performance reviews never create survey_responses rows and performance_reviews
-- has no FK to surveys (the link is the runtime slug from reviewSurveySlug).

insert into company_os.surveys (id, slug, name, description, status, is_anonymous, purpose, intro_text, thank_you_text)
values (
  'ea110000-0000-4000-8000-000000000005', 'perf-review-manager',
  'Performance Pulse: Manager Review',
  'Your review of your report. The decision section adapts to the review type.',
  'published', false, 'performance_review',
  'Rate, comment, and record your decision. Your report sees this review only once you finalize it.',
  'Submitted. Finalize it from Reviews when you are ready; your report sees it only once finalized.'
)
on conflict (id) do nothing;

-- Seed the manager form once: the eleven ratings + three free-text fields are
-- copied verbatim from the (about-to-be-removed) probation manager survey so
-- the anchored rating configs never drift, then the decision fields are added,
-- each tagged with the review types it applies to.
do $$
begin
  if not exists (
    select 1 from company_os.survey_fields where survey_id = 'ea110000-0000-4000-8000-000000000005'
  ) then
    -- positions 0-13: the six behaviors, five AI-craft skills, three free-text
    insert into company_os.survey_fields (survey_id, position, type, label, help_text, required, config)
    select 'ea110000-0000-4000-8000-000000000005', position, type, label, help_text, required, config
    from company_os.survey_fields
    where survey_id = 'ea110000-0000-4000-8000-000000000002' and position <= 13;

    -- decision section, filtered by cycle type in the page and API
    insert into company_os.survey_fields (survey_id, position, type, label, help_text, required, config)
    values
      ('ea110000-0000-4000-8000-000000000005', 14, 'single_choice', 'Decision',
       'Continue: probation passed, the labor contract proceeds. Extend: a follow-up probation review is scheduled automatically. Discontinue: end at close of probation.',
       true,
       '{"choices": ["Continue to contract", "Extend probation 30 days", "Discontinue"], "maps_to": "performance_reviews.decision", "show_when": {"types": ["probation"]}}'::jsonb),
      ('ea110000-0000-4000-8000-000000000005', 15, 'single_choice', 'Decision',
       'Renew: new contract on current role and scope. Renew with changes: describe the changes below. Do not renew: the contract ends at expiration.',
       true,
       '{"choices": ["Renew", "Renew with changes", "Do not renew"], "maps_to": "performance_reviews.decision", "show_when": {"types": ["renewal"]}}'::jsonb),
      ('ea110000-0000-4000-8000-000000000005', 16, 'long_text', 'Role or scope changes',
       'Only if renewing with changes. Salary is handled separately, never here.',
       false,
       '{"maps_to": "performance_reviews.metadata.renewal_changes", "show_when": {"types": ["renewal"]}}'::jsonb),
      ('ea110000-0000-4000-8000-000000000005', 17, 'yes_no',
       'If they told you they were leaving, would you fight to keep them?',
       'Yes flags them as a high performer for this cycle. No employment decision attaches to this answer.',
       true,
       '{"maps_to": "performance_reviews.keeper", "show_when": {"types": ["midyear"]}}'::jsonb),
      ('ea110000-0000-4000-8000-000000000005', 18, 'long_text',
       'What one thing would make them twice as valuable next half?',
       'This becomes a coaching goal.',
       false,
       '{"maps_to": "performance_reviews.metadata.twice_as_valuable", "show_when": {"types": ["midyear"]}}'::jsonb);
  end if;
end $$;

-- Retire the three per-type manager surveys.
delete from company_os.survey_fields
where survey_id in (
  'ea110000-0000-4000-8000-000000000002',
  'ea110000-0000-4000-8000-000000000003',
  'ea110000-0000-4000-8000-000000000004'
);
delete from company_os.surveys
where id in (
  'ea110000-0000-4000-8000-000000000002',
  'ea110000-0000-4000-8000-000000000003',
  'ea110000-0000-4000-8000-000000000004'
);
