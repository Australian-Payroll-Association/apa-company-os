// The recalculation engine: pure functions, no I/O. Takes actual timesheet +
// pay data rows and a rule set, computes what SHOULD have been paid, and
// diffs it against what WAS paid. Deliberately simplified for v1 — see the
// inline notes below for exactly which simplifications, so a real payroll
// consultant can tell at a glance what to check before trusting the output on
// a real engagement.
//
// v1 simplifications (documented, not hidden):
// - Weekend/public-holiday hours are paid entirely at the penalty rate for
//   that day type; they do NOT also split into an overtime tier. Overtime
//   tiers only apply on weekdays, above the daily threshold.
// - casual_loading_pct applies to every classification's rate — there is no
//   employment-type (casual/permanent) field on the timesheet template yet.
// - Superannuation is computed as rule_set.superannuation_pct of ordinary +
//   overtime + penalty pay (an approximation of "ordinary time earnings" —
//   allowances are excluded, matching common practice, but this is not a
//   substitute for the actual OTE definition in a real award).
// - A flat single-day threshold decides overtime (no weekly-hours threshold
//   check yet, and no accrual/rostering rules).

import type { DayType, PayComponent, PayDataRow, RuleSet, TimesheetRow, VarianceRow, RunResults } from "./types";

const FLAG_THRESHOLD_CENTS = 100; // $1 — deliberately simple fixed tolerance for v1

