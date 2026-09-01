// Reads APA's real "Pay Review data gathering template.xlsx" directly —
// server-only (uses exceljs). No CSV export step: consultants already fill
// this workbook in by hand, so the recalc tool accepts it as-is.
//
// Template convention (consistent across all 9 DATA# tabs): column A carries
// instruction/marker text for the human filling it in ("COMMENTS >>>", "1st
// row of CSV >>>", "Examples; pls delete >>>"); the REAL header row is the one
// whose column A reads "1st row of CSV >>>", with the actual field names in
// column B onward. Every row after that whose column A contains ">>>" is
// instructional, not data (this catches the "Examples; pls delete" row too).

import ExcelJS from "exceljs";
import type {
  Allowance,
  CallbackShift,
  EmployeeDynamicAttrs,
  EmployeeStaticAttrs,
  EmploymentType,
  PayDataRow,
  PayPeriod,
  PublicHoliday,
  RosteredShift,
  WorkbookData,
  WorkedShift,
} from "./types";

export type ParseResult = { ok: true; data: WorkbookData } | { ok: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function cellText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object" && value !== null) {
    if ("richText" in value) return (value as { richText: Array<{ text: string }> }).richText.map((r) => r.text).join("");
    if ("result" in value) return String((value as { result: unknown }).result ?? "");
    if (value instanceof Date) return value.toISOString().slice(0, 10);
  }
  return String(value).trim();
}

function sheetRows(workbook: ExcelJS.Workbook, name: string): string[][] {
  const ws = workbook.getWorksheet(name);
  if (!ws) return [];
  const rows: string[][] = [];
  ws.eachRow({ includeEmpty: true }, (row) => {
    const cells: string[] = [];
    for (let c = 1; c <= ws.columnCount; c++) cells.push(cellText(row.getCell(c).value));
    rows.push(cells);
  });
  return rows;
}

// Locates the header row and returns every data row (as {header: value}
// records) after it, skipping instruction/example marker rows and blank rows.
function readDataTab(workbook: ExcelJS.Workbook, sheetName: string): Record<string, string>[] {
  const rows = sheetRows(workbook, sheetName);
  const headerIdx = rows.findIndex((r) => /1st row of csv/i.test(r[0] || ""));
  if (headerIdx === -1) return [];
  const headers = rows[headerIdx].slice(1).map((h) => h.trim());
  const out: Record<string, string>[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if ((row[0] || "").includes(">>>")) continue; // instruction/example marker row
    const values = row.slice(1);
    if (values.every((v) => !v)) continue; // blank row
    const record: Record<string, string> = {};
    headers.forEach((h, idx) => { if (h) record[h] = (values[idx] || "").trim(); });
    out.push(record);
  }
  return out;
}

function requireDate(v: string, field: string, errors: string[]): string {
  if (!DATE_RE.test(v)) errors.push(`invalid ${field} "${v}" (expected YYYY-MM-DD)`);
  return v;
}

function toNum(v: string, field: string, errors: string[]): number {
  const n = Number(v);
  if (!Number.isFinite(n)) { errors.push(`invalid ${field} "${v}"`); return 0; }
  return n;
}

function normalizeClassification(v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, "_"); // "Level 1" -> "level_1"
}

function normalizeEmploymentType(v: string, errors: string[]): EmploymentType {
  const s = v.trim().toLowerCase();
  if (s === "full time") return "full_time";
  if (s === "part time") return "part_time";
  if (s === "casual") return "casual";
  errors.push(`unknown employment_type "${v}" (expected "Full Time", "Part Time", or "Casual")`);
  return "full_time";
}

