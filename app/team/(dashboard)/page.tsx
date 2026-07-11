import Link from "next/link";
import { requireTeamMember } from "@/lib/team-auth";
import { getOwnProfile, teamRead } from "@/lib/team/data";
import { PageHead } from "@/components/admin/PageHead";
import { MetricCard } from "@/components/admin/MetricCard";
import { formatDate, humanize } from "@/lib/admin/format";

export const dynamic = "force-dynamic";

// Portal home. Everything here is self-scoped: the profile is fetched by the
// actor's own team_member id, and "next time off" is filtered to the actor.
type NextLeave = { start_date: string; end_date: string; leave_type: string; status: string };

export default async function TeamHome() {
  const actor = await requireTeamMember();
  const profile = await getOwnProfile(actor);

  const today = new Date().toISOString().slice(0, 10);
  const { data: leaveRows } = await teamRead(
    actor,
    "time_off",
    "start_date, end_date, leave_type, status",
  )
    .eq("team_member_id", actor.teamMemberId)
    .gte("end_date", today)
    .in("status", ["requested", "approved"])
    .order("start_date", { ascending: true })
    .limit(1);
  const nextLeave = ((leaveRows ?? []) as unknown as NextLeave[])[0] ?? null;

  return (
    <>
      <PageHead
        eyebrow="Workspace"
        title={`Welcome, ${actor.displayName}`}
        sub={actor.role === "manager" ? "Manager workspace" : "Team workspace"}
      />

      <div className="mp-kpi-grid" style={{ marginBottom: 20 }}>
        <MetricCard
          label="Next time off"
          value={nextLeave ? formatDate(nextLeave.start_date) : "None scheduled"}
          sub={nextLeave ? `${humanize(nextLeave.leave_type)} · ${nextLeave.status}` : "Request time off soon"}
        />
        <MetricCard label="Department" value={profile?.departmentName || "—"} sub={profile?.positionTitle || undefined} />
        <MetricCard
          label="Manager"
          value={profile?.managerName || "—"}
          sub={profile?.start_date ? `Started ${formatDate(profile.start_date)}` : undefined}
        />
      </div>

      <div className="admin-card" style={{ padding: "18px 20px" }}>
        <h2 className="admin-card-title">Your workspace is being built</h2>
        <p className="admin-page-sub" style={{ marginTop: 0 }}>
          <Link href="/team/time-off">Time Off</Link> is live. Your profile and the team directory
          are arriving shortly. The items marked "soon" in the sidebar will switch on as each one
          ships.
        </p>
      </div>
    </>
  );
}
