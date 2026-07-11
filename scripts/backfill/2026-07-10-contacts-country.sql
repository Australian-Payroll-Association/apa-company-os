-- Backfill: contact country derived from their linked company's country
-- (primary link preferred). Only fills blanks; never overwrites. Idempotent.
-- Applied 2026-07-10 via Supabase MCP against project wwchefrgkkxmhlkntufm.
-- Result: 8 known -> 94 known (498 remain Unknown; no per-person research).

update company_os.people p
set country = v.country, updated_at = now()
from (
  select distinct on (pc.person_id) pc.person_id, c.country
  from company_os.person_companies pc
  join company_os.companies c on c.id = pc.company_id
  where c.country is not null and c.country <> ''
  order by pc.person_id, pc.is_primary desc nulls last
) v
where p.id = v.person_id and (p.country is null or p.country = '');
