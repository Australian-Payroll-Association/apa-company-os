-- Lead satellite refactor, Phase 1a (expand — strictly additive). Applied via
-- Supabase MCP 2026-07-07 (migrations lead_satellite_expand +
-- lifecycle_transitions_person_nullable). Recorded here for the repo history.
-- Plan: docs/plans/2026-07-07-lead-satellite-refactor.md

begin;

create table company_os.lead (
  id            uuid primary key default gen_random_uuid(),
  person_id     uuid not null references company_os.people(id) on delete cascade,
  status        text not null default 'new',
  sla_due_at    timestamptz,
  attempt_count integer not null default 0,
  disqualified_reason text,
  owner_id      uuid references company_os.people(id),
  source        text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint lead_person_unique unique (person_id)
);
alter table company_os.lead enable row level security;
grant select, insert, update, delete on company_os.lead to service_role;

alter table company_os.companies
  add column lifecycle_stage text not null default 'none';

alter table company_os.lifecycle_transitions
  add column company_id uuid references company_os.companies(id);
alter table company_os.lifecycle_transitions alter column person_id drop not null;
alter table company_os.lifecycle_transitions
  add constraint lifecycle_transitions_scope_check
  check (person_id is not null or company_id is not null);

create table company_os_archive.people_lead_fields as
select id, lifecycle_stage, lead_status, lead_sla_due_at,
       lead_attempt_count, disqualified_reason
from company_os.people
where lead_status is not null or lifecycle_stage <> 'none'
   or lead_attempt_count > 0 or lead_sla_due_at is not null
   or disqualified_reason is not null;

insert into company_os.lead (person_id, status, sla_due_at,
                             attempt_count, disqualified_reason, owner_id, created_at)
select p.id,
       coalesce(p.lead_status, 'new'),
       p.lead_sla_due_at, p.lead_attempt_count, p.disqualified_reason,
       p.owner_id, p.created_at
from company_os.people p
where p.lead_status is not null
   or p.lifecycle_stage <> 'none'
   or p.lead_attempt_count > 0
   or p.lead_sla_due_at is not null
   or p.disqualified_reason is not null;

with ranked as (
  select pc.company_id,
         max(case p.lifecycle_stage
               when 'evangelist' then 7 when 'customer' then 6
               when 'opportunity' then 5 when 'sql' then 4
               when 'mql' then 3 when 'lead' then 2
               when 'subscriber' then 1 else 0 end) as r
  from company_os.person_companies pc
  join company_os.people p on p.id = pc.person_id
  group by pc.company_id
)
update company_os.companies c
set lifecycle_stage = (array['none','subscriber','lead','mql','sql',
                             'opportunity','customer','evangelist'])[r.r + 1]
from ranked r
where r.company_id = c.id and r.r > 0;

commit;
