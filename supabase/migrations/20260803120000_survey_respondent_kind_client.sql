-- Add a third survey respondent_kind, 'client', and backfill existing rows.
--
-- Until now respondent_kind was only 'team' | 'external', so logged-in portal
-- clients (and known, on-file contacts) were mis-stamped 'external'. The kinds
-- are now:
--   team     — staff or admin
--   client   — a person already on file who is not staff (every logged-in
--              portal client, plus any respondent whose email matched an
--              existing non-survey people record)
--   external — someone we only know from a survey: no prior record, or a
--              people record whose source is itself 'survey'
--
-- respondent_kind is a plain text column (no check constraint), so no DDL is
-- needed — this migration only re-stamps existing data to match the new rule.
--
-- Re-stamp responses currently marked 'external' that actually belong to an
-- on-file, non-staff person. Rows with no linked person, or whose person only
-- originated from a survey, correctly stay 'external'. 'team' rows are left
-- untouched. Mirrors classifyEmail() / resolveSurveyActor() in
-- lib/survey-identity.ts.
update company_os.survey_responses r
set respondent_kind = 'client'
where r.respondent_kind = 'external'
  and r.person_id is not null
  and exists (
    select 1
    from company_os.people p
    where p.id = r.person_id
      and coalesce(p.source, '') <> 'survey'
  )
  and not exists (
    select 1
    from company_os.team_members tm
    where tm.person_id = r.person_id
      and tm.status in ('active', 'on_leave', 'notice', 'pre_start')
  );
