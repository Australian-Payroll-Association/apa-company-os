import Link from "next/link";
import { requirePortalMember } from "@/lib/portal-auth";
import { listProgramsForActor, type PortalAiProgram } from "@/lib/portal/ai-programs";
import { hasBacklog } from "@/lib/portal/backlog";
import { PageHead } from "@/components/admin/PageHead";
import { Badge, statusTone } from "@/components/admin/Badge";
import { formatDate, humanize } from "@/lib/admin/format";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Programs",
  description: "Plan and manage your AI programs with Edge8.",
};

function methodLabel(method: string): string {
  return method === "chat" ? "Guided plan" : "Documents";
}

// The roadmap is the whole prioritised program of work; individual programs are
// the pieces you plan and submit. A prominent link to it sits at the top of this
// page when Edge8 has published a roadmap for the client.
function RoadmapCard() {
  return (
    <Link
      href="/portal/backlog"
      className="admin-card admin-section-card"
      style={{ display: "flex", alignItems: "center", gap: 14, textDecoration: "none", color: "inherit", marginBottom: 16 }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <h2 className="admin-card-title" style={{ marginBottom: 4 }}>Roadmap</h2>
        <p className="admin-page-sub" style={{ margin: 0 }}>
          Your full prioritised program of work — every opportunity, grouped and ranked. Set your
          own priorities and propose new items.
        </p>
      </div>
      <span className="admin-btn admin-btn--primary" style={{ flex: "none", pointerEvents: "none" }}>
        Open roadmap →
      </span>
    </Link>
  );
}

// Flattened plan view for the "Program Plans" row, newest first.
function allPlans(programs: PortalAiProgram[]) {
  return programs
    .flatMap((p) => p.plans.map((pl) => ({ ...pl, programId: p.id, programName: p.name })))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export default async function AiProgramsPage() {
  const actor = await requirePortalMember();
  const [programs, roadmap] = await Promise.all([
    listProgramsForActor(actor),
    hasBacklog(actor),
  ]);

  if (programs.length === 0) {
    return (
      <div style={{ maxWidth: 880 }}>
        <PageHead
          eyebrow="Client Portal"
          title="Programs"
          sub="This is where you plan and manage AI programs with Edge8. Start one two ways: upload your own documents, or build a plan with our guided assistant."
        />
        {roadmap && <RoadmapCard />}
        <div className="mp-kpi-grid mp-kpi-grid--2up" style={{ gridAutoRows: "1fr" }}>
          <div className="admin-card admin-section-card" style={{ display: "flex", flexDirection: "column" }}>
            <h2 className="admin-card-title" style={{ marginBottom: 8 }}>Create a plan</h2>
            <p className="admin-page-sub" style={{ margin: 0, minHeight: 40 }}>
              A guided assistant walks you through mapping opportunities, picking one, and building a 5Ds AI Program Brief you can save and share.
            </p>
            <div style={{ marginTop: "auto", paddingTop: 16 }}>
              <Link href="/portal/projects/add/plan" className="admin-btn admin-btn--primary">
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
              <Link href="/portal/projects/add/upload" className="admin-btn">
                Upload documents
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const plans = allPlans(programs);

  return (
    <div style={{ maxWidth: 880 }}>
      <PageHead
        eyebrow="Client Portal"
        title="Programs"
        sub={`${programs.length} ${programs.length === 1 ? "program" : "programs"}.`}
        action={
          <Link href="/portal/projects/add" className="admin-btn admin-btn--primary">
            Add AI Program Plan
          </Link>
        }
      />

      {roadmap && <RoadmapCard />}

      <div className="admin-card admin-section-card" style={{ marginBottom: 16 }}>
        <h2 className="admin-card-title" style={{ marginBottom: 10 }}>Your programs</h2>
        <div className="admin-list">
          {programs.map((p) => (
            <Link
              key={p.id}
              href={`/portal/projects/${p.id}`}
              className="admin-list-row"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div className="admin-list-main">
                <div className="admin-list-title">{p.name}</div>
                <div className="admin-list-sub">
                  {formatDate(p.createdAt)}
                  {p.plans.length > 0 && ` · ${p.plans.length} ${p.plans.length === 1 ? "plan" : "plans"}`}
                  {p.documents.length > 0 && ` · ${p.documents.length} ${p.documents.length === 1 ? "document" : "documents"}`}
                </div>
              </div>
              <div className="admin-list-aside">
                <Badge tone={statusTone(p.status)}>{humanize(p.status)}</Badge>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {plans.length > 0 && (
        <div className="admin-card admin-section-card">
          <h2 className="admin-card-title" style={{ marginBottom: 10 }}>Program plans</h2>
          <div className="admin-list">
            {plans.map((pl) => (
              <Link
                key={pl.id}
                href={`/portal/projects/${pl.programId}`}
                className="admin-list-row"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div className="admin-list-main">
                  <div className="admin-list-title">{pl.title}</div>
                  <div className="admin-list-sub">
                    {pl.programName} · {formatDate(pl.createdAt)}
                  </div>
                </div>
                <div className="admin-list-aside">
                  <Badge>{methodLabel(pl.method)}</Badge>
                  {pl.method === "chat" && pl.hasBrief && <Badge tone="ok">Brief ready</Badge>}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
