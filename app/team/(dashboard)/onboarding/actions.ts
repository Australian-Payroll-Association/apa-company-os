"use server";

import { revalidatePath } from "next/cache";
import { requireTeamMember } from "@/lib/team-auth";
import { assertInScope, teamUpdateInScope } from "@/lib/team/data";
import { savePlanLink } from "@/lib/onboarding-cycle";

// Onboarding-board actions for /team managers. Same discipline as the time-off
// actions: requireTeamMember() plus the scoped helpers in lib/team/data.ts —
// assertInScope re-derives ownership server-side, so a client-forged journey or
// task id for someone outside the manager's reports is a no-op.

type Result = { ok: true } | { ok: false; error: string };

function refresh() {
  revalidatePath("/team/onboarding");
}

// Add (or replace) the link to a report's onboarding plan. Managers only — an
// employee's own journey is in their scope too, but the plan is the manager's
// deliverable, so the role gate keeps it on the right side.
export async function setOnboardingPlanLink(journeyId: string, url: string): Promise<Result> {
  const actor = await requireTeamMember();
  if (actor.role !== "manager") return { ok: false, error: "Managers only." };
  if (!journeyId) return { ok: false, error: "Missing journey." };

  const ownerTeamMemberId = await assertInScope(actor, "onboarding_plans", journeyId);
  if (!ownerTeamMemberId) return { ok: false, error: "Journey not found." };

  const res = await savePlanLink(journeyId, url, actor.teamMemberId);
  if (!res.ok) return res;

  refresh();
  return { ok: true };
}

// Tick / untick one of the Day 1 orientation activities.
export async function toggleDay1Task(taskId: string, done: boolean): Promise<Result> {
  const actor = await requireTeamMember();
  if (!taskId) return { ok: false, error: "Missing task." };

  const { ok, error } = await teamUpdateInScope(actor, "onboarding_tasks", taskId, {
    status: done ? "done" : "todo",
    completed_at: done ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  });
  if (!ok) return { ok: false, error: error ?? "Could not update the task." };

  refresh();
  return { ok: true };
}
