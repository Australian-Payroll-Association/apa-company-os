"use server";

import { revalidatePath } from "next/cache";
import { companyOs } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";
import { recordAudit } from "@/lib/admin/audit";
import { newTicketCode } from "@/lib/events-server";
import { getSiteOrigin } from "@/lib/site-origin";
import { workRequestPath } from "@/lib/admin/contractors";
import { sendDecisionEmail, sendWorkRequestEmail } from "@/lib/contractor-notify";
import type { RequestEventRow } from "./request-shared";

type Result = { ok: true } | { ok: false; error: string };

function refresh() {
  revalidatePath("/admin/operations/contractor-requests");
}

async function loadRequest(id: string) {
  const { data, error } = await companyOs
    .from("contractor_work_requests")
    .select("id, person_id, title, status, access_token, people!person_id(full_name, email)")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const people = data.people;
  const person = Array.isArray(people) ? people[0] ?? null : people;
  return { ...data, person };
}

async function addEvent(
  requestId: string,
  event: { actor_type: "admin" | "contractor" | "system"; actor?: string | null; type: string; body?: string | null; meta?: Record<string, unknown> },
) {
  const { error } = await companyOs.from("contractor_work_events").insert({
    request_id: requestId,
    actor_type: event.actor_type,
    actor: event.actor ?? null,
    type: event.type,
    body: event.body ?? null,
    meta: event.meta ?? {},
  });
  if (error) console.error("[contractor-requests] event insert failed:", error.message);
}

// Create a work request and (by default) send it straight to the contractor.
export async function createWorkRequest(input: {
  personId: string;
  title: string;
  brief: string;
  send?: boolean;
}): Promise<Result & { id?: string }> {
  const admin = await requireAdmin();

  const title = input.title?.trim();
  const brief = input.brief?.trim();
  if (!input.personId) return { ok: false, error: "Pick a contractor." };
  if (!title) return { ok: false, error: "Title is required." };
  if (!brief) return { ok: false, error: "Brief is required." };

  // Confirm the person is an active contract team member.
  const { data: tm } = await companyOs
    .from("team_members")
    .select("id, status, employment_type")
    .eq("person_id", input.personId)
    .maybeSingle();
  if (!tm || tm.employment_type !== "contract" || tm.status !== "active") {
    return { ok: false, error: "That person is not an active contractor." };
  }

  const send = input.send !== false;
  const row = {
    person_id: input.personId,
    title,
    brief,
    access_token: newTicketCode(16),
    status: send ? "awaiting_estimate" : "draft",
    created_by: admin.email,
  };
  const { data, error } = await companyOs
    .from("contractor_work_requests")
    .insert(row)
    .select("id, access_token")
    .single();
  if (error) return { ok: false, error: error.message };

  await addEvent(data.id, { actor_type: "admin", actor: admin.email, type: "created", body: brief });
  await recordAudit({
    table: "contractor_work_requests",
    recordId: data.id,
    operation: "insert",
    actor: admin.email,
    newData: { person_id: input.personId, title, status: row.status },
  });

  if (send) {
    const { data: person } = await companyOs
      .from("people")
      .select("full_name, email")
      .eq("id", input.personId)
      .maybeSingle();
    if (person?.email) {
      await sendWorkRequestEmail({
        to: person.email,
        name: person.full_name,
        title,
        brief,
        url: `${getSiteOrigin()}${workRequestPath(data.access_token)}`,
      });
    }
  }

  refresh();
  return { ok: true, id: data.id };
}

