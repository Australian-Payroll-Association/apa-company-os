import Link from "next/link";
import { companyOs } from "@/lib/supabase";
import { PageHead } from "@/components/admin/PageHead";
import { MetricCard } from "@/components/admin/MetricCard";
import { BarChart } from "@/components/admin/charts/BarChart";
import { OfficeGoalsCard } from "@/components/admin/OfficeGoalsCard";
import { getOfficeGoals, healthSummary } from "@/lib/admin/office-goals";
import { one, monthsThisYear, MS_DAY } from "@/lib/admin/dashboard-helpers";
import { getSurveyScore } from "@/lib/admin/survey-scores";
import { FIXED_VND_PER_USD } from "@/lib/admin/compensation-shared";
import { formatDate } from "@/lib/admin/format";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata = {
  title: "Operations cockpit",
  description: "Keeping the company running: time off, workplace, and internal service.",
};

// Work-request statuses that are finished; anything else is still in flight.
const WR_TERMINAL = "(completed,rejected,cancelled,draft)";

type LeaveRow = {
  start_date: string;
  end_date: string;
  leave_type: string | null;
  team_members: unknown;
};

export default async function OperationsCockpitPage() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const yearStart = `${year}-01-01`;
  const today = now.toISOString().slice(0, 10);
  const date30 = new Date(now.getTime() - 30 * MS_DAY).toISOString().slice(0, 10);
  const in7 = new Date(now.getTime() + 7 * MS_DAY).toISOString().slice(0, 10);
  const iso30 = new Date(now.getTime() - 30 * MS_DAY).toISOString();

  const [leaveRes, pendingRes, equipRes, botRes, reqRes, employeeScore, goals] = await Promise.all([
    companyOs
      .from("time_off")
      .select("start_date, end_date, leave_type, team_members!team_member_id(people!person_id(full_name, email))")
      .eq("status", "approved")
      .gte("end_date", yearStart)
      .order("start_date"),
    companyOs.from("time_off").select("id", { count: "exact", head: true }).eq("status", "requested"),
    companyOs.from("equipment").select("cost_vnd"),
    companyOs
      .from("assistant_conversations")
      .select("id", { count: "exact", head: true })
      .is("archived_at", null)
      .gte("last_message_at", iso30),
    companyOs
      .from("contractor_work_requests")
      .select("id", { count: "exact", head: true })
      .not("status", "in", WR_TERMINAL),
    getSurveyScore("team-pulse"),
    getOfficeGoals(),
  ]);

  const err = leaveRes.error || equipRes.error || botRes.error || reqRes.error;

  const leave = (leaveRes.data as LeaveRow[] | null) ?? [];
  const daysOff30 = leave.filter((l) => l.start_date >= date30).length;
  const outToday = leave.filter((l) => l.start_date <= today && l.end_date >= today).length;
  const pending = pendingRes.count ?? 0;

  const leaveByMonth = monthsThisYear(now).map(({ label, from, to }) => ({
    label,
    value: leave.filter((l) => l.start_date >= from && l.start_date < to).length,
  }));

  const outThisWeek = leave
    .filter((l) => l.end_date >= today && l.start_date <= in7)
    .map((l) => {
      const person = one(one(l.team_members as { people: unknown } | null)?.people as { full_name: string | null; email: string } | null);
      return {
        name: person?.full_name || person?.email || "Unknown",
        type: (l.leave_type ?? "leave").replace(/[_-]+/g, " "),
        start: l.start_date,
        end: l.end_date,
      };
    });

  const equipUsd = ((equipRes.data as { cost_vnd: number | null }[] | null) ?? []).reduce(
    (s, e) => s + (e.cost_vnd ?? 0),
    0,
  ) / FIXED_VND_PER_USD;

  const botCount = botRes.count ?? 0;
  const openRequests = reqRes.count ?? 0;

  const ops = goals.byOffice.operations;
  const chips = healthSummary(ops.health);

  return (
    <>
      <PageHead
        eyebrow="Four Offices · Operations"
        title="Operations cockpit"
        sub="Time off, workplace, and internal service."
      />

      {err && (
        <div className="admin-alert admin-alert--err" style={{ marginBottom: 14 }}>
          {err.message}
        </div>
      )}

      <div className="mp-kpi-grid" style={{ marginBottom: 20 }}>
        <MetricCard
          label="Days off · 30d"
          value={daysOff30}
          sub={`${outToday} out today · ${pending} pending`}
          href="/admin/operations/time-off/requests"
        />
        <MetricCard
          label="Equipment value"
          value={`$${Math.round(equipUsd).toLocaleString("en-US")}`}
          sub="on the register"
          href="/admin/operations/equipment"
        />
        <MetricCard label="Open requests" value={openRequests} sub="contractor + client" href="/admin/operations/contractor-requests" />
        <MetricCard label="Company docs" value="soon" sub="documents — coming later" />
        <MetricCard label="Chat bot inquiries · 30d" value={botCount} sub="admin + team assistants" />
        <MetricCard
          label="Employee feedback"
          value={employeeScore.avg != null ? `${employeeScore.avg} / ${employeeScore.scale}` : "—"}
          sub={employeeScore.responses > 0 ? `team pulse · ${employeeScore.responses} responses` : "no responses yet"}
          href="/admin/operations/surveys"
        />
      </div>

      {chips && (
        <div className="mp-kpi-label" style={{ marginBottom: 16 }}>
          Operations goals · {goals.quarter.label}: {chips}
          {ops.openIssues > 0 ? ` · ${ops.openIssues} open ${ops.openIssues === 1 ? "issue" : "issues"}` : ""}
        </div>
      )}

      <div className="admin-summary-grid" style={{ marginBottom: 20 }}>
        <div className="admin-card admin-chart-card">
          <div className="mp-kpi-label">Days off by month · {year}</div>
          <BarChart data={leaveByMonth} ariaLabel="Approved time off by month" emptyText="No time off this year." />
        </div>
      </div>

      <div className="admin-cockpit-cols">
        <div className="admin-card admin-section-card">
          <h2 className="admin-card-title">Out this week</h2>
          {outThisWeek.length === 0 ? (
            <div className="admin-empty">Everyone&apos;s in this week.</div>
          ) : (
            <div className="admin-list">
              {outThisWeek.slice(0, 8).map((l, i) => (
                <div key={`${l.name}-${l.start}-${i}`} className="admin-list-row">
                  <div className="admin-list-main">
                    <div className="admin-list-title">{l.name}</div>
                    <div className="admin-list-sub">{l.type}</div>
                  </div>
                  <div className="admin-list-aside">
                    <span className="admin-list-sub">
                      {l.start <= today ? `back ${formatDate(l.end)}` : `${formatDate(l.start)} – ${formatDate(l.end)}`}
                    </span>
                  </div>
                </div>
              ))}
              <div style={{ paddingTop: 10 }}>
                <Link href="/admin/operations/time-off/requests" className="admin-auth-link">
                  Open time off →
                </Link>
              </div>
            </div>
          )}
        </div>

        <OfficeGoalsCard snapshot={ops} quarterLabel={goals.quarter.label} />
      </div>
    </>
  );
}
