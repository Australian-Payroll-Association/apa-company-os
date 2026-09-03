// Review-family calculators — VERIFIED against docs/product/pricing-configs-full.md.
// Compliance Review (§2), Optimisation Review (§3), PayCompliance (§4),
// Health Check (§5). Each transcribes its own bands, add-ons, modifier-base
// SUM range, and minimum-fee floor from the cited cells. No number invented.

import type { ServiceConfig } from "../types";
import { pp } from "./_shared";

// PayCompliance & Health Check share this Level 1–4 award table (G36–G39 / G41–G44).
const AWARD_LEVELS = [
  { level: 1, fee: pp(6600, 7150) },
  { level: 2, fee: pp(7800, 8450) },
  { level: 3, fee: pp(10200, 11050) },
  { level: 4, fee: pp(12600, 13650) },
];

// ── Compliance Review (sheet 6) — Total SUM(G5:G19), no min fee ───────────────
export const complianceReview: ServiceConfig = {
  serviceKey: "compliance_review",
  label: "Compliance Review",
  verified: true,
  components: [
    {
      type: "banded_per_emp",
      key: "base",
      label: "Base fee",
      group: "base",
      bands: [
        { maxEmployees: 201, rate: pp(30, 32.5) },
        { maxEmployees: 501, rate: pp(24, 26) },
        { maxEmployees: 1001, rate: pp(18, 19.5) },
        { maxEmployees: 2001, rate: pp(12, 13) },
        { maxEmployees: 3001, rate: pp(10, 10.8333) },
        { maxEmployees: 4001, rate: pp(9, 9.75) },
        { maxEmployees: null, rate: pp(9, 9.75) },
      ],
    },
    { type: "unit", key: "unit.simple_awards", label: "Simple awards", group: "awards", countKey: "simple_awards", price: pp(18000, 19500) },
    { type: "unit", key: "unit.complex_awards", label: "Complex awards", group: "awards", countKey: "complex_awards", price: pp(24000, 26000) },
    { type: "unit", key: "unit.extra_systems", label: "Extra payroll systems", group: "systems", countKey: "extra_systems", price: pp(2400, 2600), firstFree: true },
    {
      type: "stepped",
      key: "stepped.pay_code_qty",
      label: "Pay code quantity",
      group: "paycodes",
      countKey: "pay_code_qty",
      steps: [
        { lt: 300, fee: pp(0, 0) },
        { lt: 400, fee: pp(2400, 2600) },
        { lt: 500, fee: pp(4800, 5200) },
      ],
      warnOverMax: true,
    },
    {
      type: "tiered_cumulative",
      key: "tier.eba_core",
      label: "EBA core agreements",
      group: "eba",
      countKey: "eba_core",
      tiers: [
        { count: 1, fee: pp(24000, 26000) },
        { count: 2, fee: pp(42000, 45500) },
        { count: 3, fee: pp(54000, 58500) },
      ],
      eachAdditional: pp(12000, 13000),
    },
    {
      type: "tiered_cumulative",
      key: "tier.eba_state",
      label: "EBA state agreements",
      group: "eba",
      countKey: "eba_state",
      tiers: [
        { count: 1, fee: pp(12000, 13000) },
        { count: 2, fee: pp(18000, 19500) },
      ],
      eachAdditional: pp(6000, 6500),
    },
  ],
  modifiers: [
    { key: "in_house_payroll", label: "In-house payroll", kind: "binary", when: "no", rate: 0.15 },
    { key: "knowledge_gap", label: "Payroll knowledge gap", kind: "binary", when: "yes", rate: 0.15 },
    { key: "data_quality", label: "Good data quality", kind: "binary", when: "no", rate: 0.15 },
    { key: "manual_processes", label: "Manual processes", kind: "tri", rates: { yes: 0.15, partial: 0.1, no: 0 } },
    { key: "asx_listed", label: "ASX-listed corporate", kind: "binary", when: "yes", rate: 0.3 }, // NOTE: double the 360 rate
    { key: "under_privilege", label: "Under privilege", kind: "binary", when: "yes", rate: 0.1 },
    { key: "nfp", label: "Not-for-profit", kind: "binary", when: "yes", rate: -0.15 },
    { key: "new_zealand", label: "New Zealand", kind: "binary", when: "yes", rate: 0.15 },
  ],
  // SUM(G5:G9): base + awards + EBA only (excludes systems G10 and pay codes G11).
  modifierBaseGroups: ["base", "awards", "eba"],
  minimumCents: null,
  notes: "ASX modifier is +30% here (double 360). Modifier base excludes systems + pay codes.",
};

