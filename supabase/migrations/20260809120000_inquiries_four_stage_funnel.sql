-- Inquiries funnel simplified to four working stages:
--   new_lead → contacted → qualified (promoted to the lead queue) → no_action
-- plus terminal 'spam' and 'archived'. 'won' stays valid: the Stripe webhook
-- advances retreat-type inquiries to won on payment, off the sales board.

alter table company_os.inquiries drop constraint inquiries_status_check;

-- Fold the retired mid-funnel statuses into the new set. Discovery/proposal
-- work now lives on deals, not inquiries.
update company_os.inquiries set status = 'contacted' where status in ('discovery_call', 'proposal');
update company_os.inquiries set status = 'no_action' where status in ('lost', 'nurture');

alter table company_os.inquiries add constraint inquiries_status_check
  check (status = any (array[
    'new_lead', 'contacted', 'qualified', 'no_action', 'spam', 'won', 'archived'
  ]::text[]));
