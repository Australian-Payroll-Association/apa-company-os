import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTeamMember } from "@/lib/team-auth";
import {
  getClientRoadmapForActor,
  getClientBoardViewForActor,
  getClientDocumentsForActor,
} from "@/lib/team/clients";
import { PRIORITY_LABEL, effectivePriority, type BacklogPriority } from "@/lib/client-backlog";
import { PRIORITY_LABEL as TASK_PRIORITY_LABEL } from "@/lib/boards/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Client Hub",
};

// The Overview tab: a working summary of the client — top roadmap items, the
// state of the board (and my share of it), and the latest documents. Each card
// links into its tab. Every fetch is assignment-scoped in lib/team/clients.

const PRIORITY_RANK: Record<BacklogPriority, number> = { now: 0, next: 1, later: 2, park: 3 };

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
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

  const topItems = roadmap.items
    .map((it) => ({ ...it, priority: effectivePriority(it) }))
    .filter((it) => it.priority !== "park")
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])
    .slice(0, 5);

  const openCards = (board?.cards ?? []).filter((c) => !c.done);
  const myOpenCards = openCards.filter((c) => c.assigneeId === actor.personId);
  const latestDocs = (documents ?? []).slice(0, 3);

  return (
    <div className="admin-grid" style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
      <section className="admin-card admin-section-card">
        <h2 className="admin-card-title" style={{ marginBottom: 10 }}>
          <Link href={`${base}/roadmap`}>Roadmap</Link>
        </h2>
        {topItems.length === 0 ? (
          <div className="admin-empty">No roadmap items yet.</div>
        ) : (
          <div className="admin-list">
            {topItems.map((it) => (
              <div className="admin-list-row" key={it.id}>
                <div className="admin-list-main">
                  <div className="admin-list-title">
                    {it.ref ? `${it.ref} · ` : ""}{it.title}
                  </div>
                  <div className="admin-list-sub">{PRIORITY_LABEL[it.priority]}{it.status !== "proposed" ? ` · ${it.status}` : ""}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="admin-page-sub" style={{ margin: "10px 0 0" }}>
          <Link href={`${base}/roadmap`}>All {roadmap.items.length} item{roadmap.items.length === 1 ? "" : "s"} →</Link>
        </p>
      </section>

      <section className="admin-card admin-section-card">
        <h2 className="admin-card-title" style={{ marginBottom: 10 }}>
          <Link href={`${base}/board`}>Board</Link>
        </h2>
        {!board ? (
          <div className="admin-empty">No active work board for this client yet.</div>
        ) : (
          <>
            <p className="admin-page-sub" style={{ margin: "0 0 10px" }}>
              {board.boardName}: {openCards.length} open card{openCards.length === 1 ? "" : "s"}, {myOpenCards.length} assigned to you.
            </p>
            {myOpenCards.length > 0 && (
              <div className="admin-list">
                {myOpenCards.slice(0, 4).map((c) => (
                  <div className="admin-list-row" key={c.id}>
                    <div className="admin-list-main">
                      <div className="admin-list-title">{c.title}</div>
                      <div className="admin-list-sub">
                        {TASK_PRIORITY_LABEL[c.priority] ?? c.priority}
                        {c.dueDate && ` · due ${formatDay(c.dueDate)}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="admin-page-sub" style={{ margin: "10px 0 0" }}>
              <Link href={`${base}/board`}>Client view →</Link>
              {" · "}
              <Link href={`/team/boards/${board.boardSlug}`}>Full board →</Link>
            </p>
          </>
        )}
      </section>

      <section className="admin-card admin-section-card">
        <h2 className="admin-card-title" style={{ marginBottom: 10 }}>
          <Link href={`${base}/documents`}>Documents</Link>
        </h2>
        {latestDocs.length === 0 ? (
          <div className="admin-empty">No documents yet.</div>
        ) : (
          <div className="admin-list">
            {latestDocs.map((d) => (
              <div className="admin-list-row" key={d.id}>
                <div className="admin-list-main">
                  <div className="admin-list-title">{d.filename}</div>
                  <div className="admin-list-sub">
                    {formatDay(d.createdAt)}
                    {(d.uploaderName || d.uploadedBy) && ` · ${d.uploaderName ?? d.uploadedBy}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="admin-page-sub" style={{ margin: "10px 0 0" }}>
          <Link href={`${base}/documents`}>
            {documents && documents.length > 0
              ? `All ${documents.length} document${documents.length === 1 ? "" : "s"} →`
              : "Upload the first document →"}
          </Link>
        </p>
      </section>
    </div>
  );
}
