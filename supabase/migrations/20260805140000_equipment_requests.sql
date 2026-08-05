-- 20260805140000_equipment_requests.sql
--
-- "My Equipment" on the /team portal: employees see what they are holding and
-- can ask for something new.
--
--  1. company_os.equipment.image_url — an optional product photo. The card
--     falls back to a drawn device illustration when it is empty, so the page
--     looks right with zero data entry.
--  2. company_os.equipment_requests — one row per ask. Deliberately thin: who,
--     what type, why, and where the request got to. Fulfilment stays manual
--     (an admin creates the equipment row and assigns it), because pretending
--     to automate procurement would be worse than a two-step.

alter table company_os.equipment
  add column if not exists image_url text;

create table if not exists company_os.equipment_requests (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references company_os.people(id) on delete cascade,
  type text not null check (type in (
    'laptop','desktop','monitor','keyboard','mouse','phone',
    'tablet','headset','dock','printer','accessory','other'
  )),
  reason text,
  needed_by date,
  status text not null default 'pending' check (status in (
    'pending','approved','declined','fulfilled'
  )),
  decided_by text,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now()
);

create index if not exists equipment_requests_person_idx
  on company_os.equipment_requests (person_id, created_at desc);
create index if not exists equipment_requests_status_idx
  on company_os.equipment_requests (status)
  where status = 'pending';

alter table company_os.equipment_requests enable row level security;

grant select, insert, update, delete on company_os.equipment_requests to service_role;
