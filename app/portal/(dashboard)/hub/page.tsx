import type { Metadata } from "next";
import Link from "next/link";
import { requirePortalMember } from "@/lib/portal-auth";
import { isPortalAdmin, canContribute, contributorCompanyScope, adminCompanyScope } from "@/lib/portal/roles";
import { getBacklogForActor, getGroupsForActor, getOverviewForActor } from "@/lib/portal/backlog";
import { getBoardForClient, type PortalBoardData } from "@/lib/portal/boards";
import { listDocumentsForActor } from "@/lib/portal/documents";
import { getMeetingsForActor } from "@/lib/portal/meetings";
import {
  listPortalProgramSummaries,
  listHubBoardsForActor,
  getBoardViewForActor,
} from "@/lib/portal/program-hub";
import { PageHead } from "@/components/admin/PageHead";
import { Tabs, type TabDef } from "@/components/admin/Tabs";
import { Badge, statusTone } from "@/components/admin/Badge";
import { BotText } from "@/components/assistant/BotText";
import { ClientBoardView } from "@/components/hub/ClientBoardView";
import { MeetingsPanel } from "@/components/hub/MeetingsPanel";
import { BacklogPortalView } from "../roadmap/BacklogPortalView";
import { DocumentsView } from "../documents/DocumentsView";
import { humanize } from "@/lib/admin/format";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata: Metadata = { title: "Client Hub" };

function fmtHours(n: number): string {
  return (Math.round(n * 10) / 10).toLocaleString("en-US", { maximumFractionDigits: 1 });
}

