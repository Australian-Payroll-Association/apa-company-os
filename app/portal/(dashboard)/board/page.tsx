import { redirect } from "next/navigation";
import { requirePortalMember } from "@/lib/portal-auth";
import { getBoardForClient } from "@/lib/portal/boards";
import { PageHead } from "@/components/admin/PageHead";
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

export const metadata = { title: "Work Board" };

const NONDONE_ACCENTS = [STAGE_NEUTRAL, STAGE_LEAD, STAGE_PROPOSAL, STAGE_DISCOVERY, STAGE_CONTRACT];

export default async function PortalBoardPage() {
  const actor = await requirePortalMember();
  const board = await getBoardForClient(actor);
  // Entitlement gates the nav, but guard the route too.
  if (!board) redirect("/portal");

  let nd = 0;
  const accents = board.columns.map((c) =>
    c.isDone ? STAGE_WON : NONDONE_ACCENTS[nd++ % NONDONE_ACCENTS.length],
  );

  return (
    <>
      <PageHead
        eyebrow="Delivery"
        title="Work Board"
        sub={`${board.boardName}: what we're working on for you, and how far along it is.`}
      />
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
                  return (
                    <div className="sap-card sap-card--static" key={c.id}>
                      <div className="sap-card-title">{c.title}</div>
                      <div className="sap-card-meta">
                        {isNew && <Badge tone="info">New</Badge>}
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
