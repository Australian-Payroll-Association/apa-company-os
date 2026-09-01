"use server";

// E7 · Native Pricing Engine — server actions wiring the pure engine to the
// deal. Three actions:
//   saveDealPricing     — run the engine, upsert the CPQ (deal_pricing) row.
//   applyPricingToDeal  — push the selected figure to deals.amount_cents via the
//                         existing FX-on-write path, stamp pricing_origin.
//   setPricingOverride  — logged manual-sign-off override, then re-apply.
//
// The pricing math lives in lib/admin/pricing (pure, tested). This layer only
// persists and wires. All money is AUD integer cents.

import { revalidatePath } from "next/cache";
import { companyOs } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";
import { recordAudit } from "@/lib/admin/audit";
import { priceService } from "@/lib/admin/pricing/engine";
import { getServiceConfig } from "@/lib/admin/pricing/config";
import { ENGINE_VERSION, type PricingInputs, type ServiceKey } from "@/lib/admin/pricing/types";
import { updateDeal } from "../actions";

type Result = { ok: true } | { ok: false; error: string };

// Pure, DB-free live preview for the Pricing panel — runs the engine and returns
// both figures + breakdown + warnings without persisting anything. Safe to call
// before the deal_pricing table exists.
export async function previewPricing(serviceKey: ServiceKey, inputs: PricingInputs) {
  await requireAdmin();
  return priceService(serviceKey, inputs);
}

function refresh(dealId: string) {
  revalidatePath(`/admin/revenue/deals/${dealId}`);
  revalidatePath("/admin/revenue/deals");
}

// Run the engine for the given service + inputs and upsert the CPQ record. Does
// NOT touch deals.amount_cents — applyPricingToDeal does that explicitly.
export async function saveDealPricing(
  dealId: string,
  serviceKey: ServiceKey,
  inputs: PricingInputs,
  isMember: boolean,
): Promise<Result> {
  const admin = await requireAdmin();

  const config = getServiceConfig(serviceKey);
  if (!config) return { ok: false, error: `Unknown service "${serviceKey}".` };

  const result = priceService(serviceKey, inputs);

  const row = {
    deal_id: dealId,
    service_key: serviceKey,
    is_member: isMember,
    inputs: inputs as unknown as Record<string, unknown>,
    breakdown: result.breakdown as unknown as Record<string, unknown>[],
    member_total_cents: result.memberCents,
    non_member_total_cents: result.nonMemberCents,
    currency: "aud",
    warnings: result.warnings,
    engine_version: result.engineVersion,
    updated_at: new Date().toISOString(),
  };

  const { error } = await companyOs.from("deal_pricing").upsert(row, { onConflict: "deal_id" });
  if (error) return { ok: false, error: error.message };

  await recordAudit({
    table: "deal_pricing",
    recordId: dealId,
    operation: "update",
    actor: admin.email,
    newData: { service_key: serviceKey, is_member: isMember, member_total_cents: result.memberCents, non_member_total_cents: result.nonMemberCents },
  });

  refresh(dealId);
  return { ok: true };
}

// The figure that becomes the deal value: an override wins; otherwise Member vs
// Non-Member per is_member. Returns null when nothing is computable.
function selectedCents(row: {
  is_member: boolean;
  member_total_cents: number | null;
  non_member_total_cents: number | null;
  override_cents: number | null;
}): number | null {
  if (row.override_cents != null) return row.override_cents;
  return row.is_member ? row.member_total_cents : row.non_member_total_cents;
}

async function stampNativeOrigin(dealId: string): Promise<void> {
  const { data } = await companyOs.from("deals").select("metadata").eq("id", dealId).maybeSingle();
  const metadata = { ...((data?.metadata as Record<string, unknown> | null) ?? {}), pricing_origin: "native" };
  await companyOs.from("deals").update({ metadata }).eq("id", dealId);
}

// Push the selected CPQ figure to deals.amount_cents (AUD) via updateDeal, which
// keeps amount_usd_cents/fx_rate current. Stamps metadata.pricing_origin='native'.
export async function applyPricingToDeal(dealId: string): Promise<Result> {
  const admin = await requireAdmin();

  const { data: row, error } = await companyOs
    .from("deal_pricing")
    .select("is_member, member_total_cents, non_member_total_cents, override_cents")
    .eq("deal_id", dealId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!row) return { ok: false, error: "No pricing saved for this deal yet." };

  const cents = selectedCents(row);
  if (cents == null) {
    return {
      ok: false,
      error: "No computable figure to apply (unverified config or a non-member driver without a source price). Add an override, or switch membership.",
    };
  }

  // Persist which figure was selected.
  const { error: selErr } = await companyOs
    .from("deal_pricing")
    .update({ selected_total_cents: cents, updated_at: new Date().toISOString() })
    .eq("deal_id", dealId);
  if (selErr) return { ok: false, error: selErr.message };

  // updateDeal takes dollars and refreshes FX (amount_usd_cents/fx_rate).
  const applied = await updateDeal(dealId, { amount: cents / 100, currency: "aud" });
  if (!applied.ok) return applied;

  await stampNativeOrigin(dealId);
  await recordAudit({
    table: "deals",
    recordId: dealId,
    operation: "update",
    actor: admin.email,
    context: { action: "pricing_applied", selected_total_cents: cents, engine_version: ENGINE_VERSION },
  });

  refresh(dealId);
  return { ok: true };
}

// Manual-sign-off override: record the value + reason + approver + timestamp,
// log the attestation, then re-apply to the deal. No role/login/workflow.
export async function setPricingOverride(
  dealId: string,
  overrideDollars: number,
  reason: string,
  approvedBy: string,
): Promise<Result> {
  const admin = await requireAdmin();

  if (!Number.isFinite(overrideDollars) || overrideDollars < 0) {
    return { ok: false, error: "Override amount must be zero or more." };
  }
  const trimmedReason = reason.trim();
  const trimmedApprover = approvedBy.trim();
  if (!trimmedReason) return { ok: false, error: "An override needs a reason." };
  if (!trimmedApprover) return { ok: false, error: "An override needs an approver (e.g. Ross)." };

  const cents = Math.round(overrideDollars * 100);
  const { error } = await companyOs
    .from("deal_pricing")
    .update({
      override_cents: cents,
      override_reason: trimmedReason,
      override_approved_by: trimmedApprover,
      override_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("deal_id", dealId);
  if (error) return { ok: false, error: error.message };

  // Logged attestation.
  await recordAudit({
    table: "deal_pricing",
    recordId: dealId,
    operation: "update",
    actor: admin.email,
    context: { action: "pricing_override", override_cents: cents, reason: trimmedReason, approved_by: trimmedApprover },
  });

  // Re-apply so the deal value reflects the override.
  return applyPricingToDeal(dealId);
}
