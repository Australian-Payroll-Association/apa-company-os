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
  description: "8 Edges: the goal cascade from company objectives to every executor, human or agent.",
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

// The `## Overview` section of the strategy one-pager, shown on the banner.
function overviewFromBody(body: string | null): string | null {
  const m = body?.match(/^##\s+Overview\s*\n+([\s\S]*?)(?=\n##\s|$)/m);
  return m ? m[1].trim() : null;
}

export default async function GoalsPage() {
  const q = currentQuarter();

  const [stratRes, objRes, krRes, packetRes, rosterRes, teamGoalsRes] = await Promise.all([
    companyOs.from("strategies").select("id, year, title, body_md").order("year", { ascending: false }).limit(1),
    companyOs.from("objectives").select(OBJECTIVE_SELECT).eq("quarter", q.label).neq("status", "dropped"),
    companyOs.from("key_results").select(KR_SELECT),
    companyOs.from("sync_packets").select("id").gte("week_start", q.start.toISOString().slice(0, 10)),
    // Every active team member, with their coaching profile (if any) so goals attach.
    companyOs
      .from("team_members")
      .select(
        "id, people:people!person_id(full_name, preferred_name), coaching_profiles:coaching_profiles!team_member_id(id)",
      )
      .eq("status", "active"),
    companyOs
      .from("coaching_goals")
      .select("coaching_profile_id, title, objective_id, key_result_id, metric_id")
      .eq("status", "active")
      .order("sort_order"),
  ]);

  const error =
    stratRes.error?.message ?? objRes.error?.message ?? krRes.error?.message ?? packetRes.error?.message ?? null;

  const strategy = (stratRes.data?.[0] as StrategyRow | undefined) ?? null;
  const overview = overviewFromBody(strategy?.body_md ?? null);
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
  // Transparent = the whole active team, with FAST goals set and team-visible.
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
    .map((tm) => {
      const person = first(tm.people);
      const profileIds = new Set(many(tm.coaching_profiles).map((p) => p.id));
      return {
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
  const rosterCount = fastByPerson.length;
  const rosterWithGoal = fastByPerson.filter((p) => p.goals.length > 0).length;
  const casting = {
    human: krs.filter((kr) => kr.delivery_mix === "human").length,
    blended: krs.filter((kr) => kr.delivery_mix === "blended").length,
    ai: krs.filter((kr) => kr.delivery_mix === "ai").length,
  };

  return (
    <>
      <PageHead
        eyebrow="8 Edges"
        title="Goals"
        sub={`${q.label.slice(0, 4)} Q${q.label.slice(5)} · Week ${q.week} of ${q.totalWeeks} · the cascade from company strategy to every executor, human or agent.`}
      />
      {error && (
        <div className="admin-alert admin-alert--err" style={{ marginBottom: 14 }}>
          {error}
        </div>
      )}
      <GoalsBoard
        strategy={strategy}
        overview={overview}
        tree={tree}
        quarter={q.label}
        initialsById={initialsById}
        casting={casting}
        fast={fastByPerson}
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
