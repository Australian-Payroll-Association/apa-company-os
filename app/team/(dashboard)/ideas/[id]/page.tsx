import Link from "next/link";
import { notFound } from "next/navigation";
import { remark } from "remark";
import remarkHtml from "remark-html";
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

export const metadata = { title: "Idea" };

type IdeaDetail = {
  id: string;
  person_id: string;
  title: string;
  problem: string;
  data_needed: string;
  workflow: string;
  roi: string;
  office: string | null;
  ai_plan: string | null;
  ai_error: string | null;
  status: string;
  created_at: string;
};

const D_SECTIONS: { key: keyof IdeaDetail; d: string; label: string }[] = [
  { key: "problem", d: "Define", label: "The problem" },
  { key: "data_needed", d: "Discover", label: "Data it needs" },
  { key: "workflow", d: "Design", label: "The workflow" },
  { key: "roi", d: "Determine", label: "Expected ROI" },
];

export default async function IdeaDetailPage({ params }: { params: { id: string } }) {
  const actor = await requireTeamMember();

  // teamRead scopes to personScope (self + reports for managers); this page is
  // the submitter's own view, so require literal self-ownership.
  const { data } = await teamRead(
    actor,
    "ideas",
    "id, person_id, title, problem, data_needed, workflow, roi, office, ai_plan, ai_error, status, created_at",
  )
    .eq("id", params.id)
    .maybeSingle();
  const idea = data as unknown as IdeaDetail | null;
  if (!idea || idea.person_id !== actor.personId) notFound();

  // AI-generated markdown: sanitize on render — the model's output is not a
  // trusted HTML source.
  const planHtml = idea.ai_plan
    ? String(await remark().use(remarkHtml, { sanitize: true }).process(idea.ai_plan))
    : null;

  return (
    <>
      <PageHead
        eyebrow="Ideas"
        title={idea.title}
        sub={`Submitted ${formatDate(idea.created_at)}`}
        action={
          <Link href="/team/ideas" className="admin-btn">
            All my ideas
          </Link>
        }
      />

      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {idea.office && <Badge tone={officeTone(idea.office)}>{OFFICE_LABEL[idea.office as IdeaOffice]}</Badge>}
        <Badge tone={ideaStatusTone(idea.status)}>
          {IDEA_STATUS_LABEL[idea.status as IdeaStatus] ?? idea.status}
        </Badge>
      </div>

      <div style={{ maxWidth: 760 }}>
        {planHtml ? (
          <div className="admin-card" style={{ padding: "22px 24px", marginBottom: 20 }}>
            <h2 className="admin-card-title">Your product plan</h2>
            <p className="admin-page-sub" style={{ marginTop: 0 }}>
              Written from your 5D answers. It&apos;s in the company backlog now — this is the
              document to bring when someone asks &quot;what would we actually build?&quot;
            </p>
            <div className="idea-plan" dangerouslySetInnerHTML={{ __html: planHtml }} />
          </div>
        ) : (
          <div className="admin-card" style={{ padding: "22px 24px", marginBottom: 20 }}>
            <h2 className="admin-card-title">Plan not ready yet</h2>
            <p className="admin-page-sub" style={{ marginTop: 0 }}>
              Your idea is safely in the backlog, but the product plan didn&apos;t generate.
              It will be retried — check back here soon.
            </p>
          </div>
        )}

        <div className="admin-card" style={{ padding: "22px 24px" }}>
          <h2 className="admin-card-title">What you submitted</h2>
          <dl className="admin-kv">
            {D_SECTIONS.map((s) => (
              <div key={s.key as string} style={{ gridColumn: "1 / -1", marginBottom: 10 }}>
                <dt style={{ marginBottom: 2 }}>
                  {s.d} · {s.label}
                </dt>
                <dd style={{ whiteSpace: "pre-wrap" }}>{String(idea[s.key] ?? "")}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </>
  );
}
