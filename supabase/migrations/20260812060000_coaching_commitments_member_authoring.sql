-- Member-authored commitments + an explicit priority order.
--
-- sort_order — ONE shared stack per profile. Coach and member drag the same
--   list from their two pages, so a member's reprioritisation is visible to
--   their coach and vice versa. Lower sorts first.
-- created_by — who wrote it. NULL on every pre-existing row, and null reads as
--   coach-authored: a member may edit or delete only what they created
--   themselves, so null must never grant that right.
--
-- Enforcement stays app-side per the /team pattern (lib/coaching/data.ts):
-- requireTeamMember() + ownership re-derived from the actor on every write.

alter table company_os.coaching_commitments
  add column if not exists sort_order integer not null default 0,
  add column if not exists created_by uuid references company_os.team_members(id);

-- Seed the stack in the order both pages have been showing (newest first), so
-- nothing visibly jumps on deploy.
with ranked as (
  select id,
         row_number() over (partition by coaching_profile_id order by created_at desc) - 1 as rn
  from company_os.coaching_commitments
)
update company_os.coaching_commitments c
set sort_order = ranked.rn
from ranked
where ranked.id = c.id;

create index if not exists coaching_commitments_profile_order_idx
  on company_os.coaching_commitments (coaching_profile_id, sort_order);

-- Members delete commitments they wrote; the table had no delete grant before.
grant delete on company_os.coaching_commitments to service_role;
