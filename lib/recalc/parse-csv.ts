// Deterministic CSV parsing for the recalculation module's two input
// templates (see docs/product/project-recalc-module.md). Excel and PDF input
// are Phase 2 (no reliable local parser for either exists in this repo yet —
// see the plan) — v1 is CSV only, using papaparse rather than the AI-extraction
// pattern in lib/resume-extract.ts, since these rows are already structured.

import Papa from "papaparse";
import { PAY_COMPONENTS, type PayComponent, type PayDataRow, type TimesheetRow } from "./types";

export type ParseResult<T> = { ok: true; rows: T[] } | { ok: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

function joinErrors(errors: string[]): string {
  const shown = errors.slice(0, 5);
  const more = errors.length > shown.length ? ` (+${errors.length - shown.length} more)` : "";
  return shown.join("; ") + more;
}

function cell(raw: Record<string, string>, key: string): string {
  return (raw[key] ?? "").trim();
}

// Timesheet template — one row per shift:
// employee_id, employee_name, classification, work_date, start_time, end_time, unpaid_break_minutes
export function parseTimesheetCsv(csvText: string): ParseResult<TimesheetRow> {
  const parsed = Papa.parse<Record<string, string>>(csvText, { header: true, skipEmptyLines: true });
  if (parsed.errors.length > 0) return { ok: false, error: `CSV parse error: ${parsed.errors[0].message}` };

  const rows: TimesheetRow[] = [];
  const errors: string[] = [];
  parsed.data.forEach((raw, i) => {
    const line = i + 2; // header is line 1
    const employeeId = cell(raw, "employee_id");
    const employeeName = cell(raw, "employee_name");
    const classification = cell(raw, "classification");
    const workDate = cell(raw, "work_date");
    const startTime = cell(raw, "start_time");
    const endTime = cell(raw, "end_time");
    const breakRaw = cell(raw, "unpaid_break_minutes") || "0";

    if (!employeeId) return errors.push(`Line ${line}: missing employee_id`);
    if (!classification) return errors.push(`Line ${line}: missing classification`);
    if (!DATE_RE.test(workDate)) return errors.push(`Line ${line}: invalid work_date "${workDate}" (expected YYYY-MM-DD)`);
    if (!TIME_RE.test(startTime)) return errors.push(`Line ${line}: invalid start_time "${startTime}" (expected HH:MM)`);
    if (!TIME_RE.test(endTime)) return errors.push(`Line ${line}: invalid end_time "${endTime}" (expected HH:MM)`);
    const unpaidBreakMinutes = Number(breakRaw);
    if (!Number.isFinite(unpaidBreakMinutes) || unpaidBreakMinutes < 0) {
      return errors.push(`Line ${line}: invalid unpaid_break_minutes "${breakRaw}"`);
    }
    rows.push({ employeeId, employeeName, classification, workDate, startTime, endTime, unpaidBreakMinutes });
  });

  if (errors.length > 0) return { ok: false, error: joinErrors(errors) };
  if (rows.length === 0) return { ok: false, error: "No rows found in the timesheet CSV." };
  return { ok: true, rows };
}

// Pay data template — one row per paid component per pay period (itemized,
// long format, matching how a payroll system's pay register export reads):
// employee_id, employee_name, pay_period_start, pay_period_end, component, amount, hours
export function parsePayDataCsv(csvText: string): ParseResult<PayDataRow> {
  const parsed = Papa.parse<Record<string, string>>(csvText, { header: true, skipEmptyLines: true });
  if (parsed.errors.length > 0) return { ok: false, error: `CSV parse error: ${parsed.errors[0].message}` };

  const componentSet = new Set<string>(PAY_COMPONENTS);
  const rows: PayDataRow[] = [];
  const errors: string[] = [];
  parsed.data.forEach((raw, i) => {
    const line = i + 2;
    const employeeId = cell(raw, "employee_id");
    const employeeName = cell(raw, "employee_name");
    const payPeriodStart = cell(raw, "pay_period_start");
    const payPeriodEnd = cell(raw, "pay_period_end");
    const component = cell(raw, "component");
    const amountRaw = cell(raw, "amount");
    const hoursRaw = cell(raw, "hours");

    if (!employeeId) return errors.push(`Line ${line}: missing employee_id`);
    if (!DATE_RE.test(payPeriodStart)) return errors.push(`Line ${line}: invalid pay_period_start "${payPeriodStart}"`);
    if (!DATE_RE.test(payPeriodEnd)) return errors.push(`Line ${line}: invalid pay_period_end "${payPeriodEnd}"`);
    if (!componentSet.has(component)) {
      return errors.push(`Line ${line}: unknown component "${component}" (expected one of ${PAY_COMPONENTS.join(", ")})`);
    }
    const amount = Number(amountRaw);
    if (!Number.isFinite(amount)) return errors.push(`Line ${line}: invalid amount "${amountRaw}"`);
    const hours = hoursRaw === "" ? null : Number(hoursRaw);
    if (hours !== null && !Number.isFinite(hours)) return errors.push(`Line ${line}: invalid hours "${hoursRaw}"`);

    rows.push({
      employeeId,
      employeeName,
      payPeriodStart,
      payPeriodEnd,
      component: component as PayComponent,
      amountCents: Math.round(amount * 100),
      hours,
    });
  });

  if (errors.length > 0) return { ok: false, error: joinErrors(errors) };
  if (rows.length === 0) return { ok: false, error: "No rows found in the pay data CSV." };
  return { ok: true, rows };
}
