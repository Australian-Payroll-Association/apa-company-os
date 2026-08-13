-- Hard-delete the public probation-45-review survey and its dead column. The
-- probation decision now lives on the auth-gated /team/probation/[id] page
-- (lib/onboarding-cycle applyProbationDecision); the onboarding-cycle reminder
-- emails point there.
--
-- Safe to delete outright: the survey has zero responses (the flow was seeded
-- but never used to record a decision), and onboarding_plans.day45_response_id
-- is null on every row, so nothing references it.

delete from company_os.survey_fields
where survey_id in (select id from company_os.surveys where slug = 'probation-45-review');

delete from company_os.surveys where slug = 'probation-45-review';

-- The column only ever held a probation-45 survey_response id (always null). It
-- is no longer written or read.
alter table company_os.onboarding_plans drop column if exists day45_response_id;
