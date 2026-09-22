-- payroll_iq: HubSpot licence sync (plan 090)
--
-- HubSpot owns accounts and payments for APA members. A one-way sync driven by
-- the contact property `payroll_iq_licence_assigned` creates the learner, sends
-- a magic link, disables on cancellation and re-enables on reactivation. This
-- migration is the storage half: two columns of provenance on `users`, the
-- event log that is also the idempotency anchor, one organisation for the whole
-- lane, and a seat guard that steps aside for it.
--
-- Spec: payroll-training-au `.specify/features/090-hubspot-licence-sync/`.

begin;

-- ---------------------------------------------------------------------------
-- 1. Provenance on the learner row
-- ---------------------------------------------------------------------------
--
-- `hubspot_contact_id` is UNIQUE because it is the primary resolution key in
-- `applyLicenceSignal`: two learner rows claiming the same HubSpot contact
-- would make "which user does this event belong to" ambiguous at exactly the
-- moment we are disabling access. The constraint turns that into a write error
-- we log, rather than a coin flip.
--
-- `membership_number` is NOT unique and NOT an access gate. A corporate
-- membership legitimately covers many contacts, and the number is only ever
-- read by a human answering a support question. It lives on the `memberships`
-- custom object in HubSpot (property `mebership_number_number` — the typo is
-- HubSpot's, see research.md), reached through a contact association, so it is
-- nullable: a contact with no membership association still gets a working
-- account.
alter table payroll_iq.users
  add column if not exists hubspot_contact_id text,
  add column if not exists membership_number  text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'users_hubspot_contact_id_key'
       and conrelid = 'payroll_iq.users'::regclass
  ) then
    alter table payroll_iq.users
      add constraint users_hubspot_contact_id_key unique (hubspot_contact_id);
  end if;
end $$;

comment on column payroll_iq.users.hubspot_contact_id is
  'HubSpot contact objectId that owns this learner''s licence. Unique: the licence webhook resolves the user by this first, and a duplicate would make a deactivation ambiguous. Null for anyone not on the HubSpot lane.';
comment on column payroll_iq.users.membership_number is
  'APA membership number, copied from the associated HubSpot memberships record (mebership_number_number). Provenance for support only — never an access gate, and deliberately not unique because one corporate membership covers many contacts.';

-- ---------------------------------------------------------------------------
-- 2. The event log
-- ---------------------------------------------------------------------------
--
-- Written FIRST, before the core acts, with a placeholder outcome. Two things
-- fall out of that ordering:
--
--   * a crash between the insert and the effect still leaves a trace, so a
--     learner who never got their email is findable rather than invisible;
--   * `hubspot_event_id` being UNIQUE makes the insert itself the dedupe. A
--     HubSpot redelivery (it retries on any non-2xx, and batches can repeat)
--     hits the constraint and stops before sending a second email.
--
-- The poll backstop shares the table and synthesises an id of the form
-- `poll:<contactId>:<hs_lastmodifieddate>`, which is stable for an unchanged
-- contact — so a cron that runs twice over the same window is also a no-op.
create table if not exists payroll_iq.licence_events (
  id                 uuid primary key default gen_random_uuid(),
  hubspot_event_id   text not null unique,
  hubspot_contact_id text not null,
  property_value     text,
  source             text not null,
  occurred_at        timestamptz not null,
  received_at        timestamptz not null default now(),
  user_id            uuid references payroll_iq.users(id) on delete set null,
  outcome            text not null,
  detail             jsonb not null default '{}'::jsonb,
  constraint licence_events_source_valid
    check (source = any (array['webhook'::text, 'poll'::text])),
  constraint licence_events_outcome_valid
    check (outcome = any (array[
      'created'::text, 'reactivated'::text, 'migrated'::text,
      'deactivated'::text, 'noop'::text, 'ignored'::text,
      'conflict'::text, 'error'::text
    ]))
);

comment on table payroll_iq.licence_events is
  'One row per inbound HubSpot licence signal, written before the effect. Also the idempotency anchor: hubspot_event_id is unique, so a redelivery cannot double-apply. Service role only.';
comment on column payroll_iq.licence_events.property_value is
  'The value of payroll_iq_licence_assigned as FETCHED from HubSpot, not as carried in the webhook payload. Acting on the fetched value is what makes out-of-order delivery harmless.';
comment on column payroll_iq.licence_events.outcome is
  'Starts as ''error'' (the placeholder written before we act) and is updated once the effect lands. A row still reading ''error'' is an interrupted run, and is the first thing to look at.';

