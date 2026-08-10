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
  const [issuesRes, krRes] = await Promise.all([
    companyOs.from("issues").select(ISSUE_SELECT).order("created_at", { ascending: false }),
    companyOs.from("key_results").select("id, title"),
  ]);

  const error = issuesRes.error?.message ?? krRes.error?.message ?? null;
  const issues = (issuesRes.data ?? []) as IssueRow[];
  const krs = ((krRes.data ?? []) as { id: string; title: string }[]).sort((a, b) => a.title.localeCompare(b.title));

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
      <IssuesBoard issues={issues} krs={krs} />
    </>
  );
}
