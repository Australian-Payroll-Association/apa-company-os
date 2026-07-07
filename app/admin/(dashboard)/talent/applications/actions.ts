"use server";

import { revalidatePath } from "next/cache";
import { companyOs } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";
import { recordAudit } from "@/lib/admin/audit";

type Result = { ok: true } | { ok: false; error: string };

// The real distinct statuses in the table today (checked against the DB).
const APP_STATUSES = new Set(["active", "on_hold", "hired", "rejected"]);

export type StageOption = { id: string; name: string; isTerminal: boolean };
export type AppNote = { id: string; kind: string; body: string | null; occurredAt: string | null };

// The hiring stages belong to the application's job req, so the drawer loads
// them lazily when it opens (the flat list spans many reqs).
export async function getApplicationStages(
  jobReqId: string,
): Promise<{ ok: true; stages: StageOption[] } | { ok: false; error: string }> {
  await requireAdmin();
  const { data, error } = await companyOs
    .from("application_stages")
    .select("id, name, is_terminal, position")
    .eq("job_requisition_id", jobReqId)
    .order("position");
  if (error) return { ok: false, error: error.message };
  const stages: StageOption[] = (data ?? []).map((s) => ({
    id: s.id as string,
    name: s.name as string,
    isTerminal: Boolean(s.is_terminal),
  }));
  return { ok: true, stages };
}

// Only keys present in the patch are written. Rejection reason is its own field,
// distinct from the notes thread. Moving onto a terminal stage stamps decided_at
// (the recruiter still sets final status), mirroring moveApplicationStage.
export type ApplicationPatch = {
  status?: string;
  rating?: number | null;
  rejection_reason?: string | null;
  current_stage_id?: string | null;
};

export async function updateApplication(applicationId: string, patch: ApplicationPatch): Promise<Result> {
  const admin = await requireAdmin();
  const updates: Record<string, unknown> = {};

  if (patch.status !== undefined) {
    if (!APP_STATUSES.has(patch.status)) return { ok: false, error: "Unknown status." };
    updates.status = patch.status;
  }
  if (patch.rating !== undefined) {
    if (patch.rating === null) updates.rating = null;
    else {
      const n = Math.round(patch.rating);
      if (n < 1 || n > 5) return { ok: false, error: "Rating must be between 1 and 5." };
      updates.rating = n;
    }
  }
  if (patch.rejection_reason !== undefined) {
    updates.rejection_reason = patch.rejection_reason?.trim() || null;
  }
  if (patch.current_stage_id !== undefined) {
    if (patch.current_stage_id === null) {
      updates.current_stage_id = null;
    } else {
      const { data: stage, error: stageErr } = await companyOs
        .from("application_stages")
        .select("is_terminal")
        .eq("id", patch.current_stage_id)
        .maybeSingle();
      if (stageErr || !stage) return { ok: false, error: stageErr?.message ?? "Unknown stage." };
      updates.current_stage_id = patch.current_stage_id;
      if (stage.is_terminal) updates.decided_at = new Date().toISOString();
    }
  }

  if (Object.keys(updates).length === 0) return { ok: true };

  const { error } = await companyOs.from("applications").update(updates).eq("id", applicationId);
  if (error) return { ok: false, error: error.message };
  await recordAudit({
    table: "applications",
    recordId: applicationId,
    operation: "update",
    actor: admin.email,
    newData: updates,
  });
  revalidatePath("/admin/talent/applications");
  return { ok: true };
}

// Application notes live in the shared interactions activity log, scoped with
// subject_type='application' + subject_id. Automatic 'status_change' rows are
// hidden so the thread reads as a human note history. Mirrors deal comms.
const AUTO_INTERACTION_KINDS = ["status_change"];

export async function getApplicationNotes(
  applicationId: string,
): Promise<{ ok: true; items: AppNote[] } | { ok: false; error: string }> {
  await requireAdmin();
  const { data, error } = await companyOs
    .from("interactions")
    .select("id, kind, body, occurred_at")
    .eq("subject_type", "application")
    .eq("subject_id", applicationId)
    .not("kind", "in", `(${AUTO_INTERACTION_KINDS.join(",")})`)
    .order("occurred_at", { ascending: false })
    .limit(200);
  if (error) return { ok: false, error: error.message };
  const items: AppNote[] = (data ?? []).map((r) => ({
    id: r.id as string,
    kind: (r.kind as string) ?? "note",
    body: (r.body as string | null) ?? null,
    occurredAt: (r.occurred_at as string | null) ?? null,
  }));
  return { ok: true, items };
}

export async function addApplicationNote(
  applicationId: string,
  body: string,
): Promise<{ ok: true; item: AppNote } | { ok: false; error: string }> {
  await requireAdmin();

  const text = body.trim();
  if (!text) return { ok: false, error: "Write something before saving." };

  // Copy the candidate's person onto the log entry so the note also lands on the
  // contact's 360 timeline (which filters interactions by person_id).
  const { data: app, error: aErr } = await companyOs
    .from("applications")
    .select("candidate_id, candidates(person_id)")
    .eq("id", applicationId)
    .maybeSingle();
  if (aErr || !app) return { ok: false, error: aErr?.message ?? "Application not found." };
  const cand = Array.isArray(app.candidates) ? app.candidates[0] : app.candidates;
  const personId = (cand?.person_id as string | null) ?? null;

  const occurredAt = new Date().toISOString();
  const { data, error } = await companyOs
    .from("interactions")
    .insert({
      kind: "note",
      body: text,
      person_id: personId,
      subject_type: "application",
      subject_id: applicationId,
      occurred_at: occurredAt,
      metadata: { source: "application_drawer" },
    })
    .select("id, kind, body, occurred_at")
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/talent/applications");
  return {
    ok: true,
    item: {
      id: data.id as string,
      kind: (data.kind as string) ?? "note",
      body: (data.body as string | null) ?? null,
      occurredAt: (data.occurred_at as string | null) ?? occurredAt,
    },
  };
}