// ── Optimisation Review (sheet 7) — scope-sum × headcount multiplier ───────────
export const optimise: ServiceConfig = {
  serviceKey: "optimise",
  label: "Optimisation Review",
  verified: true,
  components: [
    { type: "scope", key: "scope.process", label: "Process", group: "scope", toggleKey: "process", fee: pp(7200, 7800) },
    { type: "scope", key: "scope.governance", label: "Governance & Controls", group: "scope", toggleKey: "governance", fee: pp(7200, 7800) },
    { type: "scope", key: "scope.people", label: "People", group: "scope", toggleKey: "people", fee: pp(2400, 2600) },
    {
      type: "factor_of",
      key: "base",
      label: "Base (headcount multiplier × scope)",
      group: "base",
      baseGroups: ["scope"],
      factor: {
        kind: "headcount_band",
        steps: [
          { maxEmployees: 400, factor: 0.2 },
          { maxEmployees: 750, factor: 0.5 },
          { maxEmployees: 1000, factor: 1.5 },
          { maxEmployees: 1500, factor: 2 },
          { maxEmployees: 2000, factor: 2.5 },
          { maxEmployees: 5000, factor: 3 },
          { maxEmployees: null, factor: 3.5 },
        ],
      },
    },
  ],
  modifiers: [
    { key: "in_house_payroll", label: "In-house payroll", kind: "binary", when: "no", rate: 0.15 },
    { key: "knowledge_gap", label: "Payroll knowledge gap", kind: "binary", when: "yes", rate: 0.15 },
    { key: "data_quality", label: "Good data quality", kind: "binary", when: "no", rate: 0.15 },
    { key: "manual_processes", label: "Manual processes", kind: "tri", rates: { yes: 0.15, partial: 0.1, no: 0 } },
    { key: "asx_listed", label: "ASX-listed corporate", kind: "binary", when: "yes", rate: 0.15 },
    { key: "under_privilege", label: "Under privilege", kind: "binary", when: "yes", rate: 0.1 },
    { key: "new_zealand", label: "New Zealand", kind: "binary", when: "yes", rate: 0.15 },
    { key: "nfp", label: "Not-for-profit", kind: "binary", when: "yes", rate: -0.15 },
  ],
  modifierBaseGroups: ["scope"], // SUM(G5:G7): scope subtotal only, not the multiplied base
  minimumCents: null,
  notes: "Base = headcount-band multiplier applied to the scope subtotal. Modifiers act on scope only.",
};

