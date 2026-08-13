-- 20260813120000_equipment_check.sql
--
-- Twice-a-year equipment self-report. We do not touch anyone's machine; each
-- holder tells us how their kit is doing, once per half-year cycle. One row per
-- holder-item-cycle. Feeds the self-report column on the Fleet Fitness page,
-- alongside the spec grade.
-- Plan: docs/plans/2026-08-13-fleet-fitness-agent.md (self-report survey).

create table if not exists company_os.equipment_check (
  id uuid primary key default gen_random_uuid(),
  cycle text not null,                              -- half-year window, e.g. '2026-H2'
  equipment_id uuid not null references company_os.equipment(id) on delete cascade,
  person_id uuid not null references company_os.people(id) on delete cascade,
  condition text not null check (condition in ('good','fair','poor')),
  holding_back boolean not null default false,      -- is it too slow / in the way of your work?
  needs_upgrade boolean not null default false,     -- holder thinks it should be replaced/upgraded
  issues text,                                      -- optional free text
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (cycle, equipment_id, person_id)
);

create index if not exists equipment_check_equipment_idx
  on company_os.equipment_check (equipment_id, cycle);
create index if not exists equipment_check_cycle_idx
  on company_os.equipment_check (cycle);

alter table company_os.equipment_check enable row level security;

grant select, insert, update, delete on company_os.equipment_check to service_role;

comment on table company_os.equipment_check is
  'Twice-a-year equipment self-report: one row per holder-item-cycle. No device access; the holder rates condition and whether the machine holds them back.';
