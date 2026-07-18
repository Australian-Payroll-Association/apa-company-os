-- Applied 2026-07-16 via Supabase MCP migration `contractor_data_prep`
-- Contractor data prep for the work-requests feature (plan: docs/plans/2026-07-16-contractor-work-requests.md)
-- 1) Fix Yon's person record
update company_os.people
set full_name = 'Yon Vo', first_name = 'Yon', last_name = 'Vo', updated_at = now()
where email = 'yon@edge8.ai' and full_name = 'yon2';

-- 2) New positions
insert into company_os.positions (department_id, title, slug, employment_type)
select d.id, 'English Teacher', 'english-teacher', 'contract'
from company_os.departments d
where d.name = 'OnTarget'
  and not exists (select 1 from company_os.positions where title = 'English Teacher');

insert into company_os.positions (department_id, title, slug, employment_type)
select d.id, 'Designer', 'designer', 'contract'
from company_os.departments d
where d.name = 'Client Delivery'
  and not exists (select 1 from company_os.positions where title = 'Designer');

-- 3) Yon team_members row (contract, active, OnTarget / English Teacher)
insert into company_os.team_members (person_id, department_id, position_id, employment_type, status, start_date)
select p.id, d.id, pos.id, 'contract', 'active', current_date
from company_os.people p, company_os.departments d, company_os.positions pos
where p.email = 'yon@edge8.ai' and d.name = 'OnTarget' and pos.title = 'English Teacher'
  and not exists (select 1 from company_os.team_members tm where tm.person_id = p.id);

-- 4) Ginny: retitle to Designer (repoint; deactivate her old single-holder position)
update company_os.team_members tm
set position_id = (select id from company_os.positions where title = 'Designer'), updated_at = now()
from company_os.people p
where p.id = tm.person_id and p.email = 'ginny.vo@edge8.ai';

update company_os.positions
set active = false, updated_at = now()
where title = 'AI-Driven Junior Designer & Video Editor'
  and not exists (select 1 from company_os.team_members where position_id = positions.id);

-- 5) Seed contractor rates (hourly + overtime; overtime = hourly until told otherwise)
-- Yon $25/hr, Ginny $10/hr, Lan Anh $10/hr (USD)
insert into company_os.compensation (team_member_id, comp_type, amount_cents, currency, pay_period, effective_from, is_current, change_reason)
select tm.id, ct.comp_type, ct.cents, 'usd', 'hourly', current_date, true, 'Initial contractor rate seed'
from company_os.team_members tm
join company_os.people p on p.id = tm.person_id
cross join lateral (
  values
    ('hourly',   case p.email when 'yon@edge8.ai' then 2500 else 1000 end),
    ('overtime', case p.email when 'yon@edge8.ai' then 2500 else 1000 end)
) as ct(comp_type, cents)
where p.email in ('yon@edge8.ai','ginny.vo@edge8.ai','anh.pham@edge8.ai')
  and not exists (
    select 1 from company_os.compensation c
    where c.team_member_id = tm.id and c.comp_type = ct.comp_type and c.is_current
  );
