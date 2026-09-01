// Generates a synthetic "Pay Review data gathering" workbook (.xlsx, all 9
// real DATA# tabs) against the real MA000019 rule set, with a handful of
// deliberately seeded discrepancies across different clause categories so the
// variance report has something real to catch when uploaded through
// /admin/innovation/recalc.
//
// Run with: npx tsx scripts/generate-recalc-sample-data.ts
// Writes scripts/recalc-sample-data/pay-review-sample.xlsx

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { runRecalculation } from "../lib/recalc/engine";
import type { Allowance, CallbackShift, EmployeeDynamicAttrs, EmployeeStaticAttrs, PayDataRow, PayPeriod, PublicHoliday, RosteredShift, RuleSet, WorkbookData, WorkedShift } from "../lib/recalc/types";
import ruleSetJson from "../lib/recalc/rule-sets/ma000019-2026-07-01.json";

const ruleSet = ruleSetJson as unknown as RuleSet;

const PERIOD: PayPeriod = { start: "2026-03-01", end: "2026-03-14" };
const publicHolidays: PublicHoliday[] = [{ date: "2026-03-09", region: "VIC", name: "Labour Day (sample)" }];

const staticAttrs: EmployeeStaticAttrs[] = [
  "E01", "E02", "E03", "E04", "E05", "E06",
].map((id) => ({ employeeId: id, dob: "1990-01-01", employmentStartDate: "2018-01-01", employmentTerminationDate: null }));

const dynamicAttrs: EmployeeDynamicAttrs[] = [
  { employeeId: "E01", applicableFrom: "2020-01-01", applicableTo: "2030-01-01", employmentType: "full_time", award: "BFI", classification: "level_1", minContractHoursWeekly: null, isAboveAwardContractedRate: false, isShiftworker: false },
  { employeeId: "E02", applicableFrom: "2020-01-01", applicableTo: "2030-01-01", employmentType: "part_time", award: "BFI", classification: "level_2", minContractHoursWeekly: 20, isAboveAwardContractedRate: false, isShiftworker: false },
  { employeeId: "E03", applicableFrom: "2020-01-01", applicableTo: "2030-01-01", employmentType: "casual", award: "BFI", classification: "level_1", minContractHoursWeekly: null, isAboveAwardContractedRate: false, isShiftworker: false },
  { employeeId: "E04", applicableFrom: "2020-01-01", applicableTo: "2030-01-01", employmentType: "full_time", award: "BFI", classification: "level_2", minContractHoursWeekly: null, isAboveAwardContractedRate: false, isShiftworker: true },
  { employeeId: "E05", applicableFrom: "2020-01-01", applicableTo: "2030-01-01", employmentType: "full_time", award: "BFI", classification: "level_1", minContractHoursWeekly: null, isAboveAwardContractedRate: false, isShiftworker: false },
  { employeeId: "E06", applicableFrom: "2020-01-01", applicableTo: "2030-01-01", employmentType: "full_time", award: "BFI", classification: "level_1", minContractHoursWeekly: null, isAboveAwardContractedRate: false, isShiftworker: false },
];

