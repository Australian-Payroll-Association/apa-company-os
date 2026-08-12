"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { companyOs, supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";
import { recordAudit } from "@/lib/admin/audit";
import type { AiScreenSummary } from "@/lib/resume-screen";

type Result = { ok: true } | { ok: false; error: string };

// Matches the applications_status_check constraint.
const APP_STATUSES = new Set([
  "active",
  "on_hold",
  "passive",
  "withdrawn",
  "hired",
  "rejected",
  "future_consideration",
]);
const MAX_RESUME_BYTES = 10 * 1024 * 1024;

export type StageOption = { id: string; name: string; isTerminal: boolean };
export type AppNote = {
  id: string;
  kind: string;
  body: string | null;
  occurredAt: string | null;
  author: string | null;
};

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

export type ApplicationExtras = {
  coverLetter: string | null;
  answers: { q: string; a: string }[];
  aiRating: number | null;
  aiStatus: string | null;
  aiError: string | null;
  aiScreenedAt: string | null;
  aiSummary: AiScreenSummary | null;
};

// Cover letter + free-form answers are large per-application columns shown only
// in the manage drawer, so they load lazily on open instead of shipping with the
// whole applications list (mirrors getApplicationStages / the lazy resume load).
export async function getApplicationExtras(
  applicationId: string,
): Promise<{ ok: true; extras: ApplicationExtras } | { ok: false; error: string }> {
  await requireAdmin();
  const { data, error } = await companyOs
    .from("applications")
    .select("cover_letter, answers, ai_rating, ai_screen_status, ai_screen_error, ai_screened_at, ai_summary")
    .eq("id", applicationId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    extras: {
      coverLetter: (data?.cover_letter as string | null) ?? null,
      answers: Array.isArray(data?.answers) ? (data.answers as { q: string; a: string }[]) : [],
      aiRating: (data?.ai_rating as number | null) ?? null,
      aiStatus: (data?.ai_screen_status as string | null) ?? null,
      aiError: (data?.ai_screen_error as string | null) ?? null,
      aiScreenedAt: (data?.ai_screened_at as string | null) ?? null,
      aiSummary: (data?.ai_summary as AiScreenSummary | null) ?? null,
    },
  };
}

