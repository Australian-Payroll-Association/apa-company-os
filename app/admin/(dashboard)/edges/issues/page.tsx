import { companyOs } from "@/lib/supabase";
import { PageHead } from "@/components/admin/PageHead";
import { ISSUE_SELECT, type IssueRow } from "../edges-shared";
import { IssuesBoard } from "./IssuesBoard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Issues",
  description: "Eight Edges: anything blocking a goal, diagnosed before blamed.",
};

export default async function IssuesPage() {
  const [issuesRes, krRes, teamRes] = await Promise.all([
    companyOs.from("issues").select(ISSUE_SELECT).order("created_at", { ascending: false }),
    companyOs.from("key_results").select("id, title"),
    companyOs.from("team_members").select("person_id, status"),
  ]);

  const issues = (issuesRes.data ?? []) as IssueRow[];
  const krs = ((krRes.data ?? []) as { id: string; title: string }[]).sort((a, b) => a.title.localeCompare(b.title));

  // People needed for display (current assignees) plus the active team for the picker.
  const teamRows = (teamRes.data ?? []) as { person_id: string; status: string | null }[];
  const activeTeamIds = teamRows
    .filter((t) => !["inactive", "offboarded"].includes(t.status ?? "active"))
    .map((t) => t.person_id);
  const personIds = Array.from(
    new Set([...activeTeamIds, ...issues.map((i) => i.assignee_person_id).filter(Boolean)]),
  ) as string[];
  const peopleRes = personIds.length
    ? await companyOs.from("people").select("id, full_name").in("id", personIds)
    : { data: [], error: null };
  const people = ((peopleRes.data ?? []) as { id: string; full_name: string }[]).sort((a, b) =>
    a.full_name.localeCompare(b.full_name),
  );
  const teamOptions = people.filter((p) => activeTeamIds.includes(p.id));

  const error =
    issuesRes.error?.message ?? krRes.error?.message ?? teamRes.error?.message ?? peopleRes.error?.message ?? null;

  return (
    <>
      <PageHead
        eyebrow="Eight Edges"
        title="Issues"
        sub="Anything blocking a goal, diagnosed before blamed: goal problem, system problem, or execution problem. Agents file them automatically when numbers slip."
      />
      {error && (
        <div className="admin-alert admin-alert--err" style={{ marginBottom: 14 }}>
          {error}
        </div>
      )}
      <IssuesBoard issues={issues} krs={krs} people={people} teamOptions={teamOptions} />
    </>
  );
}
