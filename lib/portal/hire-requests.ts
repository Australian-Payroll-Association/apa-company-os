// Portal "full-time hire in Vietnam" request → lands directly in the CRM
// deals pipeline (first stage of the active pipeline), same handoff pattern
// as bookMeetingAndHandOff (app/admin/(dashboard)/revenue/leads/actions.ts).
// Budget = midpoint of the selected monthly rate bracket * 12.

import { companyOs } from "@/lib/supabase";
import type { PortalActor } from "@/lib/portal-auth";
import { notifyOps } from "@/lib/lark";
import { findBracket, HIRE_TECH_STACK } from "./hire-catalog";

type Result = { ok: true; id: string } | { ok: false; error: string };

export async function createHireRequestForActor(
  actor: PortalActor,
  input: { companyId: string; positionId: string; bracketId: string; techStack: string[] },
): Promise<Result> {
  if (!actor.companyScope.includes(input.companyId)) return { ok: false, error: "Not your company." };

  const found = findBracket(input.positionId, input.bracketId);
  if (!found) return { ok: false, error: "Pick a position and experience level." };
  const { position, bracket } = found;

  const techStack = input.techStack.filter((t) => (HIRE_TECH_STACK as readonly string[]).includes(t));
  if (techStack.length === 0) return { ok: false, error: "Pick at least one technology." };

  const { data: pipeline, error: plErr } = await companyOs
    .from("pipelines")
    .select("id, pipeline_stages(id, position)")
    .eq("active", true)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (plErr || !pipeline) return { ok: false, error: "Couldn't submit your request. Please try again." };

  const stages = (pipeline.pipeline_stages ?? []) as { id: string; position: number }[];
  const firstStage = [...stages].sort((a, b) => a.position - b.position)[0];
  if (!firstStage) return { ok: false, error: "Couldn't submit your request. Please try again." };

  const { count: stageDealCount } = await companyOs
    .from("deals")
    .select("id", { count: "exact", head: true })
    .eq("stage_id", firstStage.id);

  const monthlyMidUsd = Math.round((bracket.minUsd + bracket.maxUsd) / 2);
  const annualUsd = monthlyMidUsd * 12;

  const companyName = actor.memberships.find((m) => m.companyId === input.companyId)?.companyName ?? "client";
  const title = `${companyName} — Full-time hire: ${position.label} (${bracket.label})`;
  const nextStep = `Portal hire request — ${position.label}, ${bracket.label} (~$${monthlyMidUsd.toLocaleString()}/mo). Tech stack: ${techStack.join(", ")}.`;

  const { data, error } = await companyOs
    .from("deals")
    .insert({
      title,
      person_id: actor.personId,
      company_id: input.companyId,
      pipeline_id: pipeline.id,
      stage_id: firstStage.id,
      position: stageDealCount ?? 0,
      status: "open",
      source: "portal_vietnam_hire",
      currency: "usd",
      amount_cents: annualUsd * 100,
      next_step: nextStep,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Couldn't submit your request. Please try again." };

  await notifyOps(
    `🇻🇳 Full-time hire request: ${position.label} (${bracket.label}) — ${companyName}. Budget ~$${annualUsd.toLocaleString()}/yr. Review: https://www.edge8.ai/admin/revenue/deals?open=${data.id}`,
  );

  return { ok: true, id: data.id };
}
