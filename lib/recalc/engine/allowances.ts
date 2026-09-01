// Tier B — allowances (from DATA#allowances, real per-employee records, not
// an assumption) and call-back shifts. Each allowance type is genuinely
// different in how it's priced, per the Award/Allowances sheets.
//
// Stated simplifications:
// - Stand-by rate uses weekday vs Saturday/Sunday only — the source data has
//   no region on stand-by rows, so a public-holiday stand-by day is priced
//   at the weekend rate rather than checked against the PH calendar.
// - Higher duties pays the ORDINARY-rate differential only (higher minus
//   normal classification, hourly rate x hours) for shifts inside the
//   allowance's date range — it does not re-derive the differential through
//   the full overtime/penalty split.
// - Vehicle allowance always uses the "<1500cc" rate — the source employee
//   data doesn't record engine size.
// - Call-back shifts have no region column, so public-holiday call-backs are
//   priced at the ordinary weekday/Sunday overtime rate rather than the PH rate.

import type { Allowance, CallbackShift, EmployeeDynamicAttrs, EmployeeStaticAttrs, RuleSet } from "../types";
import { ageAt, ageBand, dayOfWeek, lookupRate, rateCategory, resolveDynamic, resolveStatic, shiftHours } from "./resolve";
import type { Contribution } from "./hours";

export type AllowanceResult = {
  byPeriodKey: Map<string, Contribution[]>; // `${employeeId}|${periodStart}|${periodEnd}`
  warnings: string[];
};

function daysOverlap(aFrom: string, aTo: string, bFrom: string, bTo: string): number {
  const from = aFrom > bFrom ? aFrom : bFrom;
  const to = aTo < bTo ? aTo : bTo;
  if (from > to) return 0;
  const ms = new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime();
  return ms / 86_400_000 + 1;
}

