import { companyOs } from "@/lib/supabase";
import { PageHead } from "@/components/admin/PageHead";
import {
  KR_SELECT,
  OBJECTIVE_SELECT,
  currentQuarter,
  personInitials,
  progressPct,
  type KrNode,
  type KrRow,
  type ObjectiveNode,
  type ObjectiveRow,
  type StrategyRow,
} from "../edges-shared";
import { GoalsBoard } from "./GoalsBoard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Goals",
  description: "Eight Edges: the goal cascade from company objectives to every executor, human or agent.",
};

function buildTree(objectives: ObjectiveRow[], krs: KrRow[]): ObjectiveNode[] {
  const krsByObjective = new Map<string, KrRow[]>();
  for (const kr of krs) {
    const list = krsByObjective.get(kr.objective_id) ?? [];
    list.push(kr);
    krsByObjective.set(kr.objective_id, list);
  }
  const childrenByKr = new Map<string, ObjectiveRow[]>();
  for (const o of objectives) {
    if (!o.parent_kr_id) continue;
    const list = childrenByKr.get(o.parent_kr_id) ?? [];
    list.push(o);
    childrenByKr.set(o.parent_kr_id, list);
  }
  const toNode = (o: ObjectiveRow): ObjectiveNode => ({
    ...o,
    krs: (krsByObjective.get(o.id) ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((kr): KrNode => ({
        ...kr,
        children: (childrenByKr.get(kr.id) ?? []).sort((a, b) => a.sort_order - b.sort_order).map(toNode),
      })),
  });
  return objectives
    .filter((o) => o.level === "company")
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(toNode);
}

export default async function GoalsPage() {
  const q = currentQuarter();

  const [stratRes, objRes, krRes, packetRes, rosterRes, teamGoalsRes] = await Promise.all([
    companyOs.from("strategies").select("id, year, title, body_md").order("year", { ascending: false }).limit(1),
    companyOs.from("objectives").select(OBJECTIVE_SELECT).eq("quarter", q.label).neq("status", "dropped"),
    companyOs.from("key_results").select(KR_SELECT),
    companyOs.from("sync_packets").select("id").gte("week_start", q.start.toISOString().slice(0, 10)),
    // O2-KR1 measured live: active coaching roster vs who has an active FAST goal.
    companyOs
      .from("coaching_profiles")
      .select("id, team_members:team_members!team_member_id(people:people!person_id(full_name, preferred_name))")
      .eq("active", true),
    companyOs
      .from("coaching_goals")
      .select("coaching_profile_id, title, objective_id, key_result_id, metric_id")
      .eq("status", "active")
      .order("sort_order"),
  ]);

  const error =
    stratRes.error?.message ?? objRes.error?.message ?? krRes.error?.message ?? packetRes.error?.message ?? null;

  const strategy = (stratRes.data?.[0] as StrategyRow | undefined) ?? null;
  const objectives = (objRes.data ?? []) as ObjectiveRow[];
  const objectiveIds = new Set(objectives.map((o) => o.id));
  const krs = ((krRes.data ?? []) as KrRow[]).filter((kr) => objectiveIds.has(kr.objective_id));
  const tree = buildTree(objectives, krs);

  // Owner initials for the avatar chips.
  const personIds = Array.from(new Set(krs.map((kr) => kr.accountable_person_id)));
  const peopleRes = personIds.length
    ? await companyOs.from("people").select("id, full_name").in("id", personIds)
    : { data: [], error: null };
  const initialsById: Record<string, string> = {};
  for (const p of (peopleRes.data ?? []) as { id: string; full_name: string }[]) {
    initialsById[p.id] = personInitials(p.full_name);
  }

  // FAST chips, computed from what the data actually supports.
  const measurable = krs.filter((kr) => kr.target_value != null).length;
  const packetsThisQuarter = packetRes.data?.length ?? 0;
  const weeksElapsed = q.week;
  const alreadyMet = krs.filter((kr) => progressPct(kr) >= 100 && kr.status !== "done").length;
  // Transparent = the coached team's FAST goals are set and team-visible.
  type RosterRow = {
    id: string;
    team_members:
      | { people: { full_name: string | null; preferred_name: string | null } | { full_name: string | null; preferred_name: string | null }[] | null }
      | { people: { full_name: string | null; preferred_name: string | null } | { full_name: string | null; preferred_name: string | null }[] | null }[]
      | null;
  };
  type TeamGoalRow = {
    coaching_profile_id: string;
    title: string;
    objective_id: string | null;
    key_result_id: string | null;
    metric_id: string | null;
  };
  const first = <T,>(e: T | T[] | null): T | null => (Array.isArray(e) ? e[0] ?? null : e);
  const roster = (rosterRes.data ?? []) as unknown as RosterRow[];
  const teamGoals = (teamGoalsRes.data ?? []) as TeamGoalRow[];
  const rosterCount = roster.length;
  const withGoal = new Set(teamGoals.map((g) => g.coaching_profile_id));
  const rosterWithGoal = roster.filter((p) => withGoal.has(p.id)).length;

  // The person-level view of the T in FAST: everyone's goals and where each
  // ladders into this tree. KR labels come from the tree itself.
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
    .map((p) => {
      const person = first(first(p.team_members)?.people ?? null);
      return {
        name: person?.preferred_name || person?.full_name || "Unknown",
        goals: teamGoals
          .filter((g) => g.coaching_profile_id === p.id)
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
  const casting = {
    human: krs.filter((kr) => kr.delivery_mix === "human").length,
    blended: krs.filter((kr) => kr.delivery_mix === "blended").length,
    ai: krs.filter((kr) => kr.delivery_mix === "ai").length,
  };

  return (
    <>
      <PageHead
        eyebrow="Eight Edges"
        title="Goals"
        sub={`${q.label.slice(0, 4)} Q${q.label.slice(5)} · Week ${q.week} of ${q.totalWeeks} · the cascade from company goals to every executor, human or agent.`}
      />
      {error && (
        <div className="admin-alert admin-alert--err" style={{ marginBottom: 14 }}>
          {error}
        </div>
      )}
      <section className="admin-card" style={{ marginBottom: 14 }}>
        <div className="admin-card-title">
          Team FAST goals{" "}
          <span className="admin-cell-muted">({rosterWithGoal}/{rosterCount} set · transparent to the whole team)</span>
        </div>
        <div className="edges-fast-grid">
          {fastByPerson.map((p) => (
            <div key={p.name} className="edges-fast-person">
              <div className="edges-fast-name">{p.name}</div>
              {p.goals.length === 0 && <div className="admin-cell-muted">No active goal</div>}
              {p.goals.map((g, i) => (
                <div key={i} className="edges-fast-goal">
                  <div>{g.title}</div>
                  <div className="admin-cell-muted">
                    {g.ladder ? `⇗ ${g.ladder}` : "No ladder yet"}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      <GoalsBoard
        strategy={strategy}
        tree={tree}
        quarter={q.label}
        initialsById={initialsById}
        casting={casting}
        chips={{
          frequent: { value: `${packetsThisQuarter}/${weeksElapsed} syncs`, tone: packetsThisQuarter >= weeksElapsed - 1 ? "ok" : "warn" },
          specific: { value: `${measurable}/${krs.length} measurable`, tone: measurable === krs.length ? "ok" : "warn" },
          ambitious: { value: alreadyMet > 0 ? `${alreadyMet} already met` : "none met early", tone: alreadyMet > 2 ? "warn" : "ok" },
          transparent: {
            value: rosterCount > 0 ? `${rosterWithGoal}/${rosterCount} team goals live` : "no roster",
            tone: rosterCount > 0 && rosterWithGoal === rosterCount ? "ok" : "warn",
          },
        }}
      />
    </>
  );
}