// Send (or resend) the request email. Draft → awaiting_estimate.
export async function sendWorkRequest(id: string): Promise<Result> {
  const admin = await requireAdmin();
  const req = await loadRequest(id);
  if (!req) return { ok: false, error: "Request not found." };
  if (["rejected", "cancelled", "completed"].includes(req.status))
    return { ok: false, error: "This request is closed." };

  if (req.status === "draft") {
    const { error } = await companyOs
      .from("contractor_work_requests")
      .update({ status: "awaiting_estimate", updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
  }

  if (!req.person?.email) return { ok: false, error: "Contractor has no email on file." };
  const sent = await sendWorkRequestEmail({
    to: req.person.email,
    name: req.person.full_name,
    title: req.title,
    brief: "",
    url: `${getSiteOrigin()}${workRequestPath(req.access_token)}`,
  });
  if (!sent) return { ok: false, error: "Email send failed (check RESEND_API_KEY)." };

  refresh();
  return { ok: true };
}

// Approve / reject / request changes on a submitted estimate. Every decision
// emails the contractor; "request changes" sends it back for a new estimate.
export async function decideEstimate(
  id: string,
  decision: "approved" | "rejected" | "changes_requested",
  note: string,
): Promise<Result> {
  const admin = await requireAdmin();
  const req = await loadRequest(id);
  if (!req) return { ok: false, error: "Request not found." };
  if (req.status !== "estimate_submitted")
    return { ok: false, error: "Only submitted estimates can be decided." };
  if (decision !== "approved" && !note.trim())
    return { ok: false, error: "Add a note so the contractor knows why." };

  const { error } = await companyOs
    .from("contractor_work_requests")
    .update({
      status: decision,
      decided_by: admin.email,
      decided_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  const eventType =
    decision === "approved" ? "approved" : decision === "rejected" ? "rejected" : "info_requested";
  await addEvent(id, { actor_type: "admin", actor: admin.email, type: eventType, body: note.trim() || null });
  await recordAudit({
    table: "contractor_work_requests",
    recordId: id,
    operation: "update",
    actor: admin.email,
    newData: { status: decision, note: note.trim() || null },
  });

  if (req.person?.email) {
    await sendDecisionEmail({
      to: req.person.email,
      name: req.person.full_name,
      title: req.title,
      decision: decision === "changes_requested" ? "info_requested" : decision,
      note,
      url: `${getSiteOrigin()}${workRequestPath(req.access_token)}`,
    });
  }

  refresh();
  return { ok: true };
}

// Accept submitted work (→ completed, payable at month end) or send it back
// for revision (→ approved, contractor resubmits).
export async function decideWork(id: string, decision: "accepted" | "revision", note: string): Promise<Result> {
  const admin = await requireAdmin();
  const req = await loadRequest(id);
  if (!req) return { ok: false, error: "Request not found." };
  if (req.status !== "work_submitted")
    return { ok: false, error: "Only submitted work can be decided." };
  if (decision === "revision" && !note.trim())
    return { ok: false, error: "Add a note so the contractor knows what to revise." };

  const patch =
    decision === "accepted"
      ? { status: "completed", accepted_by: admin.email, accepted_at: new Date().toISOString() }
      : { status: "approved" };
  const { error } = await companyOs
    .from("contractor_work_requests")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  await addEvent(id, {
    actor_type: "admin",
    actor: admin.email,
    type: decision === "accepted" ? "accepted" : "info_requested",
    body: note.trim() || null,
  });
  await recordAudit({
    table: "contractor_work_requests",
    recordId: id,
    operation: "update",
    actor: admin.email,
    newData: { status: patch.status, note: note.trim() || null },
  });

  if (req.person?.email) {
    await sendDecisionEmail({
      to: req.person.email,
      name: req.person.full_name,
      title: req.title,
      decision: decision === "accepted" ? "accepted" : "revision_requested",
      note,
      url: `${getSiteOrigin()}${workRequestPath(req.access_token)}`,
    });
  }

  refresh();
  return { ok: true };
}

export async function cancelWorkRequest(id: string, note: string): Promise<Result> {
  const admin = await requireAdmin();
  const req = await loadRequest(id);
  if (!req) return { ok: false, error: "Request not found." };
  if (["rejected", "cancelled", "completed"].includes(req.status))
    return { ok: false, error: "This request is already closed." };

  const { error } = await companyOs
    .from("contractor_work_requests")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  await addEvent(id, { actor_type: "admin", actor: admin.email, type: "cancelled", body: note.trim() || null });
  await recordAudit({
    table: "contractor_work_requests",
    recordId: id,
    operation: "update",
    actor: admin.email,
    newData: { status: "cancelled" },
  });

  if (req.person?.email && req.status !== "draft") {
    await sendDecisionEmail({
      to: req.person.email,
      name: req.person.full_name,
      title: req.title,
      decision: "cancelled",
      note,
      url: `${getSiteOrigin()}${workRequestPath(req.access_token)}`,
    });
  }

  refresh();
  return { ok: true };
}

// Timeline for the shelf (lazy-loaded on open).
export async function listRequestEvents(requestId: string): Promise<RequestEventRow[]> {
  await requireAdmin();
  const { data, error } = await companyOs
    .from("contractor_work_events")
    .select("id, actor_type, actor, type, body, meta, created_at")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[contractor-requests] events load failed:", error.message);
    return [];
  }
  return (data ?? []) as RequestEventRow[];
}
