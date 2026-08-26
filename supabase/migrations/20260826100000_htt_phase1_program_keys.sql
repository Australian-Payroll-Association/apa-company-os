-- Applied via Supabase Management API (supabase db query --linked, role postgres) on 2026-08-26.
--
-- HTT Phase 1: additive AI Program keys on the roadmap and boards tables.
-- Adds a nullable ai_program_id to client_roadmap_overview, client_backlog_items,
-- client_roadmap_groups (company column: company_id) and boards (company column:
-- client_company_id, the naming exception). NULL means "company-wide / not yet
-- split into a program". Strictly additive: no column is dropped, renamed, or
-- made NOT NULL; every existing query keeps working identically.
--
-- Backfill policy (settled in docs/plans/htt/2026-08-24-htt-build-plan.md):
-- set ai_program_id ONLY for rows whose company has exactly ONE ai_programs row.
-- Companies with multiple AI Programs keep NULL; splitting those is a later
-- human decision.

-- 1. Columns ----------------------------------------------------------------

alter table company_os.client_roadmap_overview
  add column if not exists ai_program_id uuid
    references company_os.ai_programs(id) on delete set null;

alter table company_os.client_backlog_items
  add column if not exists ai_program_id uuid
    references company_os.ai_programs(id) on delete set null;

alter table company_os.client_roadmap_groups
  add column if not exists ai_program_id uuid
    references company_os.ai_programs(id) on delete set null;

alter table company_os.boards
  add column if not exists ai_program_id uuid
    references company_os.ai_programs(id) on delete set null;

-- 2. Indexes ----------------------------------------------------------------
-- Partial: NULL rows (company-wide) are the common case and never filtered on.

create index if not exists client_roadmap_overview_ai_program_id_idx
  on company_os.client_roadmap_overview (ai_program_id)
  where ai_program_id is not null;

create index if not exists client_backlog_items_ai_program_id_idx
  on company_os.client_backlog_items (ai_program_id)
  where ai_program_id is not null;

create index if not exists client_roadmap_groups_ai_program_id_idx
  on company_os.client_roadmap_groups (ai_program_id)
  where ai_program_id is not null;

create index if not exists boards_ai_program_id_idx
  on company_os.boards (ai_program_id)
  where ai_program_id is not null;

-- 3. Backfill: single-program companies only --------------------------------
-- A company with exactly one ai_programs row gets its roadmap/backlog/groups/
-- boards keyed to that program. Everyone else stays NULL (company-wide).

with single_program as (
  select company_id, (array_agg(id))[1] as ai_program_id
  from company_os.ai_programs
  group by company_id
  having count(*) = 1
)
update company_os.client_roadmap_overview t
set ai_program_id = s.ai_program_id
from single_program s
where t.company_id = s.company_id
  and t.ai_program_id is null;

with single_program as (
  select company_id, (array_agg(id))[1] as ai_program_id
  from company_os.ai_programs
  group by company_id
  having count(*) = 1
)
update company_os.client_backlog_items t
set ai_program_id = s.ai_program_id
from single_program s
where t.company_id = s.company_id
  and t.ai_program_id is null;

with single_program as (
  select company_id, (array_agg(id))[1] as ai_program_id
  from company_os.ai_programs
  group by company_id
  having count(*) = 1
)
update company_os.client_roadmap_groups t
set ai_program_id = s.ai_program_id
from single_program s
where t.company_id = s.company_id
  and t.ai_program_id is null;

-- boards key their company via client_company_id (the naming exception).
with single_program as (
  select company_id, (array_agg(id))[1] as ai_program_id
  from company_os.ai_programs
  group by company_id
  having count(*) = 1
)
update company_os.boards t
set ai_program_id = s.ai_program_id
from single_program s
where t.client_company_id = s.company_id
  and t.ai_program_id is null;
