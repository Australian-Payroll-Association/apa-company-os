// Integration check: parses the generated sample workbook exactly as the
// server action does, runs it through the engine, and confirms the flagged
// variances match the discrepancies seeded by generate-recalc-sample-data.ts —
// and nothing else is flagged.
//
// Run with: npx tsx scripts/recalc-verify-sample-data.ts

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseWorkbook } from "../lib/recalc/parse-workbook";
import { runRecalculation } from "../lib/recalc/engine";
import type { RuleSet } from "../lib/recalc/types";
import ruleSetJson from "../lib/recalc/rule-sets/ma000019-2026-07-01.json";

const ruleSet = ruleSetJson as unknown as RuleSet;

async function main() {
  const filePath = path.join(__dirname, "recalc-sample-data", "pay-review-sample.xlsx");
  const buffer = readFileSync(filePath);
  const parsed = await parseWorkbook(buffer);
  assert.equal(parsed.ok, true, `workbook should parse cleanly: ${!parsed.ok ? parsed.error : ""}`);
  if (!parsed.ok) return;

  const result = runRecalculation(parsed.data, ruleSet);

  const EXPECTED_FLAGGED = new Set([
    "E01|ordinary",
    "E03|ordinary",
    "E07|afternoon_permanent",
    "E11|annual_leave_loading",
    "E12|first_aid_allowance",
    "E14|higher_duties_allowance",
    "E17|overtime_saturday_outside_hours",
    "E18|sunday_penalty",
    "E19|public_holiday_penalty",
    "E20|ordinary",
  ]);

  const flagged = result.variances.filter((v) => v.flagged);
  const flaggedKeys = new Set(flagged.map((v) => `${v.employeeId}|${v.component}`));

  console.log(`Parsed ${parsed.data.workedShifts.length} worked shifts, ${parsed.data.payData.length} payslip rows.`);
  console.log(`Engine produced ${result.variances.length} variance rows, ${flagged.length} flagged, ${result.warnings.length} warning(s).`);
  if (result.warnings.length > 0) result.warnings.forEach((w) => console.log(`  warning: ${w}`));

  assert.equal(flagged.length, EXPECTED_FLAGGED.size, `expected exactly ${EXPECTED_FLAGGED.size} flagged rows, got ${flagged.length}: ${[...flaggedKeys].join(", ")}`);
  for (const key of EXPECTED_FLAGGED) {
    assert.ok(flaggedKeys.has(key), `expected ${key} to be flagged, but it wasn't`);
  }

  console.log("\nAll seeded discrepancies were caught, and nothing else was flagged. ✓");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
