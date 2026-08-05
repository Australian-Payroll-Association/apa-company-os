-- 20260805120000_equipment_register.sql
--
-- Phase 1 of the equipment register
-- (docs/plans/2026-08-05-equipment-tracking.md). Two new tables:
--
--  1. company_os.equipment — one row per physical item (laptop, monitor,
--     keyboard, ...) with its type, live status, specs, purchase record and
--     cost. Follows the vendors conventions: archived_at/archived_by instead of
--     hard deletes, RLS on, explicit service_role grants.
--  2. company_os.equipment_assignments — one row per custody period. The row
--     with returned_at null is the current holder, and equipment
--     .current_holder_id mirrors it. A partial unique index makes two open
--     periods for one item impossible, which is the whole fix: the spreadsheet
--     recorded a handover by overwriting the previous holder.
--
-- Cost is deliberately NOT gated: unlike compensation, equipment cost is
-- visible to every admin, so these tables get normal service_role access and
-- stay readable by the NL->SQL assistant.

-- ── 1. equipment ───────────────────────────────────────────────────────────

-- Human-facing asset tag (EQ-0001). A sequence default rather than a trigger:
-- one less moving part, and gaps from rolled-back inserts are harmless.
create sequence if not exists company_os.equipment_asset_tag_seq;

create table if not exists company_os.equipment (
  id uuid primary key default gen_random_uuid(),
  asset_tag text unique not null
    default 'EQ-' || lpad(nextval('company_os.equipment_asset_tag_seq')::text, 4, '0'),
  type text not null default 'other' check (type in (
    'laptop','desktop','monitor','keyboard','mouse','phone',
    'tablet','headset','dock','printer','accessory','other'
  )),
  name text not null,
  brand text,
  model text,
  serial_number text,
  -- Spec columns are nullable on purpose: empty for a mouse or a cable.
  processor text,
  ram text,
  storage text,
  screen_size numeric(4,1),
  purchase_date date,
  model_year integer,
  -- Purchase location. vendor_name_raw keeps a supplier that isn't in the
  -- directory rather than dropping it on import.
  vendor_id uuid references company_os.vendors(id) on delete set null,
  vendor_name_raw text,
  invoice_ref text,
  cost_vnd numeric(14,2),
  cost_usd numeric(12,2),
  status text not null default 'in_stock' check (status in (
    'in_use','in_stock','in_repair','lost','retired','sold'
  )),
  condition text check (condition is null or condition in ('new','good','fair','damaged')),
  -- Denormalised from the open assignment so the list page can filter and sort
  -- on the holder without a join. equipment_assignments stays the source of truth.
  current_holder_id uuid references company_os.people(id) on delete set null,
  notes text,
  archived_at timestamptz,
  archived_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists equipment_type_idx on company_os.equipment (type);
create index if not exists equipment_status_idx on company_os.equipment (status);
create index if not exists equipment_holder_idx on company_os.equipment (current_holder_id);
create index if not exists equipment_vendor_idx on company_os.equipment (vendor_id);
create index if not exists equipment_serial_idx on company_os.equipment (serial_number)
  where serial_number is not null;

-- ── 2. equipment_assignments ───────────────────────────────────────────────

create table if not exists company_os.equipment_assignments (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references company_os.equipment(id) on delete cascade,
  person_id uuid not null references company_os.people(id) on delete restrict,
  assigned_at date not null default current_date,
  returned_at date,
  condition_out text check (condition_out is null or condition_out in ('new','good','fair','damaged')),
  condition_in text check (condition_in is null or condition_in in ('new','good','fair','damaged')),
  note text,
  created_by text,
  created_at timestamptz not null default now(),
  -- A period can't end before it starts.
  constraint equipment_assignments_dates_ck check (returned_at is null or returned_at >= assigned_at)
);

-- The invariant: at most one open custody period per item. Assigning to a new
-- person must close the previous row first, so history is appended, never
-- overwritten.
create unique index if not exists equipment_assignments_one_open_idx
  on company_os.equipment_assignments (equipment_id)
  where returned_at is null;

create index if not exists equipment_assignments_equipment_idx
  on company_os.equipment_assignments (equipment_id, assigned_at desc);
create index if not exists equipment_assignments_person_idx
  on company_os.equipment_assignments (person_id);

-- ── 3. Access ──────────────────────────────────────────────────────────────
-- RLS on, no policies: reached through the service-role client only, same as
-- the rest of the admin surface. Without these explicit grants the app cannot
-- see the tables at all.

alter table company_os.equipment enable row level security;
alter table company_os.equipment_assignments enable row level security;

grant select, insert, update, delete on company_os.equipment to service_role;
grant select, insert, update, delete on company_os.equipment_assignments to service_role;
grant usage, select on sequence company_os.equipment_asset_tag_seq to service_role;
