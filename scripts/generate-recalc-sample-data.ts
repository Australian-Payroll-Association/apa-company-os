// Generates a ~100-row dummy timesheet + pay data CSV pair, matched to the
// templates in docs/product/project-recalc-module.md, for exercising the
// recalculation engine end to end via the /admin/innovation/recalc UI.
//
// 8 employees x 2 fortnightly pay periods, priced against the seeded example
// rule set in supabase/02-recalc.sql. Five discrepancies are deliberately
// seeded into the pay data (see SEEDED_DISCREPANCIES below) so the variance
// report has something real to catch; everyone else should net to ~$0.
//
// Run with: npx tsx scripts/generate-recalc-sample-data.ts
// Writes scripts/recalc-sample-data/{timesheet,pay-data}.csv

import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { runRecalculation } from "../lib/recalc/engine";
import type { PayDataRow, PayComponent, RuleSet, TimesheetRow } from "../lib/recalc/types";

const RULE_SET: RuleSet = {
  ordinary_hours_per_day: 7.6,
  ordinary_hours_per_week: 38,
  classifications: { level_1: { base_hourly_rate: 24.5 }, level_2: { base_hourly_rate: 26.1 } },
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
  public_holidays: ["2026-01-01", "2026-01-26"],
  superannuation_pct: 11.5,
};

type Employee = { id: string; name: string; classification: "level_1" | "level_2" };
const EMPLOYEES: Employee[] = [
  { id: "E01", name: "Alex Nguyen", classification: "level_1" },
  { id: "E02", name: "Priya Singh", classification: "level_1" },
  { id: "E03", name: "Sam Lee", classification: "level_2" },
  { id: "E04", name: "Jo Park", classification: "level_1" },
  { id: "E05", name: "Maria Silva", classification: "level_2" },
  { id: "E06", name: "Chris Taylor", classification: "level_1" },
  { id: "E07", name: "Dana Kim", classification: "level_2" },
  { id: "E08", name: "Liam Chen", classification: "level_1" },
];

