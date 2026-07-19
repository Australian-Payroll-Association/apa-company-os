-- Human-token pack purchases (portal): 1 pack = 40 tokens (1 token = 1 hour
-- of skilled work), $2,000/pack, 1-4 packs per Stripe Checkout. Standalone
-- purchase for now — the balance is a company-scoped sum of paid rows; no
-- draw-down ledger against work requests yet (deliberately deferred).
-- Plan: docs/plans/2026-07-18-client-work-requests.md

create table company_os.token_purchases (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references company_os.companies(id),
  person_id uuid not null references company_os.people(id),
  order_id uuid references company_os.orders(id),
  packs int not null check (packs between 1 and 4),
  tokens int not null,
  amount_cents bigint not null,
  currency text not null default 'usd',
  status text not null default 'pending' check (status in ('pending','paid','expired')),
  stripe_session_id text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index token_purchases_company_idx on company_os.token_purchases (company_id);
create index token_purchases_session_idx on company_os.token_purchases (stripe_session_id);

alter table company_os.token_purchases enable row level security;
grant select, insert, update, delete on company_os.token_purchases to service_role;
