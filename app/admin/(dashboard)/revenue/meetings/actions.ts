"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { waitUntil } from "@vercel/functions";
import { companyOs, supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";
import { recordAudit } from "@/lib/admin/audit";
import { extractTranscript, MEETING_MAX_BYTES } from "@/lib/meeting-extract";
import { summarizeMeeting } from "@/lib/ai/meeting-summary";

// Admin meeting-notes actions. Upload (paste OR file) creates one row with the
// raw transcript, then kicks off AI summarization fire-and-forget. Edits, the
// publish toggle, archive, and AI retry follow the CRM action conventions
// (requireAdmin + recordAudit + revalidate).

const BUCKET = "meeting-transcripts";

type CreateResult = { ok: true; id: string } | { ok: false; error: string };

function refresh(companyId: string, meetingId?: string) {
  revalidatePath("/admin/revenue/meetings");
  if (meetingId) revalidatePath(`/admin/revenue/meetings/${meetingId}`);
  revalidatePath(`/admin/revenue/companies/${companyId}`);
  revalidatePath("/portal/meetings");
}

// Store the original uploaded file so the source is retained; the transcript
// text itself lives on the row. Path keyed by upload id under the company.
async function storeSourceFile(
  companyId: string,
  file: File,
): Promise<{ path: string; name: string } | null> {
  const safeName = (file.name || "transcript.txt").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  const path = `company/${companyId}/${randomUUID()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) return null; // Retaining the original is best-effort; the text still lands.
  return { path, name: safeName };
}

export async function createMeeting(formData: FormData): Promise<CreateResult> {
  const admin = await requireAdmin();

  const companyId = String(formData.get("companyId") || "").trim();
  if (!companyId) return { ok: false, error: "Choose a client first." };

  const manualDateRaw = String(formData.get("meetingDate") || "").trim();
  const manualDate = /^\d{4}-\d{2}-\d{2}$/.test(manualDateRaw) ? manualDateRaw : null;
  const manualTitle = String(formData.get("title") || "").trim();

  const pasted = String(formData.get("transcript") || "").trim();
  const file = formData.get("file");
  const hasFile = file instanceof File && file.size > 0;

  let transcript = pasted;
  let source: { path: string; name: string } | null = null;

  if (hasFile) {
    const f = file as File;
    if (f.size > MEETING_MAX_BYTES) return { ok: false, error: "File is too large (max 10 MB)." };
    const extracted = await extractTranscript(f);
    if (!extracted.ok) return { ok: false, error: extracted.error };
    transcript = extracted.text;
    source = await storeSourceFile(companyId, f);
  }

  if (!transcript.trim()) {
    return { ok: false, error: "Paste a transcript or upload a file." };
  }

  const { data, error } = await companyOs
    .from("meeting_notes")
    .insert({
      company_id: companyId,
      meeting_date: manualDate,
      title: manualTitle || null,
      transcript,
      source_file_path: source?.path ?? null,
      source_file_name: source?.name ?? null,
      ai_status: "pending",
      created_by: admin.email,
    })
    .select("id")
    .single();

  if (error || !data) {
    // Don't orphan an uploaded object if the row insert failed.
    if (source) await supabase.storage.from(BUCKET).remove([source.path]);
    return { ok: false, error: error?.message ?? "Could not save the meeting." };
  }

  await recordAudit({ table: "meeting_notes", recordId: data.id, operation: "insert", actor: admin.email });
  waitUntil(summarizeMeeting(data.id));
  refresh(companyId, data.id);
  return { ok: true, id: data.id };
}

type ActionResult = { ok: true } | { ok: false; error: string };

async function loadMeeting(id: string) {
  const { data } = await companyOs
    .from("meeting_notes")
    .select("id, company_id, published_at")
    .eq("id", id)
    .maybeSingle();
  return data as { id: string; company_id: string; published_at: string | null } | null;
}

export async function updateMeeting(
  id: string,
  fields: { title: string; meetingDate: string; attendees: string; summary: string },
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const meeting = await loadMeeting(id);
  if (!meeting) return { ok: false, error: "Meeting not found." };

  const meetingDate = /^\d{4}-\d{2}-\d{2}$/.test(fields.meetingDate.trim())
    ? fields.meetingDate.trim()
    : null;
  const attendees = fields.attendees
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);

  const { error } = await companyOs
    .from("meeting_notes")
    .update({
      title: fields.title.trim() || null,
      meeting_date: meetingDate,
      attendees,
      ai_summary: fields.summary.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  await recordAudit({ table: "meeting_notes", recordId: id, operation: "update", actor: admin.email });
  refresh(meeting.company_id, id);
  return { ok: true };
}

export async function setMeetingPublished(id: string, published: boolean): Promise<ActionResult> {
  const admin = await requireAdmin();
  const meeting = await loadMeeting(id);
  if (!meeting) return { ok: false, error: "Meeting not found." };

  const { error } = await companyOs
    .from("meeting_notes")
    .update({ published_at: published ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  await recordAudit({
    table: "meeting_notes",
    recordId: id,
    operation: "update",
    actor: admin.email,
    context: { published },
  });
  refresh(meeting.company_id, id);
  return { ok: true };
}

// Hard delete: remove the row and its uploaded source file. Meeting notes are
// often created by mistake (wrong transcript), and there is nothing worth
// keeping, so this is a real delete rather than a soft archive. The audit_log
// row records that the deletion happened + who, not the content.
export async function deleteMeeting(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();

  const { data } = await companyOs
    .from("meeting_notes")
    .select("id, company_id, source_file_path")
    .eq("id", id)
    .maybeSingle();
  const meeting = data as { id: string; company_id: string; source_file_path: string | null } | null;
  if (!meeting) return { ok: false, error: "Meeting not found." };

  const { error } = await companyOs.from("meeting_notes").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  if (meeting.source_file_path) {
    await supabase.storage.from(BUCKET).remove([meeting.source_file_path]);
  }
  await recordAudit({ table: "meeting_notes", recordId: id, operation: "delete", actor: admin.email });
  refresh(meeting.company_id, id);
  return { ok: true };
}

export async function retryMeetingSummary(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const meeting = await loadMeeting(id);
  if (!meeting) return { ok: false, error: "Meeting not found." };

  await companyOs
    .from("meeting_notes")
    .update({ ai_status: "pending", ai_error: null, updated_at: new Date().toISOString() })
    .eq("id", id);
  waitUntil(summarizeMeeting(id));
  refresh(meeting.company_id, id);
  return { ok: true };
}
