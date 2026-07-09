"use server";

import { revalidatePath } from "next/cache";
import { companyOs } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";
import { recordAudit } from "@/lib/admin/audit";

type Result = { ok: true } | { ok: false; error: string };

function refresh() {
  revalidatePath("/admin/revenue/public-retreats");
}

// A retreat is the set of products (type='event') sharing a cohort_slug, so
// retreat-level edits fan out to every tier row in the cohort. audit_log's
// record_id is a uuid — the cohort slug travels in context instead.

// ─── Edit ────────────────────────────────────────────────────────────────────
// Shared cohort fields from the list shelf. Dates arrive as "YYYY-MM-DD" (or
// null to clear); the retreat's display name derives from location's city part.
export type RetreatPatch = {
  location?: string | null;
  date_start?: string | null;
  date_end?: string | null;
  active?: boolean;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function updateRetreat(cohortSlug: string, patch: RetreatPatch): Promise<Result> {
  const admin = await requireAdmin();
  const updates: Record<string, unknown> = {};

  if (patch.location !== undefined) updates.location = patch.location?.trim() || null;
  if (patch.date_start !== undefined) {
    if (patch.date_start !== null && !DATE_RE.test(patch.date_start)) return { ok: false, error: "Start date must be YYYY-MM-DD." };
    updates.date_start = patch.date_start;
  }
  if (patch.date_end !== undefined) {
    if (patch.date_end !== null && !DATE_RE.test(patch.date_end)) return { ok: false, error: "End date must be YYYY-MM-DD." };
    updates.date_end = patch.date_end;
  }
  if (
    typeof updates.date_start === "string" &&
    typeof updates.date_end === "string" &&
    updates.date_end < updates.date_start
  ) {
    return { ok: false, error: "End date must be on or after the start date." };
  }
  if (patch.active !== undefined) updates.active = patch.active;

  if (Object.keys(updates).length === 0) return { ok: true };
  updates.updated_at = new Date().toISOString();

  const { data, error } = await companyOs
    .from("products")
    .update(updates)
    .eq("type", "event")
    .eq("cohort_slug", cohortSlug)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: "Retreat not found." };

  await recordAudit({
    table: "products",
    operation: "bulk_update",
    actor: admin.email,
    newData: updates,
    context: { cohort_slug: cohortSlug, product_ids: data.map((r) => r.id), via: "public_retreats_shelf" },
  });
  refresh();
  return { ok: true };
}

// ─── Delete ──────────────────────────────────────────────────────────────────
// Permanent: removes every tier product in the cohort. Blocked while any
// registration or order references a tier — the sales record stays intact;
// deactivate the retreat instead.
export async function deleteRetreat(cohortSlug: string): Promise<Result> {
  const admin = await requireAdmin();

  const { data: tiers, error: tErr } = await companyOs
    .from("products")
    .select("id")
    .eq("type", "event")
    .eq("cohort_slug", cohortSlug);
  if (tErr) return { ok: false, error: tErr.message };
  if (!tiers || tiers.length === 0) return { ok: false, error: "Retreat not found." };
  const ids = tiers.map((t) => t.id);

  const { count: regCount, error: rErr } = await companyOs
    .from("event_registrations")
    .select("id", { count: "exact", head: true })
    .in("product_id", ids);
  if (rErr) return { ok: false, error: rErr.message };
  if ((regCount ?? 0) > 0) {
    return {
      ok: false,
      error: `This retreat has ${regCount} registration${regCount === 1 ? "" : "s"} — deactivate it instead of deleting, so the sales history stays intact.`,
    };
  }

  const { count: orderCount, error: oErr } = await companyOs
    .from("orders")
    .select("id", { count: "exact", head: true })
    .in("product_id", ids);
  if (oErr) return { ok: false, error: oErr.message };
  if ((orderCount ?? 0) > 0) {
    return {
      ok: false,
      error: `This retreat has ${orderCount} order${orderCount === 1 ? "" : "s"} — deactivate it instead of deleting, so the sales history stays intact.`,
    };
  }

  const { error } = await companyOs.from("products").delete().in("id", ids);
  if (error) return { ok: false, error: error.message };

  await recordAudit({
    table: "products",
    operation: "bulk_delete",
    actor: admin.email,
    context: { cohort_slug: cohortSlug, product_ids: ids, via: "public_retreats_shelf" },
  });
  refresh();
  return { ok: true };
}