function minutesOfDay(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// Net hours worked for one shift, handling an overnight shift (end < start).
function shiftHours(row: TimesheetRow): number {
  const start = minutesOfDay(row.startTime);
  const end = minutesOfDay(row.endTime);
  const durationMin = end > start ? end - start : end + 24 * 60 - start;
  const netMin = Math.max(0, durationMin - row.unpaidBreakMinutes);
  return netMin / 60;
}

function dayType(workDate: string, ruleSet: RuleSet): DayType {
  if (ruleSet.public_holidays.includes(workDate)) return "public_holiday";
  const dow = new Date(`${workDate}T00:00:00Z`).getUTCDay();
  if (dow === 0) return "sunday";
  if (dow === 6) return "saturday";
  return "weekday";
}

function effectiveHourlyRateCents(classification: string, ruleSet: RuleSet): number | null {
  const cls = ruleSet.classifications[classification];
  if (!cls) return null;
  return cls.base_hourly_rate * (1 + ruleSet.casual_loading_pct / 100) * 100;
}

// Splits overtime hours across the rule set's tiers in order, cumulatively.
function splitOvertimeTiers(
  otHours: number,
  tiers: RuleSet["overtime"]["tiers"],
): Array<{ hours: number; multiplier: number }> {
  let remaining = otHours;
  const parts: Array<{ hours: number; multiplier: number }> = [];
  for (const tier of tiers) {
    if (remaining <= 0) break;
    const cap = tier.up_to_hours == null ? remaining : Math.min(remaining, tier.up_to_hours);
    if (cap > 0) {
      parts.push({ hours: cap, multiplier: tier.multiplier });
      remaining -= cap;
    }
  }
  return parts;
}

type PeriodKey = string; // `${employeeId}|${payPeriodStart}|${payPeriodEnd}`
type Period = { employeeId: string; employeeName: string; payPeriodStart: string; payPeriodEnd: string };

function periodKey(employeeId: string, start: string, end: string): PeriodKey {
  return `${employeeId}|${start}|${end}`;
}

function findPeriodForDate(periods: Period[], employeeId: string, date: string): Period | null {
  return (
    periods.find((p) => p.employeeId === employeeId && date >= p.payPeriodStart && date <= p.payPeriodEnd) ?? null
  );
}

type ComponentKey = string; // `${periodKey}|${component}`

function componentKey(pKey: PeriodKey, component: PayComponent): ComponentKey {
  return `${pKey}|${component}`;
}

// Computes expected pay, in cents, per employee/pay-period/component, by
// applying the rule set to the timesheet. Returns warnings for anything the
// engine had to skip rather than guess at.
function computeExpected(
  timesheet: TimesheetRow[],
  periods: Period[],
  ruleSet: RuleSet,
): { expected: Map<ComponentKey, number>; warnings: string[] } {
  const expected = new Map<ComponentKey, number>();
  const oteByPeriod = new Map<PeriodKey, number>(); // ordinary+overtime+penalty cents, for superannuation
  const warnings: string[] = [];
  const add = (key: ComponentKey, cents: number) => expected.set(key, (expected.get(key) ?? 0) + cents);

  // Group shifts by employee + day, summing hours (a split shift still counts
  // as one day for the daily overtime threshold). Classification is taken
  // from the day's first shift — a day with more than one classification is
  // an edge case out of scope for v1.
  type DayBucket = { employeeId: string; workDate: string; classification: string; hours: number };
  const days = new Map<string, DayBucket>();
  for (const row of timesheet) {
    const key = `${row.employeeId}|${row.workDate}`;
    const existing = days.get(key);
    const hours = shiftHours(row);
    if (existing) existing.hours += hours;
    else days.set(key, { employeeId: row.employeeId, workDate: row.workDate, classification: row.classification, hours });
  }

  for (const day of days.values()) {
    const period = findPeriodForDate(periods, day.employeeId, day.workDate);
    if (!period) {
      warnings.push(`${day.employeeId} worked ${day.workDate}, but no pay period on file covers that date — excluded from expected pay.`);
      continue;
    }
    const rateCents = effectiveHourlyRateCents(day.classification, ruleSet);
    if (rateCents == null) {
      warnings.push(`${day.employeeId} has classification "${day.classification}" on ${day.workDate}, which isn't in the rule set — excluded from expected pay.`);
      continue;
    }
    const pKey = periodKey(period.employeeId, period.payPeriodStart, period.payPeriodEnd);
    const type = dayType(day.workDate, ruleSet);
    let oteCents = 0;

    if (type === "weekday") {
      const ordinaryHours = Math.min(day.hours, ruleSet.ordinary_hours_per_day);
      const otHours = Math.max(0, day.hours - ruleSet.ordinary_hours_per_day);
      const ordinaryCents = Math.round(ordinaryHours * rateCents);
      add(componentKey(pKey, "ordinary"), ordinaryCents);
      oteCents += ordinaryCents;

      for (const part of splitOvertimeTiers(otHours, ruleSet.overtime.tiers)) {
        const cents = Math.round(part.hours * rateCents * part.multiplier);
        add(componentKey(pKey, "overtime"), cents);
        oteCents += cents;
      }
      if (otHours > ruleSet.allowances.meal_allowance_trigger_ot_hours) {
        add(componentKey(pKey, "meal_allowance"), ruleSet.allowances.meal_allowance_cents);
      }
    } else {
      const multiplier = ruleSet.penalty_multipliers[type];
      const component: PayComponent = `${type}_penalty` as PayComponent;
      const cents = Math.round(day.hours * rateCents * multiplier);
      add(componentKey(pKey, component), cents);
      oteCents += cents;
    }

    oteByPeriod.set(pKey, (oteByPeriod.get(pKey) ?? 0) + oteCents);
  }

  for (const [pKey, oteCents] of oteByPeriod) {
    const superCents = Math.round(oteCents * (ruleSet.superannuation_pct / 100));
    add(componentKey(pKey, "superannuation"), superCents);
  }

  return { expected, warnings };
}

export function runRecalculation(timesheet: TimesheetRow[], payData: PayDataRow[], ruleSet: RuleSet): RunResults {
  // The pay data rows are the source of truth for pay-period boundaries —
  // the timesheet only records days worked, never period start/end.
  const periodMap = new Map<PeriodKey, Period>();
  for (const row of payData) {
    const key = periodKey(row.employeeId, row.payPeriodStart, row.payPeriodEnd);
    if (!periodMap.has(key)) {
      periodMap.set(key, {
        employeeId: row.employeeId,
        employeeName: row.employeeName,
        payPeriodStart: row.payPeriodStart,
        payPeriodEnd: row.payPeriodEnd,
      });
    }
  }
  const periods = Array.from(periodMap.values());

  const { expected, warnings } = computeExpected(timesheet, periods, ruleSet);

  const actual = new Map<ComponentKey, number>();
  for (const row of payData) {
    const pKey = periodKey(row.employeeId, row.payPeriodStart, row.payPeriodEnd);
    const key = componentKey(pKey, row.component);
    actual.set(key, (actual.get(key) ?? 0) + row.amountCents);
  }

  const allKeys = new Set<ComponentKey>([...expected.keys(), ...actual.keys()]);
  const variances: VarianceRow[] = [];
  for (const key of allKeys) {
    const [pKey, component] = [key.slice(0, key.lastIndexOf("|")), key.slice(key.lastIndexOf("|") + 1)];
    const period = periodMap.get(pKey);
    if (!period) continue; // expected-only key with no matching period can't happen — periods come from payData
    const expectedCents = expected.get(key) ?? 0;
    const actualCents = actual.get(key) ?? 0;
    const varianceCents = actualCents - expectedCents;
    variances.push({
      employeeId: period.employeeId,
      employeeName: period.employeeName,
      payPeriodStart: period.payPeriodStart,
      payPeriodEnd: period.payPeriodEnd,
      component: component as PayComponent,
      expectedCents,
      actualCents,
      varianceCents,
      flagged: Math.abs(varianceCents) > FLAG_THRESHOLD_CENTS,
    });
  }

  variances.sort((a, b) =>
    a.employeeName === b.employeeName
      ? a.payPeriodStart.localeCompare(b.payPeriodStart) || a.component.localeCompare(b.component)
      : a.employeeName.localeCompare(b.employeeName),
  );

  const totals = variances.reduce(
    (acc, v) => ({
      expectedCents: acc.expectedCents + v.expectedCents,
      actualCents: acc.actualCents + v.actualCents,
      varianceCents: acc.varianceCents + v.varianceCents,
      flaggedCount: acc.flaggedCount + (v.flagged ? 1 : 0),
    }),
    { expectedCents: 0, actualCents: 0, varianceCents: 0, flaggedCount: 0 },
  );

  return { variances, totals, warnings };
}
