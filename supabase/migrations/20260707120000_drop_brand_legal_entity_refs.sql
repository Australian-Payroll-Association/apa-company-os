-- Drop all brand_id / legal_entity_id references from company_os.
-- Keeps the brands and legal_entities tables themselves (now unreferenced).
-- Drops the two pure brand link-tables (person_brands, brand_voices).
-- Reversible: original id->ref mappings archived to company_os_archive first.
-- Apply AFTER the app deploy that stops reading these columns.

begin;

create schema if not exists company_os_archive;

-- 1) Snapshot every populated reference before dropping (reversibility).
create table company_os_archive.brand_refs (source_table text, row_id uuid, brand_id uuid);
insert into company_os_archive.brand_refs select 'affiliates', id, brand_id from company_os.affiliates where brand_id is not null;
insert into company_os_archive.brand_refs select 'agents_registry', id, brand_id from company_os.agents_registry where brand_id is not null;
insert into company_os_archive.brand_refs select 'apps', id, brand_id from company_os.apps where brand_id is not null;
insert into company_os_archive.brand_refs select 'availability_blocks', id, brand_id from company_os.availability_blocks where brand_id is not null;
insert into company_os_archive.brand_refs select 'bookings', id, brand_id from company_os.bookings where brand_id is not null;
insert into company_os_archive.brand_refs select 'campaigns', id, brand_id from company_os.campaigns where brand_id is not null;
insert into company_os_archive.brand_refs select 'content_channels', id, brand_id from company_os.content_channels where brand_id is not null;
insert into company_os_archive.brand_refs select 'content_ideas', id, brand_id from company_os.content_ideas where brand_id is not null;
insert into company_os_archive.brand_refs select 'content_items', id, brand_id from company_os.content_items where brand_id is not null;
insert into company_os_archive.brand_refs select 'content_pillars', id, brand_id from company_os.content_pillars where brand_id is not null;
insert into company_os_archive.brand_refs select 'deals', id, brand_id from company_os.deals where brand_id is not null;
insert into company_os_archive.brand_refs select 'documents', id, brand_id from company_os.documents where brand_id is not null;
insert into company_os_archive.brand_refs select 'epics', id, brand_id from company_os.epics where brand_id is not null;
insert into company_os_archive.brand_refs select 'experiments', id, brand_id from company_os.experiments where brand_id is not null;
insert into company_os_archive.brand_refs select 'inquiries', id, brand_id from company_os.inquiries where brand_id is not null;
insert into company_os_archive.brand_refs select 'ip_assets', id, brand_id from company_os.ip_assets where brand_id is not null;
insert into company_os_archive.brand_refs select 'job_requisitions', id, brand_id from company_os.job_requisitions where brand_id is not null;
insert into company_os_archive.brand_refs select 'meetings', id, brand_id from company_os.meetings where brand_id is not null;
insert into company_os_archive.brand_refs select 'orders', id, brand_id from company_os.orders where brand_id is not null;
insert into company_os_archive.brand_refs select 'people', id, source_brand_id from company_os.people where source_brand_id is not null;
insert into company_os_archive.brand_refs select 'pipelines', id, brand_id from company_os.pipelines where brand_id is not null;
insert into company_os_archive.brand_refs select 'products', id, brand_id from company_os.products where brand_id is not null;
insert into company_os_archive.brand_refs select 'projects', id, brand_id from company_os.projects where brand_id is not null;
insert into company_os_archive.brand_refs select 'prompts', id, brand_id from company_os.prompts where brand_id is not null;
insert into company_os_archive.brand_refs select 'research_notes', id, brand_id from company_os.research_notes where brand_id is not null;
insert into company_os_archive.brand_refs select 'service_lines', id, brand_id from company_os.service_lines where brand_id is not null;
insert into company_os_archive.brand_refs select 'subscriptions', id, brand_id from company_os.subscriptions where brand_id is not null;
insert into company_os_archive.brand_refs select 'survey_responses', id, brand_id from company_os.survey_responses where brand_id is not null;
insert into company_os_archive.brand_refs select 'surveys', id, brand_id from company_os.surveys where brand_id is not null;
insert into company_os_archive.brand_refs select 'touchpoints', id, brand_id from company_os.touchpoints where brand_id is not null;
insert into company_os_archive.brand_refs select 'vendors', id, brand_id from company_os.vendors where brand_id is not null;

