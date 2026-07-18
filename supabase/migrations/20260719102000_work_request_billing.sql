-- Client-billing state on contractor work requests (portal-origin only).
-- billing_status is null until billing runs on acceptance:
--   invoiced        — QBO invoice created (billed_* stamped)
--   failed          — QBO call failed; accountant emailed to invoice manually
--   manual_required — missing rate / company / QBO mapping / connection;
--                     accountant emailed to invoice manually
-- Plan: docs/plans/2026-07-18-client-work-requests.md

alter table company_os.contractor_work_requests
  add column billing_status text check (billing_status in ('invoiced','failed','manual_required')),
  add column billing_error text,
  add column billed_invoice_id uuid references company_os.invoices(id),
  add column billed_amount_cents bigint,
  add column billed_rate_cents bigint,
  add column billed_at timestamptz;
