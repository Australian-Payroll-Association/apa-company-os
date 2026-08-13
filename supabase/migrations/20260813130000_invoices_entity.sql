-- Multi-company invoice mirror: company_os.invoices now feeds from two
-- QuickBooks companies (see qbo_connection). QBO invoice ids are per-realm
-- sequential integers, so Edge8 #42 and AIO #42 collide under the old
-- (source, external_id) unique key. Add an `entity` label and put it in the
-- key. See lib/admin/qbo-invoice-sync.ts.
--
--   entity 'edge8' = Talent Edge LLC   (realm 9341452654454281)
--   entity 'aio'   = AI Officer Institute (realm 9341455538178258)

-- 1. Entity label. Every existing row is Edge8 (the only company synced so far).
alter table company_os.invoices
  add column entity text not null default 'edge8'
  check (entity in ('edge8', 'aio'));

-- 2. Normalize external_id to the bare QBO Invoice.Id (the numeric txn id).
-- The operator-run MCP backfill stored ids as '<opaque-prefix>:<txnId>'; the
-- in-app QBO API returns the bare Id. Strip to the suffix after the last colon
-- so the in-app sync upserts onto existing rows instead of duplicating them.
-- Verified collision-free: 200 rows -> 200 distinct numeric bare ids.
update company_os.invoices
  set external_id = substring(external_id from '[^:]+$')
  where external_id like '%:%';

-- 3. Re-key: (source, external_id) -> (source, entity, external_id).
alter table company_os.invoices
  drop constraint if exists invoices_source_external_id_key;
drop index if exists company_os.invoices_source_external_id_key;

alter table company_os.invoices
  add constraint invoices_source_entity_external_id_key
  unique (source, entity, external_id);
