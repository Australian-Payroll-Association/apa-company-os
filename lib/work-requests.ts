import { companyOs } from "@/lib/supabase";
import { getSiteOrigin } from "@/lib/site-origin";
import { workRequestPath } from "@/lib/admin/contractors";
import { pingOps, sendDecisionEmail } from "@/lib/contractor-notify";
import { runWorkRequestBilling } from "@/lib/admin/work-billing";

// Shared state machine for contractor work requests. Since portal clients can
// now originate requests (origin='portal') and decide estimates/work
// themselves, the transitions live here — one status guard, one event write,
// one contractor email per decision — and both the admin actions
// (app/admin/.../contractor-requests/actions.ts) and the portal helpers
// (lib/portal/work-requests.ts) call in with their own decider. Auth stays
// with the callers: requireAdmin() on one side, company-scope checks on the
// other. Plan: docs/plans/2026-07-18-client-work-requests.md

export type WorkRequestResult = { ok: true } | { ok: false; error: string };

// Who is making a decision. `email` lands in decided_by/accepted_by (the
// business record); `assumedBy` is set when an admin acts via portal Assume
// and is stamped on the event meta so the true operator stays recoverable.
export type WorkDecider = {
  actorType: "admin" | "client";
  email: string;
  assumedBy?: string | null;
};

export type LoadedWorkRequest = {
  id: string;
  person_id: string;
  title: string;
  status: string;
  access_token: string;
  origin: "admin" | "portal";
  client_company_id: string | null;
  requested_by_person_id: string | null;
  person: { full_name: string | null; email: string } | null;
};

