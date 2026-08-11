import Link from "next/link";
import { requireTeamMember } from "@/lib/team-auth";
import { companyOs } from "@/lib/supabase";
import { PageHead } from "@/components/admin/PageHead";
import { Tabs } from "@/components/admin/Tabs";
import {
  KR_SELECT,
  OBJECTIVE_SELECT,
  LINE_LABELS,
  agentInitials,
  currentQuarter,
  personInitials,
  progressPct,
  type KrRow,
  type ObjectiveRow,
} from "@/app/admin/(dashboard)/edges/edges-shared";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Company Goals",
  description: "Company objectives and key results for the current quarter, plus every team member's FAST goals.",
};

// /team/company-goals — read-only, company-visible view of the quarter's
// company goals (objectives + key results). Same data as /admin/edges/goals
// but without the cascade, editing, or check-ins: every team member sees where
// the company is aiming and how far along each key result is. A second tab
// lists every active team member with their FAST goals (Transparent is the T
// in FAST); names link to the directory profile where goals can be discussed.
type ObjectiveWithKrs = ObjectiveRow & { krs: KrRow[] };

function fmtValue(kr: KrRow): string {
  const t = kr.target_value == null ? null : Number(kr.target_value);
  const c = Number(kr.current_value);
  if (kr.unit === "usd") return `$${(c / 1000).toFixed(c >= 100000 ? 0 : 1)}k`;
  if (kr.unit === "%") return `${c}%`;
  if (kr.unit === "min") return `${c}m`;
  if (kr.unit === "days") return `${c}d`;
  if (t != null && kr.direction === "up" && t <= 20) return `${c}/${t}`;
  return `${c}`;
}

function barClass(kr: KrRow): string {
  const pct = progressPct(kr);
  if (kr.status === "done" || pct >= 100) return "is-done";
  if (kr.status === "at_risk" || kr.status === "off_track") return "is-risk";
  return "";
}

