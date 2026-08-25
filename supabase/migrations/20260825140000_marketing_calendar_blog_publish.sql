-- Blog publishing off marketing_calendar: normalize the fields the public /post
-- and /blog pages need into real columns (parsed once at publish time from the
-- loose seo_md), plus a slug uniqueness guard so one live URL maps to one asset.
-- Rendering reads these columns directly; it never parses seo_md.

alter table company_os.marketing_calendar
  add column if not exists slug text,
  add column if not exists title_tag text,
  add column if not exists meta_description text,
  add column if not exists excerpt text,
  add column if not exists primary_keyword text,
  add column if not exists category text,        -- display name, e.g. 'Innovation'
  add column if not exists category_slug text,   -- e.g. 'innovation'
  add column if not exists read_time text,        -- 'N min read', computed at publish
  add column if not exists published_at timestamptz;

-- One published blog URL per slug. Partial: only blog assets with a slug are
-- constrained, so email/social rows and unpublished drafts are unaffected.
create unique index if not exists marketing_calendar_blog_slug_key
  on company_os.marketing_calendar (slug)
  where channel = 'blog' and slug is not null;

-- marketing_calendar is already granted to service_role by its base migration;
-- new columns inherit those grants, so no additional grant is required.
