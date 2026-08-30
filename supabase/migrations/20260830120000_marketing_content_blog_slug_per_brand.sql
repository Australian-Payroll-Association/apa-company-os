-- Blog slug uniqueness is per-brand, not global. AI Officer and Edge8 are
-- distinct brands on distinct domains (ai-officer.com/post/<slug>,
-- edge8.ai/blog/<slug>) and may legitimately share a slug. Both site blog
-- readers are brand-scoped (brands!inner(slug) + .eq brand), so the correct
-- key is (brand_id, slug), not a single global slug.
-- Applied to prod via Supabase MCP (central-schema table).

drop index if exists company_os.marketing_content_blog_slug_key;

create unique index if not exists marketing_content_blog_slug_key
  on company_os.marketing_content (brand_id, slug)
  where channel = 'blog' and slug is not null;