// Two fortnightly pay periods, weekdays only for ordinary/OT shifts, with a
// handful of weekend shifts sprinkled in for the penalty-rate path.
const PERIODS = [
  { start: "2026-03-01", end: "2026-03-14" }, // Sun 1 Mar - Sat 14 Mar 2026
  { start: "2026-03-15", end: "2026-03-28" },
];

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function datesInRange(start: string, end: string): string[] {
  const out: string[] = [];
  const d = new Date(`${start}T00:00:00Z`);
  const endD = new Date(`${end}T00:00:00Z`);
  while (d <= endD) {
    out.push(isoDate(d));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

const timesheetRows: TimesheetRow[] = [];
let dayCounter = 0;

for (const period of PERIODS) {
  const dates = datesInRange(period.start, period.end);
  for (const emp of EMPLOYEES) {
    for (const date of dates) {
      const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
      dayCounter++;
      if (dow === 0) continue; // Sunday off for everyone in this sample
      if (dow === 6) {
        // Roughly one Saturday shift per employee per period, for the penalty-rate path.
        if (dayCounter % 8 === 0) {
          timesheetRows.push({
            employeeId: emp.id,
            employeeName: emp.name,
            classification: emp.classification,
            workDate: date,
            startTime: "09:00",
            endTime: "15:00",
            unpaidBreakMinutes: 0,
          });
        }
        continue;
      }
      // Weekday: mostly a plain 8-hour day (7.5 net after a 30-min break, no
      // OT), with the occasional longer day to exercise the overtime tiers.
      const longDay = dayCounter % 6 === 0;
      timesheetRows.push({
        employeeId: emp.id,
        employeeName: emp.name,
        classification: emp.classification,
        workDate: date,
        startTime: "08:00",
        endTime: longDay ? "18:00" : "16:00",
        unpaidBreakMinutes: 30,
      });
    }
  }
}

// Run the engine once to get the "true" expected pay data, then write it back
// out as the pay-data CSV — deliberately corrupting a handful of rows so the
// variance report has real discrepancies to surface.
const zeroPayData: PayDataRow[] = EMPLOYEES.flatMap((emp) =>
  PERIODS.map((p) => ({
    employeeId: emp.id,
    employeeName: emp.name,
    payPeriodStart: p.start,
    payPeriodEnd: p.end,
    component: "ordinary" as PayComponent,
    amountCents: 0,
    hours: null,
  })),
);
const expected = runRecalculation(timesheetRows, zeroPayData, RULE_SET);

// Build "actual" pay data as an exact copy of expected, per employee/period/component.
type Key = string;
const actual = new Map<Key, { employeeId: string; employeeName: string; payPeriodStart: string; payPeriodEnd: string; component: PayComponent; amountCents: number }>();
for (const v of expected.variances) {
  const key = `${v.employeeId}|${v.payPeriodStart}|${v.payPeriodEnd}|${v.component}`;
  actual.set(key, {
    employeeId: v.employeeId,
    employeeName: v.employeeName,
    payPeriodStart: v.payPeriodStart,
    payPeriodEnd: v.payPeriodEnd,
    component: v.component,
    amountCents: v.expectedCents,
  });
}

// Deliberately seeded discrepancies — documented so the demo is legible.
const SEEDED_DISCREPANCIES: string[] = [];

function corrupt(employeeId: string, period: (typeof PERIODS)[number], component: PayComponent, mutate: (cents: number) => number, note: string) {
  const key = `${employeeId}|${period.start}|${period.end}|${component}`;
  const row = actual.get(key);
  if (!row) {
    console.warn(`(skip) no ${component} row for ${employeeId} in ${period.start}..${period.end} to corrupt`);
    return;
  }
  const before = row.amountCents;
  row.amountCents = mutate(before);
  SEEDED_DISCREPANCIES.push(`${employeeId} (${row.employeeName}), ${period.start}..${period.end}, ${component}: ${note} (expected ${(before / 100).toFixed(2)}, paid ${(row.amountCents / 100).toFixed(2)})`);
}

corrupt("E01", PERIODS[0], "overtime", () => 0, "overtime dropped entirely from the pay run");
corrupt("E04", PERIODS[0], "saturday_penalty", (c) => Math.round(c * (1 / 1.25)), "Saturday penalty paid at ordinary rate, not the 1.25x penalty");
corrupt("E05", PERIODS[1], "ordinary", (c) => c - 5000, "ordinary pay short by $50 (data-entry error)");
corrupt("E07", PERIODS[0], "superannuation", (c) => c + 2000, "superannuation over-paid by $20");
corrupt("E02", PERIODS[1], "ordinary", (c) => c + 1500, "ordinary pay over by $15 (a real but immaterial rounding difference)");

const payDataRows = Array.from(actual.values()).filter((r) => r.amountCents !== 0);

// --- Write CSVs ---
const OUT_DIR = path.join(__dirname, "recalc-sample-data");
mkdirSync(OUT_DIR, { recursive: true });

function toCsv(header: string[], rows: string[][]): string {
  return [header, ...rows].map((r) => r.join(",")).join("\n") + "\n";
}

const timesheetCsv = toCsv(
  ["employee_id", "employee_name", "classification", "work_date", "start_time", "end_time", "unpaid_break_minutes"],
  timesheetRows.map((r) => [r.employeeId, r.employeeName, r.classification, r.workDate, r.startTime, r.endTime, String(r.unpaidBreakMinutes)]),
);
writeFileSync(path.join(OUT_DIR, "timesheet.csv"), timesheetCsv);

const payDataCsv = toCsv(
  ["employee_id", "employee_name", "pay_period_start", "pay_period_end", "component", "amount", "hours"],
  payDataRows.map((r) => [r.employeeId, r.employeeName, r.payPeriodStart, r.payPeriodEnd, r.component, (r.amountCents / 100).toFixed(2), ""]),
);
writeFileSync(path.join(OUT_DIR, "pay-data.csv"), payDataCsv);

writeFileSync(
  path.join(OUT_DIR, "README.md"),
  `# Recalc sample data\n\nGenerated by scripts/generate-recalc-sample-data.ts against the seeded example rule set (supabase/02-recalc.sql). ${timesheetRows.length} timesheet rows, ${payDataRows.length} pay data rows, ${EMPLOYEES.length} employees, ${PERIODS.length} pay periods.\n\nUpload both files at /admin/innovation/recalc. Everything nets to ~$0 EXCEPT these deliberately seeded discrepancies:\n\n${SEEDED_DISCREPANCIES.map((s) => `- ${s}`).join("\n")}\n`,
);

console.log(`Wrote ${timesheetRows.length} timesheet rows and ${payDataRows.length} pay data rows to ${OUT_DIR}`);
console.log(`Seeded ${SEEDED_DISCREPANCIES.length} discrepancies:`);
SEEDED_DISCREPANCIES.forEach((s) => console.log(`  - ${s}`));