// The client hub: one tabbed page for the delivery surfaces (Overview, Roadmap,
// Board, Documents), replacing the separate Work Board / Roadmap / Documents
// routes. It reuses the portal's own editable components, so contributors keep
// propose/prioritise and upload; every write re-checks role server-side.
//
// Organized by AI Program (same rules as the admin hub): when programs exist,
// the tabs show ONLY company-wide (untagged) rows, so nothing is presented
// twice; program-tagged rows live in their program page, reached via the
// programs strip on top. With zero programs, everything behaves as before.
export default async function PortalHubPage() {
  const actor = await requirePortalMember();
  const [items, groups, overview, documents, meetings, programs, hubBoards] = await Promise.all([
    getBacklogForActor(actor),
    getGroupsForActor(actor),
    getOverviewForActor(actor),
    listDocumentsForActor(actor),
    getMeetingsForActor(actor),
    listPortalProgramSummaries(actor),
    listHubBoardsForActor(actor),
  ]);
  const hasPrograms = programs.length > 0;

  // Company-wide slices: untagged rows only once programs exist.
  const untaggedBoards = hubBoards.filter((b) => !b.aiProgramId);
  const roadmapItems = hasPrograms ? items.filter((i) => !i.ai_program_id) : items;
  // Company-wide sections only: a program-tagged group's header never renders
  // here, even when an untagged item still sits under its key (same strictness
  // as the program page's group filter; Edge8 retags such strays in admin).
  const roadmapGroups = hasPrograms ? groups.filter((g) => g.ai_program_id === null) : groups;
  const hubMeetings = hasPrograms ? meetings.filter((m) => !m.aiProgramId) : meetings;
  const hubDocuments = hasPrograms ? documents.filter((d) => !d.programId) : documents;

  // First active board; with programs present, first active UNTAGGED board
  // (program boards render in their program page instead).
  const board: PortalBoardData | null = hasPrograms
    ? untaggedBoards[0]
      ? await getBoardViewForActor(actor, untaggedBoards[0].id)
      : null
    : await getBoardForClient(actor);

  // Both tabs drop together only when at least one row is program-tagged AND
  // nothing company-wide remains (zero loss of access; each tagged row is
  // reachable in its program page). The tagged-row guard keeps a company with
  // programs but no boards/items from vacuously losing the tabs. Mirrors the
  // admin hub rule.
  const taggedBoardCount = hubBoards.length - untaggedBoards.length;
  const taggedItemCount = items.length - roadmapItems.length;
  const dropCompanyWideTabs =
    hasPrograms &&
    taggedBoardCount + taggedItemCount > 0 &&
    untaggedBoards.length === 0 &&
    roadmapItems.length === 0;

  // Managers (portal admins) always get the Meetings tab; other members only
  // when a published meeting exists.
  const isManager = adminCompanyScope(actor).length > 0;
  const showMeetings = isManager || hubMeetings.length > 0;

  // v1: single company in scope for writes (multi-company members are rare and
  // collapse to the first, matching the pages this replaces).
  const companyId = actor.companyScope[0] ?? "";
  const canPrioritize = companyId ? isPortalAdmin(actor, companyId) : false;
  const canPropose = companyId ? canContribute(actor, companyId) : false;

  const uploadScope = new Set(contributorCompanyScope(actor));
  const companies = actor.memberships
    .filter((m) => m.companyId && uploadScope.has(m.companyId))
    .map((m) => ({ companyId: m.companyId as string, companyName: m.companyName ?? "Your company" }));

  const companyWideTabs: TabDef[] = dropCompanyWideTabs
    ? []
    : [
        {
          key: "board",
          label: hasPrograms ? "Work Board (company-wide)" : "Work Board",
          content: board ? (
            <ClientBoardView board={board} viewerPersonId={actor.personId} />
          ) : (
            <section className="admin-card admin-section-card">
              <div className="admin-empty">
                {hasPrograms
                  ? "No company-wide work board. Program boards live in their AI Program page."
                  : "No active work board yet."}
              </div>
            </section>
          ),
        },
        {
          key: "roadmap",
          label: hasPrograms ? "Roadmap (company-wide)" : "Roadmap",
          count: roadmapItems.length,
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
              <BacklogPortalView items={roadmapItems} groups={roadmapGroups} companyId={companyId} canPrioritize={canPrioritize} canPropose={canPropose} />
            </>
          ),
        },
      ];

  const tabs: TabDef[] = [
    ...companyWideTabs,
    {
      key: "documents",
      label: "Documents",
      count: hubDocuments.length,
      content: (
        <div style={{ maxWidth: 900 }}>
          <DocumentsView documents={hubDocuments} companies={companies} actorEmail={actor.email} />
        </div>
      ),
    },
    ...(showMeetings
      ? [
          {
            key: "meetings",
            label: "Meetings",
            count: hubMeetings.length,
            content: (
              <section className="admin-card admin-section-card" style={{ maxWidth: 900 }}>
                <MeetingsPanel meetings={hubMeetings} detailBasePath="/portal/meetings" />
              </section>
            ),
          } as TabDef,
        ]
      : []),
  ];

  return (
    <div>
      <PageHead
        eyebrow="Delivery"
        title="Client Hub"
        sub={
          hasPrograms
            ? "Your AI Programs, plus the company-wide roadmap, work board, and documents."
            : "Your roadmap, work board, and documents, all in one place."
        }
      />

      {hasPrograms && (
        <div className="admin-card admin-section-card" style={{ marginBottom: 16 }}>
          <div className="hub-band-head" style={{ marginBottom: 10 }}>
            <h2 className="admin-card-title">AI Programs</h2>
            <Link href="/portal/programs" style={{ fontSize: 13, fontWeight: 600 }}>
              View all →
            </Link>
          </div>
          <div className="admin-list">
            {programs.map((p) => (
              <Link
                key={p.id}
                href={`/portal/programs/${p.id}`}
                className="admin-list-row"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div className="admin-list-main">
                  <div className="admin-list-title">{p.name}</div>
                  <div className="admin-list-sub">
                    {p.roadmapTotal > 0 ? `Roadmap ${p.roadmapDone}/${p.roadmapTotal} done` : "No roadmap items yet"}
                    {p.hasRepo && ` · ${fmtHours(p.deliveredHours)} hrs delivered`}
                  </div>
                </div>
                <div className="admin-list-aside">
                  <Badge tone={statusTone(p.status)}>{humanize(p.status)}</Badge>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <Tabs tabs={tabs} />
    </div>
  );
}
