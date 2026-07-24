-- 20260724170000_events_registered_override.sql
--
-- Some events (keynotes, workshops) are measured by a headcount
-- (attendee_count_override), not a registration list, so their "registered"
-- count in the admin was 0. Add a matching manual override for registered so
-- the list can show a sensible signups figure. Null => derive from
-- event_registrations as before.

alter table company_os.events
  add column if not exists registered_count_override integer;

comment on column company_os.events.registered_count_override is
  'Manual override for the admin "registered" count. Used for events measured by headcount rather than a registration list. Null => derive from event_registrations.';
