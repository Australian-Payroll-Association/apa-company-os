// Technical calculators — VERIFIED against docs/product/pricing-configs-full.md.
// Technology Procurement (§8), STP2 Review (§11), System Implementation Support
// (§10), Super Review + LSL Review (§13). All are structured calculators, NOT
// day-rate. No number invented; "CHECK"/"CUSTOM" cells become warnings.

import type { ServiceConfig } from "../types";
import { pp } from "./_shared";

// ── Technology Procurement (sheet 12) — Total SUM(G5:G12), no min ──────────────
// Legal-privilege compounds into the later modifier base, so it is modeled as a
// factor line (group "priv") and Full-Process/ASX/NFP act on base+counts+priv.
export const techProcurement: ServiceConfig = {
  serviceKey: "tech_procurement",
  label: "Technology Procurement",
  verified: true,
  components: [
    {
      type: "banded_per_emp",
      key: "base",
      label: "Base fee",
      group: "base",
      bands: [
        { maxEmployees: 1001, rate: pp(0, 0) },
        { maxEmployees: 2001, rate: pp(3, 3.25) },
        { maxEmployees: 3001, rate: pp(4, 4.3333) },
        { maxEmployees: 4001, rate: pp(4.5, 4.875) },
        { maxEmployees: null, rate: pp(4.5, 4.875) },
      ],
    },
    {
      type: "stepped",
      key: "stepped.req_gathering",
      label: "Requirement gathering",
      group: "counts",
      countKey: "req_gathering",
      minCount: 3, // <3 → "CHECK"
      steps: [
        { lt: 6, fee: pp(14400, 15600) }, // 3–5
        { lt: 9, fee: pp(18000, 19500) }, // 6–8
        { lt: 13, fee: pp(21600, 23400) }, // 9–12
      ],
      warnOverMax: true, // ≥13 → "CUSTOM"
    },
    {
      type: "stepped",
      key: "stepped.vendor_recs",
      label: "Vendor recommendations",
      group: "counts",
      countKey: "vendor_recs",
      minCount: 1, // <1 → "CHECK"
      steps: [
        { lt: 4, fee: pp(14400, 15600) }, // 1–3
        { lt: 7, fee: pp(18000, 19500) }, // 4–6
        { lt: 10, fee: pp(21600, 23400) }, // 7–9
        { lt: 13, fee: pp(25200, 27300) }, // 10–12
      ],
      warnOverMax: true, // ≥13 → "CUSTOM"
    },
    {
      type: "stepped",
      key: "stepped.add_system",
      label: "Additional system review",
      group: "counts",
      countKey: "add_system",
      steps: [
        { lt: 1, fee: pp(0, 0) }, // 0
        { lt: 2, fee: pp(9600, 10400) }, // 1
        { lt: 3, fee: pp(14400, 15600) }, // 2
      ],
      warnOverMax: true, // ≥3 → "CUSTOM"
    },
    {
      type: "factor_of",
      key: "priv",
      label: "Legal privilege (+20%)",
      group: "priv",
      baseGroups: ["base", "counts"], // SUM(G5:G8)
      factor: { kind: "toggle", toggleKey: "legal_privilege", factor: 0.2 },
    },
  ],
  modifiers: [
    { key: "full_process", label: "Full process", kind: "binary", when: "yes", rate: 0.2 },
    { key: "asx_listed", label: "ASX-listed corporate", kind: "binary", when: "yes", rate: 0.15 },
    { key: "nfp", label: "Not-for-profit", kind: "binary", when: "yes", rate: -0.15 },
  ],
  modifierBaseGroups: ["base", "counts", "priv"], // SUM(G5:G9): includes the legal-privilege line
  minimumCents: null,
  notes: "Legal privilege modeled as a factor line so Full-Process/ASX/NFP compound onto it, matching SUM(G5:G9).",
};

