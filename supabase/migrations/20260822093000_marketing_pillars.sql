-- Content pillars: a short controlled list per brand, so calendar entries stop
-- accumulating free-text pillar strings that can never be reported on. Each
-- pillar belongs to a brand; entries reference one via pillar_id.
--
-- Not seeded: pillars are the operator's own strategy, invented here would be
-- wrong. The calendar's pillar manager creates them.
-- Applied via Supabase MCP.

create table if not exists company_os.marketing_pillars (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references company_os.brands(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One pillar name per brand, case-insensitive.
create unique index if not exists marketing_pillars_brand_name_idx
  on company_os.marketing_pillars (brand_id, lower(name));

drop trigger if exists set_marketing_pillars_updated_at on company_os.marketing_pillars;
create trigger set_marketing_pillars_updated_at before update on company_os.marketing_pillars
  for each row execute function company_os.handle_updated_at();

alter table company_os.marketing_pillars enable row level security;

grant select, insert, update, delete on company_os.marketing_pillars to service_role;
grant select on company_os.marketing_pillars to supabase_read_only_user;

-- Calendar entries point at a pillar. The old free-text pillar column is left in
-- place (harmless) but the app now writes pillar_id.
alter table company_os.marketing_calendar
  add column if not exists pillar_id uuid references company_os.marketing_pillars(id) on delete set null;
create index if not exists marketing_calendar_pillar_idx on company_os.marketing_calendar (pillar_id);
