-- Applied 2026-07-13 via Supabase MCP migration `expenses_vendors_qbo_sync`.
-- Phase 1 of the QuickBooks expense sync: prepare the expense ledger + vendor
-- directory to receive QBO purchases/bills.
--   * expenses: add source/external_id/txn_type/lines/synced_at so imports are
--     idempotent (mirrors company_os.invoices). external_id is nullable so
--     hand-entered expenses (no QBO id) are still allowed; the unique index is
--     partial to only dedupe rows that carry a QBO id.
--   * vendors: add a metadata jsonb (it had none) plus a partial unique index on
--     metadata->>'qbo_vendor_id' so every QBO payee auto-creates exactly one row.

alter table company_os.expenses
  add column if not exists source text not null default 'quickbooks',
  add column if not exists external_id text,
  add column if not exists txn_type text,
  add column if not exists lines jsonb not null default '[]'::jsonb,
  add column if not exists synced_at timestamptz;

-- Idempotent re-import key. Partial so multiple manual rows (external_id null)
-- never collide.
create unique index if not exists expenses_source_external_id_key
  on company_os.expenses (source, external_id)
  where external_id is not null;

create index if not exists expenses_vendor_idx on company_os.expenses (vendor_id);
create index if not exists expenses_incurred_on_idx on company_os.expenses (incurred_on);

alter table company_os.expenses enable row level security;
grant select, insert, update, delete on company_os.expenses to service_role;

-- Vendors had no metadata column; add one and key QBO payees off it.
alter table company_os.vendors
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create unique index if not exists vendors_qbo_vendor_id_key
  on company_os.vendors ((metadata->>'qbo_vendor_id'))
  where metadata->>'qbo_vendor_id' is not null;