// ── STP2 Review (sheet 15) — Total SUM(G5:G12), no min ────────────────────────
// Scope toggles each multiply base+systems (SUM(G5:G6)); data quality is the
// only true % modifier, on the same base.
export const stp2: ServiceConfig = {
  serviceKey: "stp2",
  label: "STP2 Review",
  verified: true,
  components: [
    {
      type: "stepped",
      key: "base",
      label: "Base fee (pay-code / scope band)",
      group: "base",
      countKey: "band_count",
      steps: [
        { lt: 201, fee: pp(1200, 1300) },
        { lt: 301, fee: pp(2400, 2600) },
        { lt: 401, fee: pp(3600, 3900) },
        { lt: 501, fee: pp(4800, 5200) },
      ],
      warnOverMax: true, // ≥501 → "CHECK"
    },
    { type: "unit", key: "unit.extra_systems", label: "Extra payroll systems", group: "systems", countKey: "extra_systems", price: pp(2400, 2600), firstFree: true },
    { type: "factor_of", key: "stp2.paycodes", label: "Pay codes review (+50%)", group: "stp2scope", baseGroups: ["base", "systems"], factor: { kind: "toggle", toggleKey: "paycodes_review", factor: 0.5 } },
    { type: "factor_of", key: "stp2.super", label: "Superannuation (+50%)", group: "stp2scope", baseGroups: ["base", "systems"], factor: { kind: "toggle", toggleKey: "superannuation", factor: 0.5 } },
    { type: "factor_of", key: "stp2.terminations", label: "Terminations (+50%)", group: "stp2scope", baseGroups: ["base", "systems"], factor: { kind: "toggle", toggleKey: "terminations", factor: 0.5 } },
    { type: "factor_of", key: "stp2.payroll_tax", label: "Payroll tax (+200%)", group: "stp2scope", baseGroups: ["base", "systems"], factor: { kind: "toggle", toggleKey: "payroll_tax", factor: 2 } },
    { type: "factor_of", key: "stp2.payg", label: "PAYG (+50%)", group: "stp2scope", baseGroups: ["base", "systems"], factor: { kind: "toggle", toggleKey: "payg", factor: 0.5 } },
  ],
  modifiers: [{ key: "data_quality", label: "Good data quality", kind: "binary", when: "no", rate: 0.15 }],
  modifierBaseGroups: ["base", "systems"], // SUM(G5:G6)
  minimumCents: null,
  notes: "Scope toggles multiply base+systems (not each other). Payroll tax +200% is flagged 'please avoid' in the sheet.",
};