create table company_os_archive.legal_entity_refs (source_table text, row_id uuid, legal_entity_id uuid);
insert into company_os_archive.legal_entity_refs select 'apps', id, legal_entity_id from company_os.apps where legal_entity_id is not null;
insert into company_os_archive.legal_entity_refs select 'brands', id, legal_entity_id from company_os.brands where legal_entity_id is not null;
insert into company_os_archive.legal_entity_refs select 'content_channels', id, legal_entity_id from company_os.content_channels where legal_entity_id is not null;
insert into company_os_archive.legal_entity_refs select 'deals', id, legal_entity_id from company_os.deals where legal_entity_id is not null;
insert into company_os_archive.legal_entity_refs select 'departments', id, legal_entity_id from company_os.departments where legal_entity_id is not null;
insert into company_os_archive.legal_entity_refs select 'documents', id, legal_entity_id from company_os.documents where legal_entity_id is not null;
insert into company_os_archive.legal_entity_refs select 'epics', id, legal_entity_id from company_os.epics where legal_entity_id is not null;
insert into company_os_archive.legal_entity_refs select 'expenses', id, legal_entity_id from company_os.expenses where legal_entity_id is not null;
insert into company_os_archive.legal_entity_refs select 'experiments', id, legal_entity_id from company_os.experiments where legal_entity_id is not null;
insert into company_os_archive.legal_entity_refs select 'goals', id, legal_entity_id from company_os.goals where legal_entity_id is not null;
insert into company_os_archive.legal_entity_refs select 'ip_assets', id, legal_entity_id from company_os.ip_assets where legal_entity_id is not null;
insert into company_os_archive.legal_entity_refs select 'job_requisitions', id, legal_entity_id from company_os.job_requisitions where legal_entity_id is not null;
insert into company_os_archive.legal_entity_refs select 'meetings', id, legal_entity_id from company_os.meetings where legal_entity_id is not null;
insert into company_os_archive.legal_entity_refs select 'orders', id, legal_entity_id from company_os.orders where legal_entity_id is not null;
insert into company_os_archive.legal_entity_refs select 'pipelines', id, legal_entity_id from company_os.pipelines where legal_entity_id is not null;
insert into company_os_archive.legal_entity_refs select 'positions', id, legal_entity_id from company_os.positions where legal_entity_id is not null;
insert into company_os_archive.legal_entity_refs select 'products', id, legal_entity_id from company_os.products where legal_entity_id is not null;
insert into company_os_archive.legal_entity_refs select 'projects', id, legal_entity_id from company_os.projects where legal_entity_id is not null;
insert into company_os_archive.legal_entity_refs select 'research_notes', id, legal_entity_id from company_os.research_notes where legal_entity_id is not null;
insert into company_os_archive.legal_entity_refs select 'stage_templates', id, legal_entity_id from company_os.stage_templates where legal_entity_id is not null;
insert into company_os_archive.legal_entity_refs select 'team_members', id, legal_entity_id from company_os.team_members where legal_entity_id is not null;
insert into company_os_archive.legal_entity_refs select 'vendors', id, legal_entity_id from company_os.vendors where legal_entity_id is not null;

-- Full copies of the link-tables being dropped.
create table company_os_archive.person_brands as table company_os.person_brands;
create table company_os_archive.brand_voices as table company_os.brand_voices;

