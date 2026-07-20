-- Set-based deal repositioning.
--
-- reorderDeals() (deals board drag) and the bulk-move reposition previously fired
-- one UPDATE per card — N HTTP round-trips per drop. This collapses that to a
-- single call: position = p_start + (ordinality - 1), preserving the given order.
--
-- SECURITY: invoker rights (default). The app calls this only through the
-- service-role client (lib/supabase.ts), which bypasses company_os RLS; execute
-- is granted to service_role only. search_path pinned to '' with fully-qualified
-- names so the body can't be captured by a shadowing schema.

create or replace function company_os.set_deal_positions(p_ids uuid[], p_start int default 0)
returns void
language sql
set search_path = ''
as $$
  update company_os.deals d
  set position = p_start + (t.ord - 1)
  from unnest(p_ids) with ordinality as t(id, ord)
  where d.id = t.id;
$$;

grant execute on function company_os.set_deal_positions(uuid[], int) to service_role;
