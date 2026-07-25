-- Assistant chat history (docs/plans/2026-07-25-assistant-chat-history-build-plan.md).
-- One table backs BOTH AI assistants — admin (/admin) and team (/team). It is the
-- same assistant pattern gated by who logs in, so persistence is built once and
-- partitioned by `surface`. Each row is one conversation, owned by the Supabase
-- auth user who created it; the transcript the client round-trips (`messages`)
-- and the render-friendly display items (`display_items`) are stored verbatim as
-- JSONB, a 1:1 mapping of what the widgets already serialize to sessionStorage.
--
-- SECURITY MODEL — same as the rest of company_os: RLS is ENABLED with NO
-- policies and the table is granted ONLY to service_role. The browser/publishable
-- key can read nothing here. All access goes through the service-role client
-- (lib/supabase.ts), and every store function in lib/assistant-history/ scopes on
-- (surface, owner_auth_user_id) so no cross-user or cross-surface access is even
-- expressible. Deletion is soft (archived_at), matching Company OS convention, so
-- no delete grant is needed.

create table if not exists company_os.assistant_conversations (
  id                  uuid primary key default gen_random_uuid(),
  -- which assistant this conversation belongs to; partitions admin from team.
  surface             text not null check (surface in ('admin','team')),
  -- the per-user owner key = auth.uid() of the signed-in Supabase user.
  owner_auth_user_id  uuid not null,
  -- optional link to the person record, for joins/reporting (nullable: admins
  -- are matched by email and may have no linked person).
  owner_person_id     uuid references company_os.people(id),
  title               text not null default 'New chat',
  -- the Anthropic transcript the client echoes back each turn (trimmed for model
  -- context) and the complete render items (never trimmed) for exact UI restore.
  messages            jsonb not null default '[]'::jsonb,
  display_items       jsonb not null default '[]'::jsonb,
  last_message_at     timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  archived_at         timestamptz
);

-- Drives the history list: newest active conversation first, per user per surface.
create index if not exists assistant_conversations_owner_idx
  on company_os.assistant_conversations (surface, owner_auth_user_id, last_message_at desc)
  where archived_at is null;

-- company_os convention: RLS on with no policies; only service_role (explicitly
-- granted) can touch the table, and the app scopes every read/write itself.
-- No delete grant — deletion is archived_at (soft delete).
alter table company_os.assistant_conversations enable row level security;
grant select, insert, update on company_os.assistant_conversations to service_role;

-- The admin assistant's SQL roles (chatbot_reader / chatbot_writer) and the team
-- assistant's team_chatbot_reader must NOT reach this table — history is data ABOUT
-- the assistants, read via the app's service-role client, never surfaced through the
-- in-chat query_database tool (which would expose other users' transcripts). The two
-- admin roles are auto-granted here by company_os schema default privileges, so
-- revoke them explicitly; team_chatbot_reader is allow-list based and already denied.
revoke all on company_os.assistant_conversations from chatbot_reader;
revoke all on company_os.assistant_conversations from chatbot_writer;
