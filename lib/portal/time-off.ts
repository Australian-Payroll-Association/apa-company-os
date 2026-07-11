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

// A client only ever needs to see currently-open leave: what's happened
// recently, what's happening now, and what's coming up. Older history has no
// client-facing use case yet, so the window (not just the column list) keeps
// this deliberately narrow.
const LOOKBACK_DAYS = 90;
const LOOKAHEAD_DAYS = 90;
const VISIBLE_STATUSES = ["requested", "approved", "taken"] as const;

function isoDaysFromNow(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

export async function getAssignedTimeOff(actor: PortalActor): Promise<PortalTimeOffEntry[]> {
  const memberIds = await getAssignedTeamMemberIds(actor);
  if (memberIds.length === 0) return [];

  const { data } = await companyOs
    .from("time_off")
    .select("id, team_member_id, leave_type, status, start_date, end_date, is_half_day")
    .in("team_member_id", memberIds)
    .in("status", VISIBLE_STATUSES)
    .gte("end_date", isoDaysFromNow(-LOOKBACK_DAYS))
    .lte("start_date", isoDaysFromNow(LOOKAHEAD_DAYS))
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
