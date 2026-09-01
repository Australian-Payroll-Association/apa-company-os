import { describe, it, expect } from "vitest";
import { priceService } from "./engine";
import { MEMBER_DAY_RATE_CENTS, NON_MEMBER_DAY_RATE_CENTS, type PricingInputs } from "./types";
import { SERVICE_CONFIGS, VERIFIED_SERVICE_KEYS } from "./config";

// Every assertion cites the pricing-configs-full.md value it reconciles.
const line = (r: ReturnType<typeof priceService>, key: string) => r.breakdown.find((l) => l.key === key);

describe("global constants (configs-full §Global constants)", () => {
  it("day rates $2,400 / $2,600", () => {
    expect(MEMBER_DAY_RATE_CENTS).toBe(240_000);
    expect(NON_MEMBER_DAY_RATE_CENTS).toBe(260_000);
  });
});

describe("all 14 workbook calculators are verified", () => {
  it("exactly 14 verified services, none unverified", () => {
    expect(VERIFIED_SERVICE_KEYS.length).toBe(14);
    expect(Object.values(SERVICE_CONFIGS).every((c) => c.verified)).toBe(true);
  });
});

describe("Payroll 360 (§1)", () => {
  it("717 emps → $21,510 member base (30/emp)", () => {
    expect(line(priceService("payroll_360", { headcount: 717 }), "base")?.memberCents).toBe(2_151_000);
  });
  it("717 emps → $23,302.50 non-member base (32.5/emp)", () => {
    expect(line(priceService("payroll_360", { headcount: 717 }), "base")?.nonMemberCents).toBe(2_330_250);
  });
  it("$25,000 floor enforced (resolved #2): 717-emp deal floors to $25k", () => {
    const r = priceService("payroll_360", { headcount: 717 });
    expect(r.memberCents).toBe(2_500_000);
    expect(r.nonMemberCents).toBe(2_500_000);
  });
  it("2000 emps ($36,000) is above the floor", () => {
    expect(priceService("payroll_360", { headcount: 2000 }).memberCents).toBe(3_600_000);
  });
  it("Process add-on stored explicitly $7,200 / $7,800", () => {
    const l = line(priceService("payroll_360", { headcount: 2000, scope: { process: true } }), "scope.process");
    expect(l?.memberCents).toBe(720_000);
    expect(l?.nonMemberCents).toBe(780_000);
  });
  it("NFP −15% (2000 emps → $30,600)", () => {
    expect(priceService("payroll_360", { headcount: 2000, modifiers: { nfp: "yes" } }).memberCents).toBe(3_060_000);
  });
  it("modifier stack sums (+40% on subtotal)", () => {
    const inputs: PricingInputs = { headcount: 2000, modifiers: { in_house_payroll: "no", knowledge_gap: "yes", manual_processes: "partial" } };
    expect(priceService("payroll_360", inputs).memberCents).toBe(5_040_000);
  });
  it("Complex award has a non-member price now (24000/26000)", () => {
    const l = line(priceService("payroll_360", { headcount: 2000, units: { complex_awards: 1 } }), "unit.complex_awards");
    expect(l?.memberCents).toBe(2_400_000);
    expect(l?.nonMemberCents).toBe(2_600_000);
  });
  it("entities = 6 warns and adds no fee (never 'CHECK', never throws)", () => {
    const r = priceService("payroll_360", { headcount: 2000, stepped: { entities: 6 } });
    expect(r.memberCents).toBe(3_600_000);
    expect(r.warnings.some((w) => /entit/i.test(w))).toBe(true);
    expect(JSON.stringify(r.breakdown)).not.toContain("CHECK");
  });
  it("EBA core cumulative: 3 → $54,000, 4 → $66,000", () => {
    expect(line(priceService("payroll_360", { headcount: 2000, tiers: { eba_core: 3 } }), "tier.eba_core")?.memberCents).toBe(5_400_000);
    expect(line(priceService("payroll_360", { headcount: 2000, tiers: { eba_core: 4 } }), "tier.eba_core")?.memberCents).toBe(6_600_000);
  });
});

