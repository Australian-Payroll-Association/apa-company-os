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
import { resolveLeaveApprover, teamMemberIdsManagedBy } from "@/lib/time-off/approver";

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

// ---------------------------------------------------------------------------
// Client-side approval (docs/plans/2026-08-12-client-manager-time-off-approval.md)
//
// The one exception to the read-only, reason-free rules above, and it is
// narrow: a person named as client manager on an active placement sees the
// pending requests of THOSE people only, with the reason, because they are the
// one deciding. Scope is derived server-side from the placement rows
// (teamMemberIdsManagedBy), never from the portal role and never from client
// input. A client admin with no placements naming them gets an empty queue and
// no reasons, same as before.
// ---------------------------------------------------------------------------


export type PortalDecisionRequest = {
  id: string;
  fullName: string | null;
  leaveType: string;
  startDate: string;
  endDate: string;
  isHalfDay: boolean;
  reason: string | null;
  requestedAt: string | null;
};

type DecisionRow = Row & { reason: string | null; created_at: string | null };

// Does this person approve anyone's leave? Drives whether the section renders
// at all, so an approver with an empty queue still sees "Nothing waiting on
// you" instead of the section vanishing after their last decision.
export async function isClientLeaveApprover(actor: PortalActor): Promise<boolean> {
  const ids = await teamMemberIdsManagedBy(actor.personId, actor.companyScope);
  return ids.length > 0;
}

export async function getLeaveDecisionQueue(actor: PortalActor): Promise<PortalDecisionRequest[]> {
  const managedIds = await teamMemberIdsManagedBy(actor.personId, actor.companyScope);
  if (managedIds.length === 0) return [];

  const { data } = await companyOs
    .from("time_off")
    .select("id, team_member_id, leave_type, status, start_date, end_date, is_half_day, reason, created_at")
    .in("team_member_id", managedIds)
    .eq("status", "requested")
    .order("start_date", { ascending: true });
  const rows = (data ?? []) as DecisionRow[];
  if (rows.length === 0) return [];

  const { data: directoryRows } = await companyOs
    .from("team_directory")
    .select("id, full_name")
    .in("id", managedIds);
  const nameById = new Map(((directoryRows ?? []) as NameRow[]).map((r) => [r.id, r.full_name]));

  return rows.map((r) => ({
    id: r.id,
    fullName: nameById.get(r.team_member_id) ?? null,
    leaveType: r.leave_type,
    startDate: r.start_date,
    endDate: r.end_date,
    isHalfDay: r.is_half_day,
    reason: r.reason,
    requestedAt: r.created_at,
  }));
}

export type DecisionResult = { ok: true } | { ok: false; error: string };

// Records a client manager's decision. Two independent checks before any
// write: the request must belong to someone this actor manages, and it must
// still be pending. The decision is stamped on client_approved_by (people.id),
// never approved_by (team_members.id) — a client manager is not an Edge8
// employee and must not be recorded as one.
export async function decideAssignedTimeOff(
  actor: PortalActor,
  id: string,
  decision: "approved" | "rejected",
): Promise<DecisionResult> {
  if (!id) return { ok: false, error: "Missing request." };

  const managedIds = await teamMemberIdsManagedBy(actor.personId, actor.companyScope);
  if (managedIds.length === 0) return { ok: false, error: "You cannot decide this request." };

  const { data: row } = await companyOs
    .from("time_off")
    .select("id, status, team_member_id")
    .eq("id", id)
    .maybeSingle();
  const target = (row as { status: string; team_member_id: string } | null) ?? null;
  if (!target || !managedIds.includes(target.team_member_id))
    return { ok: false, error: "You cannot decide this request." };
  if (target.status !== "requested")
    return { ok: false, error: "This request has already been decided." };

  // Belt and braces: the approver resolver must independently name this actor
  // for this member. Scope and approver are two different questions and both
  // have to say yes.
  const approver = await resolveLeaveApprover(target.team_member_id);
  if (!approver || approver.kind !== "client" || approver.personId !== actor.personId)
    return { ok: false, error: "You cannot decide this request." };

  const { error } = await companyOs
    .from("time_off")
    .update({
      status: decision,
      client_approved_by: actor.personId,
      approved_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "requested");
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}
