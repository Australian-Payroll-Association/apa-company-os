-- Manual social path: when an operator posts a blog/LinkedIn/Facebook entry by
-- hand, they record the live post URL here and the entry moves to 'published'.
-- Distinct from asset_url (the source asset); this is where it went live.
-- Applied via Supabase MCP.

alter table company_os.marketing_calendar
  add column if not exists posted_url text;
