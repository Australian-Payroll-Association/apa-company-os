// Generates a synthetic "Pay Review data gathering" workbook (.xlsx, all 9
// real DATA# tabs) against the real MA000019 rule set, for 20 employees
// spanning every employment type and clause category the engine handles —
// full-time/part-time/casual x day/shift workers, leave, every allowance
// type, a call-back, weekend/public-holiday work, and one junior employee
// (to exercise the age-banded rate tables). A handful of discrepancies are
// deliberately seeded so the variance report has something real to catch.
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

// Mon-Fri dates for the two weeks in the period, plus the Saturdays/Sundays.
const WEEK1_WEEKDAYS = ["2026-03-02", "2026-03-03", "2026-03-04", "2026-03-05", "2026-03-06"];
const WEEK2_WEEKDAYS = ["2026-03-09", "2026-03-10", "2026-03-11", "2026-03-12", "2026-03-13"]; // 03-09 is also the sample public holiday
const SAT1 = "2026-03-07";
const SUN1 = "2026-03-08";
const SAT2 = "2026-03-14";

const staticAttrs: EmployeeStaticAttrs[] = [];
const dynamicAttrs: EmployeeDynamicAttrs[] = [];
const rosteredShifts: RosteredShift[] = [];
const workedShifts: WorkedShift[] = [];
const allowances: Allowance[] = [];
const callbackShifts: CallbackShift[] = [];

function addShift(employeeId: string, date: string, start: string, end: string, breakLengthHours = 0.5, extra: Partial<WorkedShift> = {}) {
  rosteredShifts.push({ employeeId, date, start, end, breakStart: null, breakLengthHours });
  workedShifts.push({ employeeId, date, start, end, breakStart: null, breakLengthHours, leave: null, location: "Sydney", region: "NSW", ...extra });
}

function employee(id: string, dob: string, dynamic: Omit<EmployeeDynamicAttrs, "employeeId" | "applicableFrom" | "applicableTo">) {
  staticAttrs.push({ employeeId: id, dob, employmentStartDate: "2018-01-01", employmentTerminationDate: null });
  dynamicAttrs.push({ employeeId: id, applicableFrom: "2020-01-01", applicableTo: "2030-01-01", ...dynamic });
  return id;
}

const ADULT_DOB = "1990-01-01";

// --- 20 employees, one scenario each ---

// E01-E02: full-time day workers, straightforward ordinary hours (Level 1 / Level 4).
employee("E01", ADULT_DOB, { employmentType: "full_time", award: "BFI", classification: "level_1", minContractHoursWeekly: null, isAboveAwardContractedRate: false, isShiftworker: false });
[...WEEK1_WEEKDAYS, ...WEEK2_WEEKDAYS].forEach((d) => addShift("E01", d, "08:00", "16:06"));

employee("E02", ADULT_DOB, { employmentType: "full_time", award: "BFI", classification: "level_4", minContractHoursWeekly: null, isAboveAwardContractedRate: false, isShiftworker: false });
[...WEEK1_WEEKDAYS, ...WEEK2_WEEKDAYS].forEach((d) => addShift("E02", d, "08:00", "16:06"));

// E03-E04: part-time day workers, contracted hours below 38 (Level 2 / Level 3).
employee("E03", ADULT_DOB, { employmentType: "part_time", award: "BFI", classification: "level_2", minContractHoursWeekly: 20, isAboveAwardContractedRate: false, isShiftworker: false });
[...WEEK1_WEEKDAYS, ...WEEK2_WEEKDAYS].forEach((d) => addShift("E03", d, "09:00", "13:00", 0));

employee("E04", ADULT_DOB, { employmentType: "part_time", award: "BFI", classification: "level_3", minContractHoursWeekly: 25, isAboveAwardContractedRate: false, isShiftworker: false });
[...WEEK1_WEEKDAYS, ...WEEK2_WEEKDAYS].forEach((d) => addShift("E04", d, "09:00", "14:00", 0));

