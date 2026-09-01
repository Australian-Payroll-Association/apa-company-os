// Shared date/time helpers and employee-attribute/rate resolution, used by
// every part of the engine. Pure functions, no I/O.

import type { AgeBand, EmployeeDynamicAttrs, EmployeeStaticAttrs, RateCategory, RateEntry, RuleSet } from "../types";

export function minutesOfDay(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

// Net hours between start/end, handling an overnight shift (end <= start).
export function shiftHours(start: string, end: string, breakLengthHours: number): number {
  const s = minutesOfDay(start);
  const e = minutesOfDay(end);
  const durationMin = e > s ? e - s : e + 24 * 60 - s;
  return Math.max(0, durationMin / 60 - breakLengthHours);
}

export function dayOfWeek(dateIso: string): number {
  return new Date(`${dateIso}T00:00:00Z`).getUTCDay(); // 0=Sun .. 6=Sat
}

// Monday-anchored ISO week key, e.g. "2026-W09" — used to bucket hours for
// weekly overtime-threshold tracking (v2 simplification: one-week buckets
// only, not the award's optional 2/3/4-week averaging cycle — see
// docs/product/project-recalc-module.md for why: there's no cycle-length
// field anywhere in the intake workbook to infer it from).
export function isoWeekKey(dateIso: string): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10); // the Monday of that week
}

export function ageAt(dob: string | null, dateIso: string): number | null {
  if (!dob) return null;
  const b = new Date(`${dob}T00:00:00Z`);
  const d = new Date(`${dateIso}T00:00:00Z`);
  let age = d.getUTCFullYear() - b.getUTCFullYear();
  const hadBirthday = d.getUTCMonth() > b.getUTCMonth() || (d.getUTCMonth() === b.getUTCMonth() && d.getUTCDate() >= b.getUTCDate());
  if (!hadBirthday) age--;
  return age;
}

export function ageBand(age: number | null): AgeBand {
  if (age == null || age >= 21) return "adult";
  if (age < 17) return "under_17";
  return String(age) as AgeBand; // "17" | "18" | "19" | "20"
}

export function rateCategory(employmentType: EmployeeDynamicAttrs["employmentType"]): RateCategory {
  return employmentType === "casual" ? "casual" : "standard";
}

export function resolveStatic(staticAttrs: EmployeeStaticAttrs[], employeeId: string): EmployeeStaticAttrs | null {
  return staticAttrs.find((s) => s.employeeId === employeeId) ?? null;
}

// Dynamic attributes are time-bounded — resolve the row whose range covers
// this date. If more than one matches (bad data), the first is used.
export function resolveDynamic(dynamicAttrs: EmployeeDynamicAttrs[], employeeId: string, date: string): EmployeeDynamicAttrs | null {
  return dynamicAttrs.find((d) => d.employeeId === employeeId && date >= d.applicableFrom && date <= d.applicableTo) ?? null;
}

export function lookupRate(ruleSet: RuleSet, band: AgeBand, category: RateCategory, classification: string): RateEntry | null {
  return ruleSet.rates[band]?.[category]?.[classification] ?? null;
}

export function weeklyThresholdHours(dynamic: EmployeeDynamicAttrs): number {
  if (dynamic.employmentType === "part_time" && dynamic.minContractHoursWeekly != null) {
    return dynamic.minContractHoursWeekly;
  }
  return 38; // full-time and casual baseline (11.1: casual's ordinary hours are the lesser of avg 38/wk or hours required)
}
