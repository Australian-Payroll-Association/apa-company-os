-- 20260718200000_admin_chatbot_writer.sql
-- Admin assistant write mode: a second locked-down Postgres role the chatbot
-- uses for INSERT/UPDATE statements that the privileged admin has explicitly
-- approved in the chat UI. Mirrors chatbot_reader
-- (20260715120000_admin_chatbot_reader.sql) with two additions and one hard
-- limit:
--   + INSERT and UPDATE on company_os tables (and USAGE on sequences)
--   + matching RLS policies (the reader migration only added SELECT policies)
--   - NO DELETE, ever: removals happen by setting archived_at (the CRM's
--     soft-delete convention), so nothing done through the chat is irreversible.
--
-- people_sensitive stays completely invisible to this role, same as the reader.
--
-- ONE MANUAL STEP after applying (the password must never live in git):
--   alter role chatbot_writer with login password '<generate a strong one>';
-- then store the Supavisor pooler connection string (as chatbot_writer) in the
-- CHATBOT_WRITE_DB_URL env var. See lib/admin-chat/db.ts.

-- ---------------------------------------------------------------------------
-- Role
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'chatbot_writer') then
    create role chatbot_writer nologin noinherit;
  end if;
end $$;

alter role chatbot_writer set statement_timeout = '5s';
alter role chatbot_writer set idle_in_transaction_session_timeout = '10s';
alter role chatbot_writer set search_path = company_os;

-- Scope to company_os ONLY (shared instance: other sites' schemas stay
-- structurally unreachable).
grant usage on schema company_os to chatbot_writer;
revoke create on schema company_os from chatbot_writer;

-- SELECT (for RETURNING and WHERE), INSERT, UPDATE — but never DELETE or
-- TRUNCATE — on every existing table, plus any created later.
grant select, insert, update on all tables in schema company_os to chatbot_writer;
alter default privileges in schema company_os
  grant select, insert, update on tables to chatbot_writer;

-- Serial/identity columns need sequence access on insert.
grant usage, select on all sequences in schema company_os to chatbot_writer;
alter default privileges in schema company_os
  grant usage, select on sequences to chatbot_writer;

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------
-- Same pattern as chatbot_reader_select: company_os tables have RLS enabled
-- with no policies, so a non-owner role gets empty reads and blocked writes
-- without explicit permissive policies. people_sensitive is skipped — it must
-- stay invisible to the assistant in both directions.

do $$
declare
  t text;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'company_os'
      and c.relkind = 'r'
      and c.relrowsecurity = true
      and c.relname <> 'people_sensitive'
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'company_os' and tablename = t and policyname = 'chatbot_writer_select'
    ) then
      execute format(
        'create policy chatbot_writer_select on company_os.%I for select to chatbot_writer using (true)',
        t
      );
    end if;
    if not exists (
      select 1 from pg_policies
      where schemaname = 'company_os' and tablename = t and policyname = 'chatbot_writer_insert'
    ) then
      execute format(
        'create policy chatbot_writer_insert on company_os.%I for insert to chatbot_writer with check (true)',
        t
      );
    end if;
    if not exists (
      select 1 from pg_policies
      where schemaname = 'company_os' and tablename = t and policyname = 'chatbot_writer_update'
    ) then
      execute format(
        'create policy chatbot_writer_update on company_os.%I for update to chatbot_writer using (true) with check (true)',
        t
      );
    end if;
  end loop;
end $$;

-- Belt-and-suspenders: people_sensitive must have no grants for this role
-- (the loop above already skips its policies).
revoke all on company_os.people_sensitive from chatbot_writer;
