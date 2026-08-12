-- Soft-archive for applications (docs/plans/2026-08-11-ats-recruiter-feedback-plan.md).
-- Recruiters need to "delete" a duplicate or wrong-person application, but a hard
-- delete would lose the resume, AI screen, and history. Instead Delete archives:
-- archived_at is stamped (reversible via Restore), the list and board hide the
-- row, and the audit log records who archived it. NULL = active. The column
-- inherits the table's existing service_role grant, so no extra grant is needed.
alter table company_os.applications add column if not exists archived_at timestamptz;

comment on column company_os.applications.archived_at is
  'Soft-archive timestamp. NULL = active. Set by the admin ATS Delete action; reversible via Restore.';
