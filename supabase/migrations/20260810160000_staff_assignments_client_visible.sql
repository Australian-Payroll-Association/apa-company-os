-- 20260810160000_staff_assignments_client_visible.sql
-- Split "client visibility" out of role. An assignment always grants the team
-- member internal access (e.g. the client roadmap in /team); client_visible
-- controls only whether they ALSO appear on the client's portal team roster.
-- Existing rows default to visible (current behaviour).
alter table company_os.staff_assignments
  add column if not exists client_visible boolean not null default true;
