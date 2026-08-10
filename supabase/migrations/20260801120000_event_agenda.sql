-- 20260801120000_event_agenda.sql
--
-- "My Retreat" — structured, reusable agenda for events
-- (docs/plans/2026-07-31-my-retreat-design.md). Two additive tables so one
-- agenda drives two views: the guest-facing "My Retreat" itinerary and the
-- internal ops work schedule.
--
--  1. company_os.event_agenda_blocks — one row per agenda block (day, period,
--     title, body, booked room, guest-visible flag, sort order).
--  2. company_os.event_agenda_staff  — who works each block (the work-schedule
--     half). References people; carries NO wages (the P&L flat $150/day covers
--     cost, so real pay never leaks into ops scheduling).
--
-- Service-role only (RLS on, no policies), same as the rest of the events
-- module: admin edits and the guest hub both read through the service-role
-- client. New company_os tables are not auto-granted to service_role, so grant
-- it explicitly. Agenda content is not sensitive, so the NL->SQL reader's
-- default SELECT grant is left in place.

-- ── 1. event_agenda_blocks ─────────────────────────────────────────────────
create table if not exists company_os.event_agenda_blocks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references company_os.events(id) on delete cascade,
  day_index integer not null default 1,       -- 1..N
  day_label text,                              -- e.g. "Day 1 — Arrive & begin"
  day_date date,                              -- optional; derived from event start + day_index
  period text check (period in ('morning', 'afternoon', 'evening')),
  time_label text,                            -- e.g. "09:00–10:30" (free text)
  title text not null,
  body text,
  room text,                                  -- the booked room for this block
  guest_visible boolean not null default true, -- false => ops/work-schedule only
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table company_os.event_agenda_blocks is
  'Structured retreat agenda blocks behind the event Agenda tab. One set of blocks drives both the guest "My Retreat" itinerary (guest_visible) and the internal ops work schedule. Service-role only.';

create index if not exists event_agenda_blocks_event_id_idx
  on company_os.event_agenda_blocks (event_id, day_index, sort_order);

create trigger set_updated_at
  before update on company_os.event_agenda_blocks
  for each row execute function company_os.handle_updated_at();

-- ── 2. event_agenda_staff ──────────────────────────────────────────────────
create table if not exists company_os.event_agenda_staff (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references company_os.event_agenda_blocks(id) on delete cascade,
  person_id uuid not null references company_os.people(id) on delete cascade,
  role text not null default 'other'
    check (role in ('lead', 'engineer', 'driver', 'maid', 'host', 'other')),
  note text,
  created_at timestamptz not null default now(),
  unique (block_id, person_id, role)
);

comment on table company_os.event_agenda_staff is
  'Which staff work each agenda block (the work-schedule half of the agenda). Ops-only: never surfaced to the guest hub. Carries no wages — the P&L flat $150/day covers cost.';

create index if not exists event_agenda_staff_block_id_idx
  on company_os.event_agenda_staff (block_id);

-- ── Grants (service-role only; RLS on, no policies) ────────────────────────
alter table company_os.event_agenda_blocks enable row level security;
alter table company_os.event_agenda_staff  enable row level security;
grant select, insert, update, delete on company_os.event_agenda_blocks to service_role;
grant select, insert, update, delete on company_os.event_agenda_staff  to service_role;
