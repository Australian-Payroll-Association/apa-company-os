-- Generated marketing images: a public storage bucket for hero/social images the
-- AI image step produces, plus image_url on the entry pointing at the rendered
-- object. image_brief_md (the direction) and image_style (the aesthetic) already
-- exist; this is where the actual picture lands.
-- Applied via Supabase MCP.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marketing', 'marketing', true, 10485760, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

alter table company_os.marketing_calendar
  add column if not exists image_url text;
