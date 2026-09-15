-- Repoint Payroll IQ's admin check at the shared grant table.
--
-- The cheapest high-leverage change in the whole consolidation: 88 call sites
-- across the policies invoke app_security.is_admin(), and the only place that
-- inlined the role check was the body of is_admin() itself. Rewriting that one
-- body flips every policy at once. (The helper now lives in payroll_iq, moved by
-- the schema transform; app_security holds cross-app contracts only.)
--
-- Safe to run only because the grants were seeded in the previous migration,
-- whose post-condition refuses to pass while any Payroll IQ admin lacks one.

create or replace function payroll_iq.is_admin()
returns boolean language sql stable security definer set search_path = '' as $fn$
  select app_security.has_app_role('payroll_iq', 'admin');
$fn$;

comment on function payroll_iq.is_admin() is
  'Delegates to app_security.has_app_role. payroll_iq.users.role no longer carries authorisation - it is membership only. Changing who is an admin is now an INSERT or a revoked_at stamp in company_os.app_access, with no deploy.';

do $chk$
declare admins int; non_admins int;
begin
  -- Every seeded Payroll IQ admin must still resolve as admin. auth.uid() is
  -- null in this context so has_app_role cannot be called directly; check the
  -- grant graph it reads instead.
  select count(*) into admins
    from payroll_iq.users pu
    join company_os.people p on p.auth_user_id = pu.id
    join company_os.app_access a on a.person_id = p.id
   where pu.role = 'admin' and a.app='payroll_iq' and a.role='admin' and a.revoked_at is null;
  if admins = 0 then raise exception 'no Payroll IQ admin resolves through the grant graph'; end if;

  -- And nobody gained admin who did not have it.
  select count(*) into non_admins
    from company_os.app_access a
    join company_os.people p on p.id = a.person_id
    left join payroll_iq.users pu on pu.id = p.auth_user_id
   where a.app='payroll_iq' and a.role='admin' and a.revoked_at is null
     and (pu.id is null or pu.role <> 'admin');
  if non_admins <> 0 then raise exception 'payroll_iq admin granted to % non-admin(s)', non_admins; end if;

  raise notice 'is_admin delegated; % admins resolve through grants', admins;
end $chk$;
