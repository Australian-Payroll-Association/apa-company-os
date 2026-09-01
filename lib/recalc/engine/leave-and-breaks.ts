// Tier C (leave payments) + Tier D (break/rest-period compliance).
//
// Stated simplifications:
// - Casual employees are excluded from leave payment entirely (casuals are
//   not NES leave-entitled in the general case — the 25% casual loading is
//   paid instead, per clause 11.2(b)).
// - Annual leave loading's "greater of 17.5% or the weekend/shift penalties
//   they'd have earned" only checks the WEEKEND/PH case (day-type penalty),
//   not weekday shift loadings — a smaller amount than the full clause allows
//   for a shiftworker on leave during a weekday shift-loaded roster.
// - Rest-period violations (20.6) are reported as compliance findings only,
//   not priced — the 200%-until-released remedy depends on knowing exactly
//   when the employee was released from duty, which isn't in any input tab.

import type { ComplianceFinding, EmployeeDynamicAttrs, EmployeeStaticAttrs, PublicHoliday, RosteredShift, RuleSet, WorkedShift } from "../types";
import { ageAt, ageBand, dayOfWeek, lookupRate, minutesOfDay, rateCategory, resolveDynamic, resolveStatic, shiftHours } from "./resolve";
import type { Contribution } from "./hours";

export type LeaveAndBreaksResult = {
  byPeriodKey: Map<string, Contribution[]>;
  findings: ComplianceFinding[];
  warnings: string[];
};

function isPublicHoliday(date: string, region: string, holidays: PublicHoliday[]): boolean {
  return holidays.some((h) => h.date === date && h.region.trim().toLowerCase() === region.trim().toLowerCase());
}

