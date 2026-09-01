// Builds a blank "Pay review data gathering" workbook — the same 9 DATA# tabs
// and column layout parse-workbook.ts expects, with the instruction/marker
// rows filled in but no data rows. Lets a consultant download a ready-to-fill
// template straight from /admin/innovation/recalc instead of hunting for
// APA's master copy elsewhere.
//
// Column lists here are intentionally independent of parse-workbook.ts's own
// (duplicated, not shared) — keep the two in sync if a tab's columns change.

import ExcelJS from "exceljs";

type TabSpec = { name: string; comments: string[]; headers: string[] };

const TABS: TabSpec[] = [
  {
    name: "DATA#employee static attributes",
    comments: ["COMMENTS >>>", "This is the MASTER list of employees for the run", "Date of birth (yyyy-mm-dd)", "Employment start date (yyyy-mm-dd)", "Employment termination date (yyyy-mm-dd), leave BLANK if not terminated"],
    headers: ["employee_identifier", "dob", "employment_start_date", "employment_termination_date"],
  },
  {
    name: "DATA#employee dynamic attribute",
    comments: ["COMMENTS >>>", "", "Date format: yyyy-mm-dd", "Date format: yyyy-mm-dd", "Accepted entries: Full Time, Part Time, Casual", "Name of Industrial Instrument", "Classification (e.g. Level 1)", "Average minimum guaranteed hours per week for FT and PT employees", "Enter y if employee paid higher than award", "Shiftworker = shift or Day worker = day"],
    headers: ["employee_identifier", "applicable_from", "applicable_to", "employment_type", "award", "ii_classification", "min_contract_hours_weekly", "is_above_award_contracted_rate", "is_employee_employed _as_a_shiftworker"],
  },
  {
    name: "DATA#pay periods",
    comments: ["COMMENTS >>>", "Date format: yyyy-mm-dd", "Date format: yyyy-mm-dd"],
    headers: ["applicable_from", "applicable_to"],
  },
  {
    name: "DATA#public holidays",
    comments: ["COMMENTS >>>", "Date format: yyyy-mm-dd", "Time format: hh:mm", "This is the public holiday region (not necessarily a state/territory)", "Helpful for inspection, not required for calculations"],
    headers: ["date", "public_holiday_start_time", "region", "public_holiday_name"],
  },
  {
    name: "DATA#payslip data",
    comments: ["COMMENTS >>>", "", "Start of the pay period (yyyy-mm-dd)", "End of the corresponding pay period (yyyy-mm-dd)", "Pay type label — exclude entries not relevant to the review (e.g. tax)", "Amount paid"],
    headers: ["employee_identifier", "applicable_from", "applicable_to", "cost_category", "total_paid_no_oncosts"],
  },
  {
    name: "DATA#rostered shifts",
    comments: ["COMMENTS >>>", "", "Date of the start of the roster block (yyyy-mm-dd)", "Start time of the roster block (hh:mm)", "End time of the roster block (hh:mm)", "Start time of the break, if present; otherwise leave BLANK", "Break duration in hours; enter 0 if no break"],
    headers: ["employee_identifier", "rostered_date", "rostered_start", "rostered_end", "rostered_unpaid_break_start", "rostered_unpaid_break_length"],
  },
  {
    name: "DATA#worked shifts",
    comments: ["COMMENTS >>>", "", "Date of the work block (yyyy-mm-dd)", "Start time of the work block (hh:mm)", "End time of the work block (hh:mm)", "Start time of the break, if present; otherwise leave BLANK", "Break duration in hours; enter 0 if no break", "Leave type taken this day (e.g. Annual Leave); leave BLANK if not leave", "Location worked — reporting only", "Public holiday region of the work block"],
    headers: ["employee_identifier", "date", "pay_start", "pay_end", "break_start", "break_length", "leave", "location", "region"],
  },
  {
    name: "DATA#allowances",
    comments: ["COMMENTS >>>", "For employees receiving allowances only", "e.g. First aid, Stand by, Higher duties, Vehicle", "Date format: yyyy-mm-dd", "Date format: yyyy-mm-dd", "For Higher Duties only — the classification being acted in"],
    headers: ["employee_identifier", "allowance_name", "applicable_from", "applicable_to", "For Higher Duties only"],
  },
  {
    name: "DATA#callback shifts",
    comments: ["COMMENTS >>>", "", "Date of the call-back work block (yyyy-mm-dd)", "Start time of the call-back (hh:mm)", "End time of the call-back (hh:mm)", "Call-back length in hours"],
    headers: ["employee_identifier", "date", "pay_start", "pay_end", "call back_ shift length"],
  },
];

export function buildTemplateWorkbook(): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();

  const notes = workbook.addWorksheet("General Notes");
  notes.addRow(["Pay Review Data Gathering — Template"]);
  notes.addRow([""]);
  notes.addRow(["Fill in one row per record on each DATA# tab, below the '1st row of CSV >>>' header row."]);
  notes.addRow(["Do not change column order, tab names, or the header row itself — the recalculation engine reads by exact name."]);
  notes.addRow(["Delete this note tab (or leave it — it's ignored) before uploading."]);
  notes.getColumn(1).width = 100;

  for (const tab of TABS) {
    const ws = workbook.addWorksheet(tab.name);
    ws.addRow(["COMMENTS >>>", ...tab.comments.slice(1)]);
    ws.addRow(["1st row of CSV >>>", ...tab.headers]);
    ws.getRow(1).font = { italic: true, color: { argb: "FF888888" } };
    ws.getRow(2).font = { bold: true };
    for (let c = 1; c <= tab.headers.length + 1; c++) ws.getColumn(c).width = 22;
  }

  return workbook;
}