-- `user_id` is ON DELETE SET NULL rather than CASCADE on purpose: the history
-- of a licence is the reason this table exists, and deleting a learner must
-- not erase the record of them having been granted and revoked access.

create index if not exists licence_events_contact_occurred_idx
  on payroll_iq.licence_events (hubspot_contact_id, occurred_at desc);

-- Finding a stuck run is a support question, so give it an index too.
create index if not exists licence_events_outcome_received_idx
  on payroll_iq.licence_events (outcome, received_at desc);

-- No policies, by design. Only service-role code (the webhook route and the
-- cron) touches this table; RLS on with zero policies means an `authenticated`
-- client reads nothing even if a future query forgets to filter. If the admin
-- console ever needs to show the log, add one `is_admin()` SELECT policy —
-- mirroring payroll_iq.hubspot_outbox — rather than granting the table.
alter table payroll_iq.licence_events enable row level security;

grant all on table payroll_iq.licence_events to service_role;

-- ---------------------------------------------------------------------------
-- 3. The organisation that holds the whole HubSpot lane
-- ---------------------------------------------------------------------------
--
-- APA members are individuals, but every `users` row needs an `org_id` (see
-- users_member_has_org). One organisation for the lane keeps the manager
-- console, seat usage and team insights working unchanged, and is read by slug
-- at runtime — never by a hardcoded uuid.
--
-- Every column not named here takes its table default deliberately:
-- `learner_seats` gets 1, and section 4 makes sure nothing ever reads it for
-- this org. Writing a large number here would be a fiction that some later
-- report would quote as a fact.
insert into payroll_iq.organisations (name, slug, billing_lane)
values ('APA Members', 'apa-members', 'hubspot')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- 3b. The poll backstop's watermark
-- ---------------------------------------------------------------------------
--
-- Seeded here rather than created on first run because `platform_settings`
-- has no INSERT policy by design — the cron reads and UPDATEs one row, and an
-- update against a row that does not exist succeeds while changing nothing.
-- That failure is silent and would make the backstop rescan its full lookback
-- window every night forever, which works but hides the fault.
--
-- The value is deliberately null-ish rather than a date: the first run has no
-- watermark, falls back to its lookback window, and writes a real one.
insert into payroll_iq.platform_settings (key, value, description)
values (
  'licence.poll.watermark',
  '{}'::jsonb,
  'HubSpot licence poll backstop: the instant the last reconciliation pass completed, as {"at": "<iso>"}. Written by the daily billing cron (plan 090). Empty means "never run" — the next pass falls back to its lookback window.'
)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 4. The seat guard steps aside for the HubSpot lane
-- ---------------------------------------------------------------------------
--
-- HubSpot is the licence ledger for this lane, so a seat ceiling here would be
-- a second, always-wrong copy of it. The early return is the whole change; the
-- rest of the body is unchanged from 01-schema.sql.
--
-- The check runs BEFORE the `for update` lock, so the HubSpot lane also stops
-- serialising every concurrent learner insert behind one organisation row —
-- which matters because a HubSpot batch can carry up to 100 events.
create or replace function payroll_iq.assert_org_within_seats(p_org_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path to ''
as $$
declare
  v_seats integer;
  v_used  integer;
  v_lane  text;
begin
  -- Staff are orgless by CHECK and never learners; nothing to enforce.
  if p_org_id is null then
    return;
  end if;

  -- Seats are not a concept on the HubSpot lane: HubSpot decides who holds a
  -- licence, and learner_seats is never read for such an org.
  select o.billing_lane into v_lane
    from payroll_iq.organisations o
   where o.id = p_org_id;

  if v_lane = 'hubspot' then
    return;
  end if;

  select o.learner_seats into v_seats
    from payroll_iq.organisations o
   where o.id = p_org_id
     for update;

  -- No org row: the foreign key will raise a better error than we can.
  if v_seats is null then
    return;
  end if;

  v_used := payroll_iq.org_seats_used(p_org_id);

  if v_used > v_seats then
    raise exception 'seat_limit_reached: % of % seats in use', v_used, v_seats
      using errcode = 'check_violation',
            hint = 'seat_limit_reached';
  end if;
end;
$$;

comment on function payroll_iq.assert_org_within_seats(uuid) is
  'Raises seat_limit_reached when an organisation is over its learner_seats. Returns early for billing_lane = ''hubspot'', where HubSpot is the licence ledger and learner_seats is meaningless (plan 090).';

commit;
