-- 20260724130000_retreats_pnl_and_wage_records.sql
--
-- Phase 1 of the Infinite Leverage Retreats P&L program
-- (docs/plans/2026-07-24-retreats-pnl-build-plan.md). Four additive changes:
--
--  1. company_os.event_pnl_lines — per-retreat revenue/expense line items that
--     back the P&L tab on the event detail page. Service-role only, and (like
--     people_sensitive) RLS-on-no-policy so the NL->SQL assistant can't read it.
--  2. company_os.compensation gains salary_vnd + salary_usd_cents so employee
--     salaries are stored in both native VND and USD (fixed 25,500 rate).
--  3. company_os.admins gains can_view_sensitive so wages/PII can be gated to
--     Dave and Mai only (being an admin is no longer enough).
--  4. Hard-exclude company_os.compensation from the admin NL->SQL assistant
--     (it now holds real pay data), matching the people_sensitive treatment.

-- ── 1. event_pnl_lines ─────────────────────────────────────────────────────
create table if not exists company_os.event_pnl_lines (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references company_os.events(id) on delete cascade,
  side text not null check (side in ('revenue', 'expense')),
  -- expense: accommodation|staff_cost|venue|transportation|food_beverage|
  --          equipment|visa|commission|stripe_fee|other
  -- revenue: retreat|human_tokens|mac_mini|other
  classification text not null check (classification in (
    'accommodation','staff_cost','venue','transportation','food_beverage',
    'equipment','visa','commission','stripe_fee',
    'retreat','human_tokens','mac_mini','other'
  )),
  description text,
  person_id uuid references company_os.people(id) on delete set null,  -- staff lines, named clients
  attendees integer,                                                    -- revenue lines
  staff_days numeric(6,2),                                              -- set => actual = days * $150 (overridable)
  -- Native amount is the record of truth; *_usd_cents is derived for cross-currency sums.
  estimated_cents bigint,
  estimated_currency text,
  estimated_usd_cents bigint,
  actual_cents bigint,
  actual_currency text,
  actual_usd_cents bigint,
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'to_be_paid', 'paid')),
  note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table company_os.event_pnl_lines is
  'Per-retreat P&L line items (revenue + expense) behind the event P&L tab. Native amount is truth; *_usd_cents is derived via fx_rates. Staff lines use a flat $150/day so real wages never leak to ops. Service-role only; hidden from the NL->SQL assistant.';

create index if not exists event_pnl_lines_event_id_idx
  on company_os.event_pnl_lines (event_id);

create trigger set_updated_at
  before update on company_os.event_pnl_lines
  for each row execute function company_os.handle_updated_at();

-- Service-role-only convention (RLS on, no policies; the service-role client
-- bypasses RLS, every other role gets empty results). New company_os tables are
-- not auto-granted to service_role, so grant it explicitly.
alter table company_os.event_pnl_lines enable row level security;
grant select, insert, update, delete on company_os.event_pnl_lines to service_role;

-- Keep it out of the NL->SQL assistant. The chatbot_reader migration set default
-- privileges that auto-grant SELECT on future tables; revoke that, and add no
-- reader policy, so both the grant path and RLS stay closed.
revoke all on company_os.event_pnl_lines from chatbot_reader;
revoke all on company_os.event_pnl_lines from chatbot_writer;

-- ── 2. compensation: dual-currency salary ──────────────────────────────────
alter table company_os.compensation
  add column if not exists salary_vnd bigint,        -- whole VND (native currency)
  add column if not exists salary_usd_cents bigint;  -- USD cents, converted at a fixed 25,500

comment on column company_os.compensation.salary_vnd is
  'Monthly salary in whole VND (native). Paired with salary_usd_cents at a fixed 25,500 VND/USD. comp_type = salary. Dave/Mai only.';
comment on column company_os.compensation.salary_usd_cents is
  'Monthly salary in USD cents, converted from salary_vnd at a fixed 25,500 VND/USD (not live fx). Dave/Mai only.';

-- ── 3. admins.can_view_sensitive ───────────────────────────────────────────
alter table company_os.admins
  add column if not exists can_view_sensitive boolean not null default false;

comment on column company_os.admins.can_view_sensitive is
  'True => this admin may view/edit wages and PII (compensation, people_sensitive, ID docs). Default false: being an admin is not enough. Env var SENSITIVE_VIEWERS is the break-glass fallback (covers env-only admins like the owner).';

-- Seed the cleared viewers that exist as admin rows. The owner (env-only admin)
-- is covered by the SENSITIVE_VIEWERS env allowlist instead.
update company_os.admins
  set can_view_sensitive = true
  where lower(email) in ('dave@edge8.ai', 'mai@edge8.ai');

-- ── 4. hard-exclude compensation from the NL->SQL assistant ─────────────────
-- Unlike people_sensitive (created after the chatbot migrations), compensation
-- predates them and already has reader/writer policies. DROP them and revoke
-- the grants so the assistant cannot read or write real pay data.
drop policy if exists chatbot_reader_select on company_os.compensation;
drop policy if exists chatbot_writer_select on company_os.compensation;
drop policy if exists chatbot_writer_insert on company_os.compensation;
drop policy if exists chatbot_writer_update on company_os.compensation;
revoke all on company_os.compensation from chatbot_reader;
revoke all on company_os.compensation from chatbot_writer;
