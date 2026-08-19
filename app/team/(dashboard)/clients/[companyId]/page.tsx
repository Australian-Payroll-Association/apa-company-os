import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTeamMember } from "@/lib/team-auth";
import {
  getClientRoadmapForActor,
  getClientBoardViewForActor,
  getClientDocumentsForActor,
} from "@/lib/team/clients";
import { Badge, type BadgeTone } from "@/components/admin/Badge";
import { PRIORITY_LABEL, effectivePriority, type BacklogPriority, type BacklogStatus } from "@/lib/client-backlog";
import { PRIORITY_LABEL as TASK_PRIORITY_LABEL, PRIORITY_TONE as TASK_PRIORITY_TONE } from "@/lib/boards/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Client Hub",
};

// The Overview tab: a glance strip (roadmap / board / documents at a glance)
// over stacked section cards, the same composition as the /team home. My tasks
// lead (the actionable thing), then the roadmap, then documents; sections only
// render when they have content. Every fetch is assignment-scoped in
// lib/team/clients. Color comes from the Badge pill system, nothing bespoke.

const PRIORITY_RANK: Record<BacklogPriority, number> = { now: 0, next: 1, later: 2, park: 3 };

// Backlog priority as a Badge tone: Now is the accent (it's the commitment),
// Next reads as on-track green, Later fades to neutral, Park warns.
const BACKLOG_PRIORITY_TONE: Record<BacklogPriority, BadgeTone> = {
  now: "info",
  next: "ok",
  later: "neutral",
  park: "warn",
};

// Status only earns a pill when it says something the priority doesn't.
const STATUS_TONE: Partial<Record<BacklogStatus, BadgeTone>> = {
  shipped: "ok",
  active: "info",
  proposed: "pink",
};

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function fileExt(filename: string): string | null {
  const m = filename.match(/\.([a-zA-Z0-9]{1,5})$/);
  return m ? m[1].toUpperCase() : null;
}

export default async function TeamClientOverviewPage({ params }: { params: { companyId: string } }) {
  const actor = await requireTeamMember();
  const [roadmap, board, documents] = await Promise.all([
    getClientRoadmapForActor(actor, params.companyId),
    getClientBoardViewForActor(actor, params.companyId),
    getClientDocumentsForActor(actor, params.companyId),
  ]);
  if (!roadmap) notFound();

  const base = `/team/clients/${params.companyId}`;

  const ranked = roadmap.items
    .map((it) => ({ ...it, priority: effectivePriority(it) }))
    .filter((it) => it.priority !== "park")
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
  const topItems = ranked.slice(0, 5);
  const nowCount = ranked.filter((it) => it.priority === "now").length;

  const openCards = (board?.cards ?? []).filter((c) => !c.done);
  const myOpenCards = openCards.filter((c) => c.assigneeId === actor.personId);
  const docs = documents ?? [];
  const latestDocs = docs.slice(0, 3);

  return (
    <div style={{ maxWidth: 880 }}>
      <div className="team-glance" style={{ marginBottom: 20 }}>
        <div className="team-glance-cell">
          <span className="team-glance-label">Roadmap</span>
          <span className="team-glance-value">
            {roadmap.items.length} item{roadmap.items.length === 1 ? "" : "s"}
          </span>
          <span className="team-glance-note">
            {nowCount > 0 ? `${nowCount} marked Now · ` : ""}
            <Link href={`${base}/roadmap`}>Open →</Link>
          </span>
        </div>
        <div className="team-glance-cell">
          <span className="team-glance-label">Board</span>
          <span className="team-glance-value">
            {board ? `${openCards.length} open card${openCards.length === 1 ? "" : "s"}` : "No board yet"}
          </span>
          <span className="team-glance-note">
            {board ? (
              <>
                {myOpenCards.length > 0 ? `${myOpenCards.length} assigned to you · ` : ""}
                <Link href={`${base}/board`}>Open →</Link>
              </>
            ) : (
              "Boards are set up by Edge8 admin"
            )}
          </span>
        </div>
        <div className="team-glance-cell">
          <span className="team-glance-label">Documents</span>
          <span className="team-glance-value">
            {docs.length === 0 ? "None yet" : `${docs.length} file${docs.length === 1 ? "" : "s"}`}
          </span>
          <span className="team-glance-note">
            {docs.length > 0 ? `Latest ${formatDay(docs[0].createdAt)} · ` : ""}
            <Link href={`${base}/documents`}>{docs.length > 0 ? "Open →" : "Upload →"}</Link>
          </span>
        </div>
      </div>

      {myOpenCards.length > 0 && board && (
        <section className="admin-card admin-section-card" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
            <h2 className="admin-card-title" style={{ margin: 0 }}>My tasks on {board.boardName}</h2>
            <Link href={`${base}/board`} className="admin-cell-muted" style={{ fontSize: 12 }}>
              Open board →
            </Link>
          </div>
          <div className="admin-list">
            {myOpenCards.slice(0, 4).map((c) => (
              <Link
                key={c.id}
                href={`${base}/board`}
                className="admin-list-row"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div className="admin-list-main">
                  <div className="admin-list-title">{c.title}</div>
                  {c.dueDate && <div className="admin-list-sub">Due {formatDay(c.dueDate)}</div>}
                </div>
                <div className="admin-list-aside">
                  <Badge tone={TASK_PRIORITY_TONE[c.priority]}>{TASK_PRIORITY_LABEL[c.priority] ?? c.priority}</Badge>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {topItems.length > 0 && (
        <section className="admin-card admin-section-card" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
            <h2 className="admin-card-title" style={{ margin: 0 }}>Next on the roadmap</h2>
            <Link href={`${base}/roadmap`} className="admin-cell-muted" style={{ fontSize: 12 }}>
              View all {roadmap.items.length} →
            </Link>
          </div>
          <div className="admin-list">
            {topItems.map((it) => {
              const statusTone = STATUS_TONE[it.status];
              return (
                <Link
                  key={it.id}
                  href={`${base}/roadmap`}
                  className="admin-list-row"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div className="admin-list-main">
                    <div className="admin-list-title">{it.ref ? `${it.ref} · ` : ""}{it.title}</div>
                  </div>
                  <div className="admin-list-aside" style={{ flexDirection: "row", alignItems: "center" }}>
                    {statusTone && <Badge tone={statusTone}>{it.status}</Badge>}
                    <Badge tone={BACKLOG_PRIORITY_TONE[it.priority]}>{PRIORITY_LABEL[it.priority]}</Badge>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {latestDocs.length > 0 && (
        <section className="admin-card admin-section-card" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
            <h2 className="admin-card-title" style={{ margin: 0 }}>Latest documents</h2>
            <Link href={`${base}/documents`} className="admin-cell-muted" style={{ fontSize: 12 }}>
              All {docs.length} →
            </Link>
          </div>
          <div className="admin-list">
            {latestDocs.map((d) => {
              const ext = fileExt(d.filename);
              return (
                <div className="admin-list-row" key={d.id}>
                  <div className="admin-list-main">
                    <div className="admin-list-title">{d.filename}</div>
                    <div className="admin-list-sub">
                      {formatDay(d.createdAt)}
                      {(d.uploaderName || d.uploadedBy) && ` · ${d.uploaderName ?? d.uploadedBy}`}
                    </div>
                  </div>
                  {ext && (
                    <div className="admin-list-aside">
                      <Badge tone="info">{ext}</Badge>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
