-- 20260719140100_company_website_url_contract.sql
--
-- Contract step of the domain/website -> website_url consolidation
-- (expand step: 20260719140000_company_website_url_expand.sql).
--
-- APPLY ONLY AFTER the code that reads company_os.companies.website_url is
-- deployed. Until then the live admin still selects domain/website, so dropping
-- them early would 500 the companies pages.
--
-- Drops the two now-redundant columns. website_url (backfilled in the expand
-- step) is the single canonical field. The old idx_companies_domain index drops
-- automatically with the domain column; idx_companies_website_url already exists.

alter table company_os.companies drop column if exists website;
alter table company_os.companies drop column if exists domain;
