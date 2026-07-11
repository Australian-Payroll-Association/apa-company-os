-- Backfill: persona for contacts that had none, from internal CRM signals then
-- source heuristic. Only fills blanks (never overwrites an existing persona)
-- and only when a rule produces a confident value; legacy-import /
-- thoughtflow_crm / sourceless contacts stay null. Guarded + idempotent.
-- Applied 2026-07-10 via Supabase MCP against project wwchefrgkkxmhlkntufm.
-- Result: 128 blank -> 75 blank (prospect +48, client +4, job_seeker +1).

update company_os.people p
set persona = v.persona, updated_at = now()
from (
  select p2.id,
    case
      -- Won deal or a customer/evangelist company link => client
      when exists(select 1 from company_os.deals d where d.person_id=p2.id and d.status='won') then 'client'
      when exists(select 1 from company_os.person_companies pc join company_os.companies c on c.id=pc.company_id
                  where pc.person_id=p2.id and c.lifecycle_stage in ('customer','evangelist')) then 'client'
      -- Any deal or a lead satellite => prospect
      when exists(select 1 from company_os.deals d where d.person_id=p2.id) then 'prospect'
      when exists(select 1 from company_os.lead l where l.person_id=p2.id) then 'prospect'
      -- ATS application => job seeker
      when exists(select 1 from company_os.applications a where a.person_id=p2.id) then 'job_seeker'
      -- Team membership => employee
      when p2.is_team_member then 'employee'
      -- Source heuristic for the remaining blanks
      when lower(coalesce(p2.source,'')) like '%career%' or lower(coalesce(p2.source,''))='itviec' then 'job_seeker'
      when lower(coalesce(p2.source,'')) in
        ('survey_import','infiniteleverage-8.com','ai-officer.com','edge8.ai','referral','inbound','aio-pad') then 'prospect'
      else null
    end as persona
  from company_os.people p2
  where p2.archived_at is null and (p2.persona is null or p2.persona='')
) v
where p.id = v.id and v.persona is not null;

-- Left null: legacy-import (74) + thoughtflow_crm/no-source contacts with no
-- deal, lead, application, team flag, or recognizable inbound source.
