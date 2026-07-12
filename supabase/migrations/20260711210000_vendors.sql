-- Applied 2026-07-11 via Supabase MCP migration `vendors`.
-- Vendor directory for Operations (cars, tours, travel agencies, conference
-- rooms, ...). company_os.vendors pre-existed as an empty scaffold
-- (id, name, category, status, notes) referenced only by expenses.vendor_id,
-- so this extends it in place: category becomes type, plus the contact/price
-- columns mirroring the operator's "Vendor List" spreadsheet tab. The
-- scaffold's status column is left as-is; the admin uses archived_at.
alter table company_os.vendors rename column category to type;

alter table company_os.vendors
  alter column type set default 'other';
update company_os.vendors set type = 'other' where type is null;
alter table company_os.vendors
  alter column type set not null;

alter table company_os.vendors
  add column if not exists price_range text,
  add column if not exists address text,
  add column if not exists phone text,
  add column if not exists tax_id text,
  add column if not exists bank_info text,
  add column if not exists primary_contact_name text,
  add column if not exists primary_contact_email text,
  add column if not exists primary_contact_phone text,
  add column if not exists secondary_contact_name text,
  add column if not exists secondary_contact_email text,
  add column if not exists secondary_contact_phone text,
  add column if not exists rating text,
  add column if not exists url text,
  add column if not exists notes text,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by text;

create index if not exists vendors_type_idx on company_os.vendors (type);

alter table company_os.vendors enable row level security;
grant select, insert, update, delete on company_os.vendors to service_role;
