"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { companyOs } from "@/lib/supabase";
import { recordAudit } from "@/lib/admin/audit";
import { uploadPlanDocument } from "@/lib/onboarding-cycle";

// Admin-side board actions. The admin mirror of the manager actions in
// app/team/(dashboard)/onboarding/actions.ts — same operations, gated by
// requireAdmin() instead of team scope, and never reused from /team (the same
// IDOR boundary as the time-off split).

type Result = { ok: true } | { ok: false; error: string };

function refresh() {
  revalidatePath("/admin/talent/onboarding");
}

export async function adminUploadOnboardingPlan(journeyId: string, formData: FormData): Promise<Result> {
  const admin = await requireAdmin();
  if (!journeyId) return { ok: false, error: "Missing journey." };

  const { data: journey } = await companyOs
    .from("onboarding_plans")
    .select("team_member_id")
    .eq("id", journeyId)
    .maybeSingle();
  const teamMemberId = (journey as { team_member_id: string } | null)?.team_member_id;
  if (!teamMemberId) return { ok: false, error: "Journey not found." };

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Pick a file to upload." };

  // plan_uploaded_by references team_members; an admin uploading on a
  // manager's behalf may not have one, so resolve their own membership if any.
  const { data: self } = await companyOs
    .from("people")
    .select("team_members:team_members!person_id(id)")
    .eq("email", admin.email)
    .maybeSingle();
  const selfRow = self as unknown as { team_members: { id: string }[] | { id: string } | null } | null;
  const selfMembership = Array.isArray(selfRow?.team_members)
    ? selfRow?.team_members[0]?.id ?? null
    : selfRow?.team_members?.id ?? null;

  const res = await uploadPlanDocument(journeyId, teamMemberId, selfMembership ?? teamMemberId, file);
  if (!res.ok) return res;

  await recordAudit({
    table: "onboarding_plans",
    recordId: journeyId,
    operation: "update",
    actor: admin.email,
    context: { action: "plan_upload", via: "admin" },
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
