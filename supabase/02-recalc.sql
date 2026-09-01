-- Payroll recalculation module (proof of concept) — new tables only.
--
-- 01-schema.sql is a raw `pg_dump` snapshot regenerated from the live database;
-- do not hand-edit it. This file is hand-authored and additive: apply it once,
-- after 00-prereqs.sql + 01-schema.sql, against the live database (e.g. via
-- psql). The next time 01-schema.sql is re-dumped, these tables will already
-- be captured there and this file becomes redundant history.
--
-- Standalone by design (see docs/product/project-report-360.md's sibling plan
-- for the recalc module): no FK into company_os.companies/deals/documents yet.
-- Kept intentionally lean for a v1 proof of concept — two tables, JSONB for the
-- variable-shaped parts (rule sets, computed results) rather than a fully
-- normalized schema. Same security posture as compensation_sensitive: RLS
-- enabled with no policies, reads/writes only via the service-role client
-- behind requireAdmin() + canViewSensitive() in application code.

SET search_path = company_os, extensions, pg_catalog;

-- One row per interpretation rule set (an award/EA's pay clauses, expressed as
-- data so it can be swapped per engagement — see `rules` shape in
-- lib/recalc/types.ts). Never hardcode award logic in application code; it
-- lives here so it's customer-specific and inspectable/editable without a
-- redeploy.
CREATE TABLE company_os.recalc_rule_sets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    rules jsonb NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT recalc_rule_sets_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE company_os.recalc_rule_sets IS
    'Interpretation rule sets (award/EA pay clauses) for the payroll recalculation module. rules is a JSONB config, not code — see lib/recalc/types.ts RuleSet.';

-- One row per uploaded pay-data + timesheet pair and its computed variance.
-- `results` holds the full computed output (per employee, per pay period, per
-- component: expected vs actual vs variance) — a POC-stage JSONB blob rather
-- than normalized rows, revisit once the engine logic is proven.
CREATE TABLE company_os.recalc_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    label text,
    rule_set_id uuid NOT NULL,
    pay_data_filename text,
    timesheet_filename text,
    status text DEFAULT 'uploaded'::text NOT NULL,
    results jsonb,
    error_message text,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT recalc_runs_pkey PRIMARY KEY (id),
    CONSTRAINT recalc_runs_status_check CHECK (status = ANY (ARRAY['uploaded'::text, 'calculating'::text, 'done'::text, 'error'::text])),
    CONSTRAINT recalc_runs_rule_set_id_fkey FOREIGN KEY (rule_set_id) REFERENCES company_os.recalc_rule_sets(id)
);

COMMENT ON TABLE company_os.recalc_runs IS
    'One payroll recalculation run: uploaded pay-data + timesheet CSVs, the rule set applied, and the computed variance. Standalone POC — no FK into companies/deals.';

CREATE INDEX idx_recalc_runs_created_at ON company_os.recalc_runs USING btree (created_at DESC);

-- Reuse the schema's existing updated_at trigger function (already defined in
-- 01-schema.sql, see e.g. set_compensation_updated_at).
CREATE TRIGGER set_recalc_rule_sets_updated_at BEFORE UPDATE ON company_os.recalc_rule_sets
    FOR EACH ROW EXECUTE FUNCTION company_os.handle_updated_at();

CREATE TRIGGER set_recalc_runs_updated_at BEFORE UPDATE ON company_os.recalc_runs
    FOR EACH ROW EXECUTE FUNCTION company_os.handle_updated_at();

ALTER TABLE company_os.recalc_rule_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_os.recalc_runs ENABLE ROW LEVEL SECURITY;

-- No policies (matches compensation_sensitive / people_sensitive): RLS denies
-- the browser/publishable key everything. All access goes through the
-- service-role client (lib/supabase.ts's `companyOs`), gated in application
-- code by requireAdmin() + canViewSensitive() (payroll dollar data is
-- sensitive, same posture as compensation).
GRANT SELECT, INSERT, UPDATE ON TABLE company_os.recalc_rule_sets TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE company_os.recalc_runs TO service_role;

-- Seed one illustrative example rule set so the engine has something to run
-- against immediately. This is a stand-in for a real client's award/EA — the
-- SCHEMA is what matters for v1 (proving rule sets are swappable/customer-
-- specific), not this example's particular rates or clauses. Do not present
-- these numbers as a certified award interpretation.
INSERT INTO company_os.recalc_rule_sets (name, description, rules) VALUES (
    'Example rule set (illustrative)',
    'Placeholder interpretation rules for proving the recalculation engine end to end. Not a certified award/EA interpretation — replace with a real client rule set before using on real engagement data.',
    '{
      "ordinary_hours_per_day": 7.6,
      "ordinary_hours_per_week": 38,
      "classifications": {
        "level_1": { "base_hourly_rate": 24.50 },
        "level_2": { "base_hourly_rate": 26.10 }
      },
      "casual_loading_pct": 25,
      "overtime": {
        "daily_threshold_hours": 7.6,
        "tiers": [
          { "up_to_hours": 2, "multiplier": 1.5 },
          { "up_to_hours": null, "multiplier": 2.0 }
        ]
      },
      "penalty_multipliers": {
        "saturday": 1.25,
        "sunday": 1.5,
        "public_holiday": 2.5
      },
      "allowances": {
        "meal_allowance_cents": 1750,
        "meal_allowance_trigger_ot_hours": 1.5
      },
      "public_holidays": ["2026-01-01", "2026-01-26"],
      "superannuation_pct": 11.5
    }'::jsonb
);
