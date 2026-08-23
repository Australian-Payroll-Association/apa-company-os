-- Preferred style catalogues per brand (blog types, image styles, social post
-- styles) plus the aesthetic image_style and social_style on each entry. Values
-- are slugs from lib/marketing/style-catalogues.ts. image_style (aesthetic, e.g.
-- pop-art) is distinct from image_type (source: real/ai/mixed/none).
-- Applied via Supabase MCP.

alter table company_os.brand_profiles
  add column if not exists preferred_blog_types text[] not null default '{}',
  add column if not exists preferred_image_styles text[] not null default '{}',
  add column if not exists preferred_social_styles text[] not null default '{}';

alter table company_os.marketing_calendar
  add column if not exists image_style text,   -- aesthetic slug (pop-art, editorial-illustration, ...)
  add column if not exists social_style text;  -- social post style slug (hook-story, hot-take, ...)

-- Seed recommended defaults.
update company_os.brand_profiles set
  preferred_blog_types = array['thesis','contrarian','warning','case-study','open-letter'],
  preferred_image_styles = array['editorial-illustration','typographic-splash','cinematic-photo','data-diagram','pop-art'],
  preferred_social_styles = array['hook-story','hot-take','lesson-learned','data-point','story-time']
where brand_id = (select id from company_os.brands where slug = 'edge8');

update company_os.brand_profiles set
  preferred_blog_types = array['framework','research-dive','case-study','myth-buster','thesis'],
  preferred_image_styles = array['data-diagram','minimalist','editorial-illustration','photorealistic'],
  preferred_social_styles = array['framework-drop','data-point','myth-reality','lesson-learned','hook-story']
where brand_id = (select id from company_os.brands where slug = 'ai-officer');
