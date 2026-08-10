-- Affiliates become company-capable + deals gain a company referrer (2026-07-20)
--
-- Model change: an affiliate can now be a COMPANY (the primary case) or an
-- individual. company_os.affiliates gains a nullable company_id; person_id was
-- already nullable. A company affiliate keeps person_id as the acting contact
-- (the person who logs into the portal and picks work_credit vs cash), so the
-- re-key is reversible and portal entitlement keeps working. Work credit accrues
-- to the affiliate row = the company. Codes/commissions hang off affiliates.id
-- and are NOT re-keyed.
--
-- Also: deals gain referrer_company_id so a company can be a deal's direct
-- referrer, mirroring the existing person referrer_id (e.g. Brad Giles's deals
-- roll up to Evolution Partners).
--
-- affiliates and deals were created directly on prod (outside tracked
-- migrations), so this is an ALTER, guarded with IF NOT EXISTS. Applied
-- 2026-07-20 via Supabase MCP migration `affiliate_company_and_deal_referrer`.

-- 1. affiliates.company_id ---------------------------------------------------
alter table company_os.affiliates
  add column if not exists company_id uuid references company_os.companies(id);

comment on column company_os.affiliates.company_id is
  'The affiliate company when this is a company affiliate. person_id (kept) is the acting/portal contact. At least one of company_id/person_id is set.';

-- At least one party must be present. Every existing row has person_id, so this
-- validates immediately against current data.
alter table company_os.affiliates
  drop constraint if exists affiliates_party_present_chk;
alter table company_os.affiliates
  add constraint affiliates_party_present_chk
  check (company_id is not null or person_id is not null);

create index if not exists affiliates_company_id_idx
  on company_os.affiliates (company_id);

-- 2. deals.referrer_company_id -----------------------------------------------
alter table company_os.deals
  add column if not exists referrer_company_id uuid references company_os.companies(id);

comment on column company_os.deals.referrer_company_id is
  'Company that directly referred this deal (mirrors person referrer_id). Attributes referred deals to a company affiliate.';

create index if not exists deals_referrer_company_id_idx
  on company_os.deals (referrer_company_id);

-- 3. Grants (convention: re-assert service_role CRUD on extended tables) ------
grant select, insert, update, delete on company_os.affiliates to service_role;
grant select, insert, update, delete on company_os.deals to service_role;

-- RLS is already enabled on both tables; re-assert idempotently per convention.
alter table company_os.affiliates enable row level security;
alter table company_os.deals enable row level security;
