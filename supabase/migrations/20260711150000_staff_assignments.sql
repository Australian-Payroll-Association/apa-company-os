-- Applied 2026-07-11 via Supabase MCP migration `staff_assignments`.
-- Client-company -> dedicated-staff relation (docs/plans/2026-07-11-client-portal-design.md).
-- Previously this mapping lived only in Dayoff team names / departments.
create table if not exists company_os.staff_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references company_os.companies(id),
  team_member_id uuid not null references company_os.team_members(id),
  role_title text,
  start_date date,
  end_date date,
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One active assignment per (company, team_member) at a time; a person can be
-- reassigned later by ending the old row and inserting a new one.
create unique index if not exists staff_assignments_active_key
  on company_os.staff_assignments (company_id, team_member_id) where status = 'active';
create index if not exists staff_assignments_company_idx on company_os.staff_assignments (company_id);
create index if not exists staff_assignments_team_member_idx on company_os.staff_assignments (team_member_id);

alter table company_os.staff_assignments enable row level security;
grant select, insert, update, delete on company_os.staff_assignments to service_role;