-- 2) Rebuild the two views that referenced the dropped columns.
drop view if exists company_os.people_with_deals;
create view company_os.people_with_deals as
 SELECT p.id, p.email, p.full_name, p.first_name, p.last_name, p.preferred_name,
    p.phone, p.avatar_url, p.country, p.timezone, p.is_team_member, p.do_not_contact,
    p.owner_id, p.source, p.auth_user_id, p.notes, p.created_at, p.updated_at, p.gender,
    p.persona, p.linkedin_url, p.city, p.state_province, p.metadata, p.lifecycle_stage,
    p.lead_status, p.lead_sla_due_at, p.lead_attempt_count, p.disqualified_reason,
    p.archived_at, p.archived_by,
    COALESCE(d.deal_value_usd_cents, (0)::numeric) AS deal_value_usd_cents,
    COALESCE(d.deal_count, (0)::bigint) AS deal_count
   FROM company_os.people p
     LEFT JOIN ( SELECT deals.person_id,
            sum(deals.amount_usd_cents) FILTER (WHERE (deals.status = ANY (ARRAY['open'::text, 'won'::text]))) AS deal_value_usd_cents,
            count(*) AS deal_count
           FROM company_os.deals
          WHERE ((deals.person_id IS NOT NULL) AND (deals.archived_at IS NULL))
          GROUP BY deals.person_id) d ON ((d.person_id = p.id));
grant select on company_os.people_with_deals to service_role;

drop view if exists company_os.team_directory;
create view company_os.team_directory as
 WITH emp AS (
         SELECT DISTINCT ON (((r.value ->> 'EmployeeID'::text))::integer) ((r.value ->> 'EmployeeID'::text))::integer AS eid,
            NULLIF(btrim((r.value ->> 'TeamName'::text)), ''::text) AS dayoff_team,
            NULLIF(btrim((r.value ->> 'LocationName'::text)), ''::text) AS dayoff_location,
            NULLIF(btrim((r.value ->> 'LeavePolicyName'::text)), ''::text) AS dayoff_leave_policy
           FROM company_os.dayoff_snapshot ds
             CROSS JOIN LATERAL jsonb_array_elements((ds.payload -> 'Results'::text)) r(value)
          WHERE (ds.endpoint = '/api/doc/employees'::text)
          ORDER BY ((r.value ->> 'EmployeeID'::text))::integer, ds.fetched_at DESC
        ), sched AS (
         SELECT DISTINCT ON (((dayoff_snapshot.params ->> 'employee'::text))::integer) ((dayoff_snapshot.params ->> 'employee'::text))::integer AS eid,
            NULLIF(btrim((dayoff_snapshot.payload ->> 'ScheduleName'::text)), ''::text) AS work_schedule
           FROM company_os.dayoff_snapshot
          WHERE (dayoff_snapshot.endpoint = '/api/doc/employees/workSchedules'::text)
          ORDER BY ((dayoff_snapshot.params ->> 'employee'::text))::integer, dayoff_snapshot.fetched_at DESC
        ), bal_latest AS (
         SELECT DISTINCT ON (((dayoff_snapshot.params ->> 'employee'::text))::integer) ((dayoff_snapshot.params ->> 'employee'::text))::integer AS eid,
            dayoff_snapshot.payload
           FROM company_os.dayoff_snapshot
          WHERE ((dayoff_snapshot.endpoint = '/api/doc/balances'::text) AND ((dayoff_snapshot.params ->> 'group'::text) = '1'::text))
          ORDER BY ((dayoff_snapshot.params ->> 'employee'::text))::integer, dayoff_snapshot.fetched_at DESC
        ), bal AS (
         SELECT bl.eid,
            sum(((b.value ->> 'UsedBalance'::text))::numeric) AS used_days,
            sum(((b.value ->> 'TotalBalance'::text))::numeric) AS total_days
           FROM bal_latest bl
             CROSS JOIN LATERAL jsonb_array_elements(bl.payload) b(value)
          GROUP BY bl.eid
        )
 SELECT t.id, t.person_id, p.full_name, p.email, p.auth_user_id, t.status,
    t.employee_number, t.employment_type, t.start_date, t.end_date, t.dayoff_employee_id,
    d.name AS department_name,
    pos.title AS position_title,
    lp.name AS leave_policy_name,
    mgr_p.full_name AS manager_name,
    COALESCE(emp.dayoff_team, d.name) AS team,
    COALESCE(emp.dayoff_location, t.work_location) AS location,
    COALESCE(emp.dayoff_leave_policy, lp.name) AS leave_policy,
    sched.work_schedule, bal.used_days, bal.total_days
   FROM company_os.team_members t
     JOIN company_os.people p ON p.id = t.person_id
     LEFT JOIN company_os.departments d ON d.id = t.department_id
     LEFT JOIN company_os.positions pos ON pos.id = t.position_id
     LEFT JOIN company_os.leave_policies lp ON lp.id = t.leave_policy_id
     LEFT JOIN company_os.team_members mgr ON mgr.id = t.manager_id
     LEFT JOIN company_os.people mgr_p ON mgr_p.id = mgr.person_id
     LEFT JOIN emp ON emp.eid = t.dayoff_employee_id
     LEFT JOIN sched ON sched.eid = t.dayoff_employee_id
     LEFT JOIN bal ON bal.eid = t.dayoff_employee_id;
