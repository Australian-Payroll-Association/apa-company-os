import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { companyOs } from "@/lib/supabase";
import { PageHead } from "@/components/admin/PageHead";
import { MetricCard } from "@/components/admin/MetricCard";
import { formatWeekShort, formatHours } from "@/lib/timesheet";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Scheduling",
  description: "Team load across a rolling eight weeks — confirmed and tentative against capacity.",
};

// Phase 1 of Improved Scheduling & Tracking: the one schedule. A read-only
// resourcing grid over the consultant_load view (confirmed + tentative
// allocation vs capacity, leave subtracted), with the deal-weighted forecast
// alongside. What-if and editing come in Phase 3; this makes the picture visible.

type LoadRow = {
  person_id: string;
  team_member_id: string;
  display_name: string;
  week_start: string;
  capacity_hours: number;
  leave_hours: number;
  available_hours: number;
  confirmed_hours: number;
  tentative_hours: number;
  confirmed_utilisation_pct: number | null;
  committed_plus_tentative_pct: number | null;
};

type Cell = {
  capacity: number;
  leave: number;
  available: number;
  confirmed: number;
  tentative: number;
  forecast: number;
  util: number | null;
};

const num = (v: unknown): number => (v == null ? 0 : Number(v));

// Two-tier overwork band (decision, 1 Sep 2026): soft ≥ 85%, hard > 100%.
function band(util: number | null, confirmed: number): "empty" | "ok" | "warn" | "crit" {
  if (confirmed <= 0) return "empty";
  if (util == null) return "empty";
  if (util > 100) return "crit";
  if (util >= 85) return "warn";
  return "ok";
}

