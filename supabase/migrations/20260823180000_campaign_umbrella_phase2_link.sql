-- Campaign umbrella, phase 2 (contract): the email-send link now lives on
-- broadcast_id (phase 1) and no code reads the deprecated campaign_id, so drop it
-- and reuse the name for the umbrella link: an asset (calendar entry) belongs to
-- one marketing_campaigns row (the founder's idea). Nullable so an asset can
-- exist without a campaign.
-- Applied via Supabase MCP.

drop index if exists company_os.marketing_calendar_campaign_idx;

alter table company_os.marketing_calendar
  drop column if exists campaign_id;

alter table company_os.marketing_calendar
  add column campaign_id uuid references company_os.marketing_campaigns(id) on delete set null;

create index if not exists marketing_calendar_campaign_idx
  on company_os.marketing_calendar (campaign_id)
  where campaign_id is not null;
