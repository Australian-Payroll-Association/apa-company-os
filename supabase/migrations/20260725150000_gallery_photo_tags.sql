-- Gallery photo tagging: link gallery photos to the people who appear in them.
--
-- Why: the team assistant should be able to answer "show me pictures of <person>".
-- A person's own avatar (people.avatar_url) is already readable, but event/gallery
-- shots had no connection to people. This adds that connection and opens the
-- gallery to the read-only team assistant so it can surface those photos.
--
-- Tagging is self-serve: any team member can tag people in a photo from
-- /team/gallery (and admins from /admin/operations/gallery). Both write through
-- the service-role client after the usual auth gate; no browser-key access.

-- ---------------------------------------------------------------------------
-- 1. The tag table
-- ---------------------------------------------------------------------------
create table if not exists company_os.gallery_photo_people (
  photo_id   uuid not null references company_os.gallery_photos(id) on delete cascade,
  person_id  uuid not null references company_os.people(id) on delete cascade,
  tagged_by  uuid references company_os.people(id) on delete set null, -- who added the tag
  created_at timestamptz not null default now(),
  primary key (photo_id, person_id)
);

-- "photos of <person>" lookups hit person_id; the PK already covers per-photo reads.
create index if not exists gallery_photo_people_person_idx
  on company_os.gallery_photo_people(person_id);

comment on table company_os.gallery_photo_people is
  'Tags linking a gallery photo to the people who appear in it. Powers "photos of <person>" for staff and the team assistant. Self-serve: any team member can tag.';

-- Service-role-only convention (RLS on, no policies); the app reaches this through
-- the service-role key. New company_os tables need the grant explicitly.
alter table company_os.gallery_photo_people enable row level security;
grant select, insert, update, delete on company_os.gallery_photo_people to service_role;

-- ---------------------------------------------------------------------------
-- 2. Open the gallery to the read-only team assistant
-- ---------------------------------------------------------------------------
-- gallery_photos was previously service-role only. Its images are public-bucket
-- URLs and the gallery is already team-visible at /team/gallery, so letting the
-- team_chatbot_reader see photos + their tags fits the open-book boundary. The
-- reader role is unaffected if it does not exist yet (guarded below), so this
-- migration is safe to apply before the assistant's own migration in a fresh DB.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'team_chatbot_reader') then
    grant select on company_os.gallery_photos to team_chatbot_reader;
    grant select on company_os.gallery_photo_people to team_chatbot_reader;
  end if;
end $$;

-- company_os tables have RLS enabled with no policies, which yields silent EMPTY
-- results for a non-owner role. Add the same permissive SELECT policy the reader
-- uses elsewhere, on both tables, idempotently.
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_roles where rolname = 'team_chatbot_reader') then
    return;
  end if;
  foreach t in array array['gallery_photos', 'gallery_photo_people'] loop
    if exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'company_os' and c.relname = t and c.relkind = 'r'
        and c.relrowsecurity = true
    ) and not exists (
      select 1 from pg_policies
      where schemaname = 'company_os' and tablename = t
        and policyname = 'team_chatbot_reader_select'
    ) then
      execute format(
        'create policy team_chatbot_reader_select on company_os.%I for select to team_chatbot_reader using (true)',
        t
      );
    end if;
  end loop;
end $$;
