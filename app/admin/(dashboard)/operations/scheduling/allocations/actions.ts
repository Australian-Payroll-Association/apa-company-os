"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { companyOs } from "@/lib/supabase";
import { parseHours, isValidISODate } from "@/lib/timesheet";

// Admin add/edit/remove for scheduling allocations — rows in staff_assignments
// that carry allocation_hours. A "project allocation" is one person on one
// client project for a period, at N weekly hours, confirmed or tentative.
//
// Constraint that shapes this: staff_assignments is UNIQUE on (company_id,
// team_member_id) — one row per person per client. So creating an allocation
// upserts on that key: if the person already has a row for that client, we set
// the scheduling fields on it rather than inserting a duplicate.

type Result = { ok: true } | { ok: false; error: string };

const STATUSES = new Set(["confirmed", "tentative"]);

function refresh() {
  revalidatePath("/admin/operations/scheduling/allocations");
  revalidatePath("/admin/operations/scheduling");
}

function validateCore(input: {
  allocationHours: number | string;
  scheduleStatus: string;
  startDate: string;
  endDate: string;
}): { hours: number } | { error: string } {
  if (!STATUSES.has(input.scheduleStatus)) return { error: "Pick confirmed or tentative." };
  if (!isValidISODate(input.startDate) || !isValidISODate(input.endDate)) return { error: "Pick valid start and end dates." };
  if (input.endDate < input.startDate) return { error: "End date can't be before the start date." };
  const parsed = parseHours(input.allocationHours);
  if ("error" in parsed) return { error: parsed.error };
  return { hours: parsed.hours };
}

export async function createAllocation(input: {
  teamMemberId: string;
  boardId: string;
  allocationHours: number | string;
  scheduleStatus: string;
  startDate: string;
  endDate: string;
  sourceDealId?: string | null;
}): Promise<Result> {
  await requireAdmin();
  if (!input.teamMemberId) return { ok: false, error: "Pick a person." };
  if (!input.boardId) return { ok: false, error: "Pick a project." };

  const v = validateCore(input);
  if ("error" in v) return { ok: false, error: v.error };

  const { data: board } = await companyOs
    .from("boards")
    .select("client_company_id")
    .eq("id", input.boardId)
    .maybeSingle();
  const companyId = (board as { client_company_id: string | null } | null)?.client_company_id;
  if (!companyId) return { ok: false, error: "That project has no client company to allocate against." };

  // client_visible stays false for scheduling allocations (tentative rows are
  // required to be, and confirmed ones shouldn't leak allocation data to the portal).
  const fields = {
    board_id: input.boardId,
    allocation_hours: v.hours,
    schedule_status: input.scheduleStatus,
    start_date: input.startDate,
    end_date: input.endDate,
    source_deal_id: input.sourceDealId || null,
    client_visible: false,
  };

  // Upsert on (company_id, team_member_id).
  const { data: existing } = await companyOs
    .from("staff_assignments")
    .select("id")
    .eq("company_id", companyId)
    .eq("team_member_id", input.teamMemberId)
    .maybeSingle();

  if (existing) {
    const { error } = await companyOs.from("staff_assignments").update(fields).eq("id", (existing as { id: string }).id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await companyOs.from("staff_assignments").insert({
      ...fields,
      company_id: companyId,
      team_member_id: input.teamMemberId,
      status: "active",
      role_title: "Consultant",
    });
    if (error) return { ok: false, error: error.message };
  }

  refresh();
  return { ok: true };
}

export async function updateAllocation(input: {
  id: string;
  allocationHours: number | string;
  scheduleStatus: string;
  startDate: string;
  endDate: string;
  sourceDealId?: string | null;
}): Promise<Result> {
  await requireAdmin();
  if (!input.id) return { ok: false, error: "Missing allocation." };

  const v = validateCore(input);
  if ("error" in v) return { ok: false, error: v.error };

  const { error } = await companyOs
    .from("staff_assignments")
    .update({
      allocation_hours: v.hours,
      schedule_status: input.scheduleStatus,
      start_date: input.startDate,
      end_date: input.endDate,
      source_deal_id: input.sourceDealId || null,
      client_visible: false,
    })
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };

  refresh();
  return { ok: true };
}

// "Remove" clears the scheduling fields, leaving any underlying client placement
// row intact (it just drops off the schedule). allocation_hours = null satisfies
// the allocation_requires_project CHECK.
export async function removeAllocation(input: { id: string }): Promise<Result> {
  await requireAdmin();
  if (!input.id) return { ok: false, error: "Missing allocation." };

  const { error } = await companyOs
    .from("staff_assignments")
    .update({ allocation_hours: null, board_id: null, source_deal_id: null, schedule_status: "confirmed" })
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };

  refresh();
  return { ok: true };
}
