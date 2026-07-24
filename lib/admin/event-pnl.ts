// Server-only data layer for the retreat P&L tab (company_os.event_pnl_lines).
// Authorization is the caller's job — every server action wraps these with
// requireAdmin(). Money is integer cents (major x 100) in the native currency;
// *_usd_cents is derived via fx_rates so revenue and expenses sum in one
// currency. Staff lines use a flat $150/day so real wages never leak to ops.

import { companyOs } from "@/lib/supabase";
import { convertToUsdCents } from "@/lib/admin/fx";

export type PnlSide = "revenue" | "expense";
export type PnlPaymentStatus = "unpaid" | "to_be_paid" | "paid";

// Flat v1 staff rate. Kept here (not from the compensation table) as the leak
// guard: retreat cost lines must never expose real wages.
export const STAFF_DAY_RATE_USD_CENTS = 15000; // $150/day

export const EXPENSE_CLASSIFICATIONS = [
  "accommodation",
  "staff_cost",
  "venue",
  "transportation",
  "food_beverage",
  "equipment",
  "visa",
  "commission",
  "stripe_fee",
  "other",
] as const;

export const REVENUE_CLASSIFICATIONS = ["retreat", "human_tokens", "mac_mini", "other"] as const;

export const CLASSIFICATION_LABELS: Record<string, string> = {
  accommodation: "Accommodation",
  staff_cost: "Staff cost",
  venue: "Venue",
  transportation: "Transportation",
  food_beverage: "Food & beverage",
  equipment: "Equipment",
  visa: "Visa",
  commission: "Commission",
  stripe_fee: "Stripe fee",
  retreat: "Retreat fee",
  human_tokens: "Human Tokens",
  mac_mini: "Mac Mini",
  other: "Other",
};

export const PAYMENT_STATUS_LABELS: Record<PnlPaymentStatus, string> = {
  unpaid: "Unpaid",
  to_be_paid: "To be paid",
  paid: "Paid",
};

export type PnlLine = {
  id: string;
  eventId: string;
  side: PnlSide;
  classification: string;
  description: string | null;
  personId: string | null;
  attendees: number | null;
  staffDays: number | null;
  estimatedCents: number | null;
  estimatedCurrency: string | null;
  estimatedUsdCents: number | null;
  actualCents: number | null;
  actualCurrency: string | null;
  actualUsdCents: number | null;
  paymentStatus: PnlPaymentStatus;
  note: string | null;
  sortOrder: number;
};

export type PnlLineInput = {
  side: PnlSide;
  classification: string;
  description?: string | null;
  personId?: string | null;
  attendees?: number | null;
  staffDays?: number | null;
  estimatedCents?: number | null;
  estimatedCurrency?: string | null;
  actualCents?: number | null;
  actualCurrency?: string | null;
  paymentStatus?: PnlPaymentStatus;
  note?: string | null;
  sortOrder?: number;
};

type Row = {
  id: string;
  event_id: string;
  side: PnlSide;
  classification: string;
  description: string | null;
  person_id: string | null;
  attendees: number | null;
  staff_days: number | string | null;
  estimated_cents: number | string | null;
  estimated_currency: string | null;
  estimated_usd_cents: number | string | null;
  actual_cents: number | string | null;
  actual_currency: string | null;
  actual_usd_cents: number | string | null;
  payment_status: PnlPaymentStatus;
  note: string | null;
  sort_order: number;
};

const num = (v: number | string | null): number | null =>
  v === null || v === "" ? null : Number(v);

function mapRow(r: Row): PnlLine {
  return {
    id: r.id,
    eventId: r.event_id,
    side: r.side,
    classification: r.classification,
    description: r.description,
    personId: r.person_id,
    attendees: r.attendees,
    staffDays: num(r.staff_days),
    estimatedCents: num(r.estimated_cents),
    estimatedCurrency: r.estimated_currency,
    estimatedUsdCents: num(r.estimated_usd_cents),
    actualCents: num(r.actual_cents),
    actualCurrency: r.actual_currency,
    actualUsdCents: num(r.actual_usd_cents),
    paymentStatus: r.payment_status,
    note: r.note,
    sortOrder: r.sort_order,
  };
}