export async function parseWorkbook(buffer: Buffer): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook();
  try {
    // exceljs's bundled types declare a plain `Buffer`, which newer @types/node's
    // generic `Buffer<ArrayBufferLike>` isn't structurally assignable to — a type-only
    // mismatch, not a runtime one (exceljs just reads bytes).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(buffer as any);
  } catch (e) {
    return { ok: false, error: `Could not read the file as an Excel workbook: ${e instanceof Error ? e.message : String(e)}` };
  }

  const errors: string[] = [];

  const staticAttrs: EmployeeStaticAttrs[] = readDataTab(workbook, "DATA#employee static attributes").map((r) => ({
    employeeId: r.employee_identifier,
    dob: r.dob ? requireDate(r.dob, "dob", errors) : null,
    employmentStartDate: r.employment_start_date ? requireDate(r.employment_start_date, "employment_start_date", errors) : null,
    employmentTerminationDate: r.employment_termination_date ? requireDate(r.employment_termination_date, "employment_termination_date", errors) : null,
  }));

  const dynamicAttrs: EmployeeDynamicAttrs[] = readDataTab(workbook, "DATA#employee dynamic attribute").map((r) => ({
    employeeId: r.employee_identifier,
    applicableFrom: requireDate(r.applicable_from, "applicable_from", errors),
    applicableTo: requireDate(r.applicable_to, "applicable_to", errors),
    employmentType: normalizeEmploymentType(r.employment_type, errors),
    award: r.award,
    classification: normalizeClassification(r.ii_classification),
    minContractHoursWeekly: r.min_contract_hours_weekly ? toNum(r.min_contract_hours_weekly, "min_contract_hours_weekly", errors) : null,
    isAboveAwardContractedRate: r.is_above_award_contracted_rate?.trim().toLowerCase() === "y",
    isShiftworker: r["is_employee_employed _as_a_shiftworker"]?.trim().toLowerCase() === "shift",
  }));

  const payPeriods: PayPeriod[] = readDataTab(workbook, "DATA#pay periods").map((r) => ({
    start: requireDate(r.applicable_from, "pay period applicable_from", errors),
    end: requireDate(r.applicable_to, "pay period applicable_to", errors),
  }));

  const publicHolidays: PublicHoliday[] = readDataTab(workbook, "DATA#public holidays").map((r) => ({
    date: requireDate(r.date, "public holiday date", errors),
    region: r.region,
    name: r.public_holiday_name,
  }));

  const payData: PayDataRow[] = readDataTab(workbook, "DATA#payslip data").map((r) => ({
    employeeId: r.employee_identifier,
    periodStart: requireDate(r.applicable_from, "payslip applicable_from", errors),
    periodEnd: requireDate(r.applicable_to, "payslip applicable_to", errors),
    costCategory: r.cost_category.trim().toLowerCase(),
    amountCents: Math.round(toNum(r.total_paid_no_oncosts, "total_paid_no_oncosts", errors) * 100),
  }));

  const rosteredShifts: RosteredShift[] = readDataTab(workbook, "DATA#rostered shifts").map((r) => ({
    employeeId: r.employee_identifier,
    date: requireDate(r.rostered_date, "rostered_date", errors),
    start: r.rostered_start,
    end: r.rostered_end,
    breakStart: r.rostered_unpaid_break_start || null,
    breakLengthHours: toNum(r.rostered_unpaid_break_length || "0", "rostered_unpaid_break_length", errors),
  }));

  const workedShifts: WorkedShift[] = readDataTab(workbook, "DATA#worked shifts").map((r) => ({
    employeeId: r.employee_identifier,
    date: requireDate(r.date, "worked shift date", errors),
    start: r.pay_start,
    end: r.pay_end,
    breakStart: r.break_start || null,
    breakLengthHours: toNum(r.break_length || "0", "break_length", errors),
    leave: r.leave || null,
    location: r.location,
    region: r.region,
  }));

  const allowances: Allowance[] = readDataTab(workbook, "DATA#allowances").map((r) => ({
    employeeId: r.employee_identifier,
    allowanceName: r.allowance_name,
    from: requireDate(r.applicable_from, "allowance applicable_from", errors),
    to: requireDate(r.applicable_to, "allowance applicable_to", errors),
    higherDutiesLevel: r["For Higher Duties only"] ? normalizeClassification(r["For Higher Duties only"]) : null,
  }));

  const callbackShifts: CallbackShift[] = readDataTab(workbook, "DATA#callback shifts").map((r) => ({
    employeeId: r.employee_identifier,
    date: requireDate(r.date, "callback date", errors),
    start: r.pay_start,
    end: r.pay_end,
    lengthHours: toNum(r["call back_ shift length"], "call back_ shift length", errors),
  }));

  if (staticAttrs.length === 0 && dynamicAttrs.length === 0 && payData.length === 0) {
    return { ok: false, error: "No data found — check the workbook has the expected DATA# tab names and a '1st row of CSV >>>' header row on each." };
  }
  if (errors.length > 0) {
    const shown = errors.slice(0, 8);
    const more = errors.length > shown.length ? ` (+${errors.length - shown.length} more)` : "";
    return { ok: false, error: shown.join("; ") + more };
  }

  return {
    ok: true,
    data: { staticAttrs, dynamicAttrs, payPeriods, publicHolidays, payData, rosteredShifts, workedShifts, allowances, callbackShifts },
  };
}
