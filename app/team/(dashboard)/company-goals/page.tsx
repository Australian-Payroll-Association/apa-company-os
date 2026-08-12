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
import {
  TeamGoalsPanel,
  type ObjectiveGroup,
  type PersonGroup,
} from "./TeamGoalsPanel";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Company Goals",
  description: "Company objectives and key results for the current quarter, plus every team member's FAST goals.",
};

// /team/company-goals — read-only, company-visible view of the quarter's
// company goals (objectives + key results). Same data as /admin/edges/goals
// but without the cascade, editing, or check-ins: every team member sees where
// the company is aiming and how far along each key result is. A second tab
// lists every active team member's FAST goals (Transparent is the T in FAST),
// groupable by member or by the company objective each goal ladders to.
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
    // All levels this quarter: company-level objectives render as cards, the
    // lower levels only feed the FAST-goal ladder rollup below.
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
  const allKrs = (krRes.data ?? []) as KrRow[];
  const objectiveIds = new Set(objectives.map((o) => o.id));
  const krs = allKrs.filter((kr) => objectiveIds.has(kr.objective_id));
  const companyObjectives = objectives.filter((o) => o.level === "company");
  const companyObjectiveIds = new Set(companyObjectives.map((o) => o.id));
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

  // Every active employee with their FAST goals, laddered into the tree.
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

  // Metrics carry a name (for the ladder label) and an optional key_result_id
  // so a metric-linked FAST goal can roll up to its company objective.
  const metricIdList = teamGoals.map((g) => g.metric_id).filter((x): x is string => !!x);
  const metricRows = metricIdList.length
    ? ((await companyOs
        .from("metrics")
        .select("id, name, target, direction, key_result_id")
        .in("id", metricIdList)).data as
        | { id: string; name: string; target: number | null; direction: string; key_result_id: string | null }[]
        | null) ?? []
    : [];
  const metricLabel = new Map(
    metricRows.map((m) => [m.id, `${m.name}${m.target != null ? ` (target ${m.target}${m.direction === "down" ? " ↓" : " ↑"})` : ""}`] as const),
  );
  const metricKr = new Map(metricRows.map((m) => [m.id, m.key_result_id] as const));

  // Resolve a goal to the COMPANY objective it ultimately ladders to, or null.
  // A KR resolves to its objective; a metric resolves via its KR; a lower-level
  // objective rolls up through its parent KR. Anything that doesn't land on a
  // company objective (no ladder, or an orphan) returns null.
  const objById = new Map(objectives.map((o) => [o.id, o] as const));
  const krObjective = new Map(allKrs.map((kr) => [kr.id, kr.objective_id] as const));
  function resolveCompanyObjectiveId(g: TeamGoalRow): string | null {
    let objId: string | null = null;
    if (g.key_result_id) objId = krObjective.get(g.key_result_id) ?? null;
    else if (g.objective_id) objId = g.objective_id;
    else if (g.metric_id) {
      const krId = metricKr.get(g.metric_id) ?? null;
      objId = krId ? krObjective.get(krId) ?? null : null;
    }
    let guard = 0;
    while (objId && objById.get(objId) && objById.get(objId)!.level !== "company" && guard++ < 10) {
      const parentKr = objById.get(objId)!.parent_kr_id;
      objId = parentKr ? krObjective.get(parentKr) ?? null : null;
    }
    return objId && companyObjectiveIds.has(objId) ? objId : null;
  }

  // profile -> the member who owns it (a member may hold more than one profile).
  const profileToMember = new Map<string, { teamMemberId: string; name: string }>();
  for (const tm of roster) {
    const person = first(tm.people);
    const name = person?.preferred_name || person?.full_name || "Unknown";
    for (const p of many(tm.coaching_profiles)) profileToMember.set(p.id, { teamMemberId: tm.id, name });
  }

  // One flat list of resolved goals (only those owned by a roster member),
  // then both groupings derive from it.
  const resolved = teamGoals.flatMap((g) => {
    const m = profileToMember.get(g.coaching_profile_id);
    if (!m) return [];
    const ladder = g.key_result_id
      ? krLabel.get(g.key_result_id) ?? null
      : g.metric_id
        ? metricLabel.get(g.metric_id) ?? null
        : g.objective_id
          ? objLabel.get(g.objective_id) ?? null
          : null;
    return [{ ...m, goalTitle: g.title, ladder, objId: resolveCompanyObjectiveId(g) }];
  });

  const byPerson: PersonGroup[] = roster
    .map((tm) => {
      const person = first(tm.people);
      return {
        teamMemberId: tm.id,
        name: person?.preferred_name || person?.full_name || "Unknown",
        goals: resolved
          .filter((r) => r.teamMemberId === tm.id)
          .map((r) => ({ title: r.goalTitle, ladder: r.ladder })),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  const withGoal = byPerson.filter((p) => p.goals.length > 0).length;

  const byObjective: ObjectiveGroup[] = tree.map((o, oi) => ({
    objectiveId: o.id,
    label: `O${oi + 1} · ${o.title}`,
    lineTag: o.business_line ?? "company",
    lineLabel: LINE_LABELS[o.business_line ?? "company"],
    items: resolved
      .filter((r) => r.objId === o.id)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((r) => ({ teamMemberId: r.teamMemberId, name: r.name, goalTitle: r.goalTitle, ladder: r.ladder })),
  }));
  const unaligned = resolved
    .filter((r) => r.objId === null)
    .sort((a, b) => a.name.localeCompare(b.name));
  if (unaligned.length) {
    byObjective.push({
      objectiveId: null,
      label: "Not yet aligned to a company objective",
      lineTag: "company",
      lineLabel: "",
      items: unaligned.map((r) => ({
        teamMemberId: r.teamMemberId,
        name: r.name,
        goalTitle: r.goalTitle,
        ladder: r.ladder,
      })),
    });
  }

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
    <TeamGoalsPanel byPerson={byPerson} byObjective={byObjective} withGoal={withGoal} />
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
          { key: "team", label: "Team member goals", count: byPerson.length, content: teamPanel },
        ]}
      />
    </>
  );
}
