"use server";

import { revalidatePath } from "next/cache";
import { companyOs } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";
import { recordAudit } from "@/lib/admin/audit";

type Result = { ok: true } | { ok: false; error: string };

// Matches the job_requisitions CHECK constraints.
const EMPLOYMENT_TYPES = new Set(["full_time", "part_time", "contract", "intern", "temp", "advisor"]);
const REMOTE_POLICIES = new Set(["onsite", "hybrid", "remote"]);
const CLOSE_OUTCOMES = new Set(["filled", "closed", "cancelled"]);

function refresh(id: string) {
  revalidatePath("/admin/talent/jobs");
  revalidatePath(`/admin/talent/jobs/${id}`);
}

// ─── Edit ────────────────────────────────────────────────────────────────────
// Core req fields from the list shelf. Salary arrives in dollars (the only
// place it converts to integer cents, mirroring updateDeal). Only keys present
// in the patch are written.
export type JobReqPatch = {
  title?: string;
  employment_type?: string;
  location?: string | null;
  remote_policy?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  currency?: string;
  description?: string | null;
};

export async function updateJobReq(jobReqId: string, patch: JobReqPatch): Promise<Result> {
  const admin = await requireAdmin();
  const updates: Record<string, unknown> = {};

  if (patch.title !== undefined) {
    const t = patch.title.trim();
    if (!t) return { ok: false, error: "Title can't be empty." };
    updates.title = t;
  }
  if (patch.employment_type !== undefined) {
    if (!EMPLOYMENT_TYPES.has(patch.employment_type)) return { ok: false, error: "Unknown employment type." };
    updates.employment_type = patch.employment_type;
  }
  if (patch.location !== undefined) updates.location = patch.location?.trim() || null;
  if (patch.remote_policy !== undefined) {
    if (patch.remote_policy === null || patch.remote_policy === "") updates.remote_policy = null;
    else if (!REMOTE_POLICIES.has(patch.remote_policy)) return { ok: false, error: "Unknown remote policy." };
    else updates.remote_policy = patch.remote_policy;
  }
  if (patch.salary_min !== undefined) {
    if (patch.salary_min !== null && (!Number.isFinite(patch.salary_min) || patch.salary_min < 0))
      return { ok: false, error: "Salary min must be zero or more." };
    updates.salary_min_cents = patch.salary_min === null ? null : Math.round(patch.salary_min * 100);
  }
  if (patch.salary_max !== undefined) {
    if (patch.salary_max !== null && (!Number.isFinite(patch.salary_max) || patch.salary_max < 0))
      return { ok: false, error: "Salary max must be zero or more." };
    updates.salary_max_cents = patch.salary_max === null ? null : Math.round(patch.salary_max * 100);
  }
  if (
    updates.salary_min_cents != null &&
    updates.salary_max_cents != null &&
    (updates.salary_max_cents as number) < (updates.salary_min_cents as number)
  ) {
    return { ok: false, error: "Salary max must be at least salary min." };
  }
  if (patch.currency !== undefined) {
    const c = patch.currency.trim().toLowerCase();
    if (!c) return { ok: false, error: "Currency is required." };
    updates.currency = c;
  }
  if (patch.description !== undefined) updates.description = patch.description?.trim() || null;

  if (Object.keys(updates).length === 0) return { ok: true };

  const { error } = await companyOs.from("job_requisitions").update(updates).eq("id", jobReqId);
  if (error) return { ok: false, error: error.message };
  await recordAudit({
    table: "job_requisitions",
    recordId: jobReqId,
    operation: "update",
    actor: admin.email,
    newData: updates,
  });
  refresh(jobReqId);
  return { ok: true };
}

// ─── Close / reopen ──────────────────────────────────────────────────────────
// Closing takes an outcome (filled, closed, cancelled) and stamps closed_at.
// A non-open req drops off /careers automatically (the public listing requires
// status='open'), so is_public is left as the recruiter set it.
export async function closeJobReq(jobReqId: string, outcome: string): Promise<Result> {
  const admin = await requireAdmin();
  if (!CLOSE_OUTCOMES.has(outcome)) return { ok: false, error: "Pick an outcome (filled, closed, or cancelled)." };

  const updates = { status: outcome, closed_at: new Date().toISOString() };
  const { error } = await companyOs.from("job_requisitions").update(updates).eq("id", jobReqId);
  if (error) return { ok: false, error: error.message };
  await recordAudit({
    table: "job_requisitions",
    recordId: jobReqId,
    operation: "update",
    actor: admin.email,
    newData: updates,
  });
  refresh(jobReqId);
  return { ok: true };
}

export async function reopenJobReq(jobReqId: string): Promise<Result> {
  const admin = await requireAdmin();
  const updates = { status: "open", closed_at: null, opened_at: new Date().toISOString() };
  const { error } = await companyOs.from("job_requisitions").update(updates).eq("id", jobReqId);
  if (error) return { ok: false, error: error.message };
  await recordAudit({
    table: "job_requisitions",
    recordId: jobReqId,
    operation: "update",
    actor: admin.email,
    newData: updates,
  });
  refresh(jobReqId);
  return { ok: true };
}

// ─── Delete ──────────────────────────────────────────────────────────────────
// Permanent. Blocked while applications reference the req — close it instead;
// applicant history is part of the hiring record. An empty req's stages are
// removed first (they FK the req).
export async function deleteJobReq(jobReqId: string): Promise<Result> {
  const admin = await requireAdmin();

  const { count, error: cErr } = await companyOs
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("job_requisition_id", jobReqId);
  if (cErr) return { ok: false, error: cErr.message };
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `This req has ${count} application${count === 1 ? "" : "s"} — close it instead of deleting, so the hiring history stays intact.`,
    };
  }

  const { error: sErr } = await companyOs.from("application_stages").delete().eq("job_requisition_id", jobReqId);
  if (sErr) return { ok: false, error: sErr.message };

  const { error } = await companyOs.from("job_requisitions").delete().eq("id", jobReqId);
  if (error) return { ok: false, error: error.message };

  await recordAudit({
    table: "job_requisitions",
    recordId: jobReqId,
    operation: "delete",
    actor: admin.email,
    context: { via: "jobs_shelf" },
  });
  revalidatePath("/admin/talent/jobs");
  return { ok: true };
}
