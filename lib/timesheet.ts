// Shared, framework-free helpers for the staff timesheet (Phase 0 of Improved
// Scheduling & Tracking). Safe to import from server components, server actions,
// and client components — no server-only dependencies.
//
// Dates are handled as plain YYYY-MM-DD strings in LOCAL time, never Date
// objects crossing a timezone boundary, so "today" on the client and the
// work_date stored in Postgres (a DATE column) always agree.

export const STANDARD_WEEK_HOURS = 38; // APA's standard week; see the charter.
export const DAILY_CAPACITY_HOURS = STANDARD_WEEK_HOURS / 5; // 7.6h = 7h 36m, weekdays only.
export const MAX_HOURS_PER_ENTRY = 24;
export const HOURS_STEP = 0.25;

/** Decimal hours → "Xh Ym" (7.6 → "7h 36m", 1.5 → "1h 30m", 0 → "0h 0m"). */
export function formatHoursMinutes(h: number): string {
  const totalMin = Math.max(0, Math.round(h * 60));
  return `${Math.floor(totalMin / 60)}h ${totalMin % 60}m`;
}

/** Is a date (ISO) a weekday (Mon–Fri)? Capacity is zero on weekends. */
export function isWeekday(iso: string): boolean {
  return ((fromISODate(iso).getDay() + 6) % 7) < 5;
}

/** ISO date (YYYY-MM-DD) for a Date, in local time. */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse a YYYY-MM-DD string to a local Date at midnight. */
export function fromISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Today as YYYY-MM-DD, local time. */
export function todayISO(): string {
  return toISODate(new Date());
}

/** Monday of the week containing the given ISO date (weeks run Mon–Sun). */
export function weekStartISO(iso: string): string {
  const d = fromISODate(iso);
  const dow = (d.getDay() + 6) % 7; // 0 = Monday … 6 = Sunday
  d.setDate(d.getDate() - dow);
  return toISODate(d);
}

/** The seven ISO dates Mon→Sun for the week starting at `mondayISO`. */
export function weekDays(mondayISO: string): string[] {
  const start = fromISODate(mondayISO);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return toISODate(d);
  });
}

/** Shift a Monday-anchored week by `delta` weeks (±). */
export function shiftWeek(mondayISO: string, delta: number): string {
  const d = fromISODate(mondayISO);
  d.setDate(d.getDate() + delta * 7);
  return toISODate(d);
}

const WEEKDAY_LONG = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Mon 1 Sep" for a day chip / row header. */
export function formatDayLabel(iso: string): string {
  const d = fromISODate(iso);
  const dow = (d.getDay() + 6) % 7;
  return `${WEEKDAY_LONG[dow]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "1 Sep" — a compact week-column header (the Monday). */
export function formatWeekShort(iso: string): string {
  const d = fromISODate(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "1 – 7 Sep 2026" for a week header. */
export function formatWeekRange(mondayISO: string): string {
  const days = weekDays(mondayISO);
  const a = fromISODate(days[0]);
  const b = fromISODate(days[6]);
  const left = `${a.getDate()} ${MONTHS[a.getMonth()]}`;
  const right = `${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;
  return `${left} – ${right}`;
}

/**
 * Validate and normalise an hours value. Returns a number rounded to the
 * quarter-hour, or an error string. Enforced identically on client and server.
 */
export function parseHours(raw: unknown): { hours: number } | { error: string } {
  const n = typeof raw === "number" ? raw : Number(String(raw ?? "").trim());
  if (!Number.isFinite(n)) return { error: "Enter hours as a number." };
  if (n <= 0) return { error: "Hours must be greater than zero." };
  if (n > MAX_HOURS_PER_ENTRY) return { error: `That's over ${MAX_HOURS_PER_ENTRY} hours in one entry.` };
  const rounded = Math.round(n / HOURS_STEP) * HOURS_STEP;
  return { hours: Number(rounded.toFixed(2)) };
}

/** Is this ISO string a well-formed calendar date? */
export function isValidISODate(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = fromISODate(s);
  return toISODate(d) === s;
}

/** Compact hours label: 8 → "8", 7.5 → "7.5", 0.25 → "0.25". */
export function formatHours(h: number): string {
  return Number(h.toFixed(2)).toString();
}