// E05-E06: casual day workers (Level 1 short shift below minimum engagement; Level 3 normal).
employee("E05", ADULT_DOB, { employmentType: "casual", award: "BFI", classification: "level_1", minContractHoursWeekly: null, isAboveAwardContractedRate: false, isShiftworker: false });
addShift("E05", WEEK1_WEEKDAYS[0], "10:00", "11:00");
addShift("E05", WEEK2_WEEKDAYS[0], "10:00", "11:00");

employee("E06", ADULT_DOB, { employmentType: "casual", award: "BFI", classification: "level_3", minContractHoursWeekly: null, isAboveAwardContractedRate: false, isShiftworker: false });
[WEEK1_WEEKDAYS[0], WEEK1_WEEKDAYS[1], WEEK2_WEEKDAYS[0]].forEach((d) => addShift("E06", d, "09:00", "14:00"));

// E07-E08: full-time shiftworkers (afternoon / night loadings).
employee("E07", ADULT_DOB, { employmentType: "full_time", award: "BFI", classification: "level_2", minContractHoursWeekly: null, isAboveAwardContractedRate: false, isShiftworker: true });
[WEEK1_WEEKDAYS[0], WEEK1_WEEKDAYS[1], WEEK1_WEEKDAYS[2], WEEK1_WEEKDAYS[3]].forEach((d) => addShift("E07", d, "14:00", "22:00"));

employee("E08", ADULT_DOB, { employmentType: "full_time", award: "BFI", classification: "level_3", minContractHoursWeekly: null, isAboveAwardContractedRate: false, isShiftworker: true });
[WEEK2_WEEKDAYS[1], WEEK2_WEEKDAYS[2], WEEK2_WEEKDAYS[3], WEEK2_WEEKDAYS[4]].forEach((d) => addShift("E08", d, "22:00", "06:00", 0.5));

// E09: part-time shiftworker, early-morning loading.
employee("E09", ADULT_DOB, { employmentType: "part_time", award: "BFI", classification: "level_1", minContractHoursWeekly: 20, isAboveAwardContractedRate: false, isShiftworker: true });
[WEEK1_WEEKDAYS[0], WEEK1_WEEKDAYS[1], WEEK1_WEEKDAYS[2], WEEK1_WEEKDAYS[3]].forEach((d) => addShift("E09", d, "05:00", "10:00", 0));

// E10: casual shiftworker.
employee("E10", ADULT_DOB, { employmentType: "casual", award: "BFI", classification: "level_2", minContractHoursWeekly: null, isAboveAwardContractedRate: false, isShiftworker: true });
[WEEK2_WEEKDAYS[0], WEEK2_WEEKDAYS[1]].forEach((d) => addShift("E10", d, "14:00", "22:00"));

// E11: full-time day worker taking annual leave one day.
employee("E11", ADULT_DOB, { employmentType: "full_time", award: "BFI", classification: "level_1", minContractHoursWeekly: null, isAboveAwardContractedRate: false, isShiftworker: false });
[WEEK1_WEEKDAYS[0], WEEK1_WEEKDAYS[1], WEEK1_WEEKDAYS[2], WEEK1_WEEKDAYS[3]].forEach((d) => addShift("E11", d, "08:00", "16:06"));
addShift("E11", WEEK1_WEEKDAYS[4], "08:00", "16:06", 0.5, { leave: "Annual Leave" });

// E12: full-time day worker with a First Aid allowance for the whole period.
employee("E12", ADULT_DOB, { employmentType: "full_time", award: "BFI", classification: "level_2", minContractHoursWeekly: null, isAboveAwardContractedRate: false, isShiftworker: false });
[...WEEK1_WEEKDAYS, ...WEEK2_WEEKDAYS].forEach((d) => addShift("E12", d, "08:00", "16:06"));
allowances.push({ employeeId: "E12", allowanceName: "First aid", from: PERIOD.start, to: PERIOD.end, higherDutiesLevel: null });

