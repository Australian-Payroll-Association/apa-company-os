-- 20260810150000_client_backlog_client_sort.sql
-- Client-controlled ordering of roadmap items within each group. When the client
-- drags cards, we write client_sort_order for every item in that group; the
-- portal orders by coalesce(client_sort_order, sort_order) so an un-reordered
-- group still falls back to Edge8's sort_order. Admin keeps using sort_order.
alter table company_os.client_backlog_items
  add column if not exists client_sort_order int;
