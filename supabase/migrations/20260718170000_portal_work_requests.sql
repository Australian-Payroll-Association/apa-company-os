-- Client-originated contractor work requests (portal). Nullable columns keep
-- the existing admin flow untouched; origin drives who decides the estimate
-- (portal rows are decided by the client in /portal/requests, admin stays a
-- backstop). Plan: docs/plans/2026-07-18-client-work-requests.md

alter table company_os.contractor_work_requests
  add column client_company_id uuid references company_os.companies(id),
  add column requested_by_person_id uuid references company_os.people(id),
  add column origin text not null default 'admin' check (origin in ('admin','portal'));

create index contractor_work_requests_client_company_idx
  on company_os.contractor_work_requests (client_company_id);

-- Allow client actors on the request timeline.
alter table company_os.contractor_work_events
  drop constraint contractor_work_events_actor_type_check;
alter table company_os.contractor_work_events
  add constraint contractor_work_events_actor_type_check
  check (actor_type in ('admin','contractor','system','client'));
