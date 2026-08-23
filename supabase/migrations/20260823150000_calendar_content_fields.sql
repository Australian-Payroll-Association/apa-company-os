-- Per-post content fields: the deliverables content-studio produces alongside a
-- post (a chosen blog style, the SEO package, and the image direction). Stored
-- on the entry so the calendar carries them and the AI writer can fill them in.
-- Applied via Supabase MCP.

alter table company_os.marketing_calendar
  add column if not exists blog_style text,        -- from the brand's style catalogue (blog entries)
  add column if not exists image_type text,        -- how the visual is sourced
  add column if not exists seo_md text,            -- the Patel SEO deliverable (title tag, meta, slug, keywords, links)
  add column if not exists image_brief_md text;    -- the design brief (concept + palette)

alter table company_os.marketing_calendar
  add constraint marketing_calendar_image_type_check
  check (image_type is null or image_type in ('real', 'ai', 'mixed', 'none'));