function weekdays(weekStart: string, count: number): string[] {
  const out: string[] = [];
  const d = new Date(`${weekStart}T00:00:00Z`);
  while (out.length < count) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

const week1 = weekdays("2026-03-02", 5); // Mon-Fri, week 1
const week2 = weekdays("2026-03-09", 5); // Mon-Fri, week 2 (includes the sample public holiday on the 9th)

const rosteredShifts: RosteredShift[] = [];
const workedShifts: WorkedShift[] = [];
const allowances: Allowance[] = [];
const callbackShifts: CallbackShift[] = [];

function addShift(employeeId: string, date: string, start: string, end: string, breakLengthHours = 0.5) {
  rosteredShifts.push({ employeeId, date, start, end, breakStart: null, breakLengthHours });
  workedShifts.push({ employeeId, date, start, end, breakStart: null, breakLengthHours, leave: null, location: "Sydney", region: "NSW" });
}

// E01: full-time day worker, 7.6h/day x 5 days x 2 weeks = ordinary only, no OT.
for (const d of [...week1, ...week2]) addShift("E01", d, "08:00", "16:06");
// E02: part-time, contracted 20h/week -> 4h/day x 5 days = 20h ordinary, no OT.
for (const d of [...week1, ...week2]) addShift("E02", d, "09:00", "13:00", 0);
// E03: casual, two short shifts (below minimum engagement) + one call-back.
addShift("E03", week1[0], "10:00", "12:00");
addShift("E03", week2[0], "10:00", "12:00");
callbackShifts.push({ employeeId: "E03", date: week1[2], start: "20:00", end: "21:00", lengthHours: 1 });
// E04: full-time shiftworker, afternoon shifts (finish 10pm) 4 days/week, plus the sample public holiday worked.
for (const d of [week1[0], week1[1], week1[2], week1[3]]) addShift("E04", d, "14:00", "22:00");
addShift("E04", "2026-03-09", "14:00", "22:00"); // public holiday
// E05: full-time day worker, 4 worked days + 1 annual leave day (rostered as if worked).
for (const d of [week1[0], week1[1], week1[2], week1[3]]) addShift("E05", d, "08:00", "16:06");
addShift("E05", week1[4], "08:00", "16:06"); // rostered — but taken as leave below
workedShifts[workedShifts.length - 1] = { ...workedShifts[workedShifts.length - 1], leave: "Annual Leave" };
// E06: full-time day worker with a First Aid allowance for the whole period.
for (const d of [...week1, ...week2]) addShift("E06", d, "08:00", "16:06");
allowances.push({ employeeId: "E06", allowanceName: "First aid", from: PERIOD.start, to: PERIOD.end, higherDutiesLevel: null });

const truthData: WorkbookData = {
  staticAttrs,
  dynamicAttrs,
  payPeriods: [PERIOD],
  publicHolidays,
  payData: [],
  rosteredShifts,
  workedShifts,
  allowances,
  callbackShifts,
};

const truth = runRecalculation(truthData, ruleSet);
if (truth.warnings.length > 0) {
  console.warn("Warnings while computing ground truth (check the fixture data):");
  truth.warnings.forEach((w) => console.warn(`  - ${w}`));
}

// Baseline: everyone gets paid exactly what's expected (zero variance) —
// truthData had no payslip rows, so runRecalculation's `actualCents` is 0
// everywhere until we set it here. Corruptions below then override specific rows.
for (const row of truth.variances) row.actualCents = row.expectedCents;

// --- Seed discrepancies across different clause categories. ---
const SEEDED: string[] = [];
function corrupt(employeeId: string, component: string, mutate: (cents: number) => number, note: string) {
  const row = truth.variances.find((v) => v.employeeId === employeeId && v.component === component);
  if (!row) { console.warn(`(skip) no ${component} row for ${employeeId} to corrupt`); return; }
  const before = row.expectedCents;
  const after = mutate(before);
  row.actualCents = after; // reuse the row's expected as "truth", write a different "actual"
  SEEDED.push(`${employeeId}, ${component}: ${note} (expected ${(before / 100).toFixed(2)}, paid ${(after / 100).toFixed(2)})`);
}

corrupt("E01", "ordinary", (c) => c - 5000, "ordinary pay short by $50 (data-entry error)");
corrupt("E02", "ordinary", (c) => c + 1500, "ordinary pay over by $15 (rounding difference)");
corrupt("E04", "afternoon_permanent", (c) => c - 8000, "afternoon shift loading paid at the non-permanent rate, not the permanent-shiftworker rate");
corrupt("E05", "annual_leave_loading", (c) => Math.round(c * 0.5), "annual leave loading underpaid — paid roughly half of what's owed");
corrupt("E06", "first_aid_allowance", (c) => c + 2059, "first aid allowance overpaid by one extra week (duplicate payment)");

// --- Build the actual payslip rows from the (possibly corrupted) variance rows. ---
const payData: PayDataRow[] = truth.variances
  .filter((v) => v.expectedCents !== 0 || v.actualCents !== 0)
  .map((v) => ({ employeeId: v.employeeId, periodStart: v.periodStart, periodEnd: v.periodEnd, costCategory: v.component, amountCents: v.actualCents }));

// --- Write the workbook, matching the real template's tab/column/marker convention. ---
const workbook = new ExcelJS.Workbook();

function addTab(name: string, headers: string[], rows: (string | number)[][]) {
  const ws = workbook.addWorksheet(name);
  ws.addRow(["COMMENTS >>>", ...headers.map(() => "")]);
  ws.addRow(["1st row of CSV >>>", ...headers]);
  for (const row of rows) ws.addRow(["", ...row]);
}

addTab("DATA#employee static attributes", ["employee_identifier", "dob", "employment_start_date", "employment_termination_date"],
  staticAttrs.map((s) => [s.employeeId, s.dob ?? "", s.employmentStartDate ?? "", s.employmentTerminationDate ?? ""]));

addTab("DATA#employee dynamic attribute",
  ["employee_identifier", "applicable_from", "applicable_to", "employment_type", "award", "ii_classification", "min_contract_hours_weekly", "is_above_award_contracted_rate", "is_employee_employed _as_a_shiftworker"],
  dynamicAttrs.map((d) => [
    d.employeeId, d.applicableFrom, d.applicableTo,
    d.employmentType === "full_time" ? "Full Time" : d.employmentType === "part_time" ? "Part Time" : "Casual",
    d.award, d.classification.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    d.minContractHoursWeekly ?? "", d.isAboveAwardContractedRate ? "y" : "", d.isShiftworker ? "shift" : "day",
  ]));

addTab("DATA#pay periods", ["applicable_from", "applicable_to"], [[PERIOD.start, PERIOD.end]]);

addTab("DATA#public holidays", ["date", "public_holiday_start_time", "region", "public_holiday_name"],
  publicHolidays.map((h) => [h.date, "", h.region, h.name]));

addTab("DATA#payslip data", ["employee_identifier", "applicable_from", "applicable_to", "cost_category", "total_paid_no_oncosts"],
  payData.map((p) => [p.employeeId, p.periodStart, p.periodEnd, p.costCategory, (p.amountCents / 100).toFixed(2)]));

addTab("DATA#rostered shifts", ["employee_identifier", "rostered_date", "rostered_start", "rostered_end", "rostered_unpaid_break_start", "rostered_unpaid_break_length"],
  rosteredShifts.map((r) => [r.employeeId, r.date, r.start, r.end, r.breakStart ?? "", r.breakLengthHours]));

addTab("DATA#worked shifts", ["employee_identifier", "date", "pay_start", "pay_end", "break_start", "break_length", "leave", "location", "region"],
  workedShifts.map((w) => [w.employeeId, w.date, w.start, w.end, w.breakStart ?? "", w.breakLengthHours, w.leave ?? "", w.location, w.region]));

addTab("DATA#allowances", ["employee_identifier", "allowance_name", "applicable_from", "applicable_to", "For Higher Duties only"],
  allowances.map((a) => [a.employeeId, a.allowanceName, a.from, a.to, a.higherDutiesLevel ?? ""]));

addTab("DATA#callback shifts", ["employee_identifier", "date", "pay_start", "pay_end", "call back_ shift length"],
  callbackShifts.map((c) => [c.employeeId, c.date, c.start, c.end, c.lengthHours]));

const OUT_DIR = path.join(__dirname, "recalc-sample-data");
mkdirSync(OUT_DIR, { recursive: true });
const outPath = path.join(OUT_DIR, "pay-review-sample.xlsx");

workbook.xlsx.writeFile(outPath).then(() => {
  writeFileSync(
    path.join(OUT_DIR, "README.md"),
    `# Recalc sample workbook\n\nGenerated by scripts/generate-recalc-sample-data.ts against the seeded MA000019 rule set (supabase/03-recalc-ma000019-ruleset.sql). 6 employees (full-time/part-time/casual day workers, one shiftworker, one on leave, one with a First Aid allowance), one pay period, one sample public holiday.\n\nUpload pay-review-sample.xlsx at /admin/innovation/recalc. Everything nets to ~$0 EXCEPT these deliberately seeded discrepancies:\n\n${SEEDED.map((s) => `- ${s}`).join("\n")}\n`,
  );
  console.log(`Wrote ${outPath}`);
  console.log(`Seeded ${SEEDED.length} discrepancies:`);
  SEEDED.forEach((s) => console.log(`  - ${s}`));
});
