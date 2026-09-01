// Types for the payroll recalculation module (proof of concept). Client-safe
// (no server-only imports) so both server actions and the results page can
// import from here.

// A rule set is data, not code: the award/EA's pay clauses expressed as a
// JSONB config on company_os.recalc_rule_sets.rules. Kept intentionally
// simple for v1 — see supabase/02-recalc.sql's seeded example. Every rule set
// is a stand-in for a real client's award/agreement until an SME (a payroll
// consultant) confirms it, never treat one as a certified interpretation.
export type RuleSet = {
  ordinary_hours_per_day: number;
  ordinary_hours_per_week: number;
  classifications: Record<string, { base_hourly_rate: number }>;
  // Applied uniformly to every classification's rate for v1 — there is no
  // employment-type (casual/permanent) field on the timesheet template yet,
  // so the engine can't tell who is actually entitled to it.
  casual_loading_pct: number;
  overtime: {
    daily_threshold_hours: number;
    // Applied in order: the first tier covers hours up to `up_to_hours`
    // (cumulative), the last tier should have `up_to_hours: null` to catch
    // the remainder.
    tiers: Array<{ up_to_hours: number | null; multiplier: number }>;
  };
  penalty_multipliers: {
    saturday: number;
    sunday: number;
    public_holiday: number;
  };
  allowances: {
    meal_allowance_cents: number;
    meal_allowance_trigger_ot_hours: number;
  };
  public_holidays: string[]; // ISO dates, "YYYY-MM-DD"
  superannuation_pct: number;
};

export type DayType = "weekday" | "saturday" | "sunday" | "public_holiday";

// One row per shift worked, from the timesheet CSV template.
export type TimesheetRow = {
  employeeId: string;
  employeeName: string;
  classification: string;
  workDate: string; // "YYYY-MM-DD"
  startTime: string; // "HH:MM", 24h
  endTime: string; // "HH:MM", 24h — may be earlier than startTime for an overnight shift
  unpaidBreakMinutes: number;
};

export const PAY_COMPONENTS = [
  "ordinary",
  "overtime",
  "saturday_penalty",
  "sunday_penalty",
  "public_holiday_penalty",
  "meal_allowance",
  "leave",
  "superannuation",
] as const;

export type PayComponent = (typeof PAY_COMPONENTS)[number];

// One row per paid component per pay period, from the pay data CSV template —
// what was actually paid, itemized (long format), not a wide payslip.
export type PayDataRow = {
  employeeId: string;
  employeeName: string;
  payPeriodStart: string; // "YYYY-MM-DD"
  payPeriodEnd: string; // "YYYY-MM-DD"
  component: PayComponent;
  amountCents: number;
  hours: number | null;
};

export type VarianceRow = {
  employeeId: string;
  employeeName: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  component: PayComponent;
  expectedCents: number;
  actualCents: number;
  varianceCents: number; // actual - expected
  flagged: boolean;
};

export type RunTotals = {
  expectedCents: number;
  actualCents: number;
  varianceCents: number;
  flaggedCount: number;
};

// The full computed output stored in company_os.recalc_runs.results.
export type RunResults = {
  variances: VarianceRow[];
  totals: RunTotals;
  // e.g. a timesheet day that fell outside every pay period on file for that
  // employee, or a classification missing from the rule set — surfaced to the
  // consultant rather than silently dropped or guessed at.
  warnings: string[];
};
