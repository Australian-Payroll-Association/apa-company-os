// Tier A — ordinary hours, overtime, weekend/public-holiday penalties, and
// shift loadings. The biggest and most load-bearing part of the engine;
// everything else (allowances, leave, super) builds on its output.
//
// v2 simplifications, stated plainly (see docs/product/project-recalc-module.md):
// - One-week buckets for the overtime threshold, not the award's optional
//   2/3/4-week averaging cycle (13.2) — no cycle-length field exists anywhere
//   in the intake workbook to infer it from.
// - A shiftworker (`is_employee_employed_as_a_shiftworker = shift`) is always
//   treated as a PERMANENT shiftworker (uses the payrates sheet's "permanent
//   shiftwork" rate columns) — the template has no separate flag for
//   permanent vs ad hoc shift assignment.
// - Day workers may work ordinary hours up to 9pm on any weeknight (13.1(b)
//   only allows this on one specified night per week; there's no "which
//   night was designated" data to check against).

import type { EmployeeDynamicAttrs, EmployeeStaticAttrs, PublicHoliday, RuleSet, WorkedShift } from "../types";
import { ageAt, ageBand, dayOfWeek, isoWeekKey, lookupRate, minutesOfDay, rateCategory, resolveDynamic, resolveStatic, shiftHours, weeklyThresholdHours } from "./resolve";

export type Contribution = { component: string; cents: number; countsTowardOte: boolean };

export type HoursResult = {
  // keyed by `${employeeId}|${date}` so callers (leave.ts, breaks.ts) can look
  // up "what did this employee actually earn/work on this day"
  byShiftKey: Map<string, { contributions: Contribution[]; hours: number }>;
  warnings: string[];
};

function endClockWrapped(start: string, end: string): number {
  const s = minutesOfDay(start);
  const e = minutesOfDay(end);
  return e <= s ? e + 24 * 60 : e;
}

// Fraction of a shift's raw duration that overlaps a same-day clock-time span
// (e.g. Saturday 8am-12pm) — used to split a shift straddling the ordinary
// span's boundary, rather than treating the whole shift as one or the other.
function spanOverlapFraction(start: string, end: string, spanStartMin: number, spanEndMin: number): number {
  const s = minutesOfDay(start);
  const e = endClockWrapped(start, end);
  const totalMin = e - s;
  if (totalMin <= 0) return 0;
  const overlapMin = Math.max(0, Math.min(e, spanEndMin) - Math.max(s, spanStartMin));
  return overlapMin / totalMin;
}

function isPublicHoliday(date: string, region: string, holidays: PublicHoliday[]): boolean {
  return holidays.some((h) => h.date === date && h.region.trim().toLowerCase() === region.trim().toLowerCase());
}

function shiftLoadingComponent(
  start: string,
  end: string,
  defs: RuleSet["clauses"]["shift_definitions"],
): "early_morning" | "afternoon_permanent" | "night_permanent" | null {
  const startMin = minutesOfDay(start);
  const endWrapped = endClockWrapped(start, end);
  const emStart = minutesOfDay(defs.early_morning_start);
  const emEnd = minutesOfDay(defs.early_morning_end);
  if (startMin >= emStart && startMin < emEnd) return "early_morning";
  const aStart = minutesOfDay(defs.afternoon_end_start); // 18:00
  const aEnd = 24 * 60; // midnight
  if (endWrapped > aStart && endWrapped <= aEnd) return "afternoon_permanent";
  const nStart = 24 * 60;
  const nEnd = 24 * 60 + minutesOfDay(defs.night_end_end); // midnight + 8h
  if (endWrapped > nStart && endWrapped <= nEnd) return "night_permanent";
  return null;
}

// Splits overtime hours into first-3h / after-3h tiers, cumulative.
function splitOvertime(hours: number): { first3: number; after3: number } {
  const first3 = Math.min(hours, 3);
  const after3 = Math.max(0, hours - 3);
  return { first3, after3 };
}

