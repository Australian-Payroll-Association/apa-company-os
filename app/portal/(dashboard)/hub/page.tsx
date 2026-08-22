import type { Metadata } from "next";
import { requirePortalMember } from "@/lib/portal-auth";
import { isPortalAdmin, canContribute, contributorCompanyScope, adminCompanyScope } from "@/lib/portal/roles";
import { getBacklogForActor, getGroupsForActor, getOverviewForActor } from "@/lib/portal/backlog";
import { getBoardForClient } from "@/lib/portal/boards";
import { listDocumentsForActor } from "@/lib/portal/documents";
import { getMeetingsForActor } from "@/lib/portal/meetings";
import { PageHead } from "@/components/admin/PageHead";
import { Tabs, type TabDef } from "@/components/admin/Tabs";
import { BotText } from "@/components/assistant/BotText";
import { ClientBoardView } from "@/components/hub/ClientBoardView";
import { MeetingsPanel } from "@/components/hub/MeetingsPanel";
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
  const [items, groups, overview, board, documents, meetings] = await Promise.all([
    getBacklogForActor(actor),
    getGroupsForActor(actor),
    getOverviewForActor(actor),
    getBoardForClient(actor),
    listDocumentsForActor(actor),
    getMeetingsForActor(actor),
  ]);
  // Managers (portal admins) always get the Meetings tab; other members only
  // when a published meeting exists.
  const isManager = adminCompanyScope(actor).length > 0;
  const showMeetings = isManager || meetings.length > 0;

  // v1: single company in scope for writes (multi-company members are rare and
  // collapse to the first, matching the pages this replaces).
  const companyId = actor.companyScope[0] ?? "";
  const canPrioritize = companyId ? isPortalAdmin(actor, companyId) : false;
  const canPropose = companyId ? canContribute(actor, companyId) : false;

  const uploadScope = new Set(contributorCompanyScope(actor));
  const companies = actor.memberships
    .filter((m) => m.companyId && uploadScope.has(m.companyId))
    .map((m) => ({ companyId: m.companyId as string, companyName: m.companyName ?? "Your company" }));

  const tabs: TabDef[] = [
    {
      key: "board",
      label: "Work Board",
      content: (
        <section className="admin-card admin-section-card">
          {board ? (
            <ClientBoardView board={board} viewerPersonId={actor.personId} />
          ) : (
            <div className="admin-empty">No active work board yet.</div>
          )}
        </section>
      ),
    },
    {
      key: "roadmap",
      label: "Roadmap",
      count: items.length,
      content: (
        <>
          {overview && (
            <section className="admin-card admin-section-card admin-content" style={{ marginBottom: 16 }}>
              <h2 className="admin-card-title" style={{ marginBottom: 8 }}>Overview</h2>
              <div className="portal-roadmap-overview" style={{ fontSize: 14, lineHeight: 1.65 }}>
                <BotText text={overview} />
              </div>
            </section>
          )}
          <section className="admin-card admin-section-card">
            <BacklogPortalView items={items} groups={groups} companyId={companyId} canPrioritize={canPrioritize} canPropose={canPropose} />
          </section>
        </>
      ),
    },
    {
      key: "documents",
      label: "Documents",
      count: documents.length,
      content: <DocumentsView documents={documents} companies={companies} actorEmail={actor.email} />,
    },
    ...(showMeetings
      ? [
          {
            key: "meetings",
            label: "Meetings",
            count: meetings.length,
            content: (
              <section className="admin-card admin-section-card">
                <MeetingsPanel meetings={meetings} detailBasePath="/portal/meetings" />
              </section>
            ),
          } as TabDef,
        ]
      : []),
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
