-- Manual priority ordering for deals (board + list) and leads (queue pin).
-- Applied via Supabase MCP 2026-07-08. Recorded here for the repo history.

begin;

alter table company_os.deals add column position integer not null default 0;

-- Backfill: preserve today's display order (created_at desc) as the initial
-- priority within each stage, so nothing visually reshuffles on rollout.
with ranked as (
  select id, stage_id,
         row_number() over (partition by stage_id order by created_at desc) - 1 as rn
  from company_os.deals
)
update company_os.deals d
set position = ranked.rn
from ranked
where ranked.id = d.id;

-- Manual boost above the SLA-ordered queue. Null = not pinned; a pinned lead
-- sorts by pinned_at desc (most recently pinned first), ahead of SLA/age.
alter table company_os.lead add column pinned_at timestamptz;

commit;
