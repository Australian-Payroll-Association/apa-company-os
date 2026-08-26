-- Applied via Supabase Management API (supabase db query --linked, role postgres) on 2026-08-26.
--
-- 20260826130000_hub_meetings_program_tag.sql
--
-- Meetings gain an optional AI Program association, like documents already
-- have (plan: Client Hub by AI Program redesign, meetings program tag PR).
-- Strictly additive: NULL means company-wide, which is today's behavior for
-- every existing row. Deleting a program only clears the tag (ON DELETE SET
-- NULL); the meeting itself is untouched.

alter table company_os.meetings
  add column if not exists ai_program_id uuid references company_os.ai_programs(id) on delete set null;

-- Only tagged meetings are ever looked up by program, so a partial index keeps
-- it small.
create index if not exists meetings_ai_program_id_idx
  on company_os.meetings (ai_program_id)
  where ai_program_id is not null;

comment on column company_os.meetings.ai_program_id is
  'Optional AI Program tag; NULL = company-wide meeting.';
