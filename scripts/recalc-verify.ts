// Hand-computed fixture tests for the recalculation engine, against the REAL
// MA000019 rates (lib/recalc/rule-sets/ma000019-2026-07-01.json) — not made-up
// numbers, so a passing fixture means the engine matches the actual award.
// No test framework in this repo — run with: npx tsx scripts/recalc-verify.ts

import assert from "node:assert/strict";
import { runRecalculation } from "../lib/recalc/engine";
import type { RuleSet, WorkbookData, WorkedShift, EmployeeDynamicAttrs, EmployeeStaticAttrs, PayDataRow, PayPeriod, Allowance, CallbackShift } from "../lib/recalc/types";
import ruleSetJson from "../lib/recalc/rule-sets/ma000019-2026-07-01.json";

const ruleSet = ruleSetJson as unknown as RuleSet;

const PERIOD: PayPeriod = { start: "2026-03-01", end: "2026-03-14" }; // Sun 1 Mar - Sat 14 Mar 2026

function emptyData(overrides: Partial<WorkbookData> = {}): WorkbookData {
  return {
    staticAttrs: [],
    dynamicAttrs: [],
    payPeriods: [PERIOD],
    publicHolidays: [{ date: "2026-01-26", region: "NSW", name: "Australia Day" }],
    payData: [],
    rosteredShifts: [],
    workedShifts: [],
    allowances: [],
    callbackShifts: [],
    ...overrides,
  };
}

function dyn(employeeId: string, over: Partial<EmployeeDynamicAttrs> = {}): EmployeeDynamicAttrs {
  return {
    employeeId,
    applicableFrom: "2020-01-01",
    applicableTo: "2030-01-01",
    employmentType: "full_time",
    award: "BFI",
    classification: "level_1",
    minContractHoursWeekly: null,
    isAboveAwardContractedRate: false,
    isShiftworker: false,
    ...over,
  };
}

function stat(employeeId: string, dob = "1990-01-01"): EmployeeStaticAttrs {
  return { employeeId, dob, employmentStartDate: "2018-01-01", employmentTerminationDate: null };
}

function work(employeeId: string, date: string, start: string, end: string, over: Partial<WorkedShift> = {}): WorkedShift {
  return { employeeId, date, start, end, breakStart: null, breakLengthHours: 0, leave: null, location: "Sydney", region: "NSW", ...over };
}

function pay(employeeId: string, costCategory: string, amountCents: number, period = PERIOD): PayDataRow {
  return { employeeId, periodStart: period.start, periodEnd: period.end, costCategory, amountCents };
}

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
  return rows.filter((r) => r.component === component).reduce((sum, r) => sum + r.expectedCents, 0);
}

const L1 = ruleSet.rates.adult.standard.level_1;
const L1_CASUAL = ruleSet.rates.adult.casual.level_1;

// --- Fixture 1: weekday ordinary + overtime split across a multi-shift week (adult FT level_1). ---
{
  // Mon-Thu: 8h each (32h total). Fri: 10h -> 6h fills remaining ordinary (38-32),
  // 4h overtime (3h @1.5x tier, 1h @2.0x tier).
  const shifts: WorkedShift[] = [
    work("E1", "2026-03-02", "08:00", "16:00"), // Mon 8h
    work("E1", "2026-03-03", "08:00", "16:00"), // Tue 8h
    work("E1", "2026-03-04", "08:00", "16:00"), // Wed 8h
    work("E1", "2026-03-05", "08:00", "16:00"), // Thu 8h
    work("E1", "2026-03-06", "08:00", "18:00"), // Fri 10h
  ];
  const data = emptyData({ dynamicAttrs: [dyn("E1")], staticAttrs: [stat("E1")], workedShifts: shifts });
  const result = runRecalculation(data, ruleSet);
  check("fixture1: ordinary = 38h at L1 hourly rate", () => assert.equal(amountFor(result.variances, "ordinary"), Math.round(38 * L1.hourly_cents)));
  check("fixture1: overtime_1.5 = 3h", () => assert.equal(amountFor(result.variances, "overtime_1.5"), Math.round(3 * L1.overtime_first_3h_cents)));
  check("fixture1: overtime_2.0 = 1h", () => assert.equal(amountFor(result.variances, "overtime_2.0"), Math.round(1 * L1.overtime_after_3h_cents)));
}

