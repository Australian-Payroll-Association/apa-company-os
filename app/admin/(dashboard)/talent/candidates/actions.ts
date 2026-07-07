"use server";

import { revalidatePath } from "next/cache";
import { companyOs } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";
import { recordAudit } from "@/lib/admin/audit";

type Result = { ok: true } | { ok: false; error: string };

// The real distinct pool statuses in the table today (checked against the DB).
const POOL_STATUSES = new Set(["active", "passive", "placed", "do_not_pursue"]);

// Only keys present in the patch are written.
export type CandidatePatch = {
  pool_status?: string;
  notes?: string | null;
  availability?: string | null;
};

export async function updateCandidate(candidateId: string, patch: CandidatePatch): Promise<Result> {
  const admin = await requireAdmin();
  const updates: Record<string, unknown> = {};

  if (patch.pool_status !== undefined) {
    if (!POOL_STATUSES.has(patch.pool_status)) return { ok: false, error: "Unknown pool status." };
    updates.pool_status = patch.pool_status;
  }
  if (patch.notes !== undefined) updates.notes = patch.notes?.trim() || null;
  if (patch.availability !== undefined) updates.availability = patch.availability?.trim() || null;

  if (Object.keys(updates).length === 0) return { ok: true };

  const { error } = await companyOs.from("candidates").update(updates).eq("id", candidateId);
  if (error) return { ok: false, error: error.message };
  await recordAudit({
    table: "candidates",
    recordId: candidateId,
    operation: "update",
    actor: admin.email,
    newData: updates,
  });
  revalidatePath("/admin/talent/candidates");
  revalidatePath(`/admin/talent/candidates/${candidateId}`);
  return { ok: true };
}