grant select on company_os.team_directory to service_role;

-- 3) Drop the two pure brand link-tables.
drop table if exists company_os.person_brands;
drop table if exists company_os.brand_voices;

-- 4) Drop the reference columns (FK constraints + indexes drop with them).
alter table company_os.affiliates drop column if exists brand_id;
alter table company_os.agents_registry drop column if exists brand_id;
alter table company_os.apps drop column if exists brand_id;
alter table company_os.availability_blocks drop column if exists brand_id;
alter table company_os.bookings drop column if exists brand_id;
alter table company_os.campaigns drop column if exists brand_id;
alter table company_os.content_channels drop column if exists brand_id;
alter table company_os.content_ideas drop column if exists brand_id;
alter table company_os.content_items drop column if exists brand_id;
alter table company_os.content_pillars drop column if exists brand_id;
alter table company_os.deals drop column if exists brand_id;
alter table company_os.documents drop column if exists brand_id;
alter table company_os.epics drop column if exists brand_id;
alter table company_os.experiments drop column if exists brand_id;
alter table company_os.inquiries drop column if exists brand_id;
alter table company_os.ip_assets drop column if exists brand_id;
alter table company_os.job_requisitions drop column if exists brand_id;
alter table company_os.meetings drop column if exists brand_id;
alter table company_os.orders drop column if exists brand_id;
alter table company_os.people drop column if exists source_brand_id;
alter table company_os.pipelines drop column if exists brand_id;
alter table company_os.products drop column if exists brand_id;
alter table company_os.projects drop column if exists brand_id;
alter table company_os.prompts drop column if exists brand_id;
alter table company_os.research_notes drop column if exists brand_id;
alter table company_os.service_lines drop column if exists brand_id;
alter table company_os.subscriptions drop column if exists brand_id;
alter table company_os.survey_responses drop column if exists brand_id;
alter table company_os.surveys drop column if exists brand_id;
alter table company_os.touchpoints drop column if exists brand_id;
alter table company_os.vendors drop column if exists brand_id;
alter table company_os.apps drop column if exists legal_entity_id;
alter table company_os.brands drop column if exists legal_entity_id;
alter table company_os.content_channels drop column if exists legal_entity_id;
alter table company_os.deals drop column if exists legal_entity_id;
alter table company_os.departments drop column if exists legal_entity_id;
alter table company_os.documents drop column if exists legal_entity_id;
alter table company_os.epics drop column if exists legal_entity_id;
alter table company_os.expenses drop column if exists legal_entity_id;
alter table company_os.experiments drop column if exists legal_entity_id;
alter table company_os.goals drop column if exists legal_entity_id;
alter table company_os.ip_assets drop column if exists legal_entity_id;
alter table company_os.job_requisitions drop column if exists legal_entity_id;
alter table company_os.meetings drop column if exists legal_entity_id;
alter table company_os.orders drop column if exists legal_entity_id;
alter table company_os.pipelines drop column if exists legal_entity_id;
alter table company_os.positions drop column if exists legal_entity_id;
alter table company_os.products drop column if exists legal_entity_id;
alter table company_os.projects drop column if exists legal_entity_id;
alter table company_os.research_notes drop column if exists legal_entity_id;
alter table company_os.stage_templates drop column if exists legal_entity_id;
alter table company_os.team_members drop column if exists legal_entity_id;
alter table company_os.vendors drop column if exists legal_entity_id;

commit;