// --- Fixture 2: Saturday — 8am-12pm ordinary, remainder overtime-Saturday-outside-hours. ---
{
  const shifts: WorkedShift[] = [work("E2", "2026-03-07", "08:00", "15:00")]; // Sat, 7h, 8-12 ordinary + 3h outside span
  const data = emptyData({ dynamicAttrs: [dyn("E2")], staticAttrs: [stat("E2")], workedShifts: shifts });
  const result = runRecalculation(data, ruleSet);
  check("fixture2: Saturday ordinary = 4h (8am-12pm)", () => assert.equal(amountFor(result.variances, "ordinary"), Math.round(4 * L1.hourly_cents)));
  check("fixture2: Saturday overtime_saturday_outside_hours = 3h", () =>
    assert.equal(amountFor(result.variances, "overtime_saturday_outside_hours"), Math.round(3 * L1.overtime_saturday_outside_hours_cents)));
}

// --- Fixture 3: Sunday — ALL hours at Sunday rate, never ordinary. ---
{
  const shifts: WorkedShift[] = [work("E3", "2026-03-01", "09:00", "15:00")]; // Sun, 6h
  const data = emptyData({ dynamicAttrs: [dyn("E3")], staticAttrs: [stat("E3")], workedShifts: shifts });
  const result = runRecalculation(data, ruleSet);
  check("fixture3: Sunday = 6h at sunday rate", () => assert.equal(amountFor(result.variances, "sunday_penalty"), Math.round(6 * L1.sunday_cents)));
  check("fixture3: no ordinary component on Sunday", () => assert.equal(amountFor(result.variances, "ordinary"), 0));
}

// --- Fixture 4: public holiday worked, minimum 4h top-up. ---
{
  const shifts: WorkedShift[] = [work("E4", "2026-01-26", "09:00", "11:00")]; // Australia Day, 2h worked -> top up to 4h
  const data = emptyData({ dynamicAttrs: [dyn("E4")], staticAttrs: [stat("E4")], workedShifts: shifts, payPeriods: [{ start: "2026-01-20", end: "2026-02-02" }] });
  const result = runRecalculation(data, ruleSet);
  check("fixture4: public holiday topped up to 4h", () => assert.equal(amountFor(result.variances, "public_holiday_penalty"), Math.round(4 * L1.public_holiday_cents)));
}

// --- Fixture 5: casual employee uses the casual rate table + minimum 2h engagement. ---
{
  const shifts: WorkedShift[] = [work("E5", "2026-03-02", "09:00", "10:00")]; // Mon, 1h -> topped up to 2h
  const data = emptyData({ dynamicAttrs: [dyn("E5", { employmentType: "casual" })], staticAttrs: [stat("E5")], workedShifts: shifts });
  const result = runRecalculation(data, ruleSet);
  check("fixture5: casual minimum engagement = 2h at casual rate", () => assert.equal(amountFor(result.variances, "ordinary"), Math.round(2 * L1_CASUAL.hourly_cents)));
}

// --- Fixture 6: shiftworker afternoon loading (permanent-shiftwork rate columns). ---
{
  const shifts: WorkedShift[] = [work("E6", "2026-03-02", "14:00", "22:00")]; // Mon, finishes 10pm -> afternoon shift
  const data = emptyData({ dynamicAttrs: [dyn("E6", { isShiftworker: true })], staticAttrs: [stat("E6")], workedShifts: shifts });
  const result = runRecalculation(data, ruleSet);
  check("fixture6: afternoon-permanent shift loading for the whole shift", () => assert.equal(amountFor(result.variances, "afternoon_permanent"), Math.round(8 * L1.afternoon_permanent_cents)));
}

// --- Fixture 7: annual leave pays the GREATER of 17.5% flat or the weekend penalty they'd have earned. ---
{
  const rostered = [{ employeeId: "E7", date: "2026-03-07", start: "08:00", end: "16:00", breakStart: null, breakLengthHours: 0 }]; // a Saturday roster
  const leaveShift = work("E7", "2026-03-07", "", "", { leave: "Annual Leave" });
  const data = emptyData({ dynamicAttrs: [dyn("E7")], staticAttrs: [stat("E7")], workedShifts: [leaveShift], rosteredShifts: rostered });
  const result = runRecalculation(data, ruleSet);
  const ordinaryCents = Math.round(4 * L1.hourly_cents); // 8am-12pm ordinary portion of the Saturday roster... engine uses full rostered hours for leave base
  const flatLoading = Math.round(Math.round(8 * L1.hourly_cents) * (ruleSet.clauses.annual_leave_loading_pct / 100));
  const penaltyPremium = Math.round(8 * (L1.overtime_saturday_outside_hours_cents - L1.hourly_cents));
  check("fixture7: leave_ordinary paid at rostered hours", () => assert.equal(amountFor(result.variances, "leave_ordinary"), Math.round(8 * L1.hourly_cents)));
  check("fixture7: annual leave loading is the greater of flat vs penalty premium", () =>
    assert.equal(amountFor(result.variances, "annual_leave_loading"), Math.max(flatLoading, penaltyPremium)));
  void ordinaryCents;
}

