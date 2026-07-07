"use server";

import { revalidatePath } from "next/cache";
import { companyOs } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";
import { recordAudit } from "@/lib/admin/audit";

type Result = { ok: true } | { ok: false; error: string };

// Move an application to a hiring stage on its job req's board. Landing on a
// terminal stage stamps decided_at; the recruiter still sets final status.
export async function moveApplicationStage(
  applicationId: string,
  toStageId: string,
  jobReqId: string,
): Promise<Result> {
  await requireAdmin();

  const { data: stage, error: stageErr } = await companyOs
    .from("application_stages")
    .select("is_terminal")
    .eq("id", toStageId)
    .maybeSingle();
  if (stageErr || !stage) return { ok: false, error: stageErr?.message ?? "Unknown stage." };

  const patch: Record<string, unknown> = { current_stage_id: toStageId };
  if (stage.is_terminal) patch.decided_at = new Date().toISOString();

  const { error } = await companyOs.from("applications").update(patch).eq("id", applicationId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/talent/jobs/${jobReqId}`);
  return { ok: true };
}

// ─── Public posting ──────────────────────────────────────────────────────────
// A req is live on /careers iff status='open' AND is_public. Everything the
// public page renders is managed here: slug (public URL), full_jd (markdown
// body), excerpt/department/featured (metadata), and up to 3 screening
// questions snapshotted onto each application at apply time.
export type JobPostingPatch = {
  is_public?: boolean;
  slug?: string;
  full_jd?: string | null;
  excerpt?: string | null;
  department?: string | null;
  featured?: boolean;
  questions?: string[];
};

export async function updateJobPosting(jobReqId: string, patch: JobPostingPatch): Promise<Result> {
  const admin = await requireAdmin();
  const updates: Record<string, unknown> = {};

  if (patch.is_public !== undefined) updates.is_public = patch.is_public;
  if (patch.slug !== undefined) {
    const slug = patch.slug
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (!slug) return { ok: false, error: "Slug can't be empty." };
    updates.slug = slug;
  }
  if (patch.full_jd !== undefined) updates.full_jd = patch.full_jd?.trim() || null;
  if (patch.questions !== undefined) {
    const qs = patch.questions.map((q) => q.trim()).filter(Boolean).slice(0, 3);
    updates.application_questions = qs;
  }

  // Presentation extras ride in metadata; merge without clobbering other keys.
  if (patch.excerpt !== undefined || patch.department !== undefined || patch.featured !== undefined) {
    const { data: cur, error: curErr } = await companyOs
      .from("job_requisitions")
      .select("metadata")
      .eq("id", jobReqId)
      .maybeSingle();
    if (curErr || !cur) return { ok: false, error: curErr?.message ?? "Req not found." };
    const meta = { ...((cur.metadata as Record<string, unknown>) ?? {}) };
    if (patch.excerpt !== undefined) meta.excerpt = patch.excerpt?.trim() || null;
    if (patch.department !== undefined) meta.department = patch.department?.trim() || null;
    if (patch.featured !== undefined) meta.featured = patch.featured;
    updates.metadata = meta;
  }

  if (Object.keys(updates).length === 0) return { ok: true };

  const { error } = await companyOs.from("job_requisitions").update(updates).eq("id", jobReqId);
  if (error) {
    if (error.code === "23505") return { ok: false, error: "That slug is already used by another req." };
    return { ok: false, error: error.message };
  }
  await recordAudit({
    table: "job_requisitions",
    recordId: jobReqId,
    operation: "update",
    actor: admin.email,
    newData: updates,
  });
  revalidatePath(`/admin/talent/jobs/${jobReqId}`);
  return { ok: true };
}