// Only keys present in the patch are written. Rejection reason is its own field,
// distinct from the notes thread. Moving onto a terminal stage stamps decided_at
// (the recruiter still sets final status), mirroring moveApplicationStage.
export type ApplicationPatch = {
  status?: string;
  rating?: number | null;
  rejection_reason?: string | null;
  current_stage_id?: string | null;
  hr_assessment?: string | null;
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
  if (patch.hr_assessment !== undefined) {
    updates.hr_assessment = patch.hr_assessment?.trim() || null;
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
  revalidatePath(`/admin/talent/applications/${applicationId}`);
  return { ok: true };
}

// Soft-archive: a recruiter "deletes" a duplicate or wrong-person application by
// archiving it (reversible) rather than a hard delete, so nothing is lost. The
// list hides archived rows by default and the full-page profile offers Restore.
export async function archiveApplication(applicationId: string): Promise<Result> {
  const admin = await requireAdmin();
  const { error } = await companyOs
    .from("applications")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", applicationId);
  if (error) return { ok: false, error: error.message };
  await recordAudit({
    table: "applications",
    recordId: applicationId,
    operation: "update",
    actor: admin.email,
    newData: { archived_at: "now" },
  });
  revalidatePath("/admin/talent/applications");
  revalidatePath(`/admin/talent/applications/${applicationId}`);
  return { ok: true };
}

export async function unarchiveApplication(applicationId: string): Promise<Result> {
  const admin = await requireAdmin();
  const { error } = await companyOs
    .from("applications")
    .update({ archived_at: null })
    .eq("id", applicationId);
  if (error) return { ok: false, error: error.message };
  await recordAudit({
    table: "applications",
    recordId: applicationId,
    operation: "update",
    actor: admin.email,
    newData: { archived_at: null },
  });
  revalidatePath("/admin/talent/applications");
  revalidatePath(`/admin/talent/applications/${applicationId}`);
  return { ok: true };
}

// Profile edits from the application shelf. Identity fields (phone, LinkedIn)
// are person attributes and write to people; recruiting-profile fields
// (headline, title, portfolio, do_not_hire) live on the candidate_profile
// satellite and upsert there. do_not_hire is the recruiting flag ("would we
// look at them again?"), kept strictly separate from do_not_contact (consent
// opt-out), which this action never touches.
export type ApplicantProfilePatch = {
  headline?: string | null;
  current_title?: string | null;
  linkedin_url?: string | null;
  portfolio_url?: string | null;
  phone?: string | null;
  do_not_hire?: boolean;
  // Recruiter overrides for the fields the AI extracts from the resume. Shown in
  // place of the AI value once set; persist across the person's applications.
  english_proficiency?: string | null;
  salary_expectation_cents?: number | null;
  salary_expectation_currency?: string | null;
  notice_period?: string | null;
};

// applicationId, when passed, lets an edit to an AI-extracted field (english /
// salary / notice) log a training correction against that application's screen
// (see logScreenCorrections). Other fields ignore it.
export async function updateApplicantProfile(
  personId: string,
  patch: ApplicantProfilePatch,
  applicationId?: string,
): Promise<Result> {
  const admin = await requireAdmin();
  const personUpdates: Record<string, unknown> = {};
  const profileUpdates: Record<string, unknown> = {};

  if (patch.linkedin_url !== undefined) personUpdates.linkedin_url = patch.linkedin_url?.trim() || null;
  if (patch.phone !== undefined) personUpdates.phone = patch.phone?.trim() || null;
  if (patch.headline !== undefined) profileUpdates.headline = patch.headline?.trim() || null;
  if (patch.current_title !== undefined) profileUpdates.current_title = patch.current_title?.trim() || null;
  if (patch.portfolio_url !== undefined) profileUpdates.portfolio_url = patch.portfolio_url?.trim() || null;
  if (patch.do_not_hire !== undefined) profileUpdates.do_not_hire = patch.do_not_hire;
  if (patch.english_proficiency !== undefined)
    profileUpdates.english_proficiency = patch.english_proficiency?.trim() || null;
  if (patch.notice_period !== undefined) profileUpdates.notice_period = patch.notice_period?.trim() || null;
  if (patch.salary_expectation_cents !== undefined)
    profileUpdates.salary_expectation_cents =
      patch.salary_expectation_cents == null || Number.isNaN(patch.salary_expectation_cents)
        ? null
        : Math.max(0, Math.round(patch.salary_expectation_cents));
  if (patch.salary_expectation_currency !== undefined)
    profileUpdates.salary_expectation_currency = patch.salary_expectation_currency?.trim() || null;

  if (Object.keys(personUpdates).length === 0 && Object.keys(profileUpdates).length === 0) {
    return { ok: true };
  }

  if (Object.keys(personUpdates).length > 0) {
    const { error } = await companyOs.from("people").update(personUpdates).eq("id", personId);
    if (error) return { ok: false, error: error.message };
    await recordAudit({
      table: "people",
      recordId: personId,
      operation: "update",
      actor: admin.email,
      newData: personUpdates,
    });
  }

  if (Object.keys(profileUpdates).length > 0) {
    // Snapshot the prior AI-field values before the upsert overwrites them, so a
    // training correction only logs on a real change (not on an unchanged blur).
    const touchesAiField =
      Boolean(applicationId) && AI_PROFILE_FIELDS.some((f) => f in profileUpdates);
    let priorProfile: Record<string, unknown> | null = null;
    if (touchesAiField) {
      const { data } = await companyOs
        .from("candidate_profile")
        .select("english_proficiency, notice_period, salary_expectation_cents, salary_expectation_currency")
        .eq("person_id", personId)
        .maybeSingle();
      priorProfile = data ?? null;
    }

    const { error } = await companyOs.from("candidate_profile").upsert(
      { person_id: personId, ...profileUpdates, updated_at: new Date().toISOString() },
      { onConflict: "person_id" },
    );
    if (error) return { ok: false, error: error.message };
    await recordAudit({
      table: "candidate_profile",
      recordId: personId,
      operation: "update",
      actor: admin.email,
      newData: profileUpdates,
    });

    // Training log is best-effort: a failure here must never break the edit.
    if (touchesAiField && applicationId) {
      try {
        await logScreenCorrections({ applicationId, personId, actor: admin.email, profileUpdates, priorProfile });
      } catch (e) {
        console.error("screen correction log failed:", e);
      }
    }
  }

  revalidatePath("/admin/talent/applications");
  revalidatePath(`/admin/contacts/${personId}`);
  return { ok: true };
}

// The AI-extracted fields a recruiter can override. An edit to one of these logs
// a correction (see logScreenCorrections); the others are pure profile edits.
const AI_PROFILE_FIELDS = ["english_proficiency", "salary_expectation_cents", "notice_period"] as const;

// Log a training correction for each AI-extracted field the recruiter changed,
// snapshotting the AI's value NOW so the (ai, human) pair survives a later
// re-scan. Only real changes vs the prior stored value are logged. Best-effort:
// the caller swallows errors so a logging failure never blocks the profile save.
async function logScreenCorrections(args: {
  applicationId: string;
  personId: string;
  actor: string;
  profileUpdates: Record<string, unknown>;
  priorProfile: Record<string, unknown> | null;
}): Promise<void> {
  const { applicationId, personId, actor, profileUpdates, priorProfile } = args;
  const { data: app } = await companyOs
    .from("applications")
    .select("ai_model, ai_summary")
    .eq("id", applicationId)
    .maybeSingle();
  const ai = (app?.ai_summary ?? null) as AiScreenSummary | null;
  const aiModel = (app?.ai_model as string | null) ?? null;
  const prior = priorProfile ?? {};
  const base = { application_id: applicationId, person_id: personId, ai_model: aiModel, corrected_by: actor };
  const rows: Record<string, unknown>[] = [];

  const eng = profileUpdates.english_proficiency as string | null | undefined;
  if (eng && eng !== (prior.english_proficiency ?? null)) {
    rows.push({ ...base, field: "english", ai_value: ai?.english ?? null, human_value: eng });
  }
  const notice = profileUpdates.notice_period as string | null | undefined;
  if (notice && notice !== (prior.notice_period ?? null)) {
    rows.push({ ...base, field: "notice", ai_value: ai?.notice_period ?? null, human_value: notice });
  }
  const cents = profileUpdates.salary_expectation_cents as number | null | undefined;
  if (cents != null && cents !== (prior.salary_expectation_cents ?? null)) {
    const cur =
      (profileUpdates.salary_expectation_currency as string | null | undefined) ??
      (prior.salary_expectation_currency as string | null) ??
      "VND";
    rows.push({
      ...base,
      field: "salary",
      ai_value: ai?.salary_expectation ?? null,
      human_value: `${Math.round(cents / 100)} ${cur}`,
    });
  }

  if (rows.length) {
    const { error } = await companyOs.from("ai_screen_corrections").insert(rows);
    if (error) throw new Error(error.message);
  }
}

// Upload (or replace) the resume on an application. The file goes to the same
// private `resumes` bucket the careers form uses; the documents row hangs off
// the application. Replacing links a new document — the old file is kept for
// the audit trail rather than deleted.
export async function uploadApplicationResume(
  applicationId: string,
  formData: FormData,
): Promise<{ ok: true; documentId: string } | { ok: false; error: string }> {
  const admin = await requireAdmin();

  const file = formData.get("resume");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a file first." };
  if (file.size > MAX_RESUME_BYTES) return { ok: false, error: "Resume is too large (max 10 MB)." };

  const { data: app, error: aErr } = await companyOs
    .from("applications")
    .select("id, person_id, people!person_id(full_name, email)")
    .eq("id", applicationId)
    .maybeSingle();
  if (aErr || !app) return { ok: false, error: aErr?.message ?? "Application not found." };
  const person = Array.isArray(app.people) ? app.people[0] : app.people;
  const personName = person?.full_name || person?.email || "applicant";

  const filename = (file.name || "resume.pdf").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  const storagePath = `admin/${applicationId}/${randomUUID()}-${filename}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage.from("resumes").upload(storagePath, buffer, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (upErr) return { ok: false, error: `Upload failed: ${upErr.message}` };

  const { data: doc, error: dErr } = await companyOs
    .from("documents")
    .insert({
      title: `Resume — ${personName}`,
      storage_path: storagePath,
      mime_type: file.type || null,
      byte_size: file.size,
      entity_type: "application",
      entity_id: applicationId,
    })
    .select("id")
    .single();
  if (dErr || !doc) return { ok: false, error: dErr?.message ?? "Could not save the document." };

  const { error: linkErr } = await companyOs
    .from("applications")
    .update({ resume_document_id: doc.id })
    .eq("id", applicationId);
  if (linkErr) return { ok: false, error: linkErr.message };

  await recordAudit({
    table: "applications",
    recordId: applicationId,
    operation: "update",
    actor: admin.email,
    newData: { resume_document_id: doc.id, resume_file: filename },
  });
  revalidatePath("/admin/talent/applications");
  return { ok: true, documentId: doc.id };
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
    .select("id, kind, body, occurred_at, metadata")
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
    author: noteAuthor(r.metadata),
  }));
  return { ok: true, items };
}

// Author display for an interview-results entry. New entries stamp the acting
// admin's name/email into metadata (see addApplicationNote); older entries have
// no author and render without one.
function noteAuthor(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const m = metadata as Record<string, unknown>;
  const name = typeof m.author_name === "string" ? m.author_name.trim() : "";
  const email = typeof m.author_email === "string" ? m.author_email.trim() : "";
  return name || email || null;
}

export async function addApplicationNote(
  applicationId: string,
  body: string,
): Promise<{ ok: true; item: AppNote } | { ok: false; error: string }> {
  const admin = await requireAdmin();

  const text = body.trim();
  if (!text) return { ok: false, error: "Write something before saving." };

  // Copy the applicant's person onto the log entry so the note also lands on
  // the contact's 360 timeline (which filters interactions by person_id).
  const { data: app, error: aErr } = await companyOs
    .from("applications")
    .select("person_id")
    .eq("id", applicationId)
    .maybeSingle();
  if (aErr || !app) return { ok: false, error: aErr?.message ?? "Application not found." };

  // Interview Results are multi-author: stamp who wrote each entry so the thread
  // reads as attributed feedback. Admins may not have a people row, so the email
  // is the reliable identity; use their display name when one exists.
  const { data: person } = await companyOs
    .from("people")
    .select("display_name, full_name")
    .eq("email", admin.email)
    .maybeSingle();
  const authorName =
    (person?.display_name as string | null) || (person?.full_name as string | null) || null;

  const occurredAt = new Date().toISOString();
  const { data, error } = await companyOs
    .from("interactions")
    .insert({
      kind: "note",
      body: text,
      person_id: app.person_id,
      subject_type: "application",
      subject_id: applicationId,
      occurred_at: occurredAt,
      metadata: { source: "application_profile", author_email: admin.email, author_name: authorName },
    })
    .select("id, kind, body, occurred_at")
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/talent/applications");
  revalidatePath(`/admin/talent/applications/${applicationId}`);
  return {
    ok: true,
    item: {
      id: data.id as string,
      kind: (data.kind as string) ?? "note",
      body: (data.body as string | null) ?? null,
      occurredAt: (data.occurred_at as string | null) ?? occurredAt,
      author: authorName || admin.email,
    },
  };
}