function datesInRange(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export function computeAllowancesAndCallbacks(
  allowances: Allowance[],
  callbackShifts: CallbackShift[],
  payPeriods: import("../types").PayPeriod[],
  workedHoursByEmployeeDate: Map<string, number>, // `${employeeId}|${date}` -> hours worked that day (for first-aid PT/casual proration)
  dynamicAttrs: EmployeeDynamicAttrs[],
  staticAttrs: EmployeeStaticAttrs[],
  ruleSet: RuleSet,
): AllowanceResult {
  const warnings: string[] = [];
  const byPeriodKey = new Map<string, Contribution[]>();
  const add = (key: string, c: Contribution) => {
    const list = byPeriodKey.get(key) ?? [];
    list.push(c);
    byPeriodKey.set(key, list);
  };

  for (const period of payPeriods) {
    for (const a of allowances) {
      const overlap = daysOverlap(a.from, a.to, period.start, period.end);
      if (overlap <= 0) continue;
      const periodKey = `${a.employeeId}|${period.start}|${period.end}`;
      const kind = a.allowanceName.trim().toLowerCase();
      const dynamic = resolveDynamic(dynamicAttrs, a.employeeId, period.start);

      if (kind === "first aid") {
        const weeklyRate = ruleSet.allowances["First aid allowance - full-time"]?.amounts_cents?.[0];
        const hourlyRate = ruleSet.allowances["First aid allowance - part-time"]?.amounts_cents?.[0];
        const weeklyCap = ruleSet.allowances["First aid allowance - part-time"]?.amounts_cents?.[1];
        if (dynamic?.employmentType === "full_time" && weeklyRate != null) {
          add(periodKey, { component: "first_aid_allowance", cents: Math.round((overlap / 7) * weeklyRate), countsTowardOte: false });
        } else if (hourlyRate != null && weeklyCap != null) {
          let hoursInRange = 0;
          for (const date of datesInRange(a.from, a.to)) {
            if (date < period.start || date > period.end) continue;
            hoursInRange += workedHoursByEmployeeDate.get(`${a.employeeId}|${date}`) ?? 0;
          }
          const cap = Math.round((overlap / 7) * weeklyCap);
          add(periodKey, { component: "first_aid_allowance", cents: Math.min(Math.round(hoursInRange * hourlyRate), cap), countsTowardOte: false });
        }
      } else if (kind === "stand by" || kind === "standby" || kind === "stand-by") {
        const weekdayRate = ruleSet.allowances["Stand-by allowance - Monday to Friday"]?.amounts_cents?.[0];
        const weekendRate = ruleSet.allowances["Stand-by allowance - Saturday, Sunday and Public holidays"]?.amounts_cents?.[0];
        for (const date of datesInRange(a.from, a.to)) {
          if (date < period.start || date > period.end) continue;
          const dow = dayOfWeek(date);
          const rate = dow === 0 || dow === 6 ? weekendRate : weekdayRate;
          if (rate != null) add(periodKey, { component: "standby_allowance", cents: rate, countsTowardOte: false });
        }
      } else if (kind === "higher duties" && a.higherDutiesLevel) {
        const staticRow = resolveStatic(staticAttrs, a.employeeId);
        for (const date of datesInRange(a.from, a.to)) {
          if (date < period.start || date > period.end) continue;
          const dyn = resolveDynamic(dynamicAttrs, a.employeeId, date);
          const hours = workedHoursByEmployeeDate.get(`${a.employeeId}|${date}`) ?? 0;
          if (!dyn || hours <= 0) continue;
          const band = ageBand(ageAt(staticRow?.dob ?? null, date));
          const category = rateCategory(dyn.employmentType);
          const normal = lookupRate(ruleSet, band, category, dyn.classification);
          const higher = lookupRate(ruleSet, band, category, a.higherDutiesLevel);
          if (normal && higher) {
            const diff = higher.hourly_cents - normal.hourly_cents;
            if (diff > 0) add(periodKey, { component: "higher_duties_allowance", cents: Math.round(diff * hours), countsTowardOte: true });
          } else {
            warnings.push(`${a.employeeId}: higher-duties level "${a.higherDutiesLevel}" not found in the rule set for ${date}.`);
          }
        }
      } else if (kind.startsWith("vehicle")) {
        const rate = ruleSet.allowances["Vehicle allowance - required to provide a motor vehicle as a condition of employment -1500 cc and under"]?.amounts_cents?.[0];
        if (rate != null) add(periodKey, { component: "vehicle_allowance", cents: Math.round((overlap / 7) * rate), countsTowardOte: false });
      }
    }
  }

  // Call-back shifts (18.3(b)): OT rate for the day, minimum engagement top-up.
  for (const cb of callbackShifts) {
    const dynamic = resolveDynamic(dynamicAttrs, cb.employeeId, cb.date);
    if (!dynamic) { warnings.push(`${cb.employeeId} was called back on ${cb.date}, but no dynamic-attribute row covers that date.`); continue; }
    const staticRow = resolveStatic(staticAttrs, cb.employeeId);
    const band = ageBand(ageAt(staticRow?.dob ?? null, cb.date));
    const category = rateCategory(dynamic.employmentType);
    const rate = lookupRate(ruleSet, band, category, dynamic.classification);
    if (!rate) { warnings.push(`${cb.employeeId}: classification "${dynamic.classification}" not in rule set for call-back on ${cb.date}.`); continue; }

    const hours = Math.max(cb.lengthHours || shiftHours(cb.start, cb.end, 0), ruleSet.clauses.casual_minimum_engagement_hours);
    const dow = dayOfWeek(cb.date);
    const period = payPeriods.find((p) => cb.date >= p.start && cb.date <= p.end);
    if (!period) { warnings.push(`${cb.employeeId}: call-back on ${cb.date} falls outside every pay period on file.`); continue; }
    const periodKey = `${cb.employeeId}|${period.start}|${period.end}`;

    if (dow === 0) {
      add(periodKey, { component: "sunday_penalty", cents: Math.round(hours * rate.sunday_cents), countsTowardOte: true });
    } else {
      const first3 = Math.min(hours, 3);
      const after3 = Math.max(0, hours - 3);
      if (first3 > 0) add(periodKey, { component: "overtime_1.5", cents: Math.round(first3 * rate.overtime_first_3h_cents), countsTowardOte: true });
      if (after3 > 0) add(periodKey, { component: "overtime_2.0", cents: Math.round(after3 * rate.overtime_after_3h_cents), countsTowardOte: true });
    }
  }

  return { byPeriodKey, warnings };
}
