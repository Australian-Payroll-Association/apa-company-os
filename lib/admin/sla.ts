// Front Door SLA + time-in-stage math (E8). Pure, no I/O — the revenue cockpit
// fetches rows and passes them in, so this module stays trivially reasoned about
// (and unit-testable once a harness exists). Two independent things live here and
// must never be conflated with the 4h speed-to-lead response SLA
// (lead.sla_due_at), which is a separate metric the cockpit renders as its own
// tile:
//   1. The 24h Front Door FIRST-CALL SLA, measured in CALENDAR hours from an
//      inquiry's created_at to the moment it first reached 'contacted'-or-later
//      (metadata.first_contacted_at).
//   2. Per-deal time-in-stage and a 7-day blanket "stalled" flag.

import { MS_DAY } from "./dashboard-helpers";

// First-call SLA target: 24 calendar hours.
export const FIRST_CALL_SLA_MS = 24 * 60 * 60 * 1000;
// Blanket stalled threshold: an open deal with no stage change for 7+ days.
export const STALLED_MS = 7 * MS_DAY;

// The minimal inquiry shape the compliance calc needs. `firstContactedAt` is
// inquiries.metadata.first_contacted_at (ISO) or null when never contacted.
export type SlaInquiry = {
  id: string;
  createdAt: string;
  firstContactedAt: string | null;
  status: string | null;
  name: string | null;
  email: string | null;
};

export type FirstCallBreach = {
  id: string;
  name: string | null;
  email: string | null;
  createdAt: string;
  // Hours from created_at to first contact, or null when never contacted.
  hoursToContact: number | null;
  status: string | null;
};

export type FirstCallCompliance = {
  total: number;
  met: number;
  breached: number;
  // Percentage met (0–100, one decimal), or null when the window is empty.
  pct: number | null;
  breaches: FirstCallBreach[];
};

// Whole hours (one decimal) between two instants; negative clamped to 0.
function hoursBetween(fromMs: number, toMs: number): number {
  return Math.max(0, Math.round(((toMs - fromMs) / (60 * 60 * 1000)) * 10) / 10);
}

// Was this inquiry first contacted within 24 calendar hours of creation?
// Never contacted → breach with hoursToContact = null. Uses UTC millis, so it
// is calendar-hours (no business-calendar logic), exactly as the spec requires.
export function isFirstCallMet(inq: SlaInquiry): boolean {
  if (!inq.firstContactedAt) return false;
  const created = new Date(inq.createdAt).getTime();
  const contacted = new Date(inq.firstContactedAt).getTime();
  if (!Number.isFinite(created) || !Number.isFinite(contacted)) return false;
  return contacted - created <= FIRST_CALL_SLA_MS;
}

// Compliance over a set of inquiries (the caller pre-filters to sales inquiries
// in the reporting window). pct = met / total. Breaches carry enough to action:
// contact, created_at, time-to-first-contact (or null = never contacted), status.
export function firstCallCompliance(inquiries: SlaInquiry[]): FirstCallCompliance {
  const total = inquiries.length;
  let met = 0;
  const breaches: FirstCallBreach[] = [];

  for (const inq of inquiries) {
    if (isFirstCallMet(inq)) {
      met += 1;
      continue;
    }
    const created = new Date(inq.createdAt).getTime();
    const hoursToContact =
      inq.firstContactedAt != null
        ? hoursBetween(created, new Date(inq.firstContactedAt).getTime())
        : null;
    breaches.push({
      id: inq.id,
      name: inq.name,
      email: inq.email,
      createdAt: inq.createdAt,
      hoursToContact,
      status: inq.status,
    });
  }

  return {
    total,
    met,
    breached: breaches.length,
    pct: total > 0 ? Math.round((met / total) * 1000) / 10 : null,
    breaches,
  };
}

// Milliseconds a deal has sat in its current stage. `lastStageChangeAt` is the
// most recent status_change.occurred_at for the deal; when a deal has no logged
// stage change yet (pre-instrumentation history), the caller passes
// deals.created_at as the documented interim anchor. `nowMs` is injected so the
// function stays pure.
export function timeInStageMs(lastStageChangeAt: string, nowMs: number): number {
  const anchor = new Date(lastStageChangeAt).getTime();
  if (!Number.isFinite(anchor)) return 0;
  return Math.max(0, nowMs - anchor);
}

// An open deal is stalled when it has not changed stage for 7+ days.
export function isStalled(timeInStageMillis: number): boolean {
  return timeInStageMillis >= STALLED_MS;
}

// Compact human duration for a tile/badge ("6d", "18h", "45m", "just now").
export function humanDuration(ms: number): string {
  if (ms < 60_000) return "just now";
  const days = Math.floor(ms / MS_DAY);
  if (days >= 1) return `${days}d`;
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours >= 1) return `${hours}h`;
  return `${Math.floor(ms / 60_000)}m`;
}