export default async function SchedulingPage() {
  await requireAdmin();

  const [loadRes, forecastRes, budgetRes] = await Promise.all([
    companyOs
      .from("consultant_load")
      .select(
        "person_id, team_member_id, display_name, week_start, capacity_hours, leave_hours, available_hours, confirmed_hours, tentative_hours, confirmed_utilisation_pct, committed_plus_tentative_pct",
      )
      .order("display_name", { ascending: true })
      .order("week_start", { ascending: true }),
    companyOs.from("deal_forecast_load").select("team_member_id, week_start, probability_weighted_hours"),
    companyOs
      .from("project_budget_health")
      .select("board_id, name, budget_hours, logged_hours, remaining_budget_hours, remaining_estimate_hours, over_budget_flag"),
  ]);

  const rows = (loadRes.data ?? []) as unknown as LoadRow[];
  const forecast = new Map<string, number>();
  for (const f of (forecastRes.data ?? []) as { team_member_id: string; week_start: string; probability_weighted_hours: unknown }[]) {
    forecast.set(`${f.team_member_id}|${f.week_start}`, num(f.probability_weighted_hours));
  }

  // Distinct weeks (columns) and people (rows), preserving encounter order.
  const weeks = Array.from(new Set(rows.map((r) => r.week_start))).sort();
  const people: { personId: string; teamMemberId: string; name: string }[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (!seen.has(r.person_id)) {
      seen.add(r.person_id);
      people.push({ personId: r.person_id, teamMemberId: r.team_member_id, name: r.display_name });
    }
  }

  const cellOf = new Map<string, Cell>();
  for (const r of rows) {
    cellOf.set(`${r.person_id}|${r.week_start}`, {
      capacity: num(r.capacity_hours),
      leave: num(r.leave_hours),
      available: num(r.available_hours),
      confirmed: num(r.confirmed_hours),
      tentative: num(r.tentative_hours),
      forecast: forecast.get(`${r.team_member_id}|${r.week_start}`) ?? 0,
      util: r.confirmed_utilisation_pct == null ? null : Number(r.confirmed_utilisation_pct),
    });
  }

  // This-week summary (first column).
  const thisWeek = weeks[0];
  const thisWeekCells = people
    .map((p) => cellOf.get(`${p.personId}|${thisWeek}`))
    .filter((c): c is Cell => !!c && c.available > 0);
  const avgUtil =
    thisWeekCells.length > 0
      ? Math.round(
          thisWeekCells.reduce((s, c) => s + (c.util ?? 0), 0) / thisWeekCells.length,
        )
      : 0;
  const overHard = thisWeekCells.filter((c) => (c.util ?? 0) > 100).length;
  const atSoft = thisWeekCells.filter((c) => (c.util ?? 0) >= 85).length;
  const tentativeThisWeek = people.reduce(
    (s, p) => s + (cellOf.get(`${p.personId}|${thisWeek}`)?.tentative ?? 0),
    0,
  );

  // Early-warning flags (Phase 2). Person: over 100% this week. Project:
  // remaining task estimate exceeds remaining budget hours.
  type BudgetRow = {
    board_id: string;
    name: string;
    remaining_budget_hours: unknown;
    remaining_estimate_hours: unknown;
    over_budget_flag: boolean;
  };
  const overBudget = ((budgetRes.data ?? []) as BudgetRow[]).filter((b) => b.over_budget_flag);
  const overworked = people
    .map((p) => ({ name: p.name, util: cellOf.get(`${p.personId}|${thisWeek}`)?.util ?? 0 }))
    .filter((x) => (x.util ?? 0) > 100)
    .sort((a, b) => (b.util ?? 0) - (a.util ?? 0));
  const flagCount = overBudget.length + overworked.length;

  return (
    <div>
      <PageHead
        eyebrow="Operations"
        title="Scheduling"
        sub="Team load across a rolling eight weeks — confirmed and tentative against a 38-hour week, leave subtracted."
        action={
          <Link className="admin-btn admin-btn--sm" href="/admin/operations/scheduling/capability">
            Capability matrix →
          </Link>
        }
      />

      {people.length === 0 ? (
        <div className="sched-empty">
          No active team members with capacity to schedule yet. Add allocations on a project
          (via staff assignments) and they will appear here.
        </div>
      ) : (
        <>
          <div className="mp-kpi-grid">
            <MetricCard label="Avg utilisation" value={`${avgUtil}%`} sub={`week of ${formatWeekShort(thisWeek)}`} />
            <MetricCard label="Over 100%" value={String(overHard)} sub="hard overwork flag" />
            <MetricCard label="At or over 85%" value={String(atSoft)} sub="soft (burnout) band" />
            <MetricCard label="Tentative" value={`${formatHours(tentativeThisWeek)}h`} sub="unconfirmed, this week" />
          </div>

          <div className="sched-flags">
            <div className="sched-flags-head">
              Early warnings
              <span className={`sched-flags-count${flagCount > 0 ? " is-hot" : ""}`}>{flagCount}</span>
            </div>
            {flagCount === 0 ? (
              <p className="sched-flags-clear">Nothing flagged — no one over 100% this week, no project tracking over budget.</p>
            ) : (
              <div className="sched-flags-list">
                {overworked.map((o) => (
                  <div key={o.name} className="sched-flag is-crit">
                    <span className="sched-flag-tag">Overwork</span>
                    <span><b>{o.name}</b> is at {Math.round(o.util ?? 0)}% this week (over the 38-hour week going to clients).</span>
                  </div>
                ))}
                {overBudget.map((b) => (
                  <div key={b.board_id} className="sched-flag is-warn">
                    <span className="sched-flag-tag">Over budget</span>
                    <span>
                      <b>{b.name}</b> — {formatHours(Number(b.remaining_estimate_hours))}h of work left,
                      {" "}{formatHours(Number(b.remaining_budget_hours))}h of budget remaining.
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="sched-legend" aria-hidden="true">
            <span><i className="sched-swatch is-ok" /> under 85%</span>
            <span><i className="sched-swatch is-warn" /> 85–100%</span>
            <span><i className="sched-swatch is-crit" /> over 100%</span>
            <span><i className="sched-swatch is-empty" /> no load</span>
            <span className="sched-legend-note">cells show confirmed util · <b>+Nt</b> tentative · <b>◔</b> leave</span>
          </div>

          <div className="sched-tablewrap">
            <table className="sched-table">
              <thead>
                <tr>
                  <th className="sched-name-h">Consultant</th>
                  {weeks.map((w, i) => (
                    <th key={w} className={i === 0 ? "is-current" : ""}>
                      {formatWeekShort(w)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {people.map((p) => (
                  <tr key={p.personId}>
                    <td className="sched-name">{p.name}</td>
                    {weeks.map((w) => {
                      const c = cellOf.get(`${p.personId}|${w}`);
                      if (!c) return <td key={w} className="sched-cell is-empty" />;
                      const b = band(c.util, c.confirmed);
                      return (
                        <td key={w} className={`sched-cell is-${b}`}>
                          <span className="sched-util">{c.confirmed > 0 && c.util != null ? `${Math.round(c.util)}%` : "—"}</span>
                          <span className="sched-hrs">
                            {formatHours(c.confirmed)}/{formatHours(c.capacity)}
                          </span>
                          {(c.tentative > 0 || c.leave > 0) && (
                            <span className="sched-marks">
                              {c.tentative > 0 && <span className="sched-tent">+{formatHours(c.tentative)}t</span>}
                              {c.leave > 0 && <span className="sched-leave" title={`${formatHours(c.leave)}h leave`}>◔</span>}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="sched-foot">
            Capacity is a flat 38h/week until <code>people.weekly_capacity_hours</code> lands (part-time
            reads high). Tentative load and the deal-weighted forecast come from unconfirmed,
            deal-linked allocations. Read-only in Phase&nbsp;1; what-if modelling is Phase&nbsp;3.
          </p>
        </>
      )}
    </div>
  );
}