// --- Fixture 8: First Aid allowance, full-time weekly flat rate, prorated to the period. ---
{
  const allowance: Allowance = { employeeId: "E8", allowanceName: "First aid", from: "2026-03-01", to: "2026-03-14", higherDutiesLevel: null };
  const data = emptyData({ dynamicAttrs: [dyn("E8")], staticAttrs: [stat("E8")], allowances: [allowance] });
  const result = runRecalculation(data, ruleSet);
  const weekly = ruleSet.allowances["First aid allowance - full-time"].amounts_cents[0];
  check("fixture8: first aid allowance = 2 weeks flat", () => assert.equal(amountFor(result.variances, "first_aid_allowance"), Math.round((14 / 7) * weekly)));
}

// --- Fixture 9: higher duties pays the hourly differential for shifts inside the allowance's date range. ---
{
  const shift = work("E9", "2026-03-02", "08:00", "16:00"); // 8h
  const allowance: Allowance = { employeeId: "E9", allowanceName: "Higher duties", from: "2026-03-02", to: "2026-03-02", higherDutiesLevel: "level_3" };
  const data = emptyData({ dynamicAttrs: [dyn("E9")], staticAttrs: [stat("E9")], workedShifts: [shift], allowances: [allowance] });
  const result = runRecalculation(data, ruleSet);
  const L3 = ruleSet.rates.adult.standard.level_3;
  check("fixture9: higher duties differential = 8h x (L3-L1 hourly)", () => assert.equal(amountFor(result.variances, "higher_duties_allowance"), Math.round(8 * (L3.hourly_cents - L1.hourly_cents))));
}

// --- Fixture 10: call-back shift paid at overtime rate, minimum 2h engagement. ---
{
  const cb: CallbackShift = { employeeId: "E10", date: "2026-03-03", start: "21:00", end: "22:00", lengthHours: 1 }; // Tue, 1h -> topped up to 2h
  const data = emptyData({ dynamicAttrs: [dyn("E10")], staticAttrs: [stat("E10")], callbackShifts: [cb] });
  const result = runRecalculation(data, ruleSet);
  check("fixture10: call-back topped up to 2h, all in the first-3h OT tier", () => assert.equal(amountFor(result.variances, "overtime_1.5"), Math.round(2 * L1.overtime_first_3h_cents)));
}

// --- Fixture 11: everything matches actual pay data exactly -> zero flags. ---
{
  const shift = work("E11", "2026-03-02", "08:00", "16:00"); // Mon 8h, all ordinary
  const ordinaryCents = Math.round(8 * L1.hourly_cents);
  const superCents = Math.round(ordinaryCents * (ruleSet.clauses.superannuation_guarantee_pct / 100));
  const payData = [pay("E11", "ordinary", ordinaryCents), pay("E11", "superannuation", superCents)];
  const data = emptyData({ dynamicAttrs: [dyn("E11")], staticAttrs: [stat("E11")], workedShifts: [shift], payData });
  const result = runRecalculation(data, ruleSet);
  check("fixture11: matched actual pay produces zero flags", () => assert.equal(result.totals.flaggedCount, 0));
  check("fixture11: net variance is zero", () => assert.equal(result.totals.varianceCents, 0));
}

// --- Fixture 12: unknown classification -> warned, excluded, doesn't throw. ---
{
  const shift = work("E12", "2026-03-02", "08:00", "16:00");
  const data = emptyData({ dynamicAttrs: [dyn("E12", { classification: "level_99" })], staticAttrs: [stat("E12")], workedShifts: [shift] });
  const result = runRecalculation(data, ruleSet);
  check("fixture12: warns about the unknown classification", () => assert.ok(result.warnings.some((w) => w.includes("level_99"))));
}

console.log(`\n${passed} check(s) passed.`);
if (process.exitCode) {
  console.error("\nSome checks FAILED.");
  process.exit(1);
}
