"use server";

import { revalidatePath } from "next/cache";
import { companyOs } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";
import { promotePersonToLead, recordTransition } from "@/lib/lifecycle";
import { recordAudit } from "@/lib/admin/audit";
import { guardedDelete } from "@/lib/admin/mutations";

type Result = { ok: true } | { ok: false; error: string };

const DISQUALIFY_REASONS = new Set([
  "no_budget",
  "no_need",
  "bad_timing",
  "no_authority",
  "unresponsive",
  "competitor",
  "not_icp",
  "other",
]);

function refresh() {
  revalidatePath("/admin/revenue/leads");
  revalidatePath("/admin/contacts");
}

export async function promoteLead(personId: string): Promise<Result> {
  await requireAdmin();
  const r = await promotePersonToLead(personId, { reason: "promoted_manually" });
  if (!r.ok) return r;
  refresh();
  return { ok: true };
}

// Safe exit: take the person off the SDR queue (into nurture) without erasing
// anything. The person stays on /admin/contacts. Distinct from Delete person.
export async function removeFromQueue(personId: string): Promise<Result> {
  const admin = await requireAdmin();

  const { data: person, error: pErr } = await companyOs
    .from("people")
    .select("lifecycle_stage, lead_status")
    .eq("id", personId)
    .maybeSingle();
  if (pErr || !person) return { ok: false, error: pErr?.message ?? "Person not found." };

  const { error } = await companyOs
    .from("people")
    .update({ lead_status: "nurture", lead_sla_due_at: null })
    .eq("id", personId);
  if (error) return { ok: false, error: error.message };

  await recordTransition({
    personId,
    fromStage: person.lifecycle_stage,
    toStage: person.lifecycle_stage,
    fromStatus: person.lead_status,
    toStatus: "nurture",
    reason: "removed_from_queue",
  });
  await recordAudit({
    table: "people",
    recordId: personId,
    operation: "update",
    actor: admin.email,
    context: { action: "removed_from_queue" },
  });
  refresh();
  return { ok: true };
}

// Destructive: permanently erase the person (GDPR), guarded by the schema's
// foreign keys. Clearly separated from the safe "remove from queue".
export async function deleteLeadPerson(personId: string): Promise<Result> {
  const admin = await requireAdmin();
  const r = await guardedDelete("people", personId, admin.email, { via: "leads" });
  if (r.ok) refresh();
  return r;
}

// Log an SDR call attempt: an interactions row + attempt counter. First
// attempt clears the speed-to-lead SLA and moves new → attempting.
export async function logCall(personId: string, note: string): Promise<Result> {
  await requireAdmin();

  const { data: person, error: pErr } = await companyOs
    .from("people")
    .select("lead_status, lead_attempt_count")
    .eq("id", personId)
    .maybeSingle();
  if (pErr || !person) return { ok: false, error: pErr?.message ?? "Person not found." };

  const { error: iErr } = await companyOs.from("interactions").insert({
    kind: "call",
    subject: "SDR call attempt",
    body: note || null,
    person_id: personId,
    occurred_at: new Date().toISOString(),
    metadata: { source: "leads_queue" },
  });
  if (iErr) return { ok: false, error: iErr.message };

  const updates: Record<string, unknown> = {
    lead_attempt_count: (person.lead_attempt_count ?? 0) + 1,
    lead_sla_due_at: null,
  };
  if (person.lead_status === "new") updates.lead_status = "attempting";

  const { error: uErr } = await companyOs.from("people").update(updates).eq("id", personId);
  if (uErr) return { ok: false, error: uErr.message };

  if (person.lead_status === "new") {
    await recordTransition({
      personId,
      fromStatus: "new",
      toStatus: "attempting",
      reason: "call_logged",
    });
  }
  refresh();
  return { ok: true };
}

export async function markConnected(personId: string): Promise<Result> {
  await requireAdmin();

  const { data: person, error: pErr } = await companyOs
    .from("people")
    .select("lead_status")
    .eq("id", personId)
    .maybeSingle();
  if (pErr || !person) return { ok: false, error: pErr?.message ?? "Person not found." };
  if (person.lead_status === "connected") return { ok: true };

  const { error } = await companyOs
    .from("people")
    .update({ lead_status: "connected", lead_sla_due_at: null })
    .eq("id", personId);
  if (error) return { ok: false, error: error.message };

  await recordTransition({
    personId,
    fromStatus: person.lead_status,
    toStatus: "connected",
    reason: "connected",
  });
  refresh();
  return { ok: true };
}

