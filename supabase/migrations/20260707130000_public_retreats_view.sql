-- One row per public retreat (products grouped by cohort_slug; type='event' = public).
-- Tiers are the product variants within a cohort. Registrations roll up by cohort.
-- Mirrors the caio-coach retreat model and the live infiniteleverage-8.com/retreats page.
create or replace view company_os.public_retreats as
select
  pr.cohort_slug                                             as id,
  pr.cohort_slug,
  -- Display name = city (before the comma in location), else the title-cased slug.
  coalesce(
    nullif(btrim(split_part(min(pr.location), ',', 1)), ''),
    initcap(replace(pr.cohort_slug, '-', ' '))
  )                                                          as name,
  min(pr.location)                                           as location,
  min(pr.date_start)                                         as date_start,
  max(pr.date_end)                                           as date_end,
  count(distinct pr.id)                                      as tiers,
  bool_or(pr.active)                                         as active,
  min(pr.amount_usd_cents)                                   as from_usd_cents,
  (select coalesce(sum(o.amount_usd_cents), 0)
     from company_os.event_registrations r
     join company_os.products p2 on p2.id = r.product_id
     left join company_os.orders o on o.id = r.order_id
    where p2.cohort_slug = pr.cohort_slug and r.status = 'confirmed')
                                                             as collected_usd_cents,
  (select count(*)
     from company_os.event_registrations r
     join company_os.products p2 on p2.id = r.product_id
    where p2.cohort_slug = pr.cohort_slug)                   as registrations,
  (select count(*)
     from company_os.event_registrations r
     join company_os.products p2 on p2.id = r.product_id
    where p2.cohort_slug = pr.cohort_slug and r.status = 'confirmed')
                                                             as confirmed
from company_os.products pr
where pr.type = 'event' and pr.cohort_slug is not null
group by pr.cohort_slug;

grant select on company_os.public_retreats to service_role;
