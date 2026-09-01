// Hand-computed fixture tests for the recalculation engine (lib/recalc/engine.ts).
// No test framework in this repo yet — run directly with tsx:
//   npx tsx scripts/recalc-verify.ts
// Exits non-zero on any failed assertion.

import assert from "node:assert/strict";
import { runRecalculation } from "../lib/recalc/engine";
import type { PayDataRow, RuleSet, TimesheetRow } from "../lib/recalc/types";

const RULE_SET: RuleSet = {
  ordinary_hours_per_day: 7.6,
  ordinary_hours_per_week: 38,
  classifications: { level_1: { base_hourly_rate: 24.5 } },
  casual_loading_pct: 25,
  overtime: {
    daily_threshold_hours: 7.6,
    tiers: [
      { up_to_hours: 2, multiplier: 1.5 },
      { up_to_hours: null, multiplier: 2.0 },
    ],
  },
  penalty_multipliers: { saturday: 1.25, sunday: 1.5, public_holiday: 2.5 },
  allowances: { meal_allowance_cents: 1750, meal_allowance_trigger_ot_hours: 1.5 },
  public_holidays: ["2026-01-01"],
  superannuation_pct: 11.5,
};

let passed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (e) {
    console.error(`FAIL  ${name}`);
    console.error(e);
    process.exitCode = 1;
  }
}

function amountFor(rows: ReturnType<typeof runRecalculation>["variances"], component: string) {
  return rows.find((r) => r.component === component);
}

// --- Fixture 1: one weekday shift, 8.5 net hours (7.6 ordinary + 0.9 OT @1.5x), matched exactly. ---
{
  const timesheet: TimesheetRow[] = [
    {
      employeeId: "E1",
      employeeName: "Alex Nguyen",
      classification: "level_1",
      workDate: "2026-03-02", // a Monday
      startTime: "08:00",
      endTime: "17:00",
      unpaidBreakMinutes: 30,
    },
  ];
  // effective rate = 24.50 * 1.25 = 30.625/hr = 3062.5 cents
  // ordinary: 7.6h * 3062.5 = 23275 cents
  // overtime: 0.9h * 3062.5 * 1.5 = 4134.375 -> round 4134
  // ote = 23275 + 4134 = 27409; super = round(27409 * 0.115) = 3152
  const payData: PayDataRow[] = [
    { employeeId: "E1", employeeName: "Alex Nguyen", payPeriodStart: "2026-03-01", payPeriodEnd: "2026-03-07", component: "ordinary", amountCents: 23275, hours: 7.6 },
    { employeeId: "E1", employeeName: "Alex Nguyen", payPeriodStart: "2026-03-01", payPeriodEnd: "2026-03-07", component: "overtime", amountCents: 4134, hours: 0.9 },
    { employeeId: "E1", employeeName: "Alex Nguyen", payPeriodStart: "2026-03-01", payPeriodEnd: "2026-03-07", component: "superannuation", amountCents: 3152, hours: null },
  ];
  const result = runRecalculation(timesheet, payData, RULE_SET);

  check("fixture 1: no warnings", () => assert.equal(result.warnings.length, 0));
  check("fixture 1: ordinary expected = 23275", () => assert.equal(amountFor(result.variances, "ordinary")?.expectedCents, 23275));
  check("fixture 1: overtime expected = 4134", () => assert.equal(amountFor(result.variances, "overtime")?.expectedCents, 4134));
  check("fixture 1: superannuation expected = 3152", () => assert.equal(amountFor(result.variances, "superannuation")?.expectedCents, 3152));
  check("fixture 1: everything matches actual (no flags)", () => assert.equal(result.totals.flaggedCount, 0));
  check("fixture 1: net variance is zero", () => assert.equal(result.totals.varianceCents, 0));
}

// --- Fixture 2: Saturday shift, paid entirely at the penalty rate (no OT split). ---
{
  const timesheet: TimesheetRow[] = [
    {
      employeeId: "E2",
      employeeName: "Priya Singh",
      classification: "level_1",
      workDate: "2026-03-07", // a Saturday
      startTime: "09:00",
      endTime: "15:00",
      unpaidBreakMinutes: 0,
    },
  ];
  // 6h * 3062.5 * 1.25 = 22968.75 -> round 22969; super = round(22969 * 0.115) = 2641
  const payData: PayDataRow[] = [
    { employeeId: "E2", employeeName: "Priya Singh", payPeriodStart: "2026-03-01", payPeriodEnd: "2026-03-07", component: "saturday_penalty", amountCents: 20000, hours: 6 },
  ];
  const result = runRecalculation(timesheet, payData, RULE_SET);
  const saturday = amountFor(result.variances, "saturday_penalty");
  const zsuper = amountFor(result.variances, "superannuation");

  check("fixture 2: saturday_penalty expected = 22969", () => assert.equal(saturday?.expectedCents, 22969));
  check("fixture 2: no separate overtime component produced", () => assert.equal(amountFor(result.variances, "overtime"), undefined));
  check("fixture 2: superannuation expected = 2641", () => assert.equal(zsuper?.expectedCents, 2641));
  check("fixture 2: underpayment flagged (actual 20000 < expected 22969)", () => assert.equal(saturday?.flagged, true));
  check("fixture 2: variance sign is actual - expected (negative)", () => assert.equal(saturday?.varianceCents, 20000 - 22969));
}

// --- Fixture 3: timesheet day falls outside every pay period on file -> warned, excluded, not silently dropped. ---
{
  const timesheet: TimesheetRow[] = [
    { employeeId: "E3", employeeName: "Sam Lee", classification: "level_1", workDate: "2026-04-01", startTime: "09:00", endTime: "17:00", unpaidBreakMinutes: 30 },
  ];
  const payData: PayDataRow[] = [
    { employeeId: "E3", employeeName: "Sam Lee", payPeriodStart: "2026-03-01", payPeriodEnd: "2026-03-07", component: "ordinary", amountCents: 20000, hours: 7.6 },
  ];
  const result = runRecalculation(timesheet, payData, RULE_SET);
  check("fixture 3: warns about the unmatched date", () => assert.equal(result.warnings.length, 1));
  check("fixture 3: actual-only ordinary shows full variance (nothing computed for it)", () => {
    const ordinary = amountFor(result.variances, "ordinary");
    assert.equal(ordinary?.expectedCents, 0);
    assert.equal(ordinary?.actualCents, 20000);
  });
}

// --- Fixture 4: unknown classification -> warned, excluded, doesn't throw. ---
{
  const timesheet: TimesheetRow[] = [
    { employeeId: "E4", employeeName: "Jo Park", classification: "level_9", workDate: "2026-03-02", startTime: "09:00", endTime: "17:00", unpaidBreakMinutes: 30 },
  ];
  const payData: PayDataRow[] = [
    { employeeId: "E4", employeeName: "Jo Park", payPeriodStart: "2026-03-01", payPeriodEnd: "2026-03-07", component: "ordinary", amountCents: 20000, hours: 7.5 },
  ];
  const result = runRecalculation(timesheet, payData, RULE_SET);
  check("fixture 4: warns about the unknown classification", () => assert.equal(result.warnings.length, 1));
}

console.log(`\n${passed} check(s) passed.`);
if (process.exitCode) {
  console.error("\nSome checks FAILED.");
  process.exit(1);
}
