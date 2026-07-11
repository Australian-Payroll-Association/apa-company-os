-- Applied 2026-07-11 via Supabase MCP migration `portal_members`.
-- Client portal membership allowlist (docs/plans/2026-07-11-client-portal-design.md).
-- Portal access is explicit: a person can log in iff they hold at least one
-- active row here. company_id null = person-only access (deferred event-attendee
-- tier; unused in v1, where provisioning always sets a company).
create table if not exists company_os.portal_members (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references company_os.people(id),
  company_id uuid references company_os.companies(id),
  role text not null default 'member',
  status text not null default 'active',
  invited_by text,
  invited_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists portal_members_person_company_key
  on company_os.portal_members (person_id, company_id) where company_id is not null;
create unique index if not exists portal_members_person_only_key
  on company_os.portal_members (person_id) where company_id is null;
create index if not exists portal_members_company_idx
  on company_os.portal_members (company_id);

alter table company_os.portal_members enable row level security;

-- company_os objects do not inherit grants; without this the app cannot see
-- the table (service-role is the only access path by design).
grant select, insert, update, delete on company_os.portal_members to service_role;
