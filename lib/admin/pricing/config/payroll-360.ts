// Payroll 360 (sheet 5) — VERIFIED against docs/product/pricing-configs-full.md §1.
// Total G26 = SUM(G6:G25); operator decision: enforce MAX(subtotal, $25,000).
// Modifier base = SUM(G6:G16) = base + scope + awards + systems + pay codes + EBA
// (the doc's explicit enumeration; entities line excluded from that range).

import type { ServiceConfig } from "../types";
import { pp } from "./_shared";

export const payroll360: ServiceConfig = {
  serviceKey: "payroll_360",
  label: "Payroll 360",
  verified: true,
  components: [
    {
      type: "banded_per_emp",
      key: "base",
      label: "Base fee",
      group: "base",
      bands: [
        { maxEmployees: 201, rate: pp(90, 97.5) },
        { maxEmployees: 501, rate: pp(48, 52) },
        { maxEmployees: 1001, rate: pp(30, 32.5) },
        { maxEmployees: 2001, rate: pp(18, 19.5) },
        { maxEmployees: 3001, rate: pp(14, 15.1667) },
        { maxEmployees: 4001, rate: pp(12, 13) },
        { maxEmployees: null, rate: pp(12, 13) },
      ],
    },
    { type: "scope", key: "scope.process", label: "Process", group: "scope", toggleKey: "process", fee: pp(7200, 7800) },
    { type: "scope", key: "scope.governance", label: "Governance & Controls", group: "scope", toggleKey: "governance", fee: pp(7200, 7800) },
    { type: "scope", key: "scope.people", label: "People", group: "scope", toggleKey: "people", fee: pp(2400, 2600) },
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
    {
      type: "stepped",
      key: "stepped.entities",
      label: "Independent entities",
      group: "entities",
      countKey: "entities",
      steps: [
        { lt: 2, fee: pp(0, 0) }, // 0–1
        { lt: 3, fee: pp(1200, 1300) }, // 2
        { lt: 4, fee: pp(3600, 3900) }, // 3
        { lt: 5, fee: pp(7200, 7800) }, // 4
        { lt: 6, fee: pp(9600, 10400) }, // 5
      ],
      warnOverMax: true, // 6+ → "CHECK" → warn (never block, never write CHECK)
    },
  ],
  modifiers: [
    { key: "in_house_payroll", label: "In-house payroll", kind: "binary", when: "no", rate: 0.15 },
    { key: "knowledge_gap", label: "Payroll knowledge gap", kind: "binary", when: "yes", rate: 0.15 },
    { key: "data_quality", label: "Good data quality", kind: "binary", when: "no", rate: 0.15 },
    { key: "manual_processes", label: "Manual processes", kind: "tri", rates: { yes: 0.15, partial: 0.1, no: 0 } },
    { key: "asx_listed", label: "ASX-listed corporate", kind: "binary", when: "yes", rate: 0.15 },
    { key: "under_privilege", label: "Under privilege", kind: "binary", when: "yes", rate: 0.1 },
    { key: "nfp", label: "Not-for-profit", kind: "binary", when: "yes", rate: -0.15 },
    { key: "new_zealand", label: "New Zealand", kind: "binary", when: "yes", rate: 0.15 },
    { key: "prolonged_onboarding", label: "Prolonged onboarding", kind: "binary", when: "yes", rate: 0.15 },
  ],
  modifierBaseGroups: ["base", "scope", "awards", "systems", "paycodes", "eba"],
  minimumCents: 2_500_000, // $25,000 (resolved decision #2: enforce MAX)
  notes: "Full 9-modifier stack. Modifier base per doc excludes the entities line.",
};
