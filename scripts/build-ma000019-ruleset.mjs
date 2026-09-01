// Builds lib/recalc/rule-sets/ma000019-2026-07-01.json from APA's real award
// interpretation library (an .xlsx "system configuration" file for MA000019 —
// see docs/product/project-recalc-module.md). Programmatic extraction, not
// hand-transcription: the payrates sheet has ~600 dollar figures across 12
// age/employment-type rate tables, too error-prone to type by hand.
//
// Re-run this if the award is updated with a new source file:
//   node scripts/build-ma000019-ruleset.mjs --award "<path to the award xlsx>" --out lib/recalc/rule-sets/ma000019-<effective-date>.json

import { writeFileSync } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

const awardPath = arg("award");
const outPath = arg("out", "lib/recalc/rule-sets/ma000019-2026-07-01.json");
if (!awardPath) {
  console.error("Usage: node scripts/build-ma000019-ruleset.mjs --award <path to award xlsx> [--out <output json path>]");
  process.exit(1);
}

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(awardPath);

function cellText(cell) {
  const v = cell?.value;
  if (v == null) return "";
  if (typeof v === "object" && "richText" in v) return v.richText.map((r) => r.text).join("");
  if (typeof v === "object" && "result" in v) return String(v.result ?? "");
  return String(v).trim();
}

function sheetToRows(sheetName) {
  const ws = workbook.getWorksheet(sheetName);
  if (!ws) throw new Error(`Sheet not found: ${sheetName}`);
  const rows = [];
  ws.eachRow({ includeEmpty: true }, (row) => {
    const cells = [];
    for (let c = 1; c <= ws.columnCount; c++) cells.push(cellText(row.getCell(c)));
    rows.push(cells);
  });
  return rows;
}

function money(s) {
  if (s === "" || s == null) return null;
  const n = Number(String(s).replace(/[$,]/g, ""));
  if (!Number.isFinite(n)) throw new Error(`Not a dollar amount: "${s}"`);
  return Math.round(n * 100); // cents
}

const rows = sheetToRows("payrates");

const rates = {}; // rates[band][category][level] = {...}

let currentBand = null;
let currentCategory = null; // "standard" | "casual"
let i = 0;
while (i < rows.length) {
  const row = rows[i];
  const label = (row[0] || "").trim();

  // Adult: two separate header lines ("Adult" then "Full-time & part-time"/"Casual").
  if (/^Adult$/i.test(label)) {
    currentBand = "adult";
    rates[currentBand] = rates[currentBand] || {};
    i++;
    continue;
  }
  if (/^Full-time & part-time$/i.test(label)) {
    currentCategory = "standard";
    i++;
    continue;
  }
  if (/^Casual$/i.test(label)) {
    currentCategory = "casual";
    i++;
    continue;
  }
  // Junior: band AND category combined in one line, e.g. "Junior - Casual - 17 years".
  const juniorMatch = label.match(/^Junior\s*-\s*(Full-time & part-time|Casual)\s*-\s*(Under 17 years|17 years|18 years|19 years|20 years)$/i);
  if (juniorMatch) {
    currentCategory = /casual/i.test(juniorMatch[1]) ? "casual" : "standard";
    currentBand = /under 17/i.test(juniorMatch[2]) ? "under_17" : juniorMatch[2].match(/\d+/)[0];
    rates[currentBand] = rates[currentBand] || {};
    i++;
    continue;
  }

  if (label === "Classification" && currentBand && currentCategory) {
    const headerRow = row.map((c) => (c || "").trim());
    const tableKind = /weekly pay rate/i.test(headerRow[1])
      ? "t1-ftpt"
      : /hourly pay rate/i.test(headerRow[1])
        ? "t1-casual"
        : /sunday/i.test(headerRow[1])
          ? headerRow.includes("Less than 10 hour break between shifts")
            ? "t2-ftpt"
            : "t2-casual"
          : "";
    if (!tableKind) { i++; continue; }

    rates[currentBand][currentCategory] = rates[currentBand][currentCategory] || {};
    i++;
    while (i < rows.length && /^Level \d/i.test((rows[i][0] || "").trim())) {
      const r = rows[i];
      const level = r[0].trim().toLowerCase().replace(/\s+/g, "_"); // "level_1"
      const entry = rates[currentBand][currentCategory][level] || {};

      if (tableKind === "t1-ftpt") {
        Object.assign(entry, {
          weekly_cents: money(r[1]),
          hourly_cents: money(r[2]),
          early_morning_cents: money(r[3]),
          afternoon_cents: money(r[4]),
          afternoon_permanent_cents: money(r[5]),
          night_cents: money(r[6]),
          night_permanent_cents: money(r[7]),
        });
      } else if (tableKind === "t1-casual") {
        Object.assign(entry, {
          hourly_cents: money(r[1]),
          early_morning_cents: money(r[2]),
          afternoon_cents: money(r[3]),
          afternoon_permanent_cents: money(r[4]),
          night_cents: money(r[5]),
          night_permanent_cents: money(r[6]),
        });
      } else if (tableKind === "t2-ftpt") {
        Object.assign(entry, {
          sunday_cents: money(r[1]),
          public_holiday_cents: money(r[2]),
          overtime_first_3h_cents: money(r[3]),
          overtime_after_3h_cents: money(r[4]),
          overtime_saturday_outside_hours_cents: money(r[5]),
          break_lt_10h_cents: money(r[6]),
          break_lt_8h_cents: money(r[7]),
        });
      } else if (tableKind === "t2-casual") {
        Object.assign(entry, {
          sunday_cents: money(r[1]),
          public_holiday_cents: money(r[2]),
          overtime_first_3h_cents: money(r[3]),
          overtime_after_3h_cents: money(r[4]),
          overtime_saturday_outside_hours_cents: money(r[5]),
        });
      }
      rates[currentBand][currentCategory][level] = entry;
      i++;
    }
    continue;
  }
  i++;
}

