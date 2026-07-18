-- Single-row QuickBooks Online OAuth connection (Talent Edge LLC realm).
-- Tokens live server-side only; RLS on, service_role grants only — same
-- security model as every company_os table. Intuit rotates the refresh token
-- on every refresh, so lib/qbo.ts persists rotations with a conditional
-- update keyed on the token it used (see getAccessToken there).
-- Plan: docs/plans/2026-07-18-client-work-requests.md

create table company_os.qbo_connection (
  id text primary key default 'default',
  realm_id text not null,
  access_token text not null,
  refresh_token text not null,
  access_token_expires_at timestamptz not null,
  refresh_token_expires_at timestamptz not null,
  environment text not null default 'production' check (environment in ('sandbox','production')),
  connected_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table company_os.qbo_connection enable row level security;
grant select, insert, update, delete on company_os.qbo_connection to service_role;