// ── System Implementation Support (sheet 14) — Total SUM(G5:G22), no min ───────
export const sysImp: ServiceConfig = {
  serviceKey: "sys_imp",
  label: "System Implementation Support",
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
        { maxEmployees: 1501, rate: pp(8, 8.6667) },
        { maxEmployees: 2251, rate: pp(10.6667, 11.5556) },
        { maxEmployees: 3001, rate: pp(12, 13) },
        { maxEmployees: 4001, rate: pp(12, 13) },
        { maxEmployees: 5001, rate: pp(12, 13) },
        { maxEmployees: null, rate: pp(12, 13) },
      ],
    },
    { type: "scope", key: "scope.award_doc", label: "Award interpretation documentation", group: "scope", toggleKey: "award_doc", fee: pp(7200, 7800) },
    { type: "scope", key: "scope.system_testing", label: "System testing", group: "scope", toggleKey: "system_testing", fee: pp(7200, 7800) },
    { type: "scope", key: "scope.parallel_run", label: "Parallel run support", group: "scope", toggleKey: "parallel_run", fee: pp(7200, 7800) },
    {
      type: "enum_flat",
      key: "processdoc",
      label: "Process documentation",
      group: "processdoc",
      enumKey: "process_doc",
      options: { enterprise: pp(12000, 13000), simple: pp(6000, 6500), none: pp(0, 0) },
    },
    { type: "factor_of", key: "awardmult.simple", label: "Simple awards effort", group: "awardmult", baseGroups: ["base", "scope", "processdoc"], factor: { kind: "count_linear", countKey: "simple_awards", perCount: 0.1 } },
    { type: "factor_of", key: "awardmult.complex", label: "Complex awards effort", group: "awardmult", baseGroups: ["base", "scope", "processdoc"], factor: { kind: "count_linear", countKey: "complex_awards", perCount: 0.2 } },
    { type: "factor_of", key: "awardmult.eba_core", label: "EBA core effort", group: "awardmult", baseGroups: ["base", "scope", "processdoc"], factor: { kind: "count_linear", countKey: "eba_core", perCount: 0.2 } },
    { type: "factor_of", key: "awardmult.eba_state", label: "EBA state effort", group: "awardmult", baseGroups: ["base", "scope", "processdoc"], factor: { kind: "count_linear", countKey: "eba_state", perCount: 0.1 } },
  ],
  modifiers: [
    { key: "process_doc_provided", label: "Process documentation provided", kind: "binary", when: "no", rate: 0.15 },
    { key: "in_house_payroll", label: "In-house payroll", kind: "binary", when: "no", rate: 0.15 },
    { key: "knowledge_gap", label: "Payroll knowledge gap", kind: "binary", when: "yes", rate: 0.1 },
    { key: "data_quality", label: "Good data quality", kind: "binary", when: "no", rate: 0.15 },
    { key: "manual_processes", label: "Manual processes", kind: "tri", rates: { yes: 0.15, partial: 0.1, no: 0 } },
    { key: "asx_listed", label: "ASX-listed corporate", kind: "binary", when: "yes", rate: 0.15 },
    { key: "under_privilege", label: "Under privilege", kind: "binary", when: "yes", rate: 0.1 },
    { key: "new_zealand", label: "New Zealand", kind: "binary", when: "yes", rate: 0.15 },
    { key: "nfp", label: "Not-for-profit", kind: "binary", when: "yes", rate: -0.15 },
  ],
  modifierBaseGroups: ["base", "scope", "processdoc", "awardmult"], // SUM(G5:G13)
  minimumCents: null,
  notes: "Awards/EBAs are effort multipliers on base+scope+processdoc, not flat per-unit fees.",
};

// ── Super Review (sheet 17) & LSL Review (sheet 18) — identical engine ─────────
function superLslConfig(serviceKey: "super_review" | "lsl_review", label: string): ServiceConfig {
  return {
    serviceKey,
    label,
    verified: true,
    components: [
      {
        type: "banded_per_emp",
        key: "base",
        label: "Base fee",
        group: "base",
        bands: [
          { maxEmployees: 501, rate: pp(24, 26) },
          { maxEmployees: 1501, rate: pp(12, 13) },
          { maxEmployees: 2501, rate: pp(9.6, 10.4) },
          { maxEmployees: 3501, rate: pp(8.5714, 9.2857) },
          { maxEmployees: 4501, rate: pp(8, 8.6667) },
          { maxEmployees: 5501, rate: pp(7.6364, 8.2727) },
          { maxEmployees: null, rate: pp(7.6364, 8.2727) },
        ],
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
            { maxMonths: 6, factor: 0 },
            { maxMonths: 24, factor: 0.5 },
            { maxMonths: 36, factor: 1 },
            { maxMonths: 72, factor: 1.5 }, // "up to 6 years"
          ],
          warnOverMax: true, // beyond 6 years → "CHECK"
        },
      },
    ],
    modifiers: [{ key: "data_quality", label: "Good data quality", kind: "binary", when: "no", rate: 0.15 }],
    modifierBaseGroups: ["base", "recalc"], // SUM(G5:G6)
    minimumCents: null,
    notes: "Base bands + recalc-period multiplier + single data-quality modifier. LSL is byte-identical to Super.",
  };
}

export const superReview = superLslConfig("super_review", "Super Review");
export const lslReview = superLslConfig("lsl_review", "LSL Review");