describe("PayReview (§6) — corrected modifier rates", () => {
  it("flat $15,000 / $16,250", () => {
    const r = priceService("pay_review", { headcount: 300 });
    expect(r.memberCents).toBe(1_500_000);
    expect(r.nonMemberCents).toBe(1_625_000);
  });
  it("knowledge gap = +10% (corrected): $15,000 → $16,500", () => {
    expect(priceService("pay_review", { headcount: 300, modifiers: { knowledge_gap: "yes" } }).memberCents).toBe(1_650_000);
  });
  it("data quality = +10% (corrected)", () => {
    expect(priceService("pay_review", { headcount: 300, modifiers: { data_quality: "no" } }).memberCents).toBe(1_650_000);
  });
});

describe("Award Interpretation (§12)", () => {
  it("complexity 1 → $3,600 / $3,900", () => {
    const r = priceService("award_interpretation", { complexity: 1 });
    expect(r.memberCents).toBe(360_000);
    expect(r.nonMemberCents).toBe(390_000);
  });
  it("complexity 4 → $18,000 / $19,500", () => {
    expect(priceService("award_interpretation", { complexity: 4 }).memberCents).toBe(1_800_000);
  });
});

describe("Compliance Review (§2)", () => {
  it("100 emps → $3,000 / $3,250 base ($30 / $32.50 per emp)", () => {
    const l = line(priceService("compliance_review", { headcount: 100 }), "base");
    expect(l?.memberCents).toBe(300_000);
    expect(l?.nonMemberCents).toBe(325_000);
  });
  it("ASX modifier is +30% here (double 360): $3,000 → $3,900", () => {
    expect(priceService("compliance_review", { headcount: 100, modifiers: { asx_listed: "yes" } }).memberCents).toBe(390_000);
  });
});

describe("Optimisation Review (§3) — scope-sum × headcount multiplier", () => {
  it("Process on, 300 emps → base = 0.2 × $7,200 = $1,440; total $8,640", () => {
    const r = priceService("optimise", { headcount: 300, scope: { process: true } });
    expect(line(r, "base")?.memberCents).toBe(144_000);
    expect(r.memberCents).toBe(864_000);
  });
});

describe("PayCompliance (§4)", () => {
  it("300 emps ($3,600 base) floors up to $15,000", () => {
    expect(priceService("pay_compliance", { headcount: 300 }).memberCents).toBe(1_500_000);
  });
  it("2000 emps → $15/emp band → $30,000 (above floor)", () => {
    expect(priceService("pay_compliance", { headcount: 2000 }).memberCents).toBe(3_000_000);
  });
  it("award Level 3 slot adds $10,200", () => {
    expect(line(priceService("pay_compliance", { headcount: 2000, awardLevels: [3] }), "awards")?.memberCents).toBe(1_020_000);
  });
});

describe("Health Check (§5)", () => {
  it("100 emps → fixed $15,000 base floors up to $25,000", () => {
    expect(priceService("health_check", { headcount: 100 }).memberCents).toBe(2_500_000);
  });
  it("1000 emps → $15,000 + $24/emp × 1000 = $39,000 (above floor)", () => {
    expect(priceService("health_check", { headcount: 1000 }).memberCents).toBe(3_900_000);
  });
});

describe("BOOT Evaluation (§7) — Tech Costs column", () => {
  it("100 emps → $60/emp band → $6,000 fee base", () => {
    expect(line(priceService("boot", { headcount: 100 }), "base")?.memberCents).toBe(600_000);
  });
  it("recalc 24mo → factor 1 → recalc line = base; WageSafe emp = 24×$3×100 = $7,200 tech", () => {
    const r = priceService("boot", { headcount: 100, recalcMonths: 24 });
    expect(line(r, "recalc")?.memberCents).toBe(600_000);
    expect(r.techMemberCents).toBe(720_000); // 24 × 300c × 100
    expect(r.feeMemberCents).toBe(1_200_000); // base + recalc
    expect(r.memberCents).toBe(1_920_000); // deal value = fee + tech
  });
  it("back-pay 10%/type on SUM(base..eba): 2 types → +20% of $6,000 = $1,200", () => {
    const r = priceService("boot", { headcount: 100, units: { back_pay_types: 2 } });
    expect(line(r, "backpay")?.memberCents).toBe(120_000);
  });
});

