-- payroll_iq.users.role stops carrying authorisation and becomes membership.
--
-- Safe only after is_admin() delegates to the grant table, which the previous
-- migration did. 'admin' becomes 'staff': an inert value whose only job is to
-- keep an APA admin's row alive so content attribution survives.
--
-- The rows are KEPT, not deleted. questions.authored_by, blueprints.uploaded_by,
-- ingest_runs.triggered_by, audit_log.actor_id, platform_settings.updated_by and
-- notification_rules.updated_by are all ON DELETE SET NULL, so deleting an admin
-- row would not fail - it would silently blank who authored each question. Five
-- inert rows are cheaper than losing that permanently.

alter table payroll_iq.users drop constraint if exists users_role_check;
alter table payroll_iq.users drop constraint if exists users_admin_is_orgless;

update payroll_iq.users set role = 'staff' where role = 'admin';

alter table payroll_iq.users
  add constraint users_role_check check (role in ('manager','learner','staff'));

-- The old invariant was a biconditional: admin IFF org-less. That does not
-- survive - migrations 025 and 026 deliberately let an admin belong to an org,
-- and 2 of the 5 do. The honest rule is one-directional: a real member always
-- has an organisation; staff may or may not, because some APA people are also
-- enrolled in a client org and some are not.
alter table payroll_iq.users
  add constraint users_member_has_org check (role = 'staff' or org_id is not null);

comment on column payroll_iq.users.role is
  'Membership, NOT authorisation. manager | learner are real members of an organisation; staff is an APA person kept only so content attribution survives. Who may administer this app is company_os.app_access, read through app_security.has_app_role.';

do $chk$
declare bad int; staff int;
begin
  select count(*) into bad from payroll_iq.users where role not in ('manager','learner','staff');
  if bad <> 0 then raise exception 'rows outside the new role vocabulary: %', bad; end if;

  select count(*) into staff from payroll_iq.users where role = 'staff';
  if staff = 0 then raise exception 'expected the former admins to survive as staff, found none'; end if;

  -- Attribution must be intact: no FK may have been nulled by this migration.
  if exists (select 1 from payroll_iq.questions where authored_by is not null
               and not exists (select 1 from payroll_iq.users u where u.id = authored_by)) then
    raise exception 'questions.authored_by lost its referent';
  end if;

  raise notice 'role collapsed; % staff rows retained for attribution', staff;
end $chk$;