export default async function TeamCompanyGoalsPage() {
  await requireTeamMember();
  const q = currentQuarter();

  const [objRes, krRes, rosterRes, teamGoalsRes] = await Promise.all([
    // All levels: company-level objectives render as cards, the rest only
    // feed the FAST-goal ladder labels.
    companyOs
      .from("objectives")
      .select(OBJECTIVE_SELECT)
      .eq("quarter", q.label)
      .neq("status", "dropped")
      .order("sort_order"),
    companyOs.from("key_results").select(KR_SELECT).order("sort_order"),
    // Employees only: contractors don't carry FAST goals.
    companyOs
      .from("team_members")
      .select(
        "id, people:people!person_id(full_name, preferred_name), coaching_profiles:coaching_profiles!team_member_id(id)",
      )
      .eq("status", "active")
      .neq("employment_type", "contract"),
    companyOs
      .from("coaching_goals")
      .select("coaching_profile_id, title, objective_id, key_result_id, metric_id")
      .eq("status", "active")
      .order("sort_order"),
  ]);

  const objectives = (objRes.data ?? []) as ObjectiveRow[];
  const objectiveIds = new Set(objectives.map((o) => o.id));
  const krs = ((krRes.data ?? []) as KrRow[]).filter((kr) => objectiveIds.has(kr.objective_id));
  const companyObjectives = objectives.filter((o) => o.level === "company");
  const krsByObjective = new Map<string, KrRow[]>();
  for (const kr of krs) {
    krsByObjective.set(kr.objective_id, [...(krsByObjective.get(kr.objective_id) ?? []), kr]);
  }
  const tree: ObjectiveWithKrs[] = companyObjectives.map((o) => ({ ...o, krs: krsByObjective.get(o.id) ?? [] }));

  const personIds = Array.from(
    new Set(tree.flatMap((o) => o.krs.map((kr) => kr.accountable_person_id))),
  );
  const peopleRes = personIds.length
    ? await companyOs.from("people").select("id, full_name").in("id", personIds)
    : { data: [] };
  const initialsById: Record<string, string> = {};
  for (const p of (peopleRes.data ?? []) as { id: string; full_name: string }[]) {
    initialsById[p.id] = personInitials(p.full_name);
  }

  // Every active team member with their FAST goals, laddered into the tree.
  type PersonEmbed = { full_name: string | null; preferred_name: string | null };
  type ProfileEmbed = { id: string };
  type RosterRow = {
    id: string;
    people: PersonEmbed | PersonEmbed[] | null;
    coaching_profiles: ProfileEmbed | ProfileEmbed[] | null;
  };
  type TeamGoalRow = {
    coaching_profile_id: string;
    title: string;
    objective_id: string | null;
    key_result_id: string | null;
    metric_id: string | null;
  };
  const many = <T,>(e: T | T[] | null): T[] => (Array.isArray(e) ? e : e ? [e] : []);
  const first = <T,>(e: T | T[] | null): T | null => (Array.isArray(e) ? e[0] ?? null : e);
  const roster = (rosterRes.data ?? []) as unknown as RosterRow[];
  const teamGoals = (teamGoalsRes.data ?? []) as TeamGoalRow[];

  const krLabel = new Map(krs.map((kr) => [kr.id, kr.title] as const));
  const objLabel = new Map(objectives.map((o) => [o.id, o.title] as const));
  const metricRows = teamGoals.some((g) => g.metric_id)
    ? ((await companyOs.from("metrics").select("id, name, target, direction").in(
        "id",
        teamGoals.map((g) => g.metric_id).filter((x): x is string => !!x),
      )).data as { id: string; name: string; target: number | null; direction: string }[] | null) ?? []
    : [];
  const metricLabel = new Map(
    metricRows.map((m) => [m.id, `${m.name}${m.target != null ? ` (target ${m.target}${m.direction === "down" ? " ↓" : " ↑"})` : ""}`] as const),
  );
  const fastByPerson = roster
    .map((tm) => {
      const person = first(tm.people);
      const profileIds = new Set(many(tm.coaching_profiles).map((p) => p.id));
      return {
        teamMemberId: tm.id,
        name: person?.preferred_name || person?.full_name || "Unknown",
        goals: teamGoals
          .filter((g) => profileIds.has(g.coaching_profile_id))
          .map((g) => ({
            title: g.title,
            ladder: g.key_result_id
              ? krLabel.get(g.key_result_id) ?? null
              : g.metric_id
                ? metricLabel.get(g.metric_id) ?? null
                : g.objective_id
                  ? objLabel.get(g.objective_id) ?? null
                  : null,
          })),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  const withGoal = fastByPerson.filter((p) => p.goals.length > 0).length;

  const companyPanel = (
    <>
      {tree.length === 0 && <div className="admin-empty">No objectives for {q.label} yet.</div>}

      {tree.map((o, oi) => (
        <div key={o.id} className="admin-card" style={{ padding: 0, marginBottom: 14, overflow: "hidden" }}>
          <div className="edges-ohead">
            <span className={`edges-ltag edges-ltag--${o.business_line ?? "company"}`}>
              {LINE_LABELS[o.business_line ?? "company"]}
            </span>
            <h3>
              O{oi + 1} · {o.title}
            </h3>
            <span className="edges-ohead-note">
              {Math.round(o.krs.reduce((s, kr) => s + progressPct(kr), 0) / Math.max(1, o.krs.length))}% ·{" "}
              {o.krs.some((kr) => kr.status === "off_track")
                ? "off track"
                : o.krs.some((kr) => kr.status === "at_risk")
                  ? "watch"
                  : "on track"}
            </span>
          </div>
          {o.krs.map((kr, ki) => (
            <div key={kr.id} className="edges-kr">
              <div className="edges-kr-row">
                <div className="edges-kr-title">
                  <span style={{ color: "var(--admin-faint)", fontWeight: 750, fontSize: 10, marginRight: 7 }}>
                    KR{oi + 1}.{ki + 1}
                  </span>
                  {kr.title}
                </div>
                <span className="edges-owner">
                  <span className="edges-av" title="Accountable human">
                    {initialsById[kr.accountable_person_id] ?? "?"}
                  </span>
                  {kr.executing_agent && (
                    <span className="edges-av edges-av--bot" title={`${kr.executing_agent} agent`}>
                      {agentInitials(kr.executing_agent)}
                    </span>
                  )}
                </span>
                <span className="edges-prog">
                  <span className="edges-prog-bar">
                    <i className={barClass(kr)} style={{ width: `${Math.min(100, progressPct(kr))}%` }} />
                  </span>
                  <span className="edges-prog-val">{fmtValue(kr)}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      ))}
    </>
  );

  const teamPanel = (
    <section className="admin-card" style={{ marginBottom: 14 }}>
      <div className="admin-card-title">
        Team member FAST goals{" "}
        <span className="admin-cell-muted">
          ({withGoal}/{fastByPerson.length} set · transparent to the whole team)
        </span>
      </div>
      <div className="edges-fast-grid">
        {fastByPerson.map((p) => (
          <div key={p.teamMemberId} className="edges-fast-person">
            <div className="edges-fast-name">
              <Link href={`/team/directory/${p.teamMemberId}`}>{p.name}</Link>
            </div>
            {p.goals.length === 0 && <div className="admin-cell-muted">No active goal</div>}
            {p.goals.map((g, i) => (
              <div key={i} className="edges-fast-goal">
                <div>{g.title}</div>
                <div className="admin-cell-muted">{g.ladder ? `⇗ ${g.ladder}` : "No ladder yet"}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );

  return (
    <>
      <PageHead
        eyebrow="Company"
        title="Company Goals"
        sub={`${q.label} · week ${q.week} of ${q.totalWeeks}`}
      />
      <Tabs
        tabs={[
          { key: "company", label: "Company goals", content: companyPanel },
          { key: "team", label: "Team member goals", count: fastByPerson.length, content: teamPanel },
        ]}
      />
    </>
  );
}
