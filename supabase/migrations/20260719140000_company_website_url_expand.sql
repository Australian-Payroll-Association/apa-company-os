-- 20260719140000_company_website_url_expand.sql
--
-- Consolidate companies.domain + companies.website into a single field. The two
-- were 99% redundant (domain = bare host, website = full URL); this collapses
-- them to one canonical "website_url" (the bare host, citext, still the CRM
-- match/search key). Expand step of an expand/contract rename so the live admin
-- never queries a missing column mid-deploy.
--
-- Contract step (drops website + domain) is 20260719140100, applied AFTER the
-- code that reads website_url is deployed.

alter table company_os.companies add column if not exists website_url citext;

-- Prefer the existing bare domain; fall back to the host parsed out of website
-- for the rows that only had a website. Never overwrite a value already set.
update company_os.companies
set website_url = coalesce(
  domain,
  nullif(regexp_replace(regexp_replace(lower(website), '^https?://(www\.)?', ''), '/.*$', ''), '')
)
where website_url is null
  and (domain is not null or (website is not null and trim(website) <> ''));

create index if not exists idx_companies_website_url on company_os.companies (website_url);
