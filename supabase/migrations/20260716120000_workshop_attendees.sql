-- Workshop attendees counter + talk catalog.
-- Plan: docs/plans/2026-07-16-workshop-attendees-counter.md
--
-- Additive. Adds 'keynote' to the event type set, a manual attendee count
-- override on events, a small talks lookup (the four keynote/workshop
-- offerings) with an event_talks join, and a function that sums effective
-- attendees for a year: coalesce(override, live registration count).

-- 1. events.type gains 'keynote' (superset, safe on live rows)
alter table company_os.events drop constraint if exists events_type_check;
alter table company_os.events add constraint events_type_check check (type in
  ('retreat','workshop','webinar','micro_session','dinner','private_trip',
   'company_event','keynote'));

-- 2. Manual attendee count for engagements with no per-person registration
--    (EO, DOXA, Georgetown). Null = derive from registrations.
alter table company_os.events
  add column if not exists attendee_count_override integer;

-- 3. talks — the keynote/workshop catalog
create table if not exists company_os.talks (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table company_os.talks enable row level security;
grant select, insert, update, delete on company_os.talks to service_role;

insert into company_os.talks (slug, title, sort_order) values
  ('four-offices-of-the-future', 'The Four Offices of the Future', 1),
  ('the-other-50', 'The Other 50%', 2),
  ('agentic-ai-in-business', 'Agentic AI In Business', 3),
  ('leadership-in-the-ai-era', 'Leadership in the AI Era', 4)
on conflict (slug) do nothing;

-- 4. event_talks — an event can cover more than one talk (EO Perth covers two)
create table if not exists company_os.event_talks (
  event_id uuid not null references company_os.events(id) on delete cascade,
  talk_id uuid not null references company_os.talks(id) on delete cascade,
  primary key (event_id, talk_id)
);
alter table company_os.event_talks enable row level security;
grant select, insert, update, delete on company_os.event_talks to service_role;
create index if not exists event_talks_talk_idx on company_os.event_talks(talk_id);

-- 5. Effective attendees for a year. Per event:
--    coalesce(attendee_count_override, active registrations + guests).
--    Cancelled, draft, and archived events never count.
create or replace function company_os.workshop_attendees_total(p_year integer default null)
returns integer
language sql
stable
set search_path = company_os, extensions, pg_catalog
as $$
  select coalesce(sum(
    coalesce(
      e.attendee_count_override,
      (select count(*) + coalesce(sum(r.guest_count), 0)
         from company_os.event_registrations r
        where r.event_id = e.id
          and r.status in ('confirmed','registered','attended'))
    )
  ), 0)::integer
  from company_os.events e
  where e.archived_at is null
    and e.status not in ('cancelled','draft')
    and (p_year is null
      or (e.starts_at >= make_date(p_year, 1, 1)
          and e.starts_at < make_date(p_year + 1, 1, 1)));
$$;

grant execute on function company_os.workshop_attendees_total(integer) to service_role;
