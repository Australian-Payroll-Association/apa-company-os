// Client-visible time-off for assigned staff. A dedicated, reviewed helper —
// same reasoning as lib/portal/team.ts: the scope is two-step (assignments ->
// derived team_member ids) and the column list is hard-restricted well below
// what admin/time-off.ts exposes internally.
//
// PRIVACY HARD LINE (docs/plans/2026-07-11-client-portal-design.md): a client
// sees person, leave type, dates, half-day flag, and status ("who is out
// when"), and NOTHING else. `reason` and `manager_note` are free text that can
// hold medical/personal detail and must never be selected here, even to
// discard client-side — don't add them to the select list. Balances,
// entitlements, and leave policy are Time Off's admin-only siblings, not
// selected either. Pending (`requested`) rows show as "pending" with no other
// detail, so the select list is identical regardless of status.

import { companyOs } from "@/lib/supabase";
import type { PortalActor } from "@/lib/portal-auth";
import { getAssignedTeamMemberIds } from "@/lib/portal/team";

export type PortalTimeOffEntry = {
  id: string;
  teamMemberId: string;
  fullName: string | null;
  leaveType: string;
  status: string;
  startDate: string;
  endDate: string;
  isHalfDay: boolean;
};

type Row = {
  id: string;
  team_member_id: string;
  leave_type: string;
  status: string;
  start_date: string;
  end_date: string;
  is_half_day: boolean;
};

type NameRow = { id: string; full_name: string | null };

// No date window: clients can page the calendar back through history and
// forward through booked leave (per Dave, 2026-08-18 — planning visibility
// beats a narrow horizon; volume is small). The privacy line is the restricted
// column list above, not the date range.
const VISIBLE_STATUSES = ["requested", "approved", "taken"] as const;

export async function getAssignedTimeOff(actor: PortalActor): Promise<PortalTimeOffEntry[]> {
  const memberIds = await getAssignedTeamMemberIds(actor);
  if (memberIds.length === 0) return [];

  const { data } = await companyOs
    .from("time_off")
    .select("id, team_member_id, leave_type, status, start_date, end_date, is_half_day")
    .in("team_member_id", memberIds)
    .in("status", VISIBLE_STATUSES)
    .order("start_date", { ascending: true });

  const rows = (data ?? []) as Row[];
  if (rows.length === 0) return [];

  // Directory-safe name lookup only — no other team_directory columns.
  const { data: directoryRows } = await companyOs
    .from("team_directory")
    .select("id, full_name")
    .in("id", memberIds);
  const nameById = new Map(((directoryRows ?? []) as NameRow[]).map((r) => [r.id, r.full_name]));

  return rows.map((r) => ({
    id: r.id,
    teamMemberId: r.team_member_id,
    fullName: nameById.get(r.team_member_id) ?? null,
    leaveType: r.leave_type,
    status: r.status,
    startDate: r.start_date,
    endDate: r.end_date,
    isHalfDay: r.is_half_day,
  }));
}
