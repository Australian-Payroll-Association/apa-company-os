-- E7 · Native Pricing Engine — CPQ record on the deal + Award Effort Matrix.
--
-- STATUS: NOT YET APPLIED. The Supabase MCP was unavailable in the session that
-- authored this file, so it was written and recorded but not run against the
-- live database. To apply: run via Supabase MCP `apply_migration` (additive
-- only), then update the "State documented" note and evidence lines in
-- docs/db/data-dictionary.md. No DROP/TRUNCATE/DELETE — additive only.
--
-- Design: docs/product/e7-pricing/impl-plan.md §Phase 2.
-- The CPQ home is the data-dictionary-sanctioned one (deals.md:167 — "a future
-- CPQ feature should FK to deals; do not create parallel opportunity or quote
-- tables"). No new column on deals; the legacy flag rides deals.metadata.
--
-- Money is INTEGER CENTS in AUD (data-dictionary rule 4). The engine that fills
-- these rows is lib/admin/pricing/engine.ts (config-as-code, pure, versioned via
-- engine_version).

-- ---------------------------------------------------------------------------
-- 1. deal_pricing — the CPQ / quote record, one live quote per deal (FK → deals)
-- ---------------------------------------------------------------------------

create table if not exists company_os.deal_pricing (
  id uuid primary key default gen_random_uuid(),
  -- One live quote per deal (R1). FK is the sanctioned CPQ home.
  deal_id uuid not null unique references company_os.deals(id) on delete cascade,
  -- Which service config drove the price. Valid values: the engine ServiceKey set.
  service_key text not null check (service_key in (
    'payroll_360','pay_review','compliance_review','health_check','optimise',
    'pay_compliance','boot','tech_procurement','stp2','award_interpretation',
    'super_review','lsl_review','sys_imp','remediation'
  )),
  -- Membership manual toggle → selects which figure becomes the deal value.
  is_member boolean not null default false,
  -- Full intake: headcount, scope toggles, count drivers, the % modifier
  -- toggles, complexity, recalc months (Remediation) — the engine's PricingInputs.
  inputs jsonb not null default '{}'::jsonb,
  -- Computed line items: { key, label, memberCents, nonMemberCents }[].
  breakdown jsonb not null default '[]'::jsonb,
  -- Computed Member figure (AUD cents); null when not computable.
  member_total_cents bigint,
  -- Computed Non-Member figure (AUD cents); null when not computable (an active
  -- driver lacked a verified non-member price, or the config is unverified).
  non_member_total_cents bigint,
  -- The figure pushed to deals.amount_cents (member vs non-member per is_member,
  -- or the override value when set). AUD cents.
  selected_total_cents bigint,
  -- AUD-native.
  currency text not null default 'aud',
  -- Out-of-range / non-member-withheld warnings surfaced to the consultant.
  warnings jsonb not null default '[]'::jsonb,
  -- Manual-sign-off override quartet (value + reason + attestation + when).
  override_cents bigint,
  override_reason text,
  override_approved_by text,
  override_at timestamptz,
  -- Config/engine stamp for reproducibility (lib/admin/pricing/types ENGINE_VERSION).
  engine_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table company_os.deal_pricing enable row level security;

drop trigger if exists set_deal_pricing_updated_at on company_os.deal_pricing;
create trigger set_deal_pricing_updated_at
  before update on company_os.deal_pricing
  for each row execute function company_os.handle_updated_at();

create index if not exists deal_pricing_deal_idx on company_os.deal_pricing(deal_id);
create index if not exists deal_pricing_service_idx on company_os.deal_pricing(service_key);

-- ---------------------------------------------------------------------------
-- 2. award_effort_matrix — reference data (DESIGNED now, imported in R2)
--    122 modern awards keyed by code, complexity 1–4. NOT read by R1 pricing.
-- ---------------------------------------------------------------------------

create table if not exists company_os.award_effort_matrix (
  id uuid primary key default gen_random_uuid(),
  -- Modern award code, e.g. 'MA000018'. Unique key for lookups.
  award_code text not null unique,
  award_name text not null,
  -- Effort/complexity rating from the Award Effort Matrix (1 Simple – 4 Complex).
  complexity integer not null check (complexity between 1 and 4),
  -- Free-text note on what makes the award complex.
  note text,
  -- Has APA already built the interpretation for this award?
  interpreted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table company_os.award_effort_matrix enable row level security;

drop trigger if exists set_award_effort_matrix_updated_at on company_os.award_effort_matrix;
create trigger set_award_effort_matrix_updated_at
  before update on company_os.award_effort_matrix
  for each row execute function company_os.handle_updated_at();

-- ---------------------------------------------------------------------------
-- Legacy flag: no schema change. A native price stamps
-- deals.metadata.pricing_origin = 'native'. A deal with no deal_pricing row and
-- no pricing_origin is rendered 'excel_legacy' and never recomputed.
-- ---------------------------------------------------------------------------
