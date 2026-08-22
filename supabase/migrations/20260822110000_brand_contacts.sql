-- Brand audience membership. A guest brand (AI Officer, CAIO Coach, …) that
-- runs campaigns from this CRM needs its own recipient list, separate from the
-- Edge8 house list. This join table is that membership.
--
-- Deliberately a join table, not a brand_id column on people: brand tags were
-- dropped from the core CRM entities on purpose (see the brand/legal-entity
-- deprecation). A person can belong to more than one brand's audience.
--
-- The Edge8 "home" brand is NOT modelled here: its audience is the whole CRM,
-- so resolveAudience treats a campaign with the edge8 brand (or no brand) as
-- the full subscribed list. Only non-home brands are scoped by this table.
-- Applied via Supabase MCP.

create table if not exists company_os.brand_contacts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references company_os.brands(id) on delete cascade,
  person_id uuid not null references company_os.people(id) on delete cascade,
  created_by text,
  created_at timestamptz not null default now(),
  constraint brand_contacts_unique unique (brand_id, person_id)
);

create index if not exists brand_contacts_brand_idx on company_os.brand_contacts (brand_id);
create index if not exists brand_contacts_person_idx on company_os.brand_contacts (person_id);

alter table company_os.brand_contacts enable row level security;

grant select, insert, update, delete on company_os.brand_contacts to service_role;
grant select on company_os.brand_contacts to supabase_read_only_user;
