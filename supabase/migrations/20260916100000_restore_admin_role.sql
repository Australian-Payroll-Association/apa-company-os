-- Revert the role collapse. It broke the application.
--
-- 20260916060000 renamed every admin's role to 'staff' on the reasoning that
-- role no longer carries authorisation once payroll_iq.is_admin() delegates to
-- company_os.app_access. That is true of RLS and false of the APPLICATION:
-- requireAdmin() checks `user.role !== 'admin'`, and 28 call sites across the
-- app read the column the same way. Renaming it locked all five Payroll IQ
-- admins out of their own console with a plain "requires an administrator",
-- and no error anywhere pointing at the cause.
--
-- The collapse was tidy-up, not a requirement of the consolidation. The grants
-- are what the database enforces and they stay; the column goes back to
-- mirroring them so the app works. Unifying the app on has_app_role is real
-- work with 28 call sites and belongs in its own change, not in a cutover.

alter table payroll_iq.users drop constraint if exists users_role_check;
alter table payroll_iq.users drop constraint if exists users_member_has_org;

update payroll_iq.users set role = 'admin' where role = 'staff';

alter table payroll_iq.users
  add constraint users_role_check check (role in ('manager','learner','admin'));

-- Members need an org; admins may or may not have one (migrations 025 and 026
-- deliberately allowed an admin to belong to one, and 2 of the 5 do).
alter table payroll_iq.users
  add constraint users_member_has_org check (role = 'admin' or org_id is not null);

comment on column payroll_iq.users.role is
  'admin | manager | learner. RLS authorises through company_os.app_access via app_security.has_app_role; this column is what the APPLICATION still reads (requireAdmin and 27 other call sites). The two must agree until the app is moved onto grants.';

do $chk$
declare admins int; mismatch int;
begin
  select count(*) into admins from payroll_iq.users where role='admin';
  if admins <> 5 then raise exception 'expected the 5 admins restored, found %', admins; end if;

  if exists (select 1 from payroll_iq.users where role='staff') then
    raise exception 'staff rows remain'; end if;

  -- The column and the grants must name the same people, or the app and the
  -- database disagree about who is an admin - which is how this broke.
  select count(*) into mismatch
    from payroll_iq.users u
   where u.role = 'admin'
     and not exists (
       select 1 from company_os.app_access a
       join company_os.people p on p.id = a.person_id
        where p.auth_user_id = u.id and a.app='payroll_iq'
          and a.role='admin' and a.revoked_at is null);
  if mismatch <> 0 then
    raise exception '% admins by column have no matching grant', mismatch; end if;
end $chk$;
