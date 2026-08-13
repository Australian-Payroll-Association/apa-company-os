-- 20260813150000_survey_list_view.sql
--
-- One row per survey with response activity rolled up. The admin surveys list
-- previously read the response total via the PostgREST embedded aggregate
-- `survey_responses(count)`, which can't be ordered or filtered on. This view
-- exposes response_count and last_response_at as plain columns so every column
-- header can sort, and so surveys with recent responses can be flagged.
--
-- Carries s.* so listEntity's name/slug search, updated_at sort, and
-- excludeArchived (archived_at) keep working unchanged against the view.
-- company_os convention: view, service-role select grant only.
create or replace view company_os.survey_list as
select
  s.*,
  count(r.id)::int                              as response_count,
  max(coalesce(r.submitted_at, r.created_at))   as last_response_at
from company_os.surveys s
left join company_os.survey_responses r on r.survey_id = s.id
group by s.id;

grant select on company_os.survey_list to service_role;