// ── PayCompliance (sheet 8) — Total MAX(SUM(G7:G20), 15000) ────────────────────
export const payCompliance: ServiceConfig = {
  serviceKey: "pay_compliance",
  label: "PayCompliance",
  verified: true,
  components: [
    {
      type: "banded_per_emp",
      key: "base",
      label: "Base fee",
      group: "base",
      bands: [
        { maxEmployees: 201, rate: pp(0, 0) },
        { maxEmployees: 501, rate: pp(12, 13) },
        { maxEmployees: 751, rate: pp(16, 17.3333) },
        { maxEmployees: 1001, rate: pp(18, 19.5) },
        { maxEmployees: 1501, rate: pp(16, 17.3333) },
        { maxEmployees: 2001, rate: pp(15, 16.25) },
        { maxEmployees: 5001, rate: pp(7.2, 7.8) },
        { maxEmployees: null, rate: pp(7.2, 7.8) },
      ],
    },
    { type: "award_levels", key: "awards", label: "Awards (by complexity)", group: "awards", slots: 4, table: AWARD_LEVELS },
    { type: "unit", key: "unit.extra_systems", label: "Extra payroll systems", group: "systems", countKey: "extra_systems", price: pp(2400, 2600), firstFree: true },
  ],
  modifiers: [
    { key: "knowledge_gap", label: "Payroll knowledge gap", kind: "binary", when: "yes", rate: 0.1 },
    { key: "data_quality", label: "Good data quality", kind: "binary", when: "no", rate: 0.15 },
    { key: "in_house_payroll", label: "In-house payroll", kind: "binary", when: "no", rate: 0.15 },
    { key: "manual_processes", label: "Manual processes", kind: "tri", rates: { yes: 0.15, partial: 0.1, no: 0 } },
    { key: "asx_listed", label: "ASX-listed corporate", kind: "binary", when: "yes", rate: 0.15 },
    { key: "under_privilege", label: "Under privilege", kind: "binary", when: "yes", rate: 0.1 },
    { key: "new_zealand", label: "New Zealand", kind: "binary", when: "yes", rate: 0.15 },
    { key: "nfp", label: "Not-for-profit", kind: "binary", when: "yes", rate: -0.15 },
  ],
  modifierBaseGroups: ["base", "awards"], // SUM(G7:G11): base + 4 award slots
  minimumCents: 1_500_000, // $15,000
  notes: "Awards priced by Level 1–4 table (shared with Health Check). Modifier base excludes systems.",
};

// ── Health Check (sheet 9) — Total MAX(SUM(G8:G21), 25000) ─────────────────────
export const healthCheck: ServiceConfig = {
  serviceKey: "health_check",
  label: "Health Check",
  verified: true,
  components: [
    { type: "flat", key: "base", label: "Health Check base fee", group: "base", fee: pp(15000, 16250) },
    {
      type: "banded_per_emp",
      key: "emps",
      label: "Employee bands",
      group: "emps",
      bands: [
        { maxEmployees: 201, rate: pp(0, 0) },
        { maxEmployees: 501, rate: pp(14.4, 15.6) },
        { maxEmployees: 751, rate: pp(24, 26) },
        { maxEmployees: 1001, rate: pp(24, 26) },
        { maxEmployees: 1501, rate: pp(20, 21.6667) },
        { maxEmployees: 2001, rate: pp(18, 19.5) },
        { maxEmployees: 5001, rate: pp(8.4, 9.1) },
        { maxEmployees: null, rate: pp(8.4, 9.1) },
      ],
    },
    { type: "award_levels", key: "awards", label: "Awards (by complexity)", group: "awards", slots: 3, table: AWARD_LEVELS },
    { type: "unit", key: "unit.extra_systems", label: "Extra payroll systems", group: "systems", countKey: "extra_systems", price: pp(2400, 2600), firstFree: true },
  ],
  modifiers: [
    { key: "in_house_payroll", label: "In-house payroll", kind: "binary", when: "no", rate: 0.15 },
    { key: "knowledge_gap", label: "Payroll knowledge gap", kind: "binary", when: "yes", rate: 0.1 },
    { key: "data_quality", label: "Good data quality", kind: "binary", when: "no", rate: 0.15 },
    { key: "manual_processes", label: "Manual processes", kind: "tri", rates: { yes: 0.15, partial: 0.1, no: 0 } },
    { key: "asx_listed", label: "ASX-listed corporate", kind: "binary", when: "yes", rate: 0.15 },
    { key: "under_privilege", label: "Under privilege", kind: "binary", when: "yes", rate: 0.1 },
    { key: "new_zealand", label: "New Zealand", kind: "binary", when: "yes", rate: 0.15 },
    { key: "nfp", label: "Not-for-profit", kind: "binary", when: "yes", rate: -0.15 },
  ],
  modifierBaseGroups: ["base", "emps", "awards"], // SUM(G8:G12): fixed base + employees + 3 award slots
  minimumCents: 2_500_000, // $25,000
  notes: "Fixed base + employee bands + up to 3 Level-1–4 awards. 'Common Systems' block ignored (labelled not in pricing).",
};
