"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { companyOs } from "@/lib/supabase";
import { recordAudit } from "@/lib/admin/audit";
import { savePlanLink } from "@/lib/onboarding-cycle";

// Admin-side board actions. The admin mirror of the manager actions in
// app/team/(dashboard)/onboarding/actions.ts — same operations, gated by
// requireAdmin() instead of team scope, and never reused from /team (the same
// IDOR boundary as the time-off split).

type Result = { ok: true } | { ok: false; error: string };

function refresh() {
  revalidatePath("/admin/talent/onboarding");
}

export async function adminSetOnboardingPlanLink(journeyId: string, url: string): Promise<Result> {
  const admin = await requireAdmin();
  if (!journeyId) return { ok: false, error: "Missing journey." };

  const { data: journey } = await companyOs
    .from("onboarding_plans")
    .select("id")
    .eq("id", journeyId)
    .maybeSingle();
  if (!journey) return { ok: false, error: "Journey not found." };

  // plan_uploaded_by references team_members; an admin adding the link on a
  // manager's behalf may not have a membership row, so resolve their own if any.
  const { data: self } = await companyOs
    .from("people")
    .select("team_members:team_members!person_id(id)")
    .eq("email", admin.email)
    .maybeSingle();
  const selfRow = self as unknown as { team_members: { id: string }[] | { id: string } | null } | null;
  const selfMembership = Array.isArray(selfRow?.team_members)
    ? selfRow?.team_members[0]?.id ?? null
    : selfRow?.team_members?.id ?? null;

  const res = await savePlanLink(journeyId, url, selfMembership);
  if (!res.ok) return res;

  await recordAudit({
    table: "onboarding_plans",
    recordId: journeyId,
    operation: "update",
    actor: admin.email,
    context: { action: "plan_link_set", via: "admin" },
  });
  refresh();
  return { ok: true };
}

// Adjust the cycle's Day 1. Moves team_members.start_date (the anchor every
// stage keys off) and keeps the Day 1 checklist due date in step. Deliberately
// does NOT touch probation_ends_on — probation dates are managed on the team
// profile, and the review window keys off probation end, not start.
export async function adminSetOnboardingStartDate(journeyId: string, date: string): Promise<Result> {
  const admin = await requireAdmin();
  if (!journeyId) return { ok: false, error: "Missing journey." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    return { ok: false, error: "Pick a valid date." };
  }

  const { data: journey } = await companyOs
    .from("onboarding_plans")
    .select("team_member_id")
    .eq("id", journeyId)
    .maybeSingle();
  const teamMemberId = (journey as { team_member_id: string } | null)?.team_member_id;
  if (!teamMemberId) return { ok: false, error: "Journey not found." };

  const { error } = await companyOs
    .from("team_members")
    .update({ start_date: date, updated_at: new Date().toISOString() })
    .eq("id", teamMemberId);
  if (error) return { ok: false, error: "Could not update the start date." };

  await companyOs
    .from("onboarding_tasks")
    .update({ due_date: date, updated_at: new Date().toISOString() })
    .eq("team_member_id", teamMemberId)
    .eq("category", "day_1"); // DAY1_CATEGORY in lib/onboarding-cycle.ts

  await recordAudit({
    table: "team_members",
    recordId: teamMemberId,
    operation: "update",
    actor: admin.email,
    context: { action: "onboarding_start_date_set", date, via: "admin" },
  });
  refresh();
  return { ok: true };
}

export async function adminToggleDay1Task(taskId: string, done: boolean): Promise<Result> {
  await requireAdmin();
  if (!taskId) return { ok: false, error: "Missing task." };

  const { error } = await companyOs
    .from("onboarding_tasks")
    .update({
      status: done ? "done" : "todo",
      completed_at: done ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);
  if (error) return { ok: false, error: "Could not update the task." };

  refresh();
  return { ok: true };
}
