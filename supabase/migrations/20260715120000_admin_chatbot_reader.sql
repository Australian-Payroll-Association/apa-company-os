-- 20260715120000_admin_chatbot_reader.sql
-- Admin database assistant: a locked-down, read-only Postgres role the chatbot
-- uses for every SELECT it runs. The security boundary is the DATABASE, not the
-- app: this role has USAGE on `company_os` only (never public or any other
-- site's schema in this shared instance), SELECT on its tables, and no write
-- grants anywhere. No matter what SQL the model is coaxed into emitting, it
-- cannot write, cannot reach another schema, and is killed after 5 seconds.
--
-- "Expose everything" was chosen deliberately: the assistant is admin-only and
-- admins already see all of company_os (revenue, expenses, comp) in the UI, so
-- there is no column redaction here. A table-level grant auto-exposes any
-- column added later — which is the intent for this schema.
--
-- ONE MANUAL STEP after applying (the password must never live in git):
--   alter role chatbot_reader with login password '<generate a strong one>';
-- then store the Supavisor pooler connection string (as chatbot_reader) in the
-- CHATBOT_DB_URL env var. See lib/admin-chat/db.ts.

-- ---------------------------------------------------------------------------
-- Role
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'chatbot_reader') then
    create role chatbot_reader nologin noinherit;
  end if;
end $$;

alter role chatbot_reader set statement_timeout = '5s';
alter role chatbot_reader set idle_in_transaction_session_timeout = '10s';
-- Unqualified table names resolve to company_os; the model is also told to
-- schema-qualify, so this is a convenience, not the boundary.
alter role chatbot_reader set search_path = company_os;

-- Scope to company_os ONLY. No usage on public means the shared database's
-- other sites (caiocoach, ai-officer, davehajdu) are structurally unreachable.
grant usage on schema company_os to chatbot_reader;
revoke create on schema company_os from chatbot_reader;

-- SELECT on every existing table/view, plus any created later.
grant select on all tables in schema company_os to chatbot_reader;
alter default privileges in schema company_os grant select on tables to chatbot_reader;

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------
-- company_os tables have RLS enabled with no policies (service-role-only
-- convention), which yields silent EMPTY results for a non-owner role like
-- chatbot_reader. Add an explicit permissive SELECT policy for it on every
-- base table so reads actually return rows. Idempotent; skips views and the
-- one RLS-disabled table (admins), where the grant alone already permits read.

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
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'company_os' and tablename = t and policyname = 'chatbot_reader_select'
    ) then
      execute format(
        'create policy chatbot_reader_select on company_os.%I for select to chatbot_reader using (true)',
        t
      );
    end if;
  end loop;
end $$;
