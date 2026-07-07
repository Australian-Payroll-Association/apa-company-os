"use server";

import { revalidatePath } from "next/cache";
import { companyOs } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";
import { recordTransition } from "@/lib/lifecycle";
import { recordAudit, recordAuditMany } from "@/lib/admin/audit";
import { archiveRecord, guardedDelete, restoreRecord } from "@/lib/admin/mutations";
import { convertToUsdCents } from "@/lib/admin/fx";

type Result = { ok: true } | { ok: false; error: string };
type BulkResult = { ok: true; message?: string } | { ok: false; error: string };

const LOST_REASONS = new Set([
  "price",
  "competitor",
  "no_decision",
  "bad_fit",
  "bad_timing",
  "ghosted",
  "other",
]);
const HANDOFF_REJECT_REASONS = new Set([
  "not_qualified",
  "bad_fit",
  "duplicate",
  "bad_timing",
  "other",
]);

function refresh() {
  revalidatePath("/admin/revenue/deals");
  revalidatePath("/admin/revenue/leads");
}

// Accept a pasted link and store a canonical URL. Empty → null; a bare host
// like "docs.google.com/x" gets an https:// scheme so the stored value is
// always clickable.
function normalizeUrl(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  if (!s) return null;
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

// When a deal closes, the person's lifecycle follows: won → customer; lost →
// back to nurture unless they're already a customer or have another open deal.
async function syncPersonAfterClose(dealId: string, personId: string | null, won: boolean) {
  if (!personId) return;
  const { data: person } = await companyOs
    .from("people")
    .select("lifecycle_stage, lead_status")
    .eq("id", personId)
    .maybeSingle();
  if (!person) return;

  if (won) {
    if (person.lifecycle_stage === "customer") return;
    await companyOs
      .from("people")
      .update({ lifecycle_stage: "customer", lead_status: null, lead_sla_due_at: null })
      .eq("id", personId);
    await recordTransition({
      personId,
      fromStage: person.lifecycle_stage,
      toStage: "customer",
      fromStatus: person.lead_status,
      toStatus: null,
      reason: "deal_won",
    });
    return;
  }

  if (person.lifecycle_stage === "customer") return;
  const { count } = await companyOs
    .from("deals")
    .select("id", { count: "exact", head: true })
    .eq("person_id", personId)
    .eq("status", "open")
    .neq("id", dealId);
  if ((count ?? 0) > 0) return;

  await companyOs
    .from("people")
    .update({ lifecycle_stage: "lead", lead_status: "nurture" })
    .eq("id", personId);
  await recordTransition({
    personId,
    fromStage: person.lifecycle_stage,
    toStage: "lead",
    fromStatus: person.lead_status,
    toStatus: "nurture",
    reason: "deal_lost",
  });
}

// Move a deal to a pipeline stage. Landing on a won/lost stage also flips the
// deal's status and stamps closed_at, so the close-rate metrics stay truthful.
// Losing a deal requires an enumerated reason.
export async function moveDealStage(
  dealId: string,
  toStageId: string,
  lostReason?: string,
): Promise<Result> {
  await requireAdmin();

  const { data: stage, error: stageErr } = await companyOs
    .from("pipeline_stages")
    .select("is_won, is_lost")
    .eq("id", toStageId)
    .maybeSingle();
  if (stageErr || !stage) return { ok: false, error: stageErr?.message ?? "Unknown stage." };

  if (stage.is_lost && (!lostReason || !LOST_REASONS.has(lostReason))) {
    return { ok: false, error: "Losing a deal needs a reason." };
  }

  const status = stage.is_won ? "won" : stage.is_lost ? "lost" : "open";
  const closed_at = stage.is_won || stage.is_lost ? new Date().toISOString() : null;

  const updates: Record<string, unknown> = { stage_id: toStageId, status, closed_at };
  if (stage.is_lost) updates.lost_reason = lostReason;

  const { data: deal, error } = await companyOs
    .from("deals")
    .update(updates)
    .eq("id", dealId)
    .select("person_id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };

  if (stage.is_won || stage.is_lost) {
    await syncPersonAfterClose(dealId, deal?.person_id ?? null, stage.is_won);
  }

  refresh();
  return { ok: true };
}

// The closer's side of the SDR handoff contract. Reject sends the person back
// to the SDR queue and closes the deal; the reason feeds SDR coaching.
export async function decideHandoff(
  dealId: string,
  decision: "accepted" | "rejected",
  reason?: string,
  note?: string,
): Promise<Result> {
  await requireAdmin();

  if (decision === "rejected" && (!reason || !HANDOFF_REJECT_REASONS.has(reason))) {
    return { ok: false, error: "Rejecting a handoff needs a reason." };
  }

  const { data: deal, error: dErr } = await companyOs
    .from("deals")
    .select("person_id, handoff_status")
    .eq("id", dealId)
    .maybeSingle();
  if (dErr || !deal) return { ok: false, error: dErr?.message ?? "Deal not found." };
  if (deal.handoff_status !== "pending") return { ok: false, error: "Handoff already decided." };

  const updates: Record<string, unknown> = {
    handoff_status: decision,
    handoff_decided_at: new Date().toISOString(),
    handoff_note: note?.trim() || null,
  };
  if (decision === "rejected") {
    updates.handoff_rejected_reason = reason;
    updates.status = "lost";
    updates.closed_at = new Date().toISOString();
    updates.lost_reason = "bad_fit";
  }

  const { error } = await companyOs.from("deals").update(updates).eq("id", dealId);
  if (error) return { ok: false, error: error.message };

  if (decision === "rejected" && deal.person_id) {
    const { data: person } = await companyOs
      .from("people")
      .select("lifecycle_stage, lead_status")
      .eq("id", deal.person_id)
      .maybeSingle();
    await companyOs
      .from("people")
      .update({ lifecycle_stage: "sql", lead_status: "connected" })
      .eq("id", deal.person_id);
    await recordTransition({
      personId: deal.person_id,
      fromStage: person?.lifecycle_stage ?? null,
      toStage: "sql",
      fromStatus: person?.lead_status ?? null,
      toStatus: "connected",
      reason: "handoff_rejected",
      note: reason,
    });
  }

  refresh();
  return { ok: true };
}

export async function saveNextStep(
  dealId: string,
  nextStep: string,
  nextStepDate: string,
): Promise<Result> {
  await requireAdmin();

  const { error } = await companyOs
    .from("deals")
    .update({
      next_step: nextStep.trim() || null,
      next_step_date: nextStepDate || null,
    })
    .eq("id", dealId);
  if (error) return { ok: false, error: error.message };

  refresh();
  return { ok: true };
}

// ─── Full deal edit ──────────────────────────────────────────────────────────
// `amount` is dollars from the form; it's the only place we convert to the
// integer-cents storage. Only keys present in the patch are written.
export type DealPatch = {
  title?: string;
  amount?: number | null;
  currency?: string;
  probability?: number | null;
  expected_close_date?: string | null;
  source?: string | null;
  next_step?: string | null;
  next_step_date?: string | null;
  proposal_url?: string | null;
  contract_url?: string | null;
};

export async function updateDeal(dealId: string, patch: DealPatch): Promise<Result> {
  const admin = await requireAdmin();
  const updates: Record<string, unknown> = {};

  if (patch.title !== undefined) {
    const t = patch.title.trim();
    if (!t) return { ok: false, error: "Title can't be empty." };
    updates.title = t;
  }
  if (patch.amount !== undefined) {
    const amt = patch.amount ?? 0;
    if (!Number.isFinite(amt) || amt < 0) return { ok: false, error: "Amount must be zero or more." };
    updates.amount_cents = Math.round(amt * 100);
  }
  if (patch.currency !== undefined) {
    const c = patch.currency.trim().toLowerCase();
    if (!c) return { ok: false, error: "Currency is required." };
    updates.currency = c;
  }
  if (patch.probability !== undefined) {
    if (patch.probability == null) updates.probability = null;
    else {
      const p = Math.round(patch.probability);
      if (p < 0 || p > 100) return { ok: false, error: "Probability must be between 0 and 100." };
      updates.probability = p;
    }
  }
  if (patch.expected_close_date !== undefined) updates.expected_close_date = patch.expected_close_date || null;
  if (patch.source !== undefined) updates.source = patch.source?.trim() || null;
  if (patch.next_step !== undefined) updates.next_step = patch.next_step?.trim() || null;
  if (patch.next_step_date !== undefined) updates.next_step_date = patch.next_step_date || null;
  if (patch.proposal_url !== undefined) updates.proposal_url = normalizeUrl(patch.proposal_url);
  if (patch.contract_url !== undefined) updates.contract_url = normalizeUrl(patch.contract_url);

  // Reporting/list views always show USD (amount_cents/currency stay the
  // original transaction). Re-fetch the rate whenever amount or currency
  // changes; a flaky FX lookup shouldn't block the deal save.
  if (updates.amount_cents !== undefined || updates.currency !== undefined) {
    let amountCents = updates.amount_cents as number | undefined;
    let currency = updates.currency as string | undefined;
    if (amountCents === undefined || currency === undefined) {
      const { data: existing } = await companyOs
        .from("deals")
        .select("amount_cents, currency")
        .eq("id", dealId)
        .maybeSingle();
      amountCents ??= existing?.amount_cents ?? 0;
      currency ??= existing?.currency ?? "usd";
    }
    try {
      const fx = await convertToUsdCents(amountCents ?? 0, currency ?? "usd");
      updates.amount_usd_cents = fx.amountUsdCents;
      updates.fx_rate = fx.rate;
      updates.fx_rate_fetched_at = new Date().toISOString();
      // Keep the shared fx_rates table fresh from real usage, so the trigger that
      // normalizes orders/products/bookings (company_os.set_amount_usd_cents) uses a
      // current rate too. Best-effort — never block the deal save.
      await companyOs
        .from("fx_rates")
        .upsert(
          { currency: (currency ?? "usd").toLowerCase(), rate_to_usd: fx.rate, updated_at: new Date().toISOString() },
          { onConflict: "currency" },
        );
    } catch (err) {
      console.error(`FX conversion failed for deal ${dealId}:`, err);
    }
  }

  if (Object.keys(updates).length === 0) return { ok: true };

  const { error } = await companyOs.from("deals").update(updates).eq("id", dealId);
  if (error) return { ok: false, error: error.message };
  await recordAudit({ table: "deals", recordId: dealId, operation: "update", actor: admin.email, newData: updates });
  refresh();
  return { ok: true };
}

export async function archiveDeal(dealId: string): Promise<Result> {
  const admin = await requireAdmin();
  const r = await archiveRecord("deals", dealId, admin.email);
  if (r.ok) refresh();
  return r;
}

export async function restoreDeal(dealId: string): Promise<Result> {
  const admin = await requireAdmin();
  const r = await restoreRecord("deals", dealId, admin.email);
  if (r.ok) refresh();
  return r;
}

export async function deleteDeal(dealId: string): Promise<Result> {
  const admin = await requireAdmin();
  const r = await guardedDelete("deals", dealId, admin.email, { via: "deals" });
  if (r.ok) refresh();
  return r;
}

// ─── Bulk (list view multi-select) ───────────────────────────────────────────
export type BulkDealPatch = {
  stage_id?: string;
  probability?: number | null;
  expected_close_date?: string | null;
  source?: string | null;
};

export async function bulkUpdateDeals(ids: string[], patch: BulkDealPatch): Promise<BulkResult> {
  const admin = await requireAdmin();
  if (ids.length === 0) return { ok: false, error: "No deals selected." };

  const updates: Record<string, unknown> = {};
  if (patch.stage_id !== undefined) {
    const { data: stage, error } = await companyOs
      .from("pipeline_stages")
      .select("is_won, is_lost")
      .eq("id", patch.stage_id)
      .maybeSingle();
    if (error || !stage) return { ok: false, error: error?.message ?? "Unknown stage." };
    if (stage.is_won || stage.is_lost) {
      return { ok: false, error: "Bulk move is limited to open stages. Close won/lost deals one at a time." };
    }
    updates.stage_id = patch.stage_id;
    updates.status = "open";
    updates.closed_at = null;
  }
  if (patch.probability !== undefined) {
    if (patch.probability == null) updates.probability = null;
    else {
      const p = Math.round(patch.probability);
      if (p < 0 || p > 100) return { ok: false, error: "Probability must be between 0 and 100." };
      updates.probability = p;
    }
  }
  if (patch.expected_close_date !== undefined) updates.expected_close_date = patch.expected_close_date || null;
  if (patch.source !== undefined) updates.source = patch.source?.trim() || null;

  if (Object.keys(updates).length === 0) {
    return { ok: false, error: "Nothing to change. Fill at least one field." };
  }

  const { error } = await companyOs.from("deals").update(updates).in("id", ids);
  if (error) return { ok: false, error: error.message };
  await recordAuditMany(
    ids.map((id) => ({ table: "deals", recordId: id, operation: "bulk_update" as const, actor: admin.email, newData: updates })),
  );
  refresh();
  return { ok: true, message: `Updated ${ids.length} deal${ids.length === 1 ? "" : "s"}.` };
}

export async function bulkArchiveDeals(ids: string[]): Promise<BulkResult> {
  const admin = await requireAdmin();
  if (ids.length === 0) return { ok: false, error: "No deals selected." };

  const { error } = await companyOs
    .from("deals")
    .update({ archived_at: new Date().toISOString(), archived_by: admin.email })
    .in("id", ids)
    .is("archived_at", null);
  if (error) return { ok: false, error: error.message };
  await recordAuditMany(
    ids.map((id) => ({ table: "deals", recordId: id, operation: "bulk_archive" as const, actor: admin.email })),
  );
  refresh();
  return { ok: true, message: `Archived ${ids.length} deal${ids.length === 1 ? "" : "s"}.` };
}

type BulkDeleteResult =
  | { ok: true; message?: string; deletedIds: string[] }
  | { ok: false; error: string };

export async function bulkDeleteDeals(ids: string[]): Promise<BulkDeleteResult> {
  const admin = await requireAdmin();
  if (ids.length === 0) return { ok: false, error: "No deals selected." };

  const deletedIds: string[] = [];
  let blocked = 0;
  for (const id of ids) {
    const r = await guardedDelete("deals", id, admin.email, { via: "deals_bulk" });
    if (r.ok) deletedIds.push(id);
    else blocked += 1;
  }
  refresh();
  if (deletedIds.length === 0) {
    return { ok: false, error: `None deleted — ${blocked} still referenced by inquiries or projects. Archive them instead.` };
  }
  return {
    ok: true,
    deletedIds,
    message:
      blocked > 0
        ? `Deleted ${deletedIds.length}, kept ${blocked} still referenced.`
        : `Deleted ${deletedIds.length} deal${deletedIds.length === 1 ? "" : "s"}.`,
  };
}
