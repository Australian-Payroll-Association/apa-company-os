"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { discoveryDb } from "@/lib/discovery/data";

type Result = { ok: true } | { ok: false; error: string };

export type FindingInput = {
  status: string;
  priority: string;
  owner: string;
  targetDate: string;
  notes: string;
};

export async function saveFinding(engagementId: string, questionId: string, input: FindingInput): Promise<Result> {
  const admin = await requireAdmin();
  const { error } = await discoveryDb.from("discovery_findings").upsert(
    {
      engagement_id: engagementId,
      question_id: questionId,
      status: input.status,
      priority: input.priority,
      owner: input.owner || null,
      target_date: input.targetDate || null,
      notes: input.notes || null,
      created_by: admin.email,
    },
    { onConflict: "engagement_id,question_id" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/discovery/${engagementId}`);
  return { ok: true };
}

export async function deleteFinding(engagementId: string, questionId: string): Promise<Result> {
  await requireAdmin();
  const { error } = await discoveryDb
    .from("discovery_findings")
    .delete()
    .eq("engagement_id", engagementId)
    .eq("question_id", questionId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/discovery/${engagementId}`);
  return { ok: true };
}

export async function addEvidenceItem(engagementId: string, name: string): Promise<Result> {
  await requireAdmin();
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Name is required." };
  const { error } = await discoveryDb.from("discovery_evidence_items").insert({
    engagement_id: engagementId,
    name: trimmed,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/discovery/${engagementId}`);
  return { ok: true };
}

export async function updateEvidenceItem(id: string, engagementId: string, fields: { name?: string; status?: string }): Promise<Result> {
  await requireAdmin();
  const { error } = await discoveryDb
    .from("discovery_evidence_items")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/discovery/${engagementId}`);
  return { ok: true };
}

export async function deleteEvidenceItem(id: string, engagementId: string): Promise<Result> {
  await requireAdmin();
  const { error } = await discoveryDb.from("discovery_evidence_items").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/discovery/${engagementId}`);
  return { ok: true };
}
