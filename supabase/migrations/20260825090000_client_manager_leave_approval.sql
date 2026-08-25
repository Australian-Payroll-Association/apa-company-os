-- 20260825090000_client_manager_leave_approval.sql
-- Client-side leave approval (docs/plans/2026-08-12-client-manager-time-off-approval.md).
--
-- Edge8 staff placed at a client are managed day to day by someone at the
-- client, not by an Edge8 manager. staff_assignments gains that person, so
-- "who approves this person's leave" can resolve to the client manager on
-- their active placement before falling back to team_members.manager_id.
alter table company_os.staff_assignments
  add column if not exists client_manager_person_id uuid references company_os.people(id);

comment on column company_os.staff_assignments.client_manager_person_id is
  'Person at the client who approves this placement''s leave. Null = fall back to the Edge8 manager.';

-- time_off.approved_by is a team_members FK and a client manager is not an
-- Edge8 employee, so a decision they make cannot be recorded there without
-- either losing it or misattributing it to an admin. Separate column, honest
-- audit trail: exactly one of the two is set on any decided row.
alter table company_os.time_off
  add column if not exists client_approved_by uuid references company_os.people(id);

comment on column company_os.time_off.client_approved_by is
  'Client-side approver (people.id) when the decision was made in the client portal. Mutually exclusive with approved_by.';

create index if not exists staff_assignments_client_manager_idx
  on company_os.staff_assignments (client_manager_person_id)
  where client_manager_person_id is not null;
