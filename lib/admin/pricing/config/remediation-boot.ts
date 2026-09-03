// Remediation-family calculators — VERIFIED against docs/product/pricing-configs-full.md.
// BOOT Evaluation (§7) and Remediation (§9). Both carry a SEPARATE Tech Costs
// column (WageSafe licences + compliance tool); per operator decision the deal
// value = professional fee + Tech Costs, and Tech Costs show as their own lines.
//
// Tech-cost figures carry NO member/non-member differential in the workbook
// (they are pass-through licence costs, not day-rate work), so their pair uses
// the single stated figure in both columns — this is transcription, not a guess.

import type { ServiceConfig } from "../types";
import { pp } from "./_shared";

// Shared 8-band base table (BOOT G24–G31 and Remediation G28–G35 are identical).
const REMEDIATION_BASE_BANDS = [
  { maxEmployees: 101, rate: pp(60, 65) },
  { maxEmployees: 201, rate: pp(60, 65) },
  { maxEmployees: 501, rate: pp(48, 52) },
  { maxEmployees: 1001, rate: pp(36, 39) },
  { maxEmployees: 1501, rate: pp(28, 30.3333) },
  { maxEmployees: 2001, rate: pp(24, 26) },
  { maxEmployees: 5001, rate: pp(10.8, 11.7) },
  { maxEmployees: null, rate: pp(10.8, 11.7) },
];

// ── BOOT Evaluation (sheet 11) — fee SUM(G5:G19), tech SUM(H5:H19), no min ─────
export const boot: ServiceConfig = {
  serviceKey: "boot",
  label: "BOOT Evaluation",
  verified: true,
  components: [
    { type: "banded_per_emp", key: "base", label: "Base fee", group: "base", bands: REMEDIATION_BASE_BANDS },
    {
      type: "factor_of",
      key: "freq",
      label: "Pay frequency multiplier",
      group: "freq",
      baseGroups: ["base"],
      factor: { kind: "enum", enumKey: "pay_frequency", map: { weekly: 0, fortnightly: 1, monthly: 1.5 } },
    },
    {
      type: "factor_of",
      key: "recalc",
      label: "Recalculation period multiplier",
      group: "recalc",
      baseGroups: ["base"],
      factor: {
        kind: "months_lookup",
        monthsKey: "recalcMonths",
        steps: [
          { maxMonths: 12, factor: 0 },
          { maxMonths: 24, factor: 1 },
          { maxMonths: 36, factor: 2 },
          { maxMonths: 48, factor: 3 },
          { maxMonths: 60, factor: 4 },
        ],
        warnOverMax: true, // >60mo → "CHECK"
      },
    },
    // Tech Costs
    { type: "scope", key: "tech.compliance_tool", label: "Compliance tool (new award interpretation)", group: "tech", column: "tech", toggleKey: "compliance_tool", fee: pp(20000, 20000) },
    { type: "wagesafe_per_emp", key: "tech.wagesafe_emp", label: "WageSafe employee licence", group: "tech", column: "tech", perEmpPerMonthCents: pp(3, 3), monthsKey: "recalcMonths" },
    { type: "wagesafe_monthly", key: "tech.wagesafe_licence", label: "WageSafe licence cost", group: "tech", column: "tech", perMonthCents: pp(1000, 1000), monthsKey: "wageSafeMonths" },
    // Fee unit lines
    { type: "unit", key: "unit.simple_awards", label: "Simple awards", group: "awards", countKey: "simple_awards", price: pp(12000, 13000) },
    { type: "unit", key: "unit.complex_awards", label: "Complex awards", group: "awards", countKey: "complex_awards", price: pp(18000, 19500) },
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
    {
      // Back-pay types G19 = MIN(count×10%, 1000%) × SUM(G5:G14). BOOT = 10%/type.
      type: "factor_of",
      key: "backpay",
      label: "Back-pay calculation types",
      group: "backpay",
      baseGroups: ["base", "freq", "recalc", "awards", "eba"],
      factor: { kind: "count_linear", countKey: "back_pay_types", perCount: 0.1, capFactor: 10 },
    },
  ],
  modifiers: [
    { key: "asx_listed", label: "ASX-listed corporate", kind: "binary", when: "yes", rate: 0.15 },
    { key: "under_privilege", label: "Under privilege", kind: "binary", when: "yes", rate: 0.1 },
    { key: "nfp", label: "Not-for-profit", kind: "binary", when: "yes", rate: -0.15 },
    { key: "bad_data_quality", label: "Bad data quality", kind: "binary", when: "yes", rate: 0.1 },
  ],
  modifierBaseGroups: ["base", "freq", "recalc", "awards", "eba", "backpay"], // SUM(G5:G14, G19)
  minimumCents: null,
  notes: "Tech Costs column (compliance tool + WageSafe $3/emp + $1,000/mo). Back-pay 10%/type, cap 1000%.",
};