export async function loadWorkRequest(id: string): Promise<LoadedWorkRequest | null> {
  const { data, error } = await companyOs
    .from("contractor_work_requests")
    .select(
      "id, person_id, title, status, access_token, origin, client_company_id, requested_by_person_id, people!person_id(full_name, email)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const people = data.people;
  const person = Array.isArray(people) ? people[0] ?? null : people;
  return { ...(data as Omit<LoadedWorkRequest, "person">), person };
}

export async function addWorkEvent(
  requestId: string,
  event: {
    actor_type: "admin" | "contractor" | "system" | "client";
    actor?: string | null;
    type: string;
    body?: string | null;
    meta?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await companyOs.from("contractor_work_events").insert({
    request_id: requestId,
    actor_type: event.actor_type,
    actor: event.actor ?? null,
    type: event.type,
    body: event.body ?? null,
    meta: event.meta ?? {},
  });
  if (error) console.error("[work-requests] event insert failed:", error.message);
}

function eventMeta(decider: WorkDecider): Record<string, unknown> {
  return decider.assumedBy ? { assumed_by: decider.assumedBy } : {};
}

const contractorUrl = (req: LoadedWorkRequest) => `${getSiteOrigin()}${workRequestPath(req.access_token)}`;

// Approve / reject / request changes on a submitted estimate. Every decision
// emails the contractor; "request changes" sends it back for a new estimate.
export async function applyEstimateDecision(
  req: LoadedWorkRequest,
  decision: "approved" | "rejected" | "changes_requested",
  decider: WorkDecider,
  note: string,
): Promise<WorkRequestResult> {
  if (req.status !== "estimate_submitted")
    return { ok: false, error: "Only submitted estimates can be decided." };
  if (decision !== "approved" && !note.trim())
    return { ok: false, error: "Add a note so the contractor knows why." };

  const { error } = await companyOs
    .from("contractor_work_requests")
    .update({
      status: decision,
      decided_by: decider.email,
      decided_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", req.id)
    .eq("status", "estimate_submitted");
  if (error) return { ok: false, error: error.message };

  const eventType =
    decision === "approved" ? "approved" : decision === "rejected" ? "rejected" : "info_requested";
  await addWorkEvent(req.id, {
    actor_type: decider.actorType,
    actor: decider.email,
    type: eventType,
    body: note.trim() || null,
    meta: eventMeta(decider),
  });

  if (req.person?.email) {
    await sendDecisionEmail({
      to: req.person.email,
      name: req.person.full_name,
      title: req.title,
      decision: decision === "changes_requested" ? "info_requested" : decision,
      note,
      url: contractorUrl(req),
    });
  }

  if (decider.actorType === "client") {
    await pingOps(
      `🧑‍💼 Client ${decision === "approved" ? "approved" : decision === "rejected" ? "declined" : "requested changes on"} the estimate for "${req.title}" (${decider.email}). Review: https://www.edge8.ai/admin/operations/contractor-requests`,
    );
  }

  return { ok: true };
}

// Accept submitted work (→ completed; portal-origin requests then get billed
// via runWorkRequestBilling) or send it back for revision (→ approved,
// contractor resubmits).
export async function applyWorkDecision(
  req: LoadedWorkRequest,
  decision: "accepted" | "revision",
  decider: WorkDecider,
  note: string,
): Promise<WorkRequestResult> {
  if (req.status !== "work_submitted")
    return { ok: false, error: "Only submitted work can be decided." };
  if (decision === "revision" && !note.trim())
    return { ok: false, error: "Add a note so the contractor knows what to revise." };

  const patch =
    decision === "accepted"
      ? { status: "completed", accepted_by: decider.email, accepted_at: new Date().toISOString() }
      : { status: "approved" };
  const { error } = await companyOs
    .from("contractor_work_requests")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", req.id)
    .eq("status", "work_submitted");
  if (error) return { ok: false, error: error.message };

  await addWorkEvent(req.id, {
    actor_type: decider.actorType,
    actor: decider.email,
    type: decision === "accepted" ? "accepted" : "info_requested",
    body: note.trim() || null,
    meta: eventMeta(decider),
  });

  if (req.person?.email) {
    await sendDecisionEmail({
      to: req.person.email,
      name: req.person.full_name,
      title: req.title,
      decision: decision === "accepted" ? "accepted" : "revision_requested",
      note,
      url: contractorUrl(req),
    });
  }

  if (decider.actorType === "client") {
    await pingOps(
      `🧑‍💼 Client ${decision === "accepted" ? "accepted the work on" : "requested a revision on"} "${req.title}" (${decider.email}). Review: https://www.edge8.ai/admin/operations/contractor-requests`,
    );
  }

  // Billing (QBO invoice at the contractor's billable rate) runs only for
  // portal-origin requests and never blocks the acceptance — every failure
  // path inside degrades to a manual_required/failed flag + accountant email.
  if (decision === "accepted") {
    await runWorkRequestBilling(req.id);
  }

  return { ok: true };
}

export async function applyCancel(
  req: LoadedWorkRequest,
  decider: WorkDecider,
  note: string,
): Promise<WorkRequestResult> {
  if (["rejected", "cancelled", "completed"].includes(req.status))
    return { ok: false, error: "This request is already closed." };

  const { error } = await companyOs
    .from("contractor_work_requests")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", req.id)
    .in("status", ["draft", "awaiting_estimate", "estimate_submitted", "changes_requested", "approved", "work_submitted"]);
  if (error) return { ok: false, error: error.message };

  await addWorkEvent(req.id, {
    actor_type: decider.actorType,
    actor: decider.email,
    type: "cancelled",
    body: note.trim() || null,
    meta: eventMeta(decider),
  });

  if (req.person?.email && req.status !== "draft") {
    await sendDecisionEmail({
      to: req.person.email,
      name: req.person.full_name,
      title: req.title,
      decision: "cancelled",
      note,
      url: contractorUrl(req),
    });
  }

  if (decider.actorType === "client") {
    await pingOps(
      `🧑‍💼 Client cancelled the work request "${req.title}" (${decider.email}).`,
    );
  }

  return { ok: true };
}
