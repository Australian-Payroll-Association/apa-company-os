-- Seed the grants from the two admin populations that exist today.
--
-- MUST land before payroll_iq.is_admin() is repointed at has_app_role. Ship the
-- delegation first and every Payroll IQ admin is locked out the moment it
-- deploys, because all 64 policies flip together.

-- 1. Company OS admins. The existing table is keyed by EMAIL, which is mutable
--    and reusable; resolving through people.auth_user_id fixes that on the way in.
insert into company_os.app_access (person_id, app, role, note)
select p.id, 'company_os', 'admin', 'migrated from company_os.admins 2026-09-16'
  from company_os.admins a
  join company_os.people p on lower(p.email::text) = lower(a.email)
 on conflict do nothing;

insert into company_os.app_access (person_id, app, role, note)
select p.id, 'company_os', 'sensitive', 'migrated from admins.can_view_sensitive 2026-09-16'
  from company_os.admins a
  join company_os.people p on lower(p.email::text) = lower(a.email)
 where a.can_view_sensitive
 on conflict do nothing;

-- 2. Payroll IQ admins. Every one needs a company_os.people row for its grant to
--    reference; three already have one from the auth merge, the rest are created
--    here. people.email is citext, so the join is case-insensitive already.
insert into company_os.people (email, full_name, auth_user_id)
select u.email::text, coalesce(pu.full_name, u.email::text), u.id
  from payroll_iq.users pu
  join auth.users u on u.id = pu.id
 where pu.role = 'admin'
   and not exists (select 1 from company_os.people p where p.auth_user_id = u.id)
   and not exists (select 1 from company_os.people p where lower(p.email::text) = lower(u.email));

-- Link any Payroll IQ admin who already had a people row by email but no uid.
update company_os.people p set auth_user_id = u.id
  from payroll_iq.users pu join auth.users u on u.id = pu.id
 where pu.role = 'admin' and p.auth_user_id is null
   and lower(p.email::text) = lower(u.email);

insert into company_os.app_access (person_id, app, role, note)
select p.id, 'payroll_iq', 'admin', 'migrated from payroll_iq.users.role 2026-09-16'
  from payroll_iq.users pu
  join company_os.people p on p.auth_user_id = pu.id
 where pu.role = 'admin'
 on conflict do nothing;

do $chk$
declare piq int; cos int; missing int;
begin
  select count(*) into piq from company_os.app_access where app='payroll_iq' and role='admin' and revoked_at is null;
  select count(*) into cos from company_os.app_access where app='company_os' and role='admin' and revoked_at is null;

  -- Every Payroll IQ admin must now hold a grant. This is the check that stops
  -- the delegation in the next migration locking someone out.
  select count(*) into missing from payroll_iq.users pu
   where pu.role='admin'
     and not exists (
       select 1 from company_os.app_access a join company_os.people p on p.id=a.person_id
        where p.auth_user_id = pu.id and a.app='payroll_iq' and a.role='admin' and a.revoked_at is null);
  if missing <> 0 then raise exception 'Payroll IQ admins with no grant: % - do NOT ship the delegation', missing; end if;

  raise notice 'grants seeded: payroll_iq admin=%, company_os admin=%', piq, cos;
end $chk$;
