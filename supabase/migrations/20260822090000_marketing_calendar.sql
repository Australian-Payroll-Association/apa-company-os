-- Marketing calendar: one planning table for content across blog, email,
-- LinkedIn, and Facebook. The model is a repurposing waterfall: a core asset
-- (usually blog) is the parent, and channel derivatives point at it via
-- parent_id. Email entries can link to a real email_campaigns row so the
-- calendar shows true send status instead of a manually-updated one.
--
-- Not built on company_os.campaigns (the empty generic marketing record): a
-- calendar entry is a unit of content on a date, not a budgeted campaign, and
-- email entries already have email_campaigns for the heavy lifting.
-- Applied via Supabase MCP.

create table if not exists company_os.marketing_calendar (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  -- Which identity this content is for (Edge8, AI Officer, …). References the
  -- existing company_os.brands table rather than a hardcoded enum so new brands
  -- appear in the picker without a migration.
  brand_id uuid references company_os.brands(id) on delete set null,
  pillar text,
  channel text not null,
  status text not null default 'idea',
  publish_date date,
  -- Repurposing waterfall: derivatives point at their core asset.
  parent_id uuid references company_os.marketing_calendar(id) on delete set null,
  campaign_id uuid references company_os.email_campaigns(id) on delete set null,
  copy_md text,
  asset_url text,
  notes text,
  -- Kanban rank within a status column. Double precision so a drag between two
  -- cards is a midpoint write, not a renumber of the whole column.
  sort_order double precision not null default 0,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_calendar_channel_check check (
    channel in ('blog', 'email', 'linkedin', 'facebook')
  ),
  constraint marketing_calendar_status_check check (
    status in ('idea', 'drafted', 'approved', 'scheduled', 'published', 'skipped')
  )
);

create index if not exists marketing_calendar_publish_idx on company_os.marketing_calendar (publish_date);
create index if not exists marketing_calendar_brand_idx on company_os.marketing_calendar (brand_id);
create index if not exists marketing_calendar_status_idx on company_os.marketing_calendar (status);
create index if not exists marketing_calendar_campaign_idx
  on company_os.marketing_calendar (campaign_id)
  where campaign_id is not null;

drop trigger if exists set_marketing_calendar_updated_at on company_os.marketing_calendar;
create trigger set_marketing_calendar_updated_at before update on company_os.marketing_calendar
  for each row execute function company_os.handle_updated_at();

alter table company_os.marketing_calendar enable row level security;

-- Delete is granted: entries are planning data, not send history.
grant select, insert, update, delete on company_os.marketing_calendar to service_role;
grant select on company_os.marketing_calendar to supabase_read_only_user;

-- Campaigns carry a brand too: a send goes out as Edge8 or AI Officer, and the
-- calendar entry that spawns a campaign passes its brand through.
alter table company_os.email_campaigns
  add column if not exists brand_id uuid references company_os.brands(id) on delete set null;
create index if not exists email_campaigns_brand_idx on company_os.email_campaigns (brand_id);