// E13: full-time day worker with a Stand-by allowance for one week.
employee("E13", ADULT_DOB, { employmentType: "full_time", award: "BFI", classification: "level_1", minContractHoursWeekly: null, isAboveAwardContractedRate: false, isShiftworker: false });
[...WEEK1_WEEKDAYS, ...WEEK2_WEEKDAYS].forEach((d) => addShift("E13", d, "08:00", "16:06"));
allowances.push({ employeeId: "E13", allowanceName: "Stand by", from: WEEK1_WEEKDAYS[0], to: WEEK1_WEEKDAYS[4], higherDutiesLevel: null });

// E14: full-time day worker acting up (Higher Duties, Level 2 -> Level 4) for one week.
employee("E14", ADULT_DOB, { employmentType: "full_time", award: "BFI", classification: "level_2", minContractHoursWeekly: null, isAboveAwardContractedRate: false, isShiftworker: false });
[...WEEK1_WEEKDAYS, ...WEEK2_WEEKDAYS].forEach((d) => addShift("E14", d, "08:00", "16:06"));
allowances.push({ employeeId: "E14", allowanceName: "Higher duties", from: WEEK2_WEEKDAYS[0], to: WEEK2_WEEKDAYS[4], higherDutiesLevel: "level_4" });

// E15: full-time day worker with a Vehicle allowance for the whole period.
employee("E15", ADULT_DOB, { employmentType: "full_time", award: "BFI", classification: "level_3", minContractHoursWeekly: null, isAboveAwardContractedRate: false, isShiftworker: false });
[...WEEK1_WEEKDAYS, ...WEEK2_WEEKDAYS].forEach((d) => addShift("E15", d, "08:00", "16:06"));
allowances.push({ employeeId: "E15", allowanceName: "Vehicle", from: PERIOD.start, to: PERIOD.end, higherDutiesLevel: null });

// E16: casual worker with an evening call-back.
employee("E16", ADULT_DOB, { employmentType: "casual", award: "BFI", classification: "level_1", minContractHoursWeekly: null, isAboveAwardContractedRate: false, isShiftworker: false });
addShift("E16", WEEK1_WEEKDAYS[0], "09:00", "13:00");
callbackShifts.push({ employeeId: "E16", date: WEEK1_WEEKDAYS[2], start: "20:00", end: "21:00", lengthHours: 1 });

// E17: full-time day worker with a Saturday shift split ordinary (8am-12pm) + overtime.
employee("E17", ADULT_DOB, { employmentType: "full_time", award: "BFI", classification: "level_2", minContractHoursWeekly: null, isAboveAwardContractedRate: false, isShiftworker: false });
[...WEEK1_WEEKDAYS, ...WEEK2_WEEKDAYS].forEach((d) => addShift("E17", d, "08:00", "16:06"));
addShift("E17", SAT1, "08:00", "15:00", 0);
addShift("E17", SAT2, "08:00", "15:00", 0);

// E18: full-time day worker who worked a Sunday (all hours at the Sunday rate).
employee("E18", ADULT_DOB, { employmentType: "full_time", award: "BFI", classification: "level_3", minContractHoursWeekly: null, isAboveAwardContractedRate: false, isShiftworker: false });
[...WEEK1_WEEKDAYS, ...WEEK2_WEEKDAYS].forEach((d) => addShift("E18", d, "08:00", "16:06"));
addShift("E18", SUN1, "09:00", "15:00", 0);

// E19: full-time day worker who worked the sample public holiday.
employee("E19", ADULT_DOB, { employmentType: "full_time", award: "BFI", classification: "level_1", minContractHoursWeekly: null, isAboveAwardContractedRate: false, isShiftworker: false });
[...WEEK1_WEEKDAYS, ...WEEK2_WEEKDAYS.filter((d) => d !== "2026-03-09")].forEach((d) => addShift("E19", d, "08:00", "16:06"));
addShift("E19", "2026-03-09", "09:00", "12:00", 0, { region: "VIC" });

