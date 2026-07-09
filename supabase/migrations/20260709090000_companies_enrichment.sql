-- Companies enrichment: normalized industry + employee-size band constraints.
-- Raw free-text `industry` is kept untouched; `industry_normalized` holds the
-- fixed taxonomy used by charts and filters. `size_band` (already present,
-- empty in practice) is constrained to the four employee bands.

alter table company_os.companies
  add column if not exists industry_normalized text;

alter table company_os.companies
  add constraint companies_industry_normalized_check
  check (industry_normalized is null or industry_normalized in (
    'Technology & Software',
    'Food & Beverage',
    'Hospitality & Travel',
    'Financial Services',
    'Professional Services',
    'Real Estate & Construction',
    'Retail & Consumer Goods',
    'Manufacturing',
    'Healthcare & Wellness',
    'Legal',
    'Marketing & Media',
    'Education',
    'Logistics & Supply Chain',
    'Energy',
    'Other'
  ));

-- size_band predates this migration as unconstrained text; null anything
-- non-conforming before the check lands.
update company_os.companies
  set size_band = null
  where size_band is not null
    and size_band not in ('0-50', '51-250', '251-5000', '5000+');

alter table company_os.companies
  add constraint companies_size_band_check
  check (size_band is null or size_band in ('0-50', '51-250', '251-5000', '5000+'));

-- Re-assert grants (new tables/functions have needed explicit grants before).
grant select, insert, update, delete on company_os.companies to service_role;
