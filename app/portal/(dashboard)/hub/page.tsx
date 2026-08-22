import type { Metadata } from "next";
import { requirePortalMember } from "@/lib/portal-auth";
import { isPortalAdmin, canContribute, contributorCompanyScope } from "@/lib/portal/roles";
import { getBacklogForActor, getGroupsForActor, getOverviewForActor } from "@/lib/portal/backlog";
import { getBoardForClient } from "@/lib/portal/boards";
import { listDocumentsForActor } from "@/lib/portal/documents";
import { PageHead } from "@/components/admin/PageHead";
import { Tabs, type TabDef } from "@/components/admin/Tabs";
import { BotText } from "@/components/assistant/BotText";
import { ClientBoardView } from "@/components/hub/ClientBoardView";
import { BacklogPortalView } from "../roadmap/BacklogPortalView";
import { DocumentsView } from "../documents/DocumentsView";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata: Metadata = { title: "Client Hub" };

// The client hub: one tabbed page for the delivery surfaces (Overview, Roadmap,
// Board, Documents), replacing the separate Work Board / Roadmap / Documents
// routes. It reuses the portal's own editable components, so contributors keep
// propose/prioritise and upload; every write re-checks role server-side.
export default async function PortalHubPage() {
  const actor = await requirePortalMember();
  const [items, groups, overview, board, documents] = await Promise.all([
    getBacklogForActor(actor),
    getGroupsForActor(actor),
    getOverviewForActor(actor),
    getBoardForClient(actor),
    listDocumentsForActor(actor),
  ]);

  // v1: single company in scope for writes (multi-company members are rare and
  // collapse to the first, matching the pages this replaces).
  const companyId = actor.companyScope[0] ?? "";
  const canPrioritize = companyId ? isPortalAdmin(actor, companyId) : false;
  const canPropose = companyId ? canContribute(actor, companyId) : false;

  const uploadScope = new Set(contributorCompanyScope(actor));
  const companies = actor.memberships
    .filter((m) => m.companyId && uploadScope.has(m.companyId))
    .map((m) => ({ companyId: m.companyId as string, companyName: m.companyName ?? "Your company" }));

  const openCards = (board?.cards ?? []).filter((c) => !c.done);

  const tabs: TabDef[] = [
    {
      key: "overview",
      label: "Overview",
      content: (
        <div className="team-glance">
          <div className="team-glance-cell">
            <span className="team-glance-label">Roadmap</span>
            <span className="team-glance-value">{items.length} item{items.length === 1 ? "" : "s"}</span>
          </div>
          <div className="team-glance-cell">
            <span className="team-glance-label">Work Board</span>
            <span className="team-glance-value">
              {board ? `${openCards.length} open card${openCards.length === 1 ? "" : "s"}` : "No board yet"}
            </span>
          </div>
          <div className="team-glance-cell">
            <span className="team-glance-label">Documents</span>
            <span className="team-glance-value">
              {documents.length === 0 ? "None yet" : `${documents.length} file${documents.length === 1 ? "" : "s"}`}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "roadmap",
      label: "Roadmap",
      count: items.length,
      content: (
        <>
          {overview && (
            <section className="admin-card admin-section-card admin-content" style={{ marginBottom: 18 }}>
              <h2 className="admin-card-title" style={{ marginBottom: 8 }}>Overview</h2>
              <div className="portal-roadmap-overview" style={{ fontSize: 14, lineHeight: 1.65 }}>
                <BotText text={overview} />
              </div>
            </section>
          )}
          <BacklogPortalView items={items} groups={groups} companyId={companyId} canPrioritize={canPrioritize} canPropose={canPropose} />
        </>
      ),
    },
    {
      key: "board",
      label: "Board",
      content: board ? (
        <ClientBoardView board={board} viewerPersonId={actor.personId} />
      ) : (
        <div className="admin-empty">No active work board yet.</div>
      ),
    },
    {
      key: "documents",
      label: "Documents",
      count: documents.length,
      content: <DocumentsView documents={documents} companies={companies} actorEmail={actor.email} />,
    },
  ];

  return (
    <div className="admin-content">
      <PageHead
        eyebrow="Delivery"
        title="Client Hub"
        sub="Your roadmap, work board, and documents, all in one place."
      />
      <Tabs tabs={tabs} />
    </div>
  );
}
