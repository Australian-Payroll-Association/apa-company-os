// The recalculation engine — orchestrates the four rule tiers (hours,
// allowances, leave, break-compliance; see lib/recalc/engine/*.ts) into one
// expected-pay computation, then diffs it against the real pay data.
//
// `DATA#pay periods` is the single source of truth for period boundaries —
// every date (worked shift, leave, allowance, call-back, and the payslip
// data's own applicable_from) is resolved against it, so both sides of the
// diff always land in the same bucket even if a payslip row's own dates are
// slightly off from the canonical period list.

import type { PayPeriod, RunResults, VarianceRow, WorkbookData } from "./types";
import type { RuleSet } from "./types";
import { shiftHours } from "./engine/resolve";
import { computeHours, type Contribution } from "./engine/hours";
import { computeAllowancesAndCallbacks } from "./engine/allowances";
import { computeLeaveAndBreaks } from "./engine/leave-and-breaks";

const FLAG_THRESHOLD_CENTS = 100; // $1

function findPeriod(payPeriods: PayPeriod[], date: string): PayPeriod | null {
  return payPeriods.find((p) => date >= p.start && date <= p.end) ?? null;
}

export function runRecalculation(data: WorkbookData, ruleSet: RuleSet): RunResults {
  const warnings: string[] = [];

  const hoursResult = computeHours(data.workedShifts, data.rosteredShifts, data.dynamicAttrs, data.staticAttrs, data.publicHolidays, ruleSet);
  warnings.push(...hoursResult.warnings);

  const workedHoursByEmployeeDate = new Map<string, number>();
  for (const shift of data.workedShifts) {
    if (shift.leave) continue;
    workedHoursByEmployeeDate.set(`${shift.employeeId}|${shift.date}`, shiftHours(shift.start, shift.end, shift.breakLengthHours));
  }

  const allowanceResult = computeAllowancesAndCallbacks(
    data.allowances,
    data.callbackShifts,
    data.payPeriods,
    workedHoursByEmployeeDate,
    data.dynamicAttrs,
    data.staticAttrs,
    ruleSet,
  );
  warnings.push(...allowanceResult.warnings);

  const leaveResult = computeLeaveAndBreaks(data.workedShifts, data.rosteredShifts, data.dynamicAttrs, data.staticAttrs, data.publicHolidays, data.payPeriods, ruleSet);
  warnings.push(...leaveResult.warnings);

  // --- Fold every contribution into expected-by-period-component, and track OTE for super. ---
  const expected = new Map<string, number>(); // `${employeeId}|${periodStart}|${periodEnd}|${component}` -> cents
  const oteByPeriod = new Map<string, number>(); // `${employeeId}|${periodStart}|${periodEnd}` -> cents
  const addExpected = (periodKey: string, c: Contribution) => {
    const key = `${periodKey}|${c.component}`;
    expected.set(key, (expected.get(key) ?? 0) + c.cents);
    if (c.countsTowardOte) oteByPeriod.set(periodKey, (oteByPeriod.get(periodKey) ?? 0) + c.cents);
  };

  for (const shift of data.workedShifts) {
    if (shift.leave) continue;
    const key = `${shift.employeeId}|${shift.date}`;
    const hit = hoursResult.byShiftKey.get(key);
    if (!hit) continue;
    const period = findPeriod(data.payPeriods, shift.date);
    if (!period) { warnings.push(`${shift.employeeId} worked ${shift.date}, but no canonical pay period (DATA#pay periods) covers that date.`); continue; }
    const periodKey = `${shift.employeeId}|${period.start}|${period.end}`;
    for (const c of hit.contributions) addExpected(periodKey, c);
  }
  for (const [periodKey, contributions] of allowanceResult.byPeriodKey) for (const c of contributions) addExpected(periodKey, c);
  for (const [periodKey, contributions] of leaveResult.byPeriodKey) for (const c of contributions) addExpected(periodKey, c);

  // Superannuation: statutory %, not an Award clause, computed on OTE from every other component.
  for (const [periodKey, oteCents] of oteByPeriod) {
    const superCents = Math.round(oteCents * (ruleSet.clauses.superannuation_guarantee_pct / 100));
    expected.set(`${periodKey}|superannuation`, (expected.get(`${periodKey}|superannuation`) ?? 0) + superCents);
  }

  // --- Actual pay data, resolved to the same canonical periods. ---
  const actual = new Map<string, number>();
  for (const row of data.payData) {
    const period = findPeriod(data.payPeriods, row.periodStart);
    if (!period) { warnings.push(`Payslip row for ${row.employeeId} (${row.periodStart}..${row.periodEnd}) falls outside every canonical pay period on file.`); continue; }
    const key = `${row.employeeId}|${period.start}|${period.end}|${row.costCategory}`;
    actual.set(key, (actual.get(key) ?? 0) + row.amountCents);
  }

  // --- Diff. ---
  const allKeys = new Set<string>([...expected.keys(), ...actual.keys()]);
  const variances: VarianceRow[] = [];
  for (const key of allKeys) {
    const lastPipe = key.lastIndexOf("|");
    const periodKey = key.slice(0, lastPipe);
    const component = key.slice(lastPipe + 1);
    const parts = periodKey.split("|");
    const employeeId = parts[0];
    const periodStart = parts[1];
    const periodEnd = parts[2];
    const expectedCents = expected.get(key) ?? 0;
    const actualCents = actual.get(key) ?? 0;
    const varianceCents = actualCents - expectedCents;
    variances.push({
      employeeId,
      periodStart,
      periodEnd,
      component,
      expectedCents,
      actualCents,
      varianceCents,
      flagged: Math.abs(varianceCents) > FLAG_THRESHOLD_CENTS,
    });
  }
  variances.sort((a, b) => a.employeeId.localeCompare(b.employeeId) || a.periodStart.localeCompare(b.periodStart) || a.component.localeCompare(b.component));

  const totals = variances.reduce(
    (acc, v) => ({
      expectedCents: acc.expectedCents + v.expectedCents,
      actualCents: acc.actualCents + v.actualCents,
      varianceCents: acc.varianceCents + v.varianceCents,
      flaggedCount: acc.flaggedCount + (v.flagged ? 1 : 0),
    }),
    { expectedCents: 0, actualCents: 0, varianceCents: 0, flaggedCount: 0 },
  );

  return {
    variances,
    totals,
    warnings,
    findings: leaveResult.findings,
    notModeled: ruleSet.clauses.not_modeled,
  };
}
