-- Allow a 'billable' comp_type: the client-facing hourly rate a contractor's
-- work is invoiced at (default 100% markup on the internal hourly rate).
-- Additive only: keeps every existing value and appends 'billable'.
-- Plan: docs/plans/2026-07-18-client-work-requests.md
alter table company_os.compensation drop constraint compensation_comp_type_check;
alter table company_os.compensation add constraint compensation_comp_type_check
  check (comp_type in ('base_salary','hourly','bonus','commission','equity','stipend','allowance','overtime','billable'));

-- Backfill: current billable = 2x current hourly, USD only (client invoicing
-- is USD via Talent Edge LLC; VND-paid contractors get their billable rate set
-- by hand in the admin). Skips anyone who already has a current billable row.
insert into company_os.compensation
  (team_member_id, comp_type, amount_cents, currency, pay_period, effective_from, is_current, change_reason)
select c.team_member_id, 'billable', c.amount_cents * 2, 'usd', 'hourly', current_date, true,
       'Backfill: default 100% markup'
from company_os.compensation c
where c.comp_type = 'hourly'
  and c.is_current = true
  and c.currency = 'usd'
  and not exists (
    select 1 from company_os.compensation b
    where b.team_member_id = c.team_member_id
      and b.comp_type = 'billable'
      and b.is_current = true
  );