export async function saveQualification(
  personId: string,
  fields: {
    goal: string;
    plan: string;
    challenge: string;
    timeline: string;
    budget: string;
    authority: string;
  },
): Promise<Result> {
  await requireAdmin();

  const clean = Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [k, v.trim() || null]),
  );
  const { error } = await companyOs
    .from("person_qualifications")
    .upsert({ person_id: personId, ...clean }, { onConflict: "person_id" });
  if (error) return { ok: false, error: error.message };

  refresh();
  return { ok: true };
}

// Enumerated exit. mode 'nurture' keeps the person warm for re-engagement;
// 'unqualified' is a hard no. Either way the person stays and the transition
// log keeps this cycle queryable.
export async function disqualifyLead(
  personId: string,
  reason: string,
  mode: "unqualified" | "nurture",
  note: string,
): Promise<Result> {
  await requireAdmin();
  if (!DISQUALIFY_REASONS.has(reason)) return { ok: false, error: "Pick a reason." };

  const { data: person, error: pErr } = await companyOs
    .from("people")
    .select("lifecycle_stage, lead_status")
    .eq("id", personId)
    .maybeSingle();
  if (pErr || !person) return { ok: false, error: pErr?.message ?? "Person not found." };

  const { error } = await companyOs
    .from("people")
    .update({
      lead_status: mode,
      lead_sla_due_at: null,
      disqualified_reason: reason,
    })
    .eq("id", personId);
  if (error) return { ok: false, error: error.message };

  await recordTransition({
    personId,
    fromStage: person.lifecycle_stage,
    toStage: person.lifecycle_stage,
    fromStatus: person.lead_status,
    toStatus: mode,
    reason,
    note: note.trim() || null,
  });
  refresh();
  return { ok: true };
}

// The SDR→closer handoff: create a pending deal on the default pipeline's
// first stage and move the person to opportunity/open_deal. The closer
// accepts or rejects it on the Deals board.
export async function bookMeetingAndHandOff(personId: string): Promise<Result> {
  await requireAdmin();

  const { data: person, error: pErr } = await companyOs
    .from("people")
    .select(
      "full_name, email, lifecycle_stage, lead_status, person_companies(company_id, companies(name))",
    )
    .eq("id", personId)
    .maybeSingle();
  if (pErr || !person) return { ok: false, error: pErr?.message ?? "Person not found." };

  const { data: pipeline, error: plErr } = await companyOs
    .from("pipelines")
    .select("id, pipeline_stages(id, position)")
    .eq("active", true)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (plErr || !pipeline) return { ok: false, error: plErr?.message ?? "No active pipeline." };

  const stages = (pipeline.pipeline_stages ?? []) as { id: string; position: number }[];
  const firstStage = [...stages].sort((a, b) => a.position - b.position)[0];
  if (!firstStage) return { ok: false, error: "Pipeline has no stages." };

  const pcs = (person.person_companies ?? []) as {
    company_id: string;
    companies: { name: string | null } | { name: string | null }[] | null;
  }[];
  const companyId = pcs[0]?.company_id ?? null;

  const name = person.full_name || person.email;
  const { error: dErr } = await companyOs.from("deals").insert({
    title: `${name} — SDR handoff`,
    person_id: personId,
    company_id: companyId,
    pipeline_id: pipeline.id,
    stage_id: firstStage.id,
    status: "open",
    source: "sdr_handoff",
    handoff_status: "pending",
  });
  if (dErr) return { ok: false, error: dErr.message };

  const { error: uErr } = await companyOs
    .from("people")
    .update({
      lifecycle_stage: "opportunity",
      lead_status: "open_deal",
      lead_sla_due_at: null,
    })
    .eq("id", personId);
  if (uErr) return { ok: false, error: uErr.message };

  await recordTransition({
    personId,
    fromStage: person.lifecycle_stage,
    toStage: "opportunity",
    fromStatus: person.lead_status,
    toStatus: "open_deal",
    reason: "meeting_booked",
  });

  refresh();
  revalidatePath("/admin/revenue/deals");
  return { ok: true };
}