// Sanity check: every band/category should have exactly 6 levels with a non-null hourly_cents.
let checkedTables = 0;
for (const [band, cats] of Object.entries(rates)) {
  for (const [cat, levels] of Object.entries(cats)) {
    const levelKeys = Object.keys(levels);
    if (levelKeys.length !== 6) throw new Error(`Expected 6 levels for ${band}/${cat}, got ${levelKeys.length}: ${levelKeys.join(",")}`);
    for (const lvl of levelKeys) {
      if (levels[lvl].hourly_cents == null) throw new Error(`Missing hourly_cents for ${band}/${cat}/${lvl}`);
    }
    checkedTables++;
  }
}
if (checkedTables !== 12) throw new Error(`Expected 12 rate tables (adult+5 junior bands x standard+casual), got ${checkedTables}`);

// Allowances sheet -> named dollar allowances (best-effort parse of "$X.XX" tokens in each row's rate text).
const allowanceRows = sheetToRows("Allowances");
const allowances = {};
for (const row of allowanceRows) {
  const name = (row[0] || "").trim();
  const rateText = (row[1] || "").trim();
  if (!name || !rateText || /^allowances?$/i.test(name) || /^(award|effective from):?$/i.test(name)) continue;
  const amounts = [...rateText.matchAll(/\$([\d,]+\.\d{2})/g)].map((m) => Math.round(Number(m[1].replace(/,/g, "")) * 100));
  allowances[name] = { rate_text: rateText, amounts_cents: amounts };
}

const ruleSet = {
  name: "MA000019 - Banking, Finance and Insurance Award 2020",
  effective_from: "The first full pay period starting on or after 01 July 2026",
  source: "APA Award Interpretation Library - Awards - System configuration - MA000019 (1 July 2026)",
  generated_by: "scripts/build-ma000019-ruleset.mjs",
  rates,
  allowances,
  clauses: {
    ordinary_span: { weekday_start: "07:00", weekday_end: "19:00", weekday_late_end: "21:00", saturday_start: "08:00", saturday_end: "12:00" },
    averaging_weeks_default: 1, // 13.2 allows 1/2/3/4; per-engagement override via min_contract_hours_weekly cycle
    casual_loading_pct: 25,
    casual_minimum_engagement_hours: 2,
    shift_definitions: { early_morning_start: "04:00", early_morning_end: "07:00", afternoon_end_start: "18:00", afternoon_end_end: "24:00", night_end_start: "00:00", night_end_end: "08:00" },
    meal_allowance: { trigger_ot_hours: 1.5, trigger_finish_after: "18:00", additional_trigger_ot_hours: 5.5 },
    annual_leave_loading_pct: 17.5,
    superannuation_guarantee_pct: 11.5, // statutory, not award-specific
    not_modeled: [
      "13.5 Make-up time (requires an enterprise agreement record not present in any input tab)",
      "13.6 Rostered days off banking",
      "20.5 Time off instead of payment for overtime (TOIL banking)",
      "18.3(b) Stand-by call-back travel/transport reimbursement",
      "18.4(b) Travelling time/expense reimbursement",
      "32 Redundancy",
    ],
  },
};

writeFileSync(path.resolve(outPath), JSON.stringify(ruleSet, null, 2) + "\n");
console.log(`Wrote ${outPath}`);
console.log(`Bands: ${Object.keys(rates).join(", ")}`);
console.log(`Allowances parsed: ${Object.keys(allowances).length}`);
