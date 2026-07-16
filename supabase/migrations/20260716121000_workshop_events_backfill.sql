-- Backfill: 2026 keynote/workshop engagements for the workshop attendees
-- counter. Plan: docs/plans/2026-07-16-workshop-attendees-counter.md
--
-- All rows are private (client engagements, never listed publicly) and carry
-- metadata.backfill for reversibility. Attendee numbers provided by Dave
-- 2026-07-16; future dates get counts after each event.

with new_events (slug, type, status, title, location, starts_at, timezone, attendee_count_override, metadata, talk_slugs) as (
  values
    ('eo-perth-2026-01', 'workshop', 'completed',
     'EO Perth: AI Leadership Series', 'Perth, Australia',
     '2026-01-01T09:00:00+08:00'::timestamptz, 'Australia/Perth', 241,
     '{"sessions_count": 12}'::jsonb,
     array['leadership-in-the-ai-era','agentic-ai-in-business']),
    ('georgetown-dubai-2026-06', 'keynote', 'completed',
     'Georgetown Dubai: Leadership in the AI Era', 'Dubai, UAE',
     '2026-06-14T09:00:00+04:00'::timestamptz, 'Asia/Dubai', 59,
     '{}'::jsonb, array['leadership-in-the-ai-era']),
    ('eo-vietnam-2026-06', 'keynote', 'completed',
     'EO Vietnam: Leadership in the AI Era', 'Ho Chi Minh City, Vietnam',
     '2026-06-20T09:00:00+07:00'::timestamptz, 'Asia/Ho_Chi_Minh', 47,
     '{}'::jsonb, array['leadership-in-the-ai-era']),
    ('georgetown-dc-2026-07', 'keynote', 'completed',
     'Georgetown DC: Leadership in the AI Era', 'Washington DC, USA',
     '2026-07-09T09:00:00-04:00'::timestamptz, 'America/New_York', 64,
     '{}'::jsonb, array['leadership-in-the-ai-era']),
    ('doxa-philadelphia-2026-07', 'keynote', 'completed',
     'DOXA Philadelphia: The Four Offices of the Future', 'Philadelphia, USA',
     '2026-07-14T09:00:00-04:00'::timestamptz, 'America/New_York', 27,
     '{}'::jsonb, array['four-offices-of-the-future']),
    ('doxa-talent-2026-07', 'keynote', 'completed',
     'DOXA Talent: Agentic AI In Business', null,
     '2026-07-16T09:00:00-04:00'::timestamptz, 'America/New_York', 207,
     '{}'::jsonb, array['agentic-ai-in-business']),
    ('doxa-denver-2026-07', 'keynote', 'published',
     'DOXA Denver: The Four Offices of the Future', 'Denver, USA',
     '2026-07-17T09:00:00-06:00'::timestamptz, 'America/Denver', null,
     '{}'::jsonb, array['four-offices-of-the-future']),
    ('doxa-dallas-2026-07', 'keynote', 'published',
     'DOXA Dallas: The Four Offices of the Future', 'Dallas, USA',
     '2026-07-20T09:00:00-05:00'::timestamptz, 'America/Chicago', null,
     '{}'::jsonb, array['four-offices-of-the-future']),
    ('doxa-seattle-2026-07', 'keynote', 'published',
     'DOXA Seattle: The Four Offices of the Future', 'Seattle, USA',
     '2026-07-22T09:00:00-07:00'::timestamptz, 'America/Los_Angeles', null,
     '{}'::jsonb, array['four-offices-of-the-future']),
    ('doxa-san-francisco-2026-07', 'keynote', 'published',
     'DOXA San Francisco: The Four Offices of the Future', 'San Francisco, USA',
     '2026-07-24T09:00:00-07:00'::timestamptz, 'America/Los_Angeles', null,
     '{}'::jsonb, array['four-offices-of-the-future']),
    ('eo-melbourne-retreat-2026-10', 'retreat', 'published',
     'EO Melbourne: Infinite Leverage Retreat', 'Melbourne, Australia',
     '2026-10-01T09:00:00+10:00'::timestamptz, 'Australia/Melbourne', null,
     '{}'::jsonb, array[]::text[]),
    ('eo-south-pacific-ignite-2026-10', 'keynote', 'published',
     'EO South Pacific Ignite Conference: The Four Offices of the Future', null,
     '2026-10-18T09:00:00+11:00'::timestamptz, 'Australia/Sydney', null,
     '{}'::jsonb, array['four-offices-of-the-future'])
),
inserted as (
  insert into company_os.events
    (slug, type, status, visibility, title, location, starts_at, timezone,
     attendee_count_override, metadata)
  select slug, type, status, 'private', title, location, starts_at, timezone,
         attendee_count_override,
         metadata || jsonb_build_object('backfill', '20260716121000_workshop_events_backfill')
  from new_events
  on conflict (slug) do nothing
  returning id, slug
)
insert into company_os.event_talks (event_id, talk_id)
select i.id, t.id
from inserted i
join new_events ne on ne.slug = i.slug
join company_os.talks t on t.slug = any(ne.talk_slugs)
on conflict do nothing;
