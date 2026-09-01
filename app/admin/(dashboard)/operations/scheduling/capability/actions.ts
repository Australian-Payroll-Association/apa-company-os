"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { companyOs } from "@/lib/supabase";
import { WORK_TYPES, isCapabilityLevel, isPreference } from "@/lib/scheduling";

// Capability matrix edits. Admin-gated (requireAdmin) — the matrix is Adriana's
// assignment judgment written down, an internal leadership tool. work_type is
// validated against the known vocabulary so the matrix can't fill with junk.

type Result = { ok: true } | { ok: false; error: string };

const WORK_TYPE_SET = new Set<string>(WORK_TYPES as readonly string[]);

function refresh() {
  revalidatePath("/admin/operations/scheduling/capability");
}

// Set (or clear) one person's level for one work type. level === null clears
// the cell (deletes the row). preference is optional and preserved on upsert.
export async function setCapability(input: {
  personId: string;
  workType: string;
  level: string | null;
  preference?: string | null;
}): Promise<Result> {
  await requireAdmin();

  if (!input.personId) return { ok: false, error: "Missing person." };
  if (!WORK_TYPE_SET.has(input.workType)) return { ok: false, error: "Unknown work type." };

  if (input.level === null) {
    const { error } = await companyOs
      .from("capability")
      .delete()
      .eq("person_id", input.personId)
      .eq("work_type", input.workType);
    if (error) return { ok: false, error: error.message };
    refresh();
    return { ok: true };
  }

  if (!isCapabilityLevel(input.level)) return { ok: false, error: "Invalid level." };
  const preference =
    input.preference == null ? null : isPreference(input.preference) ? input.preference : null;

  const { error } = await companyOs
    .from("capability")
    .upsert(
      { person_id: input.personId, work_type: input.workType, level: input.level, preference },
      { onConflict: "person_id,work_type" },
    );
  if (error) return { ok: false, error: error.message };

  refresh();
  return { ok: true };
}
