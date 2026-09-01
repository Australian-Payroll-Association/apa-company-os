// Integration check: parses the generated sample CSVs (scripts/recalc-sample-data/)
// exactly as the server action does, runs them through the engine, and confirms
// the flagged variances match the discrepancies seeded by
// generate-recalc-sample-data.ts — and nothing else is flagged.
//
// Run with: npx tsx scripts/recalc-verify-sample-data.ts

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parsePayDataCsv, parseTimesheetCsv } from "../lib/recalc/parse-csv";
import { runRecalculation } from "../lib/recalc/engine";
import type { RuleSet } from "../lib/recalc/types";

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

const DIR = path.join(__dirname, "recalc-sample-data");
const timesheetCsv = readFileSync(path.join(DIR, "timesheet.csv"), "utf8");
const payDataCsv = readFileSync(path.join(DIR, "pay-data.csv"), "utf8");

const timesheet = parseTimesheetCsv(timesheetCsv);
const payData = parsePayDataCsv(payDataCsv);
assert.equal(timesheet.ok, true, "timesheet CSV should parse cleanly");
assert.equal(payData.ok, true, "pay data CSV should parse cleanly");
if (!timesheet.ok || !payData.ok) process.exit(1);

const result = runRecalculation(timesheet.rows, payData.rows, RULE_SET);

const EXPECTED_FLAGGED = new Set([
  "E01|2026-03-01|2026-03-14|overtime",
  "E04|2026-03-01|2026-03-14|saturday_penalty",
  "E05|2026-03-15|2026-03-28|ordinary",
  "E07|2026-03-01|2026-03-14|superannuation",
  "E02|2026-03-15|2026-03-28|ordinary",
]);

const flagged = result.variances.filter((v) => v.flagged);
const flaggedKeys = new Set(flagged.map((v) => `${v.employeeId}|${v.payPeriodStart}|${v.payPeriodEnd}|${v.component}`));

console.log(`Parsed ${timesheet.rows.length} timesheet rows, ${payData.rows.length} pay data rows.`);
console.log(`Engine produced ${result.variances.length} variance rows, ${flagged.length} flagged, ${result.warnings.length} warning(s).`);

assert.equal(result.warnings.length, 0, `expected no warnings, got: ${result.warnings.join(" | ")}`);
assert.equal(flagged.length, EXPECTED_FLAGGED.size, `expected exactly ${EXPECTED_FLAGGED.size} flagged rows, got ${flagged.length}: ${[...flaggedKeys].join(", ")}`);
for (const key of EXPECTED_FLAGGED) {
  assert.ok(flaggedKeys.has(key), `expected ${key} to be flagged, but it wasn't`);
}

console.log("\nAll seeded discrepancies were caught, and nothing else was flagged. ✓");
