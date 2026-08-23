-- The founder's idea is the heart of a campaign and deserves room to breathe:
-- a long-form field, distinct from the short `name` used as the title in lists,
-- breadcrumbs, and the hub header. Backfill idea = name so existing campaigns
-- read sensibly until they are expanded.
-- Applied via Supabase MCP.

alter table company_os.marketing_campaigns
  add column if not exists idea text;

update company_os.marketing_campaigns
  set idea = name
  where idea is null;