describe("Technology Procurement (§8)", () => {
  it("1500 emps → $3/emp band → $4,500 base", () => {
    expect(line(priceService("tech_procurement", { headcount: 1500 }), "base")?.memberCents).toBe(450_000);
  });
  it("requirement gathering 4 (3–5 band) → $14,400", () => {
    expect(line(priceService("tech_procurement", { headcount: 1500, stepped: { req_gathering: 4 } }), "stepped.req_gathering")?.memberCents).toBe(1_440_000);
  });
  it("requirement gathering below 3 → 'CHECK' → warns, no fee", () => {
    const r = priceService("tech_procurement", { headcount: 1500, stepped: { req_gathering: 2 } });
    expect(line(r, "stepped.req_gathering")).toBeUndefined();
    expect(r.warnings.some((w) => /minimum/i.test(w))).toBe(true);
  });
});

describe("Remediation (§9) — Tech Costs + recalc", () => {
  it("100 emps → $6,000 base; recalc 12mo → factor 1.0 → $6,000; WageSafe = 12×$3.50×100 = $4,200 tech", () => {
    const r = priceService("remediation", { headcount: 100, recalcMonths: 12 });
    expect(line(r, "base")?.memberCents).toBe(600_000);
    expect(line(r, "recalc")?.memberCents).toBe(600_000);
    expect(r.techMemberCents).toBe(420_000); // 12 × 350c × 100
    expect(r.memberCents).toBe(1_620_000); // fee (1,200,000) + tech (420,000)
  });
  it("recalc caps at 1.5 beyond 24 months (60mo → factor 1.5)", () => {
    expect(line(priceService("remediation", { headcount: 100, recalcMonths: 60 }), "recalc")?.memberCents).toBe(900_000);
  });
  it("back-pay 20%/type: 3 types on SUM(base+recalc) $12,000 → +60% = $7,200", () => {
    const r = priceService("remediation", { headcount: 100, recalcMonths: 12, units: { back_pay_types: 3 } });
    expect(line(r, "backpay")?.memberCents).toBe(720_000); // 0.6 × (600000+600000)
  });
});

describe("System Implementation Support (§10)", () => {
  it("300 emps → $12/emp band → $3,600 base", () => {
    expect(line(priceService("sys_imp", { headcount: 300 }), "base")?.memberCents).toBe(360_000);
  });
  it("process documentation 'simple' → $6,000", () => {
    expect(line(priceService("sys_imp", { headcount: 300, enums: { process_doc: "simple" } }), "processdoc")?.memberCents).toBe(600_000);
  });
});

describe("STP2 Review (§11)", () => {
  it("band count 250 (<301) → $2,400 base", () => {
    expect(line(priceService("stp2", { stepped: { band_count: 250 } }), "base")?.memberCents).toBe(240_000);
  });
  it("pay-codes review toggle → +50% of base", () => {
    const r = priceService("stp2", { stepped: { band_count: 250 }, scope: { paycodes_review: true } });
    expect(line(r, "stp2.paycodes")?.memberCents).toBe(120_000);
    expect(r.memberCents).toBe(360_000);
  });
  it("band count ≥501 → 'CHECK' → warns, no base fee", () => {
    const r = priceService("stp2", { stepped: { band_count: 600 } });
    expect(line(r, "base")).toBeUndefined();
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe("Super Review & LSL Review (§13) — identical engine", () => {
  it("Super 300 emps → $24/emp → $7,200 base; recalc 24mo → factor 0.5 → $3,600", () => {
    const r = priceService("super_review", { headcount: 300, recalcMonths: 24 });
    expect(line(r, "base")?.memberCents).toBe(720_000);
    expect(line(r, "recalc")?.memberCents).toBe(360_000);
  });
  it("LSL is byte-identical to Super for the same inputs", () => {
    const inputs: PricingInputs = { headcount: 300, recalcMonths: 24, modifiers: { data_quality: "no" } };
    expect(priceService("lsl_review", inputs).memberCents).toBe(priceService("super_review", inputs).memberCents);
  });
});

describe("engine purity", () => {
  it("never throws on garbage input", () => {
    expect(() => priceService("payroll_360", { headcount: -5, stepped: { entities: 999 } })).not.toThrow();
    expect(() => priceService("remediation", {})).not.toThrow();
  });
  it("returns AUD cents metadata", () => {
    const r = priceService("payroll_360", { headcount: 717 });
    expect(r.currency).toBe("aud");
    expect(r.engineVersion).toMatch(/^e7-pricing@/);
  });
});
