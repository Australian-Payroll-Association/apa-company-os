"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { discoveryDb } from "@/lib/discovery/data";
import { sendClientInvite } from "@/lib/discovery/notify";
import { getSiteOrigin } from "@/lib/site-origin";

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

export async function resendInvite(engagementId: string): Promise<Result> {
  const admin = await requireAdmin();
  const { data: engagement, error } = await discoveryDb
    .from("discovery_engagements")
    .select("client_name, client_email, client_contact_name, consultant_email, access_token")
    .eq("id", engagementId)
    .maybeSingle();
  if (error || !engagement) return { ok: false, error: error?.message ?? "Review not found." };
  if (!engagement.client_email) return { ok: false, error: "No client email is on file for this review." };

  const sent = await sendClientInvite({
    engagementId,
    clientName: engagement.client_name,
    clientEmail: engagement.client_email,
    contactName: engagement.client_contact_name,
    senderEmail: engagement.consultant_email,
    discoveryUrl: `${getSiteOrigin()}/discovery/${engagement.access_token}`,
  });
  await discoveryDb.from("discovery_events").insert({
    engagement_id: engagementId,
    actor_type: "admin",
    actor: admin.email,
    type: "note",
    body: sent ? `Invite re-emailed to ${engagement.client_email}.` : `Resend to ${engagement.client_email} failed.`,
  });
  revalidatePath(`/admin/discovery/${engagementId}`);
  if (!sent) return { ok: false, error: `Couldn't send — the address may not be reachable, or the sender domain isn't verified yet.` };
  return { ok: true };
}
