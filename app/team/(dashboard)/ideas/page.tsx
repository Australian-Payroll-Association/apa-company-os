import Link from "next/link";
import { requireTeamMember } from "@/lib/team-auth";
import { teamRead } from "@/lib/team/data";
import { PageHead } from "@/components/admin/PageHead";
import { Badge } from "@/components/admin/Badge";
import { formatDate } from "@/lib/admin/format";
import {
  IDEA_STATUS_LABEL,
  OFFICE_LABEL,
  ideaStatusTone,
  officeTone,
  type IdeaOffice,
  type IdeaStatus,
} from "@/lib/ideas";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My ideas",
  description: "Your AI program ideas and their product plans.",
};

type OwnIdea = {
  id: string;
  title: string;
  office: string | null;
  status: string;
  ai_plan: string | null;
  ai_error: string | null;
  created_at: string;
  person_id: string;
};

export default async function IdeasPage() {
  const actor = await requireTeamMember();

  // Strictly own ideas: teamRead scopes to the actor's personScope (which for
  // managers includes reports), so narrow further to literal self.
  const { data } = await teamRead(
    actor,
    "ideas",
    "id, title, office, status, ai_plan, ai_error, created_at, person_id",
  )
    .eq("person_id", actor.personId)
    .order("created_at", { ascending: false });
  const ideas = (data ?? []) as unknown as OwnIdea[];

  return (
    <>
      <PageHead
        eyebrow="Ideas"
        title="My ideas"
        sub={
          ideas.length === 0
            ? "Every AI program starts as an idea someone wrote down."
            : `${ideas.length} ${ideas.length === 1 ? "idea" : "ideas"} submitted`
        }
        action={
          <Link href="/team/ideas/new" className="admin-btn admin-btn--primary">
            Submit an idea
          </Link>
        }
      />

      {ideas.length === 0 ? (
        <div className="admin-card" style={{ padding: "22px 24px", maxWidth: 720 }}>
          <h2 className="admin-card-title">Got a workflow AI should own?</h2>
          <p className="admin-page-sub" style={{ marginTop: 0 }}>
            Submit it through the 5D framework — define the problem, discover the data, design the
            workflow, determine the ROI — and get back a product plan written in seconds. Your idea
            lands in the company backlog where it can get picked up and built.
          </p>
          <Link href="/team/ideas/new" className="admin-btn admin-btn--primary">
            Submit your first idea
          </Link>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Idea</th>
                <th>Office</th>
                <th>Status</th>
                <th>Plan</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {ideas.map((i) => (
                <tr key={i.id}>
                  <td>
                    <Link href={`/team/ideas/${i.id}`} className="admin-cell-strong">
                      {i.title}
                    </Link>
                  </td>
                  <td>
                    {i.office ? (
                      <Badge tone={officeTone(i.office)}>{OFFICE_LABEL[i.office as IdeaOffice]}</Badge>
                    ) : (
                      <span className="admin-cell-muted">—</span>
                    )}
                  </td>
                  <td>
                    <Badge tone={ideaStatusTone(i.status)}>
                      {IDEA_STATUS_LABEL[i.status as IdeaStatus] ?? i.status}
                    </Badge>
                  </td>
                  <td>
                    {i.ai_plan ? (
                      <Badge tone="ok">Ready</Badge>
                    ) : i.ai_error ? (
                      <Badge tone="warn">Pending</Badge>
                    ) : (
                      <span className="admin-cell-muted">—</span>
                    )}
                  </td>
                  <td>{formatDate(i.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
