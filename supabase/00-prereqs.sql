-- ═══════════════════════════════════════════════════════════════════════════
-- Company OS — prerequisites. Apply BEFORE 01-schema.sql.
--
-- These three groups are what `pg_dump --schema-only --schema=company_os
-- --schema=htt` does NOT produce, and 01-schema.sql will fail without them:
--
--   1. The schemas themselves.
--   2. Extensions. They live in the `extensions` schema, which is outside the
--      dumped schemas, so the dump references citext columns and vector types
--      without ever creating the types.
--   3. Roles. pg_dump never dumps roles — those are cluster-global
--      (pg_dumpall --globals-only). The dump's GRANT statements reference
--      these three by name and error if they do not exist.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

create schema if not exists company_os;
create schema if not exists htt;

-- ── extensions ─────────────────────────────────────────────────────────────
-- citext backs the case-insensitive columns (affiliate codes, github repo
-- names, website URLs, attendee emails). vector is present for embeddings.
create extension if not exists citext        with schema extensions;
create extension if not exists pgcrypto      with schema extensions;
create extension if not exists "uuid-ossp"   with schema extensions;
create extension if not exists vector        with schema extensions;

-- ── least-privilege roles for the database assistants ──────────────────────
--
-- This is the security boundary for the admin and team chat agents. The
-- read-only guarantee is enforced HERE, by Postgres, not by prompt
-- instructions: the reader roles hold SELECT-only grants and a 5s statement
-- timeout, so a prompt injection that reaches the query tool still cannot
-- write. Keep it that way.
--
-- nologin: these are never connected to directly. The application switches
-- into them with SET ROLE for the duration of one assistant query.
-- noinherit: they get exactly the grants in 01-schema.sql, nothing by
-- membership.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'chatbot_reader') then
    create role chatbot_reader nologin noinherit;
  end if;
end $$;

alter role chatbot_reader set statement_timeout = '5s';
alter role chatbot_reader set idle_in_transaction_session_timeout = '10s';
alter role chatbot_reader set search_path = company_os;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'team_chatbot_reader') then
    create role team_chatbot_reader nologin noinherit;
  end if;
end $$;

alter role team_chatbot_reader set statement_timeout = '5s';
alter role team_chatbot_reader set idle_in_transaction_session_timeout = '10s';
alter role team_chatbot_reader set search_path = company_os;

-- The writer role exists for the approval-gated write tools. Reaching it needs
-- an email in CHATBOT_PRIVILEGED_EMAILS *and* a human approval click in the
-- UI. Leave CHATBOT_PRIVILEGED_EMAILS unset and nothing can use it.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'chatbot_writer') then
    create role chatbot_writer nologin noinherit;
  end if;
end $$;

alter role chatbot_writer set statement_timeout = '5s';
alter role chatbot_writer set idle_in_transaction_session_timeout = '10s';
alter role chatbot_writer set search_path = company_os;

-- ── storage buckets ────────────────────────────────────────────────────────
--
-- These live in storage.buckets, which is outside company_os and htt, so a
-- schema-scoped pg_dump does not create them. Without them every upload path
-- fails at runtime: resumes on the careers form, avatars, the photo gallery,
-- marketing images, onboarding plans, ID documents.
--
-- The public/private split is deliberate and load-bearing. The five private
-- buckets hold personal data and are never served directly — the application
-- issues short-lived signed URLs instead (60s for ID documents, 300s for
-- resumes). Flipping any of them to public would expose identity documents
-- and candidate resumes to anyone holding a path. There are no RLS policies
-- on storage.objects by design: all access goes through the service-role
-- client behind the app's own authorization checks.

insert into storage.buckets (id, name, public)
values
  -- public: served directly, non-sensitive
  ('avatars',             'avatars',             true),
  ('event-media',         'event-media',         true),
  ('gallery',             'gallery',             true),
  ('marketing',           'marketing',           true),
  -- private: signed URLs only
  ('id-documents',        'id-documents',        false),
  ('passports',           'passports',           false),
  ('resumes',             'resumes',             false),
  ('meeting-transcripts', 'meeting-transcripts', false),
  ('onboarding-plans',    'onboarding-plans',    false),
  ('program-documents',   'program-documents',   false)
on conflict (id) do nothing;
