-- Campaign umbrella, phase 1 (expand): introduce the marketing_campaigns parent
-- (the founder's idea) and marketing_asset_images (image version history), and
-- begin moving the calendar's email link from campaign_id to broadcast_id.
--
-- Zero-downtime on the live DB: the old campaign_id column is KEPT as a plain
-- uuid (deprecated) so currently-deployed code keeps reading it, but its foreign
-- key MOVES to the new broadcast_id column. Keeping a single FK from
-- marketing_calendar -> email_campaigns means the existing PostgREST embed
-- (email_campaigns(status)) stays unambiguous during the transition. A later
-- migration drops campaign_id and reuses the name for the umbrella link once no
-- code reads it.
-- Applied via Supabase MCP.

-- 1. Broadcast link (supersedes campaign_id as the email-send FK).
alter table company_os.marketing_calendar
  add column if not exists broadcast_id uuid;

update company_os.marketing_calendar
  set broadcast_id = campaign_id
  where broadcast_id is null and campaign_id is not null;

alter table company_os.marketing_calendar
  drop constraint if exists marketing_calendar_campaign_id_fkey;

alter table company_os.marketing_calendar
  add constraint marketing_calendar_broadcast_id_fkey
  foreign key (broadcast_id) references company_os.email_campaigns(id) on delete set null;

comment on column company_os.marketing_calendar.campaign_id is
  'DEPRECATED: superseded by broadcast_id; dropped once the umbrella link reuses this name.';

create index if not exists marketing_calendar_broadcast_idx
  on company_os.marketing_calendar (broadcast_id)
  where broadcast_id is not null;

-- 2. Campaign umbrella: the founder's idea. Assets (calendar entries) link up to
-- one of these in a later phase; a campaign carries a goal, a schedule, a pillar,
-- and an SEO/GEO plan.
create table if not exists company_os.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references company_os.brands(id) on delete set null,
  pillar_id uuid references company_os.marketing_pillars(id) on delete set null,
  name text not null,
  objective text,
  seo_geo_md text,
  starts_on date,
  ends_on date,
  status text not null default 'active',
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_campaigns_status_check check (
    status in ('draft', 'active', 'done', 'archived')
  )
);

create index if not exists marketing_campaigns_brand_idx on company_os.marketing_campaigns (brand_id);
create index if not exists marketing_campaigns_pillar_idx on company_os.marketing_campaigns (pillar_id);

drop trigger if exists set_marketing_campaigns_updated_at on company_os.marketing_campaigns;
create trigger set_marketing_campaigns_updated_at before update on company_os.marketing_campaigns
  for each row execute function company_os.handle_updated_at();

alter table company_os.marketing_campaigns enable row level security;
grant select, insert, update, delete on company_os.marketing_campaigns to service_role;
grant select on company_os.marketing_campaigns to supabase_read_only_user;

-- 3. Image version history: every generated (or uploaded) image for an asset is
-- kept, with the exact prompt that produced it, so a regenerate never destroys
-- the previous one and the operator can revert. marketing_calendar.image_url
-- continues to mirror the selected row so existing reads keep working.
create table if not exists company_os.marketing_asset_images (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references company_os.marketing_calendar(id) on delete cascade,
  url text not null,
  prompt_used text,
  model text,
  is_selected boolean not null default false,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists marketing_asset_images_entry_idx
  on company_os.marketing_asset_images (entry_id, created_at desc);
create unique index if not exists marketing_asset_images_one_selected
  on company_os.marketing_asset_images (entry_id)
  where is_selected;

alter table company_os.marketing_asset_images enable row level security;
grant select, insert, update, delete on company_os.marketing_asset_images to service_role;
grant select on company_os.marketing_asset_images to supabase_read_only_user;

-- Backfill: adopt each existing rendered image as the selected v1 so no picture
-- is orphaned by the move to versioned history.
insert into company_os.marketing_asset_images (entry_id, url, is_selected, created_by)
select id, image_url, true, created_by
from company_os.marketing_calendar
where image_url is not null
  and not exists (
    select 1 from company_os.marketing_asset_images i where i.entry_id = marketing_calendar.id
  );