export function computeLeaveAndBreaks(
  workedShifts: WorkedShift[],
  rosteredShifts: RosteredShift[],
  dynamicAttrs: EmployeeDynamicAttrs[],
  staticAttrs: EmployeeStaticAttrs[],
  publicHolidays: PublicHoliday[],
  payPeriods: import("../types").PayPeriod[],
  ruleSet: RuleSet,
): LeaveAndBreaksResult {
  const warnings: string[] = [];
  const findings: ComplianceFinding[] = [];
  const byPeriodKey = new Map<string, Contribution[]>();
  const add = (key: string, c: Contribution) => {
    const list = byPeriodKey.get(key) ?? [];
    list.push(c);
    byPeriodKey.set(key, list);
  };

  const rosteredByEmployeeDate = new Map<string, RosteredShift>();
  for (const r of rosteredShifts) rosteredByEmployeeDate.set(`${r.employeeId}|${r.date}`, r);

  // --- Leave payment + annual leave loading (Tier C) ---
  for (const shift of workedShifts) {
    if (!shift.leave) continue;
    const dynamic = resolveDynamic(dynamicAttrs, shift.employeeId, shift.date);
    if (!dynamic) { warnings.push(`${shift.employeeId} took leave on ${shift.date}, but no dynamic-attribute row covers that date.`); continue; }
    if (dynamic.employmentType === "casual") continue; // 11.2(b) — casuals paid loading instead of leave

    const staticRow = resolveStatic(staticAttrs, shift.employeeId);
    const band = ageBand(ageAt(staticRow?.dob ?? null, shift.date));
    const category = rateCategory(dynamic.employmentType);
    const rate = lookupRate(ruleSet, band, category, dynamic.classification);
    if (!rate) { warnings.push(`${shift.employeeId}: classification "${dynamic.classification}" not in rule set for leave on ${shift.date}.`); continue; }

    const rostered = rosteredByEmployeeDate.get(`${shift.employeeId}|${shift.date}`);
    const hours = rostered ? shiftHours(rostered.start, rostered.end, rostered.breakLengthHours) : 38 / 5;
    if (!rostered) warnings.push(`${shift.employeeId}: no rostered shift found for leave on ${shift.date} — assumed a standard ${(38 / 5).toFixed(1)}h day.`);

    const period = payPeriods.find((p) => shift.date >= p.start && shift.date <= p.end);
    if (!period) { warnings.push(`${shift.employeeId}: leave on ${shift.date} falls outside every pay period on file.`); continue; }
    const periodKey = `${shift.employeeId}|${period.start}|${period.end}`;
    const ordinaryCents = Math.round(hours * rate.hourly_cents);
    add(periodKey, { component: "leave_ordinary", cents: ordinaryCents, countsTowardOte: false });

    if (/annual leave/i.test(shift.leave)) {
      const flatLoading = Math.round(ordinaryCents * (ruleSet.clauses.annual_leave_loading_pct / 100));
      let penaltyPremium = 0;
      if (rostered) {
        const dow = dayOfWeek(shift.date);
        const region = shift.region;
        if (isPublicHoliday(shift.date, region, publicHolidays)) penaltyPremium = Math.round(hours * (rate.public_holiday_cents - rate.hourly_cents));
        else if (dow === 0) penaltyPremium = Math.round(hours * (rate.sunday_cents - rate.hourly_cents));
        else if (dow === 6) penaltyPremium = Math.round(hours * (rate.overtime_saturday_outside_hours_cents - rate.hourly_cents));
      }
      add(periodKey, { component: "annual_leave_loading", cents: Math.max(flatLoading, penaltyPremium), countsTowardOte: false });
    }
  }

  // --- Break compliance (Tier D) ---
  for (const shift of workedShifts) {
    if (shift.leave) continue;
    const dynamic = resolveDynamic(dynamicAttrs, shift.employeeId, shift.date);
    if (!dynamic) continue;
    const hours = shiftHours(shift.start, shift.end, 0); // gross hours, before break deduction, to test the >5h trigger
    if (hours <= 5) continue;

    if (dynamic.isShiftworker) {
      const paidBreakHours = Math.min(shift.breakLengthHours, 20 / 60);
      if (paidBreakHours > 0) {
        const staticRow = resolveStatic(staticAttrs, shift.employeeId);
        const band = ageBand(ageAt(staticRow?.dob ?? null, shift.date));
        const category = rateCategory(dynamic.employmentType);
        const rate = lookupRate(ruleSet, band, category, dynamic.classification);
        const period = payPeriods.find((p) => shift.date >= p.start && shift.date <= p.end);
        if (rate && period) {
          add(`${shift.employeeId}|${period.start}|${period.end}`, {
            component: "shiftworker_paid_meal_break",
            cents: Math.round(paidBreakHours * rate.hourly_cents),
            countsTowardOte: true,
          });
        }
      } else {
        findings.push({ employeeId: shift.employeeId, date: shift.date, description: "Shiftworker shift >5h with no recorded meal break (13.7(e) requires a paid 20-minute break)." });
      }
    } else if (shift.breakLengthHours < 0.5) {
      findings.push({ employeeId: shift.employeeId, date: shift.date, description: "Day-worker shift >5h with an unpaid meal break under 30 minutes (clause 14) — a breach, not priced here." });
    }
  }

  // Rest-period violations: gap between consecutive worked shifts < required hours.
  const byEmployee = new Map<string, WorkedShift[]>();
  for (const s of workedShifts) {
    if (s.leave) continue;
    const list = byEmployee.get(s.employeeId) ?? [];
    list.push(s);
    byEmployee.set(s.employeeId, list);
  }
  for (const [employeeId, shifts] of byEmployee) {
    const sorted = [...shifts].sort((a, b) => a.date.localeCompare(b.date) || minutesOfDay(a.start) - minutesOfDay(b.start));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const prevEndMs = new Date(`${prev.date}T00:00:00Z`).getTime() + minutesOfDay(prev.end) * 60_000;
      const currStartMs = new Date(`${curr.date}T00:00:00Z`).getTime() + minutesOfDay(curr.start) * 60_000;
      const gapHours = (currStartMs - prevEndMs) / 3_600_000;
      if (gapHours < 0 || gapHours > 24) continue; // not consecutive / data gap, not a rest-period case
      const dynamic = resolveDynamic(dynamicAttrs, employeeId, curr.date);
      const required = dynamic?.isShiftworker ? 8 : 10;
      if (gapHours < required) {
        findings.push({
          employeeId,
          date: curr.date,
          description: `Only ${gapHours.toFixed(1)}h between shifts (needs ${required}h) — clause 20.6 entitlement to be released/paid until the rest period is met, not priced here.`,
        });
      }
    }
  }

  return { byPeriodKey, findings, warnings };
}
