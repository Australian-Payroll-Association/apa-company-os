-- Applied 2026-07-16 via Supabase MCP migration `contractor_work_requests`
-- Contractor work-request + monthly-payment workflow (plan: docs/plans/2026-07-16-contractor-work-requests.md)
-- Roster = team_members where employment_type='contract'; rates = compensation (comp_type hourly/overtime).

-- Monthly payment request (one per contractor per month)
create table company_os.contractor_payments (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references company_os.people(id),
  period_month date not null,
  status text not null default 'pending'
    check (status in ('pending','paid','rejected','info_requested')),
  total_regular_hours numeric(8,2) not null default 0,
  total_overtime_hours numeric(8,2) not null default 0,
  amount_cents bigint not null default 0,
  currency text not null default 'usd',
  summary text,
  decided_by text,
  decided_at timestamptz,
  paid_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (person_id, period_month)
);

-- The core work-request record; access_token is the contractor's login-less bearer link.
create table company_os.contractor_work_requests (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references company_os.people(id),
  title text not null,
  brief text not null,
  access_token text not null unique,
  status text not null default 'draft'
    check (status in ('draft','awaiting_estimate','estimate_submitted','changes_requested',
                      'approved','rejected','work_submitted','completed','cancelled')),
  -- estimate (contractor-supplied)
  estimated_hours numeric(6,2),
  plan_text text,
  estimate_submitted_at timestamptz,
  -- latest admin decision snapshot (full history in contractor_work_events)
  decided_by text,
  decided_at timestamptz,
  -- work submission (contractor-supplied)
  actual_hours numeric(6,2),
  actual_overtime_hours numeric(6,2) not null default 0,
  work_summary text,
  work_link text,
  work_submitted_at timestamptz,
  accepted_by text,
  accepted_at timestamptz,
  -- payment linkage (stamped by the monthly roll-up)
  payment_id uuid references company_os.contractor_payments(id),
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contractor_work_requests_person_idx on company_os.contractor_work_requests (person_id);
create index contractor_work_requests_status_idx on company_os.contractor_work_requests (status);
create index contractor_work_requests_payment_idx on company_os.contractor_work_requests (payment_id);
create index contractor_payments_person_idx on company_os.contractor_payments (person_id);
create index contractor_payments_status_idx on company_os.contractor_payments (status);

-- Timeline / thread: one row per meaningful event on a request
create table company_os.contractor_work_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references company_os.contractor_work_requests(id) on delete cascade,
  actor_type text not null check (actor_type in ('admin','contractor','system')),
  actor text,
  type text not null check (type in ('created','estimate_submitted','approved','rejected','info_requested',
                                     'estimate_resubmitted','work_submitted','accepted','message','cancelled')),
  body text,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index contractor_work_events_request_idx on company_os.contractor_work_events (request_id, created_at);

alter table company_os.contractor_payments enable row level security;
alter table company_os.contractor_work_requests enable row level security;
alter table company_os.contractor_work_events enable row level security;
grant select, insert, update, delete on company_os.contractor_payments to service_role;
grant select, insert, update, delete on company_os.contractor_work_requests to service_role;
grant select, insert, update, delete on company_os.contractor_work_events to service_role;
