-- Backfill: companies with a won deal become customers (raise-only).
-- Approved 2026-07-09: "if it's won, it should be customer". Never demotes
-- customer/evangelist. Idempotent: re-running matches no rows.
-- Run via Supabase MCP execute_sql against project wwchefrgkkxmhlkntufm.

with candidates as (
  select c.id, c.lifecycle_stage as from_stage
  from company_os.companies c
  where c.archived_at is null
    and c.lifecycle_stage not in ('customer', 'evangelist')
    and exists (
      select 1 from company_os.deals d
      where d.company_id = c.id and d.status = 'won'
    )
),
promoted as (
  update company_os.companies c
  set lifecycle_stage = 'customer',
      updated_at = now()
  from candidates x
  where c.id = x.id
  returning c.id
)
insert into company_os.lifecycle_transitions (company_id, from_stage, to_stage, reason)
select x.id, x.from_stage, 'customer', 'backfill_deal_won'
from candidates x
join promoted p on p.id = x.id;
