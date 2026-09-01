import { describe, it, expect } from "vitest";
import { priceService } from "./engine";

// QA-added coverage (E7 correctness audit). Focuses on the highest-risk,
// previously-uncovered behaviours: which lines form each tab's %-modifier base
// (the most error-prone transcription), non-member floor behaviour, and a
// characterization test pinning the documented Remediation rostering gap.

const line = (r: ReturnType<typeof priceService>, key: string) => r.breakdown.find((l) => l.key === key);

describe("modifier-base exclusions (configs-full 'Cross-service notes')", () => {
  // 360 modifier base = SUM(G6:G16) EXCLUDES the Independent-entities line.
  // base $36,000 + entities $1,200; NFP -15% acts on $36,000 only → -$5,400.
  // Total = 36,000 + 1,200 - 5,400 = $31,800. (If entities were wrongly in the
  // base the total would be $31,620.)
  it("Payroll 360: entities line is excluded from the modifier base", () => {
    const r = priceService("payroll_360", {
      headcount: 2000,
      stepped: { entities: 2 },
      modifiers: { nfp: "yes" },
    });
    expect(line(r, "stepped.entities")?.memberCents).toBe(120_000);
    expect(r.memberCents).toBe(3_180_000);
  });

  // Compliance modifier base = SUM(G5:G9) EXCLUDES systems (G10) and pay codes.
  // base $3,000 + extra systems $2,400 (first free → 1×2,400); NFP -15% acts on
  // $3,000 only → -$450. Total = 3,000 + 2,400 - 450 = $4,950. (If systems were
  // in the base the total would be $4,590.)
  it("Compliance Review: systems line is excluded from the modifier base", () => {
    const r = priceService("compliance_review", {
      headcount: 100,
      units: { extra_systems: 2 },
      modifiers: { nfp: "yes" },
    });
    expect(line(r, "unit.extra_systems")?.memberCents).toBe(240_000);
    expect(r.memberCents).toBe(495_000);
  });
});

describe("minimum-fee floor applies to the non-member column too", () => {
  // PayCompliance min $15,000. 300 emps → member $3,600 / non-member $3,900,
  // both below the floor → both floored to $15,000.
  it("PayCompliance floors non-member to $15,000", () => {
    const r = priceService("pay_compliance", { headcount: 300 });
    expect(r.memberCents).toBe(1_500_000);
    expect(r.nonMemberCents).toBe(1_500_000);
  });
});

describe("Remediation rostering — documented single-pass gap (characterization)", () => {
  // KNOWN GAP (see remediation-boot.ts rostering component): the workbook base
  // for rostering is SUM(G7:G21,G23), which INCLUDES the %-modifier output lines
  // G17–G21. This single-pass engine computes rostering on the pre-modifier fee
  // groups, so with rostering AND a modifier both active the rostering line is an
  // UNDERSTATEMENT vs Excel. This test PINS the current engine output so any
  // future change to the gap is intentional; it does not assert the Excel figure.
  it("rostering is computed on the pre-modifier base (understates vs workbook)", () => {
    const r = priceService("remediation", {
      headcount: 100,
      recalcMonths: 12, // base 6,000 + recalc 6,000 = 12,000 pre-modifier fee
      modifiers: { knowledge_gap: "yes" }, // +15% → modifier line = 1,800
      scope: { rostering_pattern: true },
    });
    // Engine: 0.3 × 12,000 = 3,600. Excel would be 0.3 × (12,000 + 1,800) = 4,140.
    expect(line(r, "rostering")?.memberCents).toBe(360_000);
    // Modifier line acts on base..backpay (excludes rostering): 15% × 12,000.
    expect(line(r, "modifiers")?.memberCents).toBe(180_000);
    // Fee = 6,000 + 6,000 + 3,600 + 1,800 = 17,400; tech = 12×$3.50×100 = 4,200.
    expect(r.feeMemberCents).toBe(1_740_000);
    expect(r.memberCents).toBe(2_160_000);
  });
});