// ── Remediation (sheet 13) — fee SUM(G7:G23), tech SUM(H7:H23), no min ─────────
export const remediation: ServiceConfig = {
  serviceKey: "remediation",
  label: "Remediation",
  verified: true,
  components: [
    { type: "banded_per_emp", key: "base", label: "Base fee", group: "base", bands: REMEDIATION_BASE_BANDS },
    {
      type: "factor_of",
      key: "recalc",
      label: "Recalculation period multiplier",
      group: "recalc",
      baseGroups: ["base"],
      factor: {
        kind: "months_lookup",
        monthsKey: "recalcMonths",
        steps: [
          { maxMonths: 2, factor: 0.1 },
          { maxMonths: 3, factor: 0.25 },
          { maxMonths: 6, factor: 0.5 },
          { maxMonths: 12, factor: 1.0 },
          { maxMonths: 24, factor: 1.5 },
          { maxMonths: null, factor: 1.5 }, // flat cap beyond 24 months
        ],
      },
    },
    // Compliance tool is a FEE line here (G9), not tech.
    { type: "scope", key: "toolfee.compliance_tool", label: "Compliance tool (new award interpretation)", group: "toolfee", toggleKey: "compliance_tool", fee: pp(24000, 26000) },
    {
      // Singular types of award interpretation G10 = factor × base G7.
      type: "factor_of",
      key: "singular",
      label: "Singular award-interpretation types",
      group: "singular",
      baseGroups: ["base"],
      factor: {
        kind: "count_step",
        countKey: "singular_award_types",
        steps: [
          { lt: 2, factor: 0.2 }, // 1
          { lt: 3, factor: 0.4 }, // 2
          { lt: 4, factor: 0.6 }, // 3
          { lt: 5, factor: 0.8 }, // 4
          { lt: 6, factor: 1.0 }, // 5
          { lt: 7, factor: 1.2 }, // 6
        ],
        warnOverMax: true, // >6 → "CHECK"
      },
    },
    // Tech Costs
    { type: "wagesafe_per_emp", key: "tech.wagesafe_emp", label: "WageSafe employee licence", group: "tech", column: "tech", perEmpPerMonthCents: pp(3.5, 3.5), monthsKey: "recalcMonths" },
    { type: "wagesafe_monthly", key: "tech.wagesafe_licence", label: "WageSafe licence cost", group: "tech", column: "tech", perMonthCents: pp(1000, 1000), monthsKey: "wageSafeMonths" },
    // Fee unit lines
    { type: "unit", key: "unit.simple_awards", label: "Simple awards", group: "awards", countKey: "simple_awards", price: pp(12000, 13000) },
    { type: "unit", key: "unit.complex_awards", label: "Complex awards", group: "awards", countKey: "complex_awards", price: pp(18000, 19500) },
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
    {
      // Back-pay types G23 = MIN(count×20%, 1000%) × SUM(G7:G8) (base + recalc).
      type: "factor_of",
      key: "backpay",
      label: "Back-pay calculation types",
      group: "backpay",
      baseGroups: ["base", "recalc"],
      factor: { kind: "count_linear", countKey: "back_pay_types", perCount: 0.2, capFactor: 10 },
    },
    {
      // Rostering pattern G22 = IF(Yes, 0.3, 0) × SUM(G7:G21, G23).
      // GAP: the workbook base also spans the % modifier output lines (G17–G21),
      // which this single-pass engine computes AFTER components. Modeled here on
      // the pre-modifier fee groups + back-pay; when rostering AND any modifier
      // are both active the rostering line is a slight UNDERSTATEMENT vs Excel.
      // Flagged for operator confirmation.
      type: "factor_of",
      key: "rostering",
      label: "Rostering pattern",
      group: "rostering",
      baseGroups: ["base", "recalc", "toolfee", "singular", "awards", "eba", "backpay"],
      factor: { kind: "toggle", toggleKey: "rostering_pattern", factor: 0.3 },
    },
  ],
  modifiers: [
    { key: "knowledge_gap", label: "Payroll knowledge gap", kind: "binary", when: "yes", rate: 0.15 },
    { key: "asx_listed", label: "ASX-listed corporate", kind: "binary", when: "yes", rate: 0.15 },
    { key: "under_privilege", label: "Under privilege", kind: "binary", when: "yes", rate: 0.1 },
    { key: "nfp", label: "Not-for-profit", kind: "binary", when: "yes", rate: -0.15 },
    { key: "bad_data_quality", label: "Bad data quality", kind: "binary", when: "yes", rate: 0.1 },
  ],
  // SUM(G7:G16, G23): base + recalc + toolfee + singular + awards + eba + backpay.
  modifierBaseGroups: ["base", "recalc", "toolfee", "singular", "awards", "eba", "backpay"],
  minimumCents: null,
  notes: "Tech Costs (WageSafe $3.50/emp + $1,000/mo). Recalc cap 1.5 @≥24mo. Back-pay 20%/type. Rostering wide-base gap flagged (see rostering component).",
};
