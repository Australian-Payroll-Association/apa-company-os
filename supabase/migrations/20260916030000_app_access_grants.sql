-- Per-app authorisation grants.
--
-- The client asked for separate logins with merged auth. A shared admin LIST
-- was rejected earlier, correctly: the Payroll IQ admins and the APA Company OS
-- admins are different departments, and one list would have given each
-- department the other's access. A grant table answers that directly -
-- membership is not the permission, the grant is. Someone who may use both apps
-- has two rows; someone who may use one has one.

create table if not exists company_os.app_access (
  id         uuid primary key default gen_random_uuid(),
  person_id  uuid not null references company_os.people(id) on delete cascade,
  app        text not null check (app in ('company_os','payroll_iq')),
  role       text not null,
  granted_by uuid references company_os.people(id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  note       text
);

comment on table company_os.app_access is
  'Who may use which APA app, in what capacity. Revocation is a timestamp, never a delete, so the history of who held what and when survives an audit.';

-- One live grant per person/app/role. Partial, so a revoked grant does not
-- block re-granting later.
create unique index if not exists app_access_live
  on company_os.app_access (person_id, app, role) where revoked_at is null;
create index if not exists app_access_person
  on company_os.app_access (person_id) where revoked_at is null;

alter table company_os.app_access enable row level security;
grant select, insert, update on company_os.app_access to service_role;

-- The contract. Apps call THIS, never the table, so Company OS can restructure
-- grants without touching Payroll IQ's 64 policies.
create or replace function app_security.has_app_role(app_param text, role_param text)
returns boolean language sql stable security definer set search_path = '' as $fn$
  select exists (
    select 1
    from company_os.app_access a
    join company_os.people p on p.id = a.person_id
    where p.auth_user_id = auth.uid()
      and a.app = app_param
      and a.role = role_param
      and a.revoked_at is null);
$fn$;

comment on function app_security.has_app_role(text, text) is
  'The one authorisation contract every APA app calls. Resolves auth.uid() to a person, then to a live grant. STABLE, so Postgres caches it per statement - which is why a table lookup costs nothing next to JWT claims, and unlike claims a revocation takes effect on the next request with no token refresh.';

grant execute on function app_security.has_app_role(text, text) to authenticated, service_role;

do $chk$
begin
  if to_regclass('company_os.app_access') is null then
    raise exception 'app_access was not created';
  end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                  where n.nspname='app_security' and p.proname='has_app_role') then
    raise exception 'has_app_role was not created';
  end if;
end $chk$;
