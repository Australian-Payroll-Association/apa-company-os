-- Newsletter campaigns.
--
-- Not built on the pre-existing empty company_os.campaigns table: that one is a
-- generic multi-channel marketing record (name/channel/status/budget_cents) with
-- no subject, body, audience, or per-recipient state, so an email send cannot be
-- modelled on it. It is left alone for a future ads/umbrella use.
--
-- Two tables because a campaign has one body but N independent delivery
-- outcomes. The recipients table is also the send queue: the cron sender claims
-- pending rows in batches, so a crash mid-campaign resumes exactly where it
-- stopped instead of re-mailing everyone.
-- Applied via Supabase MCP.

create table if not exists company_os.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null,
  preheader text,
  body_md text not null default '',
  status text not null default 'draft',
  segment jsonb not null default '{}'::jsonb,
  from_email text,
  reply_to text,
  -- Batching is not optional. The sending domain has never sent bulk mail, so
  -- reputation has to build gradually and a bad list must surface on batch one.
  batch_size integer not null default 150,
  scheduled_at timestamptz,
  approved_at timestamptz,
  approved_by text,
  sent_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_campaigns_status_check check (
    status in ('draft', 'approved', 'sending', 'sent', 'cancelled')
  ),
  constraint email_campaigns_batch_size_check check (batch_size between 1 and 1000)
);

create index if not exists email_campaigns_status_idx on company_os.email_campaigns (status);
create index if not exists email_campaigns_created_idx on company_os.email_campaigns (created_at desc);

drop trigger if exists set_email_campaigns_updated_at on company_os.email_campaigns;
create trigger set_email_campaigns_updated_at before update on company_os.email_campaigns
  for each row execute function company_os.handle_updated_at();

create table if not exists company_os.email_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references company_os.email_campaigns(id) on delete cascade,
  person_id uuid not null references company_os.people(id),
  email text not null,
  status text not null default 'pending',
  skip_reason text,
  resend_email_id text,
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint email_campaign_recipients_status_check check (
    status in ('pending', 'sent', 'skipped', 'failed')
  ),
  constraint email_campaign_recipients_unique unique (campaign_id, person_id)
);

-- The sender's hot path: "next N pending rows for this campaign".
create index if not exists email_campaign_recipients_queue_idx
  on company_os.email_campaign_recipients (campaign_id, status)
  where status = 'pending';
create index if not exists email_campaign_recipients_person_idx
  on company_os.email_campaign_recipients (person_id);

alter table company_os.email_campaigns enable row level security;
alter table company_os.email_campaign_recipients enable row level security;

-- No delete on campaigns: cancelling is a status, so send history is never lost.
grant select, insert, update on company_os.email_campaigns to service_role;
grant select, insert, update, delete on company_os.email_campaign_recipients to service_role;
grant select on company_os.email_campaigns to supabase_read_only_user;
grant select on company_os.email_campaign_recipients to supabase_read_only_user;
