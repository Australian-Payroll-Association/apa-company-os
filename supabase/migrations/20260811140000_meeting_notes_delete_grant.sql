-- Meeting notes get a hard delete (docs/plans/2026-08-11-client-meeting-notes.md).
-- Unlike most company_os tables (soft delete only), a meeting note is often
-- created by mistake — the wrong transcript pasted against the wrong client —
-- and there is nothing worth retaining in that case. The admin Delete button
-- removes the row outright (and its uploaded source file), audit-logging that
-- the deletion happened. Same guarded-erasure posture as the CRM records.
grant delete on company_os.meeting_notes to service_role;
