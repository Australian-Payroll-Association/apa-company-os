-- 20260718120000_team_photo_gallery.sql
--
-- Internal team photo gallery: admins upload photos in /admin, the team browses
-- them in /team, and the /team home shows a collage of avatars + recent photos.
-- Images go in a PUBLIC bucket (same call as avatars) since they're low-
-- sensitivity culture photos and the URLs are only surfaced on gated pages.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gallery', 'gallery', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create table if not exists company_os.gallery_photos (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,        -- public URL (bucket is public)
  storage_path text not null,     -- object path, for deletion
  caption text,
  taken_on date,                  -- optional "when"; null falls back to created_at
  uploaded_by text,               -- admin email
  created_at timestamptz not null default now()
);

comment on table company_os.gallery_photos is
  'Internal team photo gallery. Public-bucket images; admin-managed, team-visible.';

-- Service-role-only convention (RLS on, no policies); the app reaches this
-- through the service-role key. New company_os tables need the grant explicitly.
alter table company_os.gallery_photos enable row level security;
grant select, insert, update, delete on company_os.gallery_photos to service_role;
