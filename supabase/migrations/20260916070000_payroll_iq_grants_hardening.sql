-- Records the payroll_iq grants and closes three gaps code review found.
--
-- REPRODUCIBILITY FIRST. The grants below already exist on the target, but they
-- were applied ad hoc rather than through a migration, so the repo could not
-- rebuild the database it describes. Re-stating them here is idempotent and
-- makes the ledger the source of truth, per D5.

grant usage on schema payroll_iq to authenticated, service_role;
grant all on all tables in schema payroll_iq to service_role;
grant all on all sequences in schema payroll_iq to service_role;
grant select, insert, update, delete on all tables in schema payroll_iq to authenticated;
grant usage, select on all sequences in schema payroll_iq to authenticated;

-- 1. HIGH: future tables were full-DML to every logged-in user the moment they
--    were created, BEFORE anyone ran `alter table ... enable row level
--    security`. Not exploitable today - all 35 tables have RLS - but it arms
--    the next incident, because the dangerous window is invisible.
--    Default privileges go; tables get their grant explicitly, as they are
--    created, next to the policies that protect them.
alter default privileges in schema payroll_iq revoke all on tables from authenticated;
alter default privileges in schema payroll_iq revoke all on sequences from authenticated;

-- 2. MEDIUM: all 21 payroll_iq functions were EXECUTE-able by PUBLIC, including
--    SECURITY DEFINER ones like admin_org_directory and is_admin. Unreachable by
--    anon today only because anon lacks schema USAGE - a single future
--    `grant usage ... to anon` would turn admin_org_directory into an
--    unauthenticated read of every organisation. Two independent things should
--    have to go wrong, not one.
do $revoke$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'payroll_iq'
  loop
    execute format('revoke all on function %s from public', f.sig);
    execute format('grant execute on function %s to authenticated, service_role', f.sig);
  end loop;
end $revoke$;

revoke all on function app_security.has_app_role(text, text) from public;
grant execute on function app_security.has_app_role(text, text) to authenticated, service_role;

-- 3. LOW: seat_tiers_select named `anon` among its roles. Inert - anon has no
--    USAGE on this schema - but the plan's rule is "anon: nothing, anywhere",
--    and a dormant grant is the kind of thing a later change quietly activates.
drop policy if exists seat_tiers_select on payroll_iq.seat_tiers;
create policy seat_tiers_select on payroll_iq.seat_tiers
  for select to authenticated using (true);

do $chk$
declare pub int; anonpol int; defacl int;
begin
  select count(*) into pub from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='payroll_iq' and p.proacl is null;
  if pub <> 0 then raise exception '% payroll_iq functions still PUBLIC-executable', pub; end if;

  select count(*) into anonpol from pg_policies
   where schemaname='payroll_iq' and 'anon' = any(roles);
  if anonpol <> 0 then raise exception '% payroll_iq policies still name anon', anonpol; end if;

  select count(*) into defacl from pg_default_acl d join pg_namespace n on n.oid=d.defaclnamespace
   where n.nspname='payroll_iq' and defaclobjtype='r'
     and array_to_string(defaclacl,' ') like '%authenticated=%';
  if defacl <> 0 then raise exception 'authenticated still holds a default ACL on new tables'; end if;

  if has_schema_privilege('anon','payroll_iq','USAGE') then
    raise exception 'anon gained USAGE on payroll_iq';
  end if;
end $chk$;
