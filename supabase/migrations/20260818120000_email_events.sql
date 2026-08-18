-- Resend delivery feedback. Until now the only thing we knew about an email was
-- that Resend ACCEPTED it (lib/email.ts returns true and logs an interaction).
-- Whether it was delivered, bounced, or marked as spam was invisible, which is
-- exactly the data you need before sending bulk mail from a domain that never has.
--
-- Resend has no aggregate stats API; delivery data arrives as webhooks, one row
-- per event here. campaign_id is nullable and unreferenced until the campaigns
-- migration lands, so transactional events (the majority today) just carry null.
--
-- Idempotency: Resend retries on any non-2xx, so the same event can arrive more
-- than once. The unique index makes a redelivery a no-op rather than a double count.
-- Applied via Supabase MCP.
create table if not exists company_os.email_events (
  id uuid primary key default gen_random_uuid(),
  resend_email_id text not null,
  event_type text not null,
  recipient text not null,
  person_id uuid references company_os.people(id),
  campaign_id uuid,
  subject text,
  occurred_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint email_events_type_check check (
    event_type in (
      'sent', 'delivered', 'delivery_delayed', 'bounced',
      'complained', 'opened', 'clicked', 'failed'
    )
  )
);

-- One row per (email, event type, moment). Resend can legitimately send several
-- 'opened' events for one email at different times, so occurred_at is part of
-- the key; a retry of the same event repeats all three and is discarded.
create unique index if not exists email_events_dedupe_idx
  on company_os.email_events (resend_email_id, event_type, occurred_at);

create index if not exists email_events_recipient_idx on company_os.email_events (recipient);
create index if not exists email_events_person_idx on company_os.email_events (person_id);
create index if not exists email_events_occurred_idx on company_os.email_events (occurred_at desc);
create index if not exists email_events_campaign_idx on company_os.email_events (campaign_id)
  where campaign_id is not null;

alter table company_os.email_events enable row level security;
grant select, insert on company_os.email_events to service_role;
grant select on company_os.email_events to supabase_read_only_user;