export async function getEventPnlLines(eventId: string): Promise<PnlLine[]> {
  const { data, error } = await companyOs
    .from("event_pnl_lines")
    .select("*")
    .eq("event_id", eventId)
    .order("side", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    console.error("getEventPnlLines failed:", error.message);
    return [];
  }
  return (data as Row[]).map(mapRow);
}

// Best-effort native -> USD. USD short-circuits (rate 1). On a flaky FX lookup
// we keep the native amount and leave USD null rather than block the save; the
// fx_rates cache is refreshed opportunistically so cross-currency sums stay
// close. Never throws.
async function deriveUsdCents(cents: number | null, currency: string | null): Promise<number | null> {
  if (cents === null) return null;
  const cur = (currency ?? "usd").toLowerCase();
  try {
    const fx = await convertToUsdCents(cents, cur);
    if (cur !== "usd") {
      await companyOs
        .from("fx_rates")
        .upsert(
          { currency: cur, rate_to_usd: fx.rate, updated_at: new Date().toISOString() },
          { onConflict: "currency" },
        );
    }
    return fx.amountUsdCents;
  } catch (err) {
    console.error("deriveUsdCents failed:", (err as Error).message);
    return cur === "usd" ? cents : null;
  }
}

function normalizeInput(input: PnlLineInput) {
  return {
    side: input.side,
    classification: input.classification,
    description: input.description ?? null,
    person_id: input.personId ?? null,
    attendees: input.attendees ?? null,
    staff_days: input.staffDays ?? null,
    estimated_cents: input.estimatedCents ?? null,
    estimated_currency: input.estimatedCents == null ? null : (input.estimatedCurrency ?? "usd").toLowerCase(),
    actual_cents: input.actualCents ?? null,
    actual_currency: input.actualCents == null ? null : (input.actualCurrency ?? "usd").toLowerCase(),
    payment_status: input.paymentStatus ?? "unpaid",
    note: input.note ?? null,
    sort_order: input.sortOrder ?? 0,
  };
}

export async function insertPnlLine(
  eventId: string,
  input: PnlLineInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const base = normalizeInput(input);
  const [estimatedUsd, actualUsd] = await Promise.all([
    deriveUsdCents(base.estimated_cents, base.estimated_currency),
    deriveUsdCents(base.actual_cents, base.actual_currency),
  ]);
  const { data, error } = await companyOs
    .from("event_pnl_lines")
    .insert({
      event_id: eventId,
      ...base,
      estimated_usd_cents: estimatedUsd,
      actual_usd_cents: actualUsd,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: (data as { id: string }).id };
}

export async function updatePnlLine(
  id: string,
  input: PnlLineInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const base = normalizeInput(input);
  const [estimatedUsd, actualUsd] = await Promise.all([
    deriveUsdCents(base.estimated_cents, base.estimated_currency),
    deriveUsdCents(base.actual_cents, base.actual_currency),
  ]);
  const { error } = await companyOs
    .from("event_pnl_lines")
    .update({ ...base, estimated_usd_cents: estimatedUsd, actual_usd_cents: actualUsd })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deletePnlLine(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await companyOs.from("event_pnl_lines").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Pure totals (all in USD cents). `autoRevenueUsdCents` is the read-only Stripe
// revenue already captured via orders, added to the manual revenue lines.
export type PnlSummary = {
  revenueEstimatedUsd: number;
  revenueActualUsd: number;
  expenseEstimatedUsd: number;
  expenseActualUsd: number;
  profitEstimatedUsd: number;
  profitActualUsd: number;
};

export function summarizePnl(lines: PnlLine[], autoRevenueUsdCents = 0): PnlSummary {
  let revEst = autoRevenueUsdCents;
  let revAct = autoRevenueUsdCents;
  let expEst = 0;
  let expAct = 0;
  for (const l of lines) {
    if (l.side === "revenue") {
      revEst += l.estimatedUsdCents ?? 0;
      revAct += l.actualUsdCents ?? 0;
    } else {
      expEst += l.estimatedUsdCents ?? 0;
      expAct += l.actualUsdCents ?? 0;
    }
  }
  return {
    revenueEstimatedUsd: revEst,
    revenueActualUsd: revAct,
    expenseEstimatedUsd: expEst,
    expenseActualUsd: expAct,
    profitEstimatedUsd: revEst - expEst,
    profitActualUsd: revAct - expAct,
  };
}