export function computeHours(
  workedShifts: WorkedShift[],
  rosteredShifts: import("../types").RosteredShift[],
  dynamicAttrs: EmployeeDynamicAttrs[],
  staticAttrs: EmployeeStaticAttrs[],
  publicHolidays: PublicHoliday[],
  ruleSet: RuleSet,
): HoursResult {
  const warnings: string[] = [];
  const byShiftKey: HoursResult["byShiftKey"] = new Map();

  // Weekly rostered hours per employee (shiftworker OT baseline) — see module note.
  const rosteredWeeklyHours = new Map<string, number>(); // `${employeeId}|${isoWeek}` -> hours
  for (const r of rosteredShifts) {
    const key = `${r.employeeId}|${isoWeekKey(r.date)}`;
    rosteredWeeklyHours.set(key, (rosteredWeeklyHours.get(key) ?? 0) + shiftHours(r.start, r.end, r.breakLengthHours));
  }

  const weeklyOrdinaryUsed = new Map<string, number>(); // `${employeeId}|${isoWeek}` -> hours already ordinary this week

  const workDays = [...workedShifts].filter((s) => !s.leave).sort((a, b) => a.date.localeCompare(b.date));

  for (const shift of workDays) {
    const dynamic = resolveDynamic(dynamicAttrs, shift.employeeId, shift.date);
    if (!dynamic) {
      warnings.push(`${shift.employeeId} worked ${shift.date}, but no employee dynamic-attribute row covers that date — excluded from expected pay.`);
      continue;
    }
    const staticRow = resolveStatic(staticAttrs, shift.employeeId);
    const band = ageBand(ageAt(staticRow?.dob ?? null, shift.date));
    const category = rateCategory(dynamic.employmentType);
    const rate = lookupRate(ruleSet, band, category, dynamic.classification);
    if (!rate) {
      warnings.push(`${shift.employeeId} has classification "${dynamic.classification}" (${band}/${category}) on ${shift.date}, which isn't in the rule set — excluded from expected pay.`);
      continue;
    }

    let hours = shiftHours(shift.start, shift.end, shift.breakLengthHours);
    if (dynamic.employmentType === "casual" && hours > 0 && hours < ruleSet.clauses.casual_minimum_engagement_hours) {
      hours = ruleSet.clauses.casual_minimum_engagement_hours; // 11.4 minimum engagement
    }

    const dow = dayOfWeek(shift.date);
    const contributions: Contribution[] = [];
    const weekKey = `${shift.employeeId}|${isoWeekKey(shift.date)}`;

    if (isPublicHoliday(shift.date, shift.region, publicHolidays)) {
      const payHours = Math.max(hours, 4); // 27.4 minimum 4h if available to work 4h
      contributions.push({ component: "public_holiday_penalty", cents: Math.round(payHours * rate.public_holiday_cents), countsTowardOte: true });
    } else if (dow === 0) {
      // Sunday — ALL hours at the Sunday rate, never ordinary (20.1).
      contributions.push({ component: "sunday_penalty", cents: Math.round(hours * rate.sunday_cents), countsTowardOte: true });
    } else if (dow === 6) {
      // Saturday — 8am-12pm is ordinary (up to the weekly threshold); everything else
      // (outside that window, or beyond the weekly threshold even inside it) is
      // "overtime - Saturday - work in excess of weekly hours" — same rate column
      // either way, so no need to track the two cases separately.
      const spanStart = minutesOfDay(ruleSet.clauses.ordinary_span.saturday_start);
      const spanEnd = minutesOfDay(ruleSet.clauses.ordinary_span.saturday_end);
      const hoursInSpan = hours * spanOverlapFraction(shift.start, shift.end, spanStart, spanEnd);
      const threshold = dynamic.isShiftworker ? (rosteredWeeklyHours.get(weekKey) ?? weeklyThresholdHours(dynamic)) : weeklyThresholdHours(dynamic);
      const used = weeklyOrdinaryUsed.get(weekKey) ?? 0;
      const remaining = Math.max(0, threshold - used);
      const ordinaryHours = Math.min(hoursInSpan, remaining);
      const otHours = hours - ordinaryHours;
      if (ordinaryHours > 0) {
        contributions.push({ component: "ordinary", cents: Math.round(ordinaryHours * rate.hourly_cents), countsTowardOte: true });
        weeklyOrdinaryUsed.set(weekKey, used + ordinaryHours);
      }
      if (otHours > 0) {
        contributions.push({ component: "overtime_saturday_outside_hours", cents: Math.round(otHours * rate.overtime_saturday_outside_hours_cents), countsTowardOte: true });
      }
    } else {
      // Monday-Friday.
      const threshold = dynamic.isShiftworker ? (rosteredWeeklyHours.get(weekKey) ?? weeklyThresholdHours(dynamic)) : weeklyThresholdHours(dynamic);
      const used = weeklyOrdinaryUsed.get(weekKey) ?? 0;
      const remaining = Math.max(0, threshold - used);

      const spanStart = minutesOfDay(ruleSet.clauses.ordinary_span.weekday_start);
      const spanLateEnd = minutesOfDay(ruleSet.clauses.ordinary_span.weekday_late_end); // day workers only
      const hoursInSpan = dynamic.isShiftworker
        ? hours // shiftworkers' "span" is governed by shift loadings below, not the day-worker 7am-7pm window
        : hours * spanOverlapFraction(shift.start, shift.end, spanStart, spanLateEnd);

      const ordinaryHours = Math.min(hoursInSpan, remaining);
      const otHours = hours - ordinaryHours;

      const shiftType = dynamic.isShiftworker ? shiftLoadingComponent(shift.start, shift.end, ruleSet.clauses.shift_definitions) : null;
      const ordinaryRateCents = shiftType === "early_morning" ? rate.early_morning_cents : shiftType === "afternoon_permanent" ? rate.afternoon_permanent_cents : shiftType === "night_permanent" ? rate.night_permanent_cents : rate.hourly_cents;
      const ordinaryComponent = shiftType ?? "ordinary";

      if (ordinaryHours > 0) {
        contributions.push({ component: ordinaryComponent, cents: Math.round(ordinaryHours * ordinaryRateCents), countsTowardOte: true });
        weeklyOrdinaryUsed.set(weekKey, used + ordinaryHours);
      }
      if (otHours > 0) {
        const { first3, after3 } = splitOvertime(otHours);
        if (first3 > 0) contributions.push({ component: "overtime_1.5", cents: Math.round(first3 * rate.overtime_first_3h_cents), countsTowardOte: true });
        if (after3 > 0) contributions.push({ component: "overtime_2.0", cents: Math.round(after3 * rate.overtime_after_3h_cents), countsTowardOte: true });
        // Meal allowance: triggered by >=1.5h OT finishing after 6pm (18.4(a)).
        if (otHours >= ruleSet.clauses.meal_allowance.trigger_ot_hours && endClockWrapped(shift.start, shift.end) >= minutesOfDay(ruleSet.clauses.meal_allowance.trigger_finish_after)) {
          const meal = ruleSet.allowances["Meal allowance - overtime"];
          if (meal?.amounts_cents?.[0] != null) {
            contributions.push({ component: "meal_allowance", cents: meal.amounts_cents[0], countsTowardOte: false });
            if (otHours >= ruleSet.clauses.meal_allowance.additional_trigger_ot_hours && meal.amounts_cents[1] != null) {
              contributions.push({ component: "meal_allowance", cents: meal.amounts_cents[1], countsTowardOte: false });
            }
          }
        }
      }
    }

    byShiftKey.set(`${shift.employeeId}|${shift.date}`, { contributions, hours });
  }

  return { byShiftKey, warnings };
}
