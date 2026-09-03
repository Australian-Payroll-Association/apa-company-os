// PayReview (sheet 10) — VERIFIED against docs/product/pricing-configs-full.md §6.
// Total G11 = MAX(SUM(G7:G10), 12500). Flat base $15,000/$16,250 (headcount
// ignored — both IF branches are G15). Modifier base = G7 (base only).
// CORRECTION vs pricing-model-analysis.md: knowledge-gap +10% and
// data-quality +10% (the cells are F24=0.1, F30=0.1, not 0.15).

import type { ServiceConfig } from "../types";
import { pp } from "./_shared";

export const payReview: ServiceConfig = {
  serviceKey: "pay_review",
  label: "PayReview",
  verified: true,
  components: [{ type: "flat", key: "base", label: "PayReview base fee", group: "base", fee: pp(15000, 16250) }],
  modifiers: [
    { key: "in_house_payroll", label: "In-house payroll", kind: "binary", when: "no", rate: 0.15 },
    { key: "knowledge_gap", label: "Payroll knowledge gap", kind: "binary", when: "yes", rate: 0.1 },
    { key: "data_quality", label: "Good data quality", kind: "binary", when: "no", rate: 0.1 },
  ],
  modifierBaseGroups: ["base"],
  minimumCents: 1_250_000, // $12,500
  notes: "Flat base; headcount ignored by design. Corrected knowledge-gap/data-quality to +10%.",
};
