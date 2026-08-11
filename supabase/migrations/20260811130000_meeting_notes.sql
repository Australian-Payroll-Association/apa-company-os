-- Client meeting notes (docs/plans/2026-08-11-client-meeting-notes.md).
-- One row = one client meeting: the raw transcript (pasted or extracted from an
-- uploaded file), an AI-generated title / summary / attendee list / date, and a
-- publish gate that controls whether it appears in that client's portal.
--
-- The transcript is captured once (admin server action) and never re-derived;
-- the AI fields are produced fire-and-forget by lib/ai/meeting-summary.ts, the
-- same never-throws pattern as lib/ai/idea-plan.ts (ai_status / ai_model /
-- ai_error mirror the Ideas + ATS rows).
--
-- PORTAL VISIBILITY: the client sees date / attendees / title / summary ONLY,
-- and ONLY once published_at is set. The raw transcript is admin-only and is
-- never selected by lib/portal/meetings.ts. Uploaded source files live in the
-- private `meeting-transcripts` bucket.
--
-- SECURITY MODEL — company_os convention: RLS ENABLED with NO policies, granted
-- ONLY to service_role. The browser/publishable key can read nothing; the app
-- scopes every read/write itself (portal reads gate on actor.companyScope +
-- published_at). Deletion is soft (archived_at), so no delete grant.

create table if not exists company_os.meeting_notes (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references company_os.companies(id),
  -- The meeting date. Nullable because the AI infers it from the transcript;
  -- an admin may set it manually, in which case the AI leaves it alone.
  meeting_date     date,
  -- AI-generated, admin-editable. title/attendees are only auto-filled when
  -- left blank/empty, so a manual value is never overwritten.
  title            text,
  attendees        text[] not null default '{}',
  -- The raw transcript (admin-only). Pasted text, or text extracted server-side
  -- from an uploaded .txt/.vtt/.srt/.md/.docx file.
  transcript       text not null,
  -- The original uploaded file, retained in the private meeting-transcripts
  -- bucket. Null when the transcript was pasted.
  source_file_path text,
  source_file_name text,
  -- AI summary + generation status (mirrors ideas.ai_* / applications.ai_*).
  ai_summary       text,
  ai_status        text not null default 'pending' check (ai_status in ('pending','ready','failed')),
  ai_model         text,
  ai_error         text,
  -- Publish gate: null = admin-only; set = visible in the client's portal.
  published_at     timestamptz,
  created_by       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  archived_at      timestamptz
);

-- Company 360 tab + global admin list: newest meeting first per company.
create index if not exists meeting_notes_company_idx
  on company_os.meeting_notes (company_id, meeting_date desc nulls last, created_at desc)
  where archived_at is null;

-- Portal list: published rows for a set of companies.
create index if not exists meeting_notes_published_idx
  on company_os.meeting_notes (company_id, published_at)
  where archived_at is null and published_at is not null;

-- company_os convention: RLS on with no policies; only service_role can touch
-- the table. No delete grant — deletion is archived_at (soft delete).
alter table company_os.meeting_notes enable row level security;
grant select, insert, update on company_os.meeting_notes to service_role;

-- Meeting transcripts are free-form, client-confidential text. Keep them out of
-- the NL->SQL assistants: the admin roles (chatbot_reader / chatbot_writer) are
-- auto-granted by company_os schema default privileges, so revoke them
-- explicitly; team_chatbot_reader is allow-list based and already denied.
revoke all on company_os.meeting_notes from chatbot_reader, chatbot_writer;

-- Private bucket for the original uploaded transcript files.
insert into storage.buckets (id, name, public)
values ('meeting-transcripts', 'meeting-transcripts', false)
on conflict (id) do nothing;
