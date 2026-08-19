import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTeamMember } from "@/lib/team-auth";
import { getClientBoardViewForActor, getActorClientCompanies } from "@/lib/team/clients";
import { Badge } from "@/components/admin/Badge";
import { formatDate } from "@/lib/admin/format";
import { NEW_ASSIGNMENT_DAYS, PRIORITY_LABEL, PRIORITY_TONE, initials } from "@/lib/boards/types";
import {
  STAGE_WON,
  STAGE_LEAD,
  STAGE_NEUTRAL,
  STAGE_PROPOSAL,
  STAGE_DISCOVERY,
  STAGE_CONTRACT,
} from "@/lib/admin/stageColors";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata = { title: "Client Board" };

// The Board tab: exactly what the client sees on /portal/board (same shared
// view, same columns and cards, internal cards excluded). Read-only here; the
// full working board lives at /team/boards/[slug].

const NONDONE_ACCENTS = [STAGE_NEUTRAL, STAGE_LEAD, STAGE_PROPOSAL, STAGE_DISCOVERY, STAGE_CONTRACT];

export default async function TeamClientBoardTab({ params }: { params: { companyId: string } }) {
  const actor = await requireTeamMember();
  // Assignment gate first: an unassigned actor gets a 404 even to learn
  // whether a board exists.
  const companies = await getActorClientCompanies(actor);
  if (!companies.some((c) => c.id === params.companyId)) notFound();

  const board = await getClientBoardViewForActor(actor, params.companyId);

  if (!board) {
    return (
      <div className="admin-card admin-section-card" style={{ padding: 22 }}>
        <p className="admin-page-sub" style={{ margin: 0 }}>
          This client has no active work board yet.
        </p>
      </div>
    );
  }

  let nd = 0;
  const accents = board.columns.map((c) =>
    c.isDone ? STAGE_WON : NONDONE_ACCENTS[nd++ % NONDONE_ACCENTS.length],
  );

  return (
    <>
      <p className="admin-page-sub" style={{ margin: "0 0 14px" }}>
        {board.boardName}: what the client sees on their portal. Work the full board at{" "}
        <Link href={`/team/boards/${board.boardSlug}`}>Work Boards</Link>.
      </p>
      <div className="sap-kanban">
        {board.columns.map((col, i) => {
          const colCards = board.cards.filter((c) => c.columnId === col.id);
          return (
            <div className="sap-col" key={col.id}>
              <div className="sap-col-head">
                <span className="sap-col-dot" style={{ background: accents[i] }} />
                <span className="sap-col-label">{col.name}</span>
                <span className="sap-col-count">{colCards.length}</span>
              </div>
              <div className="sap-col-body">
                {colCards.map((c) => {
                  const isNew =
                    !c.done &&
                    Date.now() - new Date(c.createdAt).getTime() < NEW_ASSIGNMENT_DAYS * 86400000;
                  const who = c.assigneeName ?? "Edge8";
                  const mine = c.assigneeId === actor.personId;
                  return (
                    <div className="sap-card sap-card--static" key={c.id}>
                      <div className="sap-card-title">{c.title}</div>
                      <div className="sap-card-meta">
                        {isNew && <Badge tone="info">New</Badge>}
                        {mine && <Badge tone="ok">Mine</Badge>}
                        <Badge tone={PRIORITY_TONE[c.priority]}>{PRIORITY_LABEL[c.priority]}</Badge>
                        {c.sprintName && <Badge tone="info">{c.sprintName}</Badge>}
                      </div>
                      <div className="sap-card-meta">
                        <span className="sap-card-assignee">
                          <span className="sap-avatar">{initials(who)}</span>
                          {who}
                        </span>
                        {c.dueDate && (
                          <span className="sap-card-sub" style={{ marginLeft: "auto" }}>
                            {formatDate(c.dueDate)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {colCards.length === 0 && <div className="sap-col-empty">No cards</div>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
