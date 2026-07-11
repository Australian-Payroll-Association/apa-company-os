-- Applied 2026-07-11 via Supabase MCP migration `invoices`.
-- Client-facing invoice ledger synced from QuickBooks (docs/plans/2026-07-11-client-portal-design.md).
-- v1 is a backfill + operator-run re-sync, not a scheduled auto-sync.
create table if not exists company_os.invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references company_os.companies(id),
  source text not null default 'quickbooks',
  external_id text not null,
  doc_number text,
  txn_date date not null,
  due_date date,
  currency text not null default 'usd',
  amount_cents bigint not null,
  balance_cents bigint not null default 0,
  status text not null,
  memo text,
  payment_link text,
  lines jsonb not null default '[]'::jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, external_id)
);

create index if not exists invoices_company_idx on company_os.invoices (company_id);

alter table company_os.invoices enable row level security;
grant select, insert, update, delete on company_os.invoices to service_role;

-- QBO customer -> company mapping, keyed by our own company id (an array
-- because EO bills through two QBO customers, main + APAC).
update company_os.companies set metadata = metadata || jsonb_build_object('qbo_customer_ids', jsonb_build_array('5'))
  where id = 'ec0f7dd3-45a9-4b88-bd05-1d0e9ebd5b42'; -- On Target (billed as Aym Technologies)
update company_os.companies set metadata = metadata || jsonb_build_object('qbo_customer_ids', jsonb_build_array('205','187'))
  where id = '7be4752c-c39b-4edc-9b1b-8cf61c4ff867'; -- Entrepreneurs Organization (main + APAC)
update company_os.companies set metadata = metadata || jsonb_build_object('qbo_customer_ids', jsonb_build_array('4'))
  where id = '6268b2b7-07eb-4c77-9721-b4cd5ba30d55'; -- Unlock Venture Partners
update company_os.companies set metadata = metadata || jsonb_build_object('qbo_customer_ids', jsonb_build_array('13'))
  where id = '1093fbc0-7d47-4c2c-8f4b-4c55f71b5b24'; -- Wareease
update company_os.companies set metadata = metadata || jsonb_build_object('qbo_customer_ids', jsonb_build_array('223'))
  where id = '8bdd0566-ed10-4c12-82c9-90fd8591b891'; -- DOXA Talent
update company_os.companies set metadata = metadata || jsonb_build_object('qbo_customer_ids', jsonb_build_array('220'))
  where id = '1787dc4b-a9f5-409d-a81b-e2cfdf75f95d'; -- Work Healthy Australia (billed as James Murray)
update company_os.companies set metadata = metadata || jsonb_build_object('qbo_customer_ids', jsonb_build_array('224'))
  where id = '1750a8ca-93ea-4369-aca1-c55553a49073'; -- Australian Payroll
update company_os.companies set metadata = metadata || jsonb_build_object('qbo_customer_ids', jsonb_build_array('158'))
  where id = 'd9bcd03f-20bf-466a-b7a8-b922b91a0a22'; -- Grady Golf