// E20: junior casual employee (17 years old at the time of the period) — exercises the junior rate bands.
employee("E20", "2008-09-15", { employmentType: "casual", award: "BFI", classification: "level_1", minContractHoursWeekly: null, isAboveAwardContractedRate: false, isShiftworker: false });
[WEEK1_WEEKDAYS[0], WEEK1_WEEKDAYS[1], WEEK2_WEEKDAYS[0]].forEach((d) => addShift("E20", d, "09:00", "13:00"));

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
  console.warn(`Warnings while computing ground truth (${truth.warnings.length}) — check the fixture data:`);
  truth.warnings.forEach((w) => console.warn(`  - ${w}`));
}

// Baseline: everyone gets paid exactly what's expected (zero variance) —
// truthData had no payslip rows, so runRecalculation's `actualCents` is 0
// everywhere until we set it here. Corruptions below then override specific rows.
for (const row of truth.variances) row.actualCents = row.expectedCents;

// --- Seed discrepancies across different clause categories and employees. ---
const SEEDED: string[] = [];
function corrupt(employeeId: string, component: string, mutate: (cents: number) => number, note: string) {
  const row = truth.variances.find((v) => v.employeeId === employeeId && v.component === component);
  if (!row) {
    console.warn(`(skip) no ${component} row for ${employeeId} to corrupt`);
    return;
  }
  const before = row.expectedCents;
  const after = mutate(before);
  row.actualCents = after;
  SEEDED.push(`${employeeId}, ${component}: ${note} (expected ${(before / 100).toFixed(2)}, paid ${(after / 100).toFixed(2)})`);
}

corrupt("E01", "ordinary", (c) => c - 5000, "ordinary pay short by $50 (data-entry error)");
corrupt("E03", "ordinary", (c) => c + 1500, "part-time ordinary pay over by $15 (rounding difference)");
corrupt("E07", "afternoon_permanent", (c) => c - 8000, "afternoon shift loading paid at the non-permanent rate, not the permanent-shiftworker rate");
corrupt("E11", "annual_leave_loading", (c) => Math.round(c * 0.5), "annual leave loading underpaid — paid roughly half of what's owed");
corrupt("E12", "first_aid_allowance", (c) => c + 2059, "first aid allowance overpaid by one extra week (duplicate payment)");
corrupt("E14", "higher_duties_allowance", (c) => 0, "higher duties differential not paid at all");
corrupt("E17", "overtime_saturday_outside_hours", (c) => c - 3000, "Saturday overtime underpaid by $30");
corrupt("E18", "sunday_penalty", (c) => Math.round(c * 0.8), "Sunday penalty underpaid — paid at roughly 80% of the correct rate");
corrupt("E19", "public_holiday_penalty", (c) => c + 4000, "public holiday work overpaid by $40 (double-counted top-up)");
corrupt("E20", "ordinary", (c) => c - 500, "junior casual rate applied incorrectly, short by $5");

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
    `# Recalc sample workbook\n\nGenerated by scripts/generate-recalc-sample-data.ts against the real MA000019 rule set (supabase/03-recalc-ma000019-ruleset.sql). 20 employees spanning every employment type (full-time/part-time/casual x day/shift workers), leave, every allowance type, a call-back, weekend/public-holiday work, and one junior (17yo) employee. One pay period, one sample public holiday.\n\nUpload pay-review-sample.xlsx at /admin/innovation/recalc. Everything nets to ~$0 EXCEPT these deliberately seeded discrepancies:\n\n${SEEDED.map((s) => `- ${s}`).join("\n")}\n`,
  );
  console.log(`Wrote ${outPath}`);
  console.log(`${staticAttrs.length} employees, ${workedShifts.length} worked shifts, ${payData.length} payslip rows.`);
  console.log(`Seeded ${SEEDED.length} discrepancies:`);
  SEEDED.forEach((s) => console.log(`  - ${s}`));
});
