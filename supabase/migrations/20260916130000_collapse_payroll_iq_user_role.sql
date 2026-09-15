-- payroll_iq.users.role: admin | manager | learner  ->  staff | manager | learner
--
-- WHY THIS IS SAFE NOW AND WAS NOT BEFORE
-- The first attempt (20260916060000) was reverted the same day by
-- 20260916100000, because renaming the value broke authorisation: the
-- application still asked `role === 'admin'` and every admin was locked out.
-- That is no longer true. Since payroll-iq #557 the admin gate reads the
-- app_access grant through payroll_iq.is_admin(), which delegates to
-- has_app_role() — verified: 0 RLS policies in this schema mention the literal
-- 'admin', and is_admin() is a one-line delegation.
--
-- So `role` now carries MEMBERSHIP only, and `staff` is the honest name for a
-- row that is not a member of any organisation.
--
-- NOT DELETED, and this is the point of the rename rather than a cleanup:
-- questions.authored_by, blueprints.uploaded_by, ingest_runs.triggered_by,
-- audit_log.actor_id, platform_settings.updated_by and notification_rules
-- .updated_by are all ON DELETE SET NULL. Deleting these rows would not fail —
-- it would silently blank who authored each question. Six inert rows are
-- cheaper than losing that.
--
-- Seat accounting needs no change: org_seats_used() counts `is_learner` users
-- within an org, so it never looked at role.
begin;

-- ORDER MATTERS, IN BOTH DIRECTIONS, and getting it wrong is not theoretical:
-- a first run of this migration failed on users_member_has_org and rolled back.
--
-- That constraint reads `role = 'admin' OR org_id IS NOT NULL`, so it names the
-- OLD spelling as the thing that permits an org-less row. The moment an
-- org-less admin is set to 'staff' it violates — before the statement further
-- down that would have taught it the new spelling. Three of the six rows are
-- org-less, so this fails on the first one it reaches.
--
-- So the org rule comes off FIRST and goes back on LAST, with the value
-- constraint widened and narrowed inside it.
alter table payroll_iq.users drop constraint users_member_has_org;

alter table payroll_iq.users drop constraint users_role_check;
alter table payroll_iq.users
  add constraint users_role_check
  check (role = any (array['manager'::text, 'learner'::text, 'staff'::text, 'admin'::text]));

update payroll_iq.users set role = 'staff' where role = 'admin';

alter table payroll_iq.users drop constraint users_role_check;
alter table payroll_iq.users
  add constraint users_role_check
  check (role = any (array['manager'::text, 'learner'::text, 'staff'::text]));

-- Same rule, new spelling: everyone who is not platform staff belongs to an
-- organisation.
alter table payroll_iq.users
  add constraint users_member_has_org
  check ((role = 'staff'::text) or (org_id is not null));

commit;
