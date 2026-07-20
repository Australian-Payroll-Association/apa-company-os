-- Add Scope: a client (or admin) can expand an in-progress (approved) work
-- request. The added scope is appended to the brief and the request goes back
-- to the contractor to re-estimate, running the same estimate → approve →
-- submit → accept → invoice loop as the original — one invoice, at the end.
--
-- Additive constraint widening only (no data touched): a new request status
-- 'scope_added' (contractor re-estimates, like 'changes_requested') and a new
-- event type 'scope_added'. Same drop/re-add pattern as the actor_type widen
-- in 20260718170000_portal_work_requests.sql.

alter table company_os.contractor_work_requests
  drop constraint contractor_work_requests_status_check;
alter table company_os.contractor_work_requests
  add constraint contractor_work_requests_status_check
  check (status in ('draft','awaiting_estimate','estimate_submitted','changes_requested',
                    'scope_added','approved','rejected','work_submitted','completed','cancelled'));

alter table company_os.contractor_work_events
  drop constraint contractor_work_events_type_check;
alter table company_os.contractor_work_events
  add constraint contractor_work_events_type_check
  check (type in ('created','estimate_submitted','approved','rejected','info_requested',
                  'estimate_resubmitted','scope_added','work_submitted','accepted','message','cancelled'));
