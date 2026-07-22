"use server";

import { revalidatePath } from "next/cache";
import { requireTeamMember } from "@/lib/team-auth";
import {
  teamInsertOwn,
  teamRead,
  teamUpdateInScope,
  getManagerContact,
  getOwnApprovalPolicy,
} from "@/lib/team/data";
import { LEAVE_TYPES, LEAVE_TYPE_LABEL, countWorkingDays, formatDays, type LeaveType } from "@/lib/admin/time-off";
import { formatDate } from "@/lib/admin/format";
import { notifyOps } from "@/lib/lark";
import { sendTransactionalEmail } from "@/lib/email";

// Own-service time-off actions for /team. Deliberately NOT a reuse of the
// admin actions in app/admin/(dashboard)/operations/time-off/requests/actions.ts
// — those are safe only under requireAdmin(); reused as-is here they would let
// any signed-in employee file or cancel leave for anyone (IDOR). Every write
// below goes through requireTeamMember() plus the scoped helpers in
// lib/team/data.ts, which force or verify actor.teamMemberId server-side.

type Result = { ok: true } | { ok: false; error: string };
type SubmitResult = { ok: true; autoApproved: boolean } | { ok: false; error: string };

const LEAVE_TYPE_SET = new Set<string>(LEAVE_TYPES);

function refresh() {
  revalidatePath("/team/time-off");
}

// Minimal HTML-escape for free-text interpolated into an email body. `reason`
// is employee-authored and lands in their manager's inbox, so it must not be
// able to inject markup.
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

export async function requestOwnTimeOff(input: {
  leaveType: string;
  startDate: string;
  endDate: string;
  isHalfDay: boolean;
  reason: string;
}): Promise<SubmitResult> {
  const actor = await requireTeamMember();

  if (!LEAVE_TYPE_SET.has(input.leaveType)) return { ok: false, error: "Pick a leave type." };
  if (!input.startDate || !input.endDate) return { ok: false, error: "Pick start and end dates." };
  if (input.endDate < input.startDate)
    return { ok: false, error: "End date cannot be before the start date." };
  if (input.isHalfDay && input.startDate !== input.endDate)
    return { ok: false, error: "A half day must be a single date." };

  // Approval mode follows the actor's leave policy (Edge8 Core Team
  // auto-approves; On Target stays manual). Resolved server-side — the client
  // never gets to pick its own approval path. Auto-approved rows are stamped
  // approved_at with approved_by left null: "approved by policy, not a person"
  // — the admin board renders that combination as "auto".
  const policy = await getOwnApprovalPolicy(actor);

  // teamInsertOwn forces team_member_id = actor.teamMemberId — no id field is
  // accepted from the client here at all, so there is nothing to spoof.
  const { data, error } = await teamInsertOwn(actor, "time_off", {
    leave_type: input.leaveType as LeaveType,
    status: policy.autoApprove ? "approved" : "requested",
    approved_at: policy.autoApprove ? new Date().toISOString() : null,
    start_date: input.startDate,
    end_date: input.endDate,
    is_half_day: input.isHalfDay,
    reason: input.reason.trim() || null,
  });
  if (error || !data) return { ok: false, error: error ?? "Could not submit request." };

  // Best-effort notifications: never let a Lark/email failure block or fail
  // the request the employee just successfully submitted.
  const leaveLabel = LEAVE_TYPE_LABEL[input.leaveType as LeaveType];
  const days = countWorkingDays(input.startDate, input.endDate, input.isHalfDay);
  const dateRange =
    input.startDate === input.endDate
      ? formatDate(input.startDate)
      : `${formatDate(input.startDate)} → ${formatDate(input.endDate)}`;

  notifyOps(
    policy.autoApprove
      ? `Time off auto-approved: ${actor.displayName} — ${leaveLabel}, ${dateRange} (${formatDays(days)}).`
      : `Time off requested: ${actor.displayName} — ${leaveLabel}, ${dateRange} (${formatDays(days)}). Needs approval.`,
  ).catch(() => {});

  getManagerContact(actor)
    .then((mgr) => {
      if (!mgr) return undefined;
      return sendTransactionalEmail({
        to: mgr.email,
        subject: policy.autoApprove
          ? `Time off: ${actor.displayName} — ${dateRange}`
          : `Time off request from ${actor.displayName}`,
        html: policy.autoApprove
          ? `
          <p>${escapeHtml(actor.displayName)} booked ${leaveLabel.toLowerCase()} leave: ${dateRange} (${formatDays(days)}).</p>
          ${input.reason.trim() ? `<p>Reason: ${escapeHtml(input.reason.trim())}</p>` : ""}
          <p>Approved automatically under the ${escapeHtml(policy.policyName ?? "company")} policy — no action needed.</p>
        `
          : `
          <p>${escapeHtml(actor.displayName)} requested ${leaveLabel.toLowerCase()} leave: ${dateRange} (${formatDays(days)}).</p>
          ${input.reason.trim() ? `<p>Reason: ${escapeHtml(input.reason.trim())}</p>` : ""}
          <p>It is awaiting approval in the Edge8 admin under Operations &gt; Time Off.</p>
        `,
      });
    })
    .catch(() => {});

  refresh();
  return { ok: true, autoApproved: policy.autoApprove };
}

export async function cancelOwnTimeOff(id: string): Promise<Result> {
  const actor = await requireTeamMember();
  if (!id) return { ok: false, error: "Missing request." };

  // Deliberately stricter than the actor's general read scope: a manager's
  // scope includes their reports (so they can see and later approve/reject
  // those requests), but this is the employee's OWN cancel button, so it must
  // check literal self-ownership, not "self or report".
  const { data: row } = await teamRead(actor, "time_off", "status, team_member_id")
    .eq("id", id)
    .maybeSingle();
  const r = row as { status: string; team_member_id: string } | null;
  if (!r || r.team_member_id !== actor.teamMemberId) return { ok: false, error: "Request not found." };
  if (r.status === "cancelled") return { ok: true };
  if (r.status === "taken") return { ok: false, error: "Taken leave cannot be cancelled." };

  const { ok, error } = await teamUpdateInScope(actor, "time_off", id, { status: "cancelled" });
  if (!ok) return { ok: false, error: error ?? "Could not cancel request." };

  refresh();
  return { ok: true };
}
