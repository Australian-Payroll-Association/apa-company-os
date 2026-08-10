import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePortalMember } from "@/lib/portal-auth";
import { getProgramForActor, getPlanBriefForActor } from "@/lib/portal/ai-programs";
import { PageHead } from "@/components/admin/PageHead";
import { Badge, statusTone } from "@/components/admin/Badge";
import { formatDate, humanize } from "@/lib/admin/format";
import { BriefViewer } from "./BriefViewer";
import { ProgramDocuments } from "./ProgramDocuments";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "AI Program",
  description: "View your AI program, plans, and documents.",
};

export default async function AiProgramDetailPage({ params }: { params: { id: string } }) {
  const actor = await requirePortalMember();
  const program = await getProgramForActor(actor, params.id);
  if (!program) notFound();

  // Load brief HTML for chat plans that have one (few plans per program).
  const briefs = new Map<string, string>();
  await Promise.all(
    program.plans
      .filter((p) => p.method === "chat" && p.hasBrief)
      .map(async (p) => {
        const html = await getPlanBriefForActor(actor, p.id);
        if (html) briefs.set(p.id, html);
      }),
  );

  return (
    <div style={{ maxWidth: 880 }}>
      <PageHead
        eyebrow="AI Programs"
        title={program.name}
        sub={`Created ${formatDate(program.createdAt)}`}
        action={<Badge tone={statusTone(program.status)}>{humanize(program.status)}</Badge>}
      />

      <div className="admin-card admin-section-card" style={{ marginBottom: 16 }}>
        <h2 className="admin-card-title" style={{ marginBottom: 10 }}>Plans</h2>
        {program.plans.length === 0 ? (
          <div className="admin-empty">No plans yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {program.plans.map((pl) => (
              <div key={pl.id}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <strong>{pl.title}</strong>
                  <Badge>{pl.method === "chat" ? "Guided plan" : "Documents"}</Badge>
                  <span className="admin-cell-muted">{formatDate(pl.createdAt)}</span>
                </div>
                {pl.method === "chat" && briefs.has(pl.id) ? (
                  <BriefViewer html={briefs.get(pl.id)!} title={pl.title} />
                ) : pl.method === "chat" ? (
                  <div className="admin-cell-muted">This plan has no saved brief.</div>
                ) : (
                  <div className="admin-cell-muted">See documents below.</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="admin-card admin-section-card" style={{ marginBottom: 16 }}>
        <h2 className="admin-card-title" style={{ marginBottom: 10 }}>Documents</h2>
        {program.documents.length === 0 ? (
          <div className="admin-empty">No documents uploaded.</div>
        ) : (
          <ProgramDocuments documents={program.documents} />
        )}
      </div>

      <Link href="/portal/programs" className="admin-btn admin-btn--sm">← Back to Programs</Link>
    </div>
  );
}
