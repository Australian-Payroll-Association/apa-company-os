"use server";

import { revalidatePath } from "next/cache";
import { companyOs } from "@/lib/supabase";
import { pingOps } from "@/lib/contractor-notify";

// Contractor-facing actions on the public /work/[token] page. No admin gate:
// the opaque access_token IS the credential (same bearer-link model as event
// tickets). Every action re-validates the token and the allowed status server
// side, so a stale form can't force an illegal transition.

type Result = { ok: true } | { ok: false; error: string };

async function loadByToken(token: string) {
  if (!token || token.length < 8) return null;
  const { data, error } = await companyOs
    .from("contractor_work_requests")
    .select("id, title, status, people!person_id(full_name, email)")
    .eq("access_token", token)
    .maybeSingle();
  if (error || !data) return null;
  const people = data.people;
  const person = Array.isArray(people) ? people[0] ?? null : people;
  return { ...data, person };
}

function parseHours(v: unknown, label: string, { allowZero = false } = {}): number | { error: string } {
  const n = Number(v);
  if (!Number.isFinite(n)) return { error: `${label} must be a number.` };
  if (n < 0 || (!allowZero && n <= 0)) return { error: `${label} must be greater than zero.` };
  if (n > 1000) return { error: `${label} looks too large.` };
  return Math.round(n * 100) / 100;
}

export async function submitEstimate(input: {
  token: string;
  estimatedHours: number;
  plan: string;
  website?: string; // honeypot
}): Promise<Result> {
  if (input.website) return { ok: true }; // bot: pretend success, write nothing

  const req = await loadByToken(input.token);
  if (!req) return { ok: false, error: "This link is not valid." };
  if (!["awaiting_estimate", "changes_requested"].includes(req.status))
    return { ok: false, error: "This request is not open for an estimate right now." };

  const hours = parseHours(input.estimatedHours, "Estimated hours");
  if (typeof hours !== "number") return { ok: false, error: hours.error };
  const plan = input.plan?.trim();
  if (!plan) return { ok: false, error: "Describe your plan to complete the work." };

  const resubmit = req.status === "changes_requested";
  const { error } = await companyOs
    .from("contractor_work_requests")
    .update({
      status: "estimate_submitted",
      estimated_hours: hours,
      plan_text: plan,
      estimate_submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", req.id);
  if (error) return { ok: false, error: "Something went wrong — please try again." };

  await companyOs.from("contractor_work_events").insert({
    request_id: req.id,
    actor_type: "contractor",
    actor: req.person?.email ?? null,
    type: resubmit ? "estimate_resubmitted" : "estimate_submitted",
    body: plan,
    meta: { estimated_hours: hours },
  });

  await pingOps(
    `📝 Contractor estimate ${resubmit ? "resubmitted" : "submitted"}: "${req.title}" — ${
      req.person?.full_name ?? req.person?.email ?? "unknown"
    }, ${hours}h. Review: https://www.edge8.ai/admin/operations/contractor-requests`,
  );

  revalidatePath(`/work/${input.token}`);
  return { ok: true };
}

export async function submitWork(input: {
  token: string;
  actualHours: number;
  overtimeHours: number;
  summary: string;
  link: string;
  website?: string; // honeypot
}): Promise<Result> {
  if (input.website) return { ok: true };

  const req = await loadByToken(input.token);
  if (!req) return { ok: false, error: "This link is not valid." };
  if (req.status !== "approved")
    return { ok: false, error: "This request is not open for a work submission right now." };

  const hours = parseHours(input.actualHours, "Actual hours");
  if (typeof hours !== "number") return { ok: false, error: hours.error };
  const overtime = parseHours(input.overtimeHours ?? 0, "Overtime hours", { allowZero: true });
  if (typeof overtime !== "number") return { ok: false, error: overtime.error };
  const summary = input.summary?.trim();
  if (!summary) return { ok: false, error: "Describe the work you did." };
  const link = input.link?.trim() || null;
  if (link && !/^https?:\/\//i.test(link))
    return { ok: false, error: "The supporting link must start with http:// or https://." };

  const { error } = await companyOs
    .from("contractor_work_requests")
    .update({
      status: "work_submitted",
      actual_hours: hours,
      actual_overtime_hours: overtime,
      work_summary: summary,
      work_link: link,
      work_submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", req.id);
  if (error) return { ok: false, error: "Something went wrong — please try again." };

  await companyOs.from("contractor_work_events").insert({
    request_id: req.id,
    actor_type: "contractor",
    actor: req.person?.email ?? null,
    type: "work_submitted",
    body: summary,
    meta: { actual_hours: hours, overtime_hours: overtime, link },
  });

  await pingOps(
    `✅ Contractor work submitted: "${req.title}" — ${
      req.person?.full_name ?? req.person?.email ?? "unknown"
    }, ${hours}h${overtime > 0 ? ` + ${overtime}h OT` : ""}. Review: https://www.edge8.ai/admin/operations/contractor-requests`,
  );

  revalidatePath(`/work/${input.token}`);
  return { ok: true };
}
