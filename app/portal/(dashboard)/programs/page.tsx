import Link from "next/link";
import { requirePortalMember } from "@/lib/portal-auth";
import { contributorCompanyScope } from "@/lib/portal/roles";
import { listPortalProgramSummaries } from "@/lib/portal/program-hub";
import { getTokenUsage } from "@/lib/portal/tokens";
import { hasBacklog } from "@/lib/portal/backlog";
import { PageHead } from "@/components/admin/PageHead";
import { Badge, statusTone } from "@/components/admin/Badge";
import { humanize } from "@/lib/admin/format";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "AI Programs",
  description: "Plan and track your AI programs with Edge8.",
};

function fmtTokens(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}
function fmtHours(n: number): string {
  return (Math.round(n * 10) / 10).toLocaleString("en-US", { maximumFractionDigits: 1 });
}

// Tokens are the company-wide pool shared by all programs; the figure and the
// buy link sit top right on this page per the approved wireframe.
function TokensAside({ balanceTokens }: { balanceTokens: number }) {
  return (
    <span className="admin-cell-muted" style={{ fontSize: 13 }}>
      <strong style={{ fontSize: 15 }}>{fmtTokens(balanceTokens)}</strong> tokens remaining ·{" "}
      <Link href="/portal/tokens">Buy Human Tokens</Link>
    </span>
  );
}

// The roadmap is the whole prioritised program of work; individual programs are
// the pieces you plan and submit. A prominent link to it sits at the top of this
// page when Edge8 has published a roadmap for the client.
function RoadmapCard() {
  return (
    <Link
      href="/portal/hub"
      className="admin-card admin-section-card"
      style={{ display: "flex", alignItems: "center", gap: 14, textDecoration: "none", color: "inherit", marginBottom: 16 }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <h2 className="admin-card-title" style={{ marginBottom: 4 }}>Client Hub</h2>
        <p className="admin-page-sub" style={{ margin: 0 }}>
          Your company-wide roadmap, work board, and documents, all in one place. Set your own
          priorities and propose new items.
        </p>
      </div>
      <span className="admin-btn admin-btn--primary" style={{ flex: "none", pointerEvents: "none" }}>
        Open Client Hub →
      </span>
    </Link>
  );
}

export default async function AiProgramsPage() {
  const actor = await requirePortalMember();
  const [programs, roadmap, usage] = await Promise.all([
    listPortalProgramSummaries(actor),
    hasBacklog(actor),
    getTokenUsage(actor),
  ]);
  // Creating programs is contributor+ (PR 2 roles); viewers browse only.
  const canCreate = contributorCompanyScope(actor).length > 0;

  if (programs.length === 0) {
    return (
      <div className="admin-content">
        <PageHead
          eyebrow="Client Portal"
          title="Your AI Programs"
          sub="This is where you plan and manage AI programs with Edge8. Start one two ways: upload your own documents, or build a plan with our guided assistant."
          action={<TokensAside balanceTokens={usage.balanceTokens} />}
        />
        {roadmap && <RoadmapCard />}
        <div className="mp-kpi-grid mp-kpi-grid--2up" style={{ gridAutoRows: "1fr" }}>
          <div className="admin-card admin-section-card" style={{ display: "flex", flexDirection: "column" }}>
            <h2 className="admin-card-title" style={{ marginBottom: 8 }}>Create a plan</h2>
            <p className="admin-page-sub" style={{ margin: 0, minHeight: 40 }}>
              A guided assistant walks you through mapping opportunities, picking one, and building a 5Ds AI Program Brief you can save and share.
            </p>
            <div style={{ marginTop: "auto", paddingTop: 16 }}>
              <Link href="/portal/programs/add/plan" className="admin-btn admin-btn--primary">
                Build a plan
              </Link>
            </div>
          </div>
          <div className="admin-card admin-section-card" style={{ display: "flex", flexDirection: "column" }}>
            <h2 className="admin-card-title" style={{ marginBottom: 8 }}>Upload documents</h2>
            <p className="admin-page-sub" style={{ margin: 0, minHeight: 40 }}>
              Already have a brief, plan, or supporting docs? Name the program and upload your files.
            </p>
            <div style={{ marginTop: "auto", paddingTop: 16 }}>
              <Link href="/portal/programs/add/upload" className="admin-btn">
                Upload documents
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-content">
      <PageHead
        eyebrow="Client Portal"
        title="Your AI Programs"
        sub={`${programs.length} ${programs.length === 1 ? "program" : "programs"}. Tokens are a company-wide pool shared across programs.`}
        action={
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>{/* layout-ok: mirrors the company 360 PageHead action stack verbatim */}
            <TokensAside balanceTokens={usage.balanceTokens} />
            {canCreate && (
              <Link href="/portal/programs/add" className="admin-btn admin-btn--primary">
                Add AI Program Plan
              </Link>
            )}
          </div>
        }
      />

      {roadmap && <RoadmapCard />}

      <div className="admin-card admin-section-card" style={{ marginBottom: 16 }}>
        <h2 className="admin-card-title" style={{ marginBottom: 10 }}>Your programs</h2>
        <div className="admin-list">
          {programs.map((p) => {
            const meta = [
              p.roadmapTotal > 0 ? `Roadmap ${p.roadmapDone}/${p.roadmapTotal} done` : "No roadmap items yet",
              ...(p.hasRepo
                ? [
                    `${fmtHours(p.deliveredHours)} hrs delivered`,
                    `${p.prsMergedLast7d} ${p.prsMergedLast7d === 1 ? "update" : "updates"} this week`,
                  ]
                : []),
            ].join(" · ");
            return (
              <Link
                key={p.id}
                href={`/portal/programs/${p.id}`}
                className="admin-list-row"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div className="admin-list-main">
                  <div className="admin-list-title">{p.name}</div>
                  {p.description && <div className="admin-list-sub">{p.description}</div>}
                  <div className="admin-list-sub">{meta}</div>
                </div>
                <div className="admin-list-aside">
                  <Badge tone={statusTone(p.status)}>{humanize(p.status)}</Badge>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
