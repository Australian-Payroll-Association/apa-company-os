// Award Interpretation (sheet 16) — VERIFIED against docs/product/pricing-configs-full.md §12.
// Fixed fee by complexity 1–4 (G = days×2400, H = days×2600). EA/EBA = complexity 4.
// No bands, no modifiers, no minimum. Non-member is column H on this sheet.

import type { ServiceConfig } from "../types";
import { pp } from "./_shared";

export const awardInterpretation: ServiceConfig = {
  serviceKey: "award_interpretation",
  label: "Award Interpretation",
  verified: true,
  components: [
    {
      type: "complexity",
      key: "base",
      label: "Award interpretation fee",
      group: "base",
      tiers: [
        { complexity: 1, fee: pp(3600, 3900) }, // 1.5 days
        { complexity: 2, fee: pp(6000, 6500) }, // 2.5 days
        { complexity: 3, fee: pp(12000, 13000) }, // 5 days
        { complexity: 4, fee: pp(18000, 19500) }, // 7.5 days (also EA/EBA)
      ],
    },
  ],
  minimumCents: null,
  notes: "Standalone complexity card; per-tab award prices differ and live on those tabs.",
};
