import { requireTeamMember } from "@/lib/team-auth";
import { teamRead, getOwnLeaveSummary } from "@/lib/team/data";
import { PageHead } from "@/components/admin/PageHead";
import { MetricCard } from "@/components/admin/MetricCard";
import { formatLeaveBalance } from "@/lib/admin/time-off";
import { TimeOffPanel, type OwnRequestRow } from "./TimeOffPanel";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Time Off",
  description: "Request time off and see your balance and history.",
};

// /team/time-off — own-service only. Every read below is filtered to the
// actor's own team_member id (never a client-supplied one), matching the
// scoped-write actions in ./actions.ts.
export default async function TeamTimeOffPage() {
  const actor = await requireTeamMember();

  const [summary, requestsRes] = await Promise.all([
    getOwnLeaveSummary(actor),
    teamRead(actor, "time_off", "id, leave_type, status, start_date, end_date, is_half_day, reason")
      .eq("team_member_id", actor.teamMemberId)
      .order("start_date", { ascending: false })
      .limit(200),
  ]);

  const rows = ((requestsRes.data ?? []) as unknown as {
    id: string;
    leave_type: string;
    status: string;
    start_date: string;
    end_date: string;
    is_half_day: boolean;
    reason: string | null;
  }[]).map(
    (r): OwnRequestRow => ({
      id: r.id,
      leaveType: r.leave_type,
      status: r.status,
      startDate: r.start_date,
      endDate: r.end_date,
      isHalfDay: r.is_half_day,
      reason: r.reason,
    }),
  );

  const total = summary?.totalDays ?? null;
  const used = summary?.usedDays ?? null;
  const remaining = total !== null && used !== null ? Math.round((total - used) * 10) / 10 : null;

  return (
    <>
      <PageHead
        eyebrow="Me"
        title="Time Off"
        sub={summary?.policyName ? `Policy: ${summary.policyName}` : "Request and track your leave."}
      />

      {total !== null && (
        <div className="mp-kpi-grid" style={{ marginBottom: 20 }}>
          <MetricCard label="Entitled" value={formatLeaveBalance(total)} sub="days this period" />
          <MetricCard label="Used" value={formatLeaveBalance(used)} sub="days taken" />
          <MetricCard
            label="Remaining"
            value={remaining !== null ? formatLeaveBalance(remaining) : "—"}
            sub="days left"
          />
        </div>
      )}

      <TimeOffPanel rows={rows} />
    </>
  );
}
