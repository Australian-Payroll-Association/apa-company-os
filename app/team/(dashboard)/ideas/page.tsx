import Link from "next/link";
import { remark } from "remark";
import remarkHtml from "remark-html";
import { requireTeamMember } from "@/lib/team-auth";
import { getSharedIdeas, type SharedIdea } from "@/lib/team/data";
import { PageHead } from "@/components/admin/PageHead";
import { Badge } from "@/components/admin/Badge";
import { formatDate } from "@/lib/admin/format";
import { firstParam, type SearchParamsObj } from "@/lib/admin/url";
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
  title: "Ideas that Spark Solutions",
  description: "What should we build? What have I learned? The whole team's ideas and learnings.",
};

// Ideas that Spark Solutions: the whole team sees the whole feed (Learn and
// Share). Two sections — Learnings (what have I learned?) and Plans (what
// should we build?, each with its Claude product plan).

export default async function IdeasPage({ searchParams }: { searchParams: SearchParamsObj }) {
  await requireTeamMember();
  const view = firstParam(searchParams.view) === "plans" ? "plans" : "learnings";

  const all = await getSharedIdeas();
  const learnings = all.filter((i) => i.kind === "learning");
  const builds = all.filter((i) => i.kind !== "learning");

  // Learnings show the Claude-polished summary when it exists; sanitize on
  // render — the model's output is not a trusted HTML source.
  const md = remark().use(remarkHtml, { sanitize: true });
  const summaryHtml = new Map<string, string>();
  if (view === "learnings") {
    await Promise.all(
      learnings.map(async (l) => {
        if (l.ai_plan) summaryHtml.set(l.id, String(await md.process(l.ai_plan)));
      }),
    );
  }

  const tabs = [
    { key: "learnings", label: `Learnings (${learnings.length})`, href: "/team/ideas" },
    { key: "plans", label: `Plans (${builds.length})`, href: "/team/ideas?view=plans" },
  ];

  return (
    <>
      <PageHead
        eyebrow="Ideas"
        title="Ideas that Spark Solutions"
        sub="Two questions power this page: what should we build, and what have I learned? Everyone sees everything — that's the point."
        action={
          <Link href="/team/ideas/new" className="admin-btn admin-btn--primary">
            Share an idea
          </Link>
        }
      />

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            className={`admin-btn admin-btn--sm${view === t.key ? " admin-btn--primary" : ""}`}
            aria-current={view === t.key ? "page" : undefined}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {view === "learnings" ? (
        <LearningsFeed learnings={learnings} summaryHtml={summaryHtml} />
      ) : (
        <PlansTable builds={builds} />
      )}
    </>
  );
}

function LearningsFeed({
  learnings,
  summaryHtml,
}: {
  learnings: SharedIdea[];
  summaryHtml: Map<string, string>;
}) {
  if (learnings.length === 0) {
    return (
      <div className="admin-card" style={{ padding: "22px 24px", maxWidth: 720 }}>
        <h2 className="admin-card-title">Learned something this week?</h2>
        <p className="admin-page-sub" style={{ marginTop: 0 }}>
          Learn and Share is how we work: something you figured out is something the whole team
          gets to skip figuring out. Be the first on the feed.
        </p>
        <Link href="/team/ideas/new?kind=learning" className="admin-btn admin-btn--primary">
          Share a learning
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 14, maxWidth: 760 }}>
      {learnings.map((l) => {
        const html = summaryHtml.get(l.id);
        return (
          <div key={l.id} className="admin-card" style={{ padding: "20px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <h2 className="admin-card-title" style={{ marginBottom: 0 }}>
                <Link href={`/team/ideas/${l.id}`}>{l.title}</Link>
              </h2>
              {l.office && (
                <Badge tone={officeTone(l.office)}>{OFFICE_LABEL[l.office as IdeaOffice]}</Badge>
              )}
            </div>
            <p className="admin-page-sub" style={{ marginTop: 2 }}>
              {l.submitterName} · {formatDate(l.created_at)}
            </p>
            {html ? (
              <div className="idea-plan" dangerouslySetInnerHTML={{ __html: html }} />
            ) : (
              <>
                <p style={{ whiteSpace: "pre-wrap", marginBottom: 8 }}>{l.story}</p>
                {l.takeaway && (
                  <p style={{ whiteSpace: "pre-wrap", fontWeight: 600, marginBottom: 0 }}>{l.takeaway}</p>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PlansTable({ builds }: { builds: SharedIdea[] }) {
  if (builds.length === 0) {
    return (
      <div className="admin-card" style={{ padding: "22px 24px", maxWidth: 720 }}>
        <h2 className="admin-card-title">Got a workflow AI should own?</h2>
        <p className="admin-page-sub" style={{ marginTop: 0 }}>
          Submit it through the 5D framework — define the problem, discover the data, design the
          workflow, determine the ROI — and get back a product plan written in seconds. Your idea
          lands in the company backlog where it can get picked up and built.
        </p>
        <Link href="/team/ideas/new?kind=build" className="admin-btn admin-btn--primary">
          Submit your first idea
        </Link>
      </div>
    );
  }

  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Idea</th>
            <th>Submitted by</th>
            <th>Office</th>
            <th>Status</th>
            <th>Plan</th>
            <th>Submitted</th>
          </tr>
        </thead>
        <tbody>
          {builds.map((i) => (
            <tr key={i.id}>
              <td>
                <Link href={`/team/ideas/${i.id}`} className="admin-cell-strong">
                  {i.title}
                </Link>
              </td>
              <td>{i.submitterName}</td>
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
  );
}
