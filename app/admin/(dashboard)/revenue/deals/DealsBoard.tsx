"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { KanbanBoard, type KanbanColumn } from "@/components/admin/KanbanBoard";
import { DetailDrawer } from "@/components/admin/DetailDrawer";
import { Badge, statusTone } from "@/components/admin/Badge";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { useAutosave } from "@/components/admin/useAutosave";
import { AutosaveIndicator } from "@/components/admin/AutosaveStatus";
import { formatCents, formatDate, humanize } from "@/lib/admin/format";
import {
  addDealCommunication,
  archiveDeal,
  bulkArchiveDeals,
  bulkDeleteDeals,
  bulkUpdateDeals,
  createReferrerForDeal,
  decideHandoff,
  deleteDeal,
  demoteDealToLead,
  getDealCommunications,
  moveDealStage,
  reorderDeals,
  restoreDeal,
  searchCompanies,
  searchPeople,
  setDealReferrer,
  setDealReferrerCompany,
  updateDeal,
  type Communication,
  type CompanyHit,
  type PersonHit,
} from "./actions";
import { HANDOFF_COLUMN_ID } from "./constants";

export type StageOption = { id: string; name: string };

// Extra input a stage move may require: a reason when landing on a lost stage,
// the final deal amount (in the deal's currency) when landing on a won one.
export type MoveOpts = { lostReason?: string; wonAmount?: number };

export type DealCard = {
  id: string;
  columnId: string;
  stageId: string | null;
  position: number;
  title: string | null;
  personId: string | null;
  personName: string | null;
  companyName: string | null;
  amountCents: number | null;
  amountUsdCents: number | null;
  currency: string | null;
  probability: number | null;
  status: string | null;
  expectedClose: string | null;
  source: string | null;
  nextStep: string | null;
  nextStepDate: string | null;
  proposalUrl: string | null;
  contractUrl: string | null;
  handoffStatus: string;
  lostReason: string | null;
  archivedAt: string | null;
  updatedAt: string | null;
  referrerId: string | null;
  referrerName: string | null;
  referrerCompanyId: string | null;
  referrerCompanyName: string | null;
};

const CURRENCIES = ["usd", "eur", "gbp", "aud", "sgd", "vnd"];

const LOST_REASONS = [
  ["price", "Price"],
  ["competitor", "Chose competitor"],
  ["no_decision", "No decision"],
  ["bad_fit", "Bad fit"],
  ["bad_timing", "Bad timing"],
  ["ghosted", "Ghosted"],
  ["other", "Other"],
] as const;

const REJECT_REASONS = [
  ["not_qualified", "Not qualified"],
  ["bad_fit", "Bad fit"],
  ["duplicate", "Duplicate"],
  ["bad_timing", "Bad timing"],
  ["other", "Other"],
] as const;

function idleDays(updatedAt: string | null): number | null {
  if (!updatedAt) return null;
  const days = Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86_400_000);
  return days >= 0 ? days : null;
}

// Client-side free-text filter for the board and list. `query` is already
// trimmed + lowercased. Matches title, contact, company, referrer and source.
function cardMatches(c: DealCard, query: string): boolean {
  if (!query) return true;
  return [c.title, c.personName, c.companyName, c.referrerName, c.referrerCompanyName, c.source].some((v) =>
    v ? v.toLowerCase().includes(query) : false,
  );
}

type ListSort = { key: string; dir: "asc" | "desc" };

function dealSortValue(c: DealCard, key: string, stageLabelMap: Map<string, string>): string | number | null {
  switch (key) {
    case "deal":
      return (c.title || c.personName || c.companyName || "").toLowerCase();
    case "stage":
      return c.columnId === HANDOFF_COLUMN_ID ? "new from sdr" : (stageLabelMap.get(c.columnId) ?? "").toLowerCase();
    case "amount":
      return c.amountUsdCents;
    case "prob":
      return c.probability;
    case "nextstep":
      return c.nextStepDate;
    case "status":
      return c.status ?? "";
    default:
      return null;
  }
}

// Client-side sort for the list view. Empty/null values always sort last,
// regardless of direction, so a click never buries the populated rows.
function makeDealComparator(sort: ListSort, stageLabelMap: Map<string, string>) {
  const mul = sort.dir === "desc" ? -1 : 1;
  return (a: DealCard, b: DealCard) => {
    const va = dealSortValue(a, sort.key, stageLabelMap);
    const vb = dealSortValue(b, sort.key, stageLabelMap);
    const aEmpty = va === null || va === undefined || va === "";
    const bEmpty = vb === null || vb === undefined || vb === "";
    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1;
    if (bEmpty) return -1;
    const d = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
    return d * mul;
  };
}

function NextStepLine({ card }: { card: DealCard }) {
  if (card.status !== "open") return null;
  if (!card.nextStepDate) {
    return (
      <div className="sap-card-sub" style={{ color: "var(--admin-err-ink)", fontWeight: 600 }}>
        No next step
      </div>
    );
  }
  return (
    <div className="sap-card-sub">
      → {card.nextStep || "next step"} · {formatDate(card.nextStepDate)}
    </div>
  );
}

export function DealsBoard({
  columns,
  initialCards,
  lostStageIds,
  wonStageIds,
  stageOptions,
}: {
  columns: KanbanColumn[];
  initialCards: DealCard[];
  lostStageIds: string[];
  wonStageIds: string[];
  stageOptions: StageOption[];
}) {
  const router = useRouter();
  const [cards, setCards] = useState<DealCard[]>(initialCards);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [listSort, setListSort] = useState<ListSort | null>(null);
  // Board (kanban) is the default; the last-picked view is remembered in
  // localStorage. Init to "board" on both server and first client render to
  // avoid a hydration mismatch, then hydrate the saved choice in an effect.
  const [view, setView] = useState<"board" | "list">("board");
  useEffect(() => {
    const saved = localStorage.getItem("deals-view");
    if (saved === "board" || saved === "list") setView(saved);
  }, []);
  function changeView(next: "board" | "list") {
    setView(next);
    clearSelection();
    try {
      localStorage.setItem("deals-view", next);
    } catch {
      // private mode / storage disabled — the toggle still works this session.
    }
  }
  const [banner, setBanner] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingLost, setPendingLost] = useState<
    { cardId: string; toColumnId: string; toIndex?: number } | null
  >(null);
  const [pendingWon, setPendingWon] = useState<
    { cardId: string; toColumnId: string; toIndex?: number } | null
  >(null);
  const [wonAmount, setWonAmount] = useState("");
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [search, setSearch] = useState("");

  const lostSet = new Set(lostStageIds);
  const wonSet = new Set(wonStageIds);
  const query = search.trim().toLowerCase();
  // Sort by position (not just filter) so a reorder's patched position values
  // are always reflected, regardless of the underlying array's insert order.
  const byPosition = (a: DealCard, b: DealCard) => a.position - b.position;
  const activeCards = cards.filter((c) => !c.archivedAt && cardMatches(c, query)).sort(byPosition);
  const archivedCards = cards.filter((c) => c.archivedAt && cardMatches(c, query)).sort(byPosition);
  // The two "nothing new to look at" entry columns — the synthetic SDR
  // handoff bucket and the first real stage — collapse away when empty.
  // Every stage after that (Contacted onward) always shows, even at zero
  // deals, so it still reads as "we have nothing here" rather than vanishing.
  const firstStageColumnId = columns.find((c) => c.id !== HANDOFF_COLUMN_ID)?.id;
  const collapsibleIds = new Set([HANDOFF_COLUMN_ID, firstStageColumnId]);
  const boardColumns = columns.filter(
    (col) => !collapsibleIds.has(col.id) || activeCards.some((c) => c.columnId === col.id),
  );
  const listCards = showArchived ? archivedCards : activeCards;
  const stageLabelMap = new Map(columns.map((c) => [c.id, c.label]));
  const sortedListCards = listSort ? [...listCards].sort(makeDealComparator(listSort, stageLabelMap)) : listCards;
  const selected = cards.find((c) => c.id === selectedId) ?? null;

  function sortList(key: string) {
    setListSort((s) => (s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  function patchCard(id: string, patch: Partial<DealCard>) {
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    router.refresh();
  }
  function removeCard(id: string) {
    setCards((cs) => cs.filter((c) => c.id !== id));
    setSelectedIds((s) => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });
    router.refresh();
  }

  // Reorders `toColumnId`'s cards so `cardId` lands at `toIndex`, returning the
  // new full order for that column (used both to patch local state and to
  // persist positions for every card whose rank shifted).
  function reorderColumn(all: DealCard[], cardId: string, toColumnId: string, toIndex?: number): DealCard[] {
    const destBefore = all.filter((c) => c.columnId === toColumnId && c.id !== cardId);
    const insertAt = toIndex != null ? Math.min(Math.max(toIndex, 0), destBefore.length) : destBefore.length;
    const moved = all.find((c) => c.id === cardId);
    if (!moved) return destBefore;
    return [...destBefore.slice(0, insertAt), moved, ...destBefore.slice(insertAt)];
  }

  function applyMove(cardId: string, toColumnId: string, opts?: MoveOpts, toIndex?: number) {
    const prev = cards;
    const destOrdered = reorderColumn(prev, cardId, toColumnId, toIndex);
    const positionById = new Map(destOrdered.map((c, i) => [c.id, i]));
    setCards((cs) =>
      cs.map((c) => {
        if (c.id === cardId) {
          return {
            ...c,
            columnId: toColumnId,
            stageId: toColumnId,
            position: positionById.get(c.id) ?? c.position,
            handoffStatus: c.handoffStatus === "pending" ? "accepted" : c.handoffStatus,
            ...(opts?.wonAmount != null ? { amountCents: Math.round(opts.wonAmount * 100) } : {}),
          };
        }
        const pos = positionById.get(c.id);
        return pos != null ? { ...c, position: pos } : c;
      }),
    );
    setBanner(null);
    const card = prev.find((c) => c.id === cardId);
    const chain =
      card?.handoffStatus === "pending"
        ? decideHandoff(cardId, "accepted").then((r) =>
            r.ok ? moveDealStage(cardId, toColumnId, opts?.lostReason, opts?.wonAmount) : r,
          )
        : moveDealStage(cardId, toColumnId, opts?.lostReason, opts?.wonAmount);
    chain
      .then((r) => (r.ok ? reorderDeals(destOrdered.map((c) => c.id)) : r))
      .then((r) => {
        if (!r.ok) {
          setCards(prev);
          setBanner(`Couldn't move deal: ${r.error}`);
        } else {
          router.refresh();
        }
      });
  }

  function move(cardId: string, toColumnId: string, toIndex?: number) {
    if (toColumnId === HANDOFF_COLUMN_ID) return;
    if (lostSet.has(toColumnId)) {
      setPendingLost({ cardId, toColumnId, toIndex });
      setReason("");
      return;
    }
    if (wonSet.has(toColumnId)) {
      const card = cards.find((c) => c.id === cardId);
      setPendingWon({ cardId, toColumnId, toIndex });
      setWonAmount(card?.amountCents != null ? (card.amountCents / 100).toString() : "");
      return;
    }
    applyMove(cardId, toColumnId, undefined, toIndex);
  }

  // Same-column drag: card stays in its stage, just changes rank within it.
  function reorder(cardId: string, columnId: string, toIndex: number) {
    const prev = cards;
    const destOrdered = reorderColumn(prev, cardId, columnId, toIndex);
    const positionById = new Map(destOrdered.map((c, i) => [c.id, i]));
    setCards((cs) => cs.map((c) => (positionById.has(c.id) ? { ...c, position: positionById.get(c.id)! } : c)));
    reorderDeals(destOrdered.map((c) => c.id)).then((r) => {
      if (!r.ok) {
        setCards(prev);
        setBanner(`Couldn't reorder: ${r.error}`);
      } else {
        router.refresh();
      }
    });
  }

  function decide(cardId: string, decision: "accepted" | "rejected", rejectReason?: string) {
    setBanner(null);
    decideHandoff(cardId, decision, rejectReason).then((r) => {
      if (!r.ok) setBanner(r.error);
      else {
        setRejecting(null);
        setCards((cs) =>
          cs
            .map((c) =>
              c.id === cardId
                ? decision === "accepted"
                  ? { ...c, handoffStatus: "accepted", columnId: c.stageId ?? c.columnId }
                  : { ...c, handoffStatus: "rejected", status: "lost" }
                : c,
            )
            .filter((c) => !(c.id === cardId && decision === "rejected")),
        );
        router.refresh();
      }
    });
  }

  function toggleSelect(id: string) {
    setSelectedIds((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleSelectAll() {
    setSelectedIds((s) =>
      listCards.every((c) => s.has(c.id)) ? new Set() : new Set(listCards.map((c) => c.id)),
    );
  }
  function clearSelection() {
    setSelectedIds(new Set());
    setBulkOpen(false);
  }

  const selectedIdList = [...selectedIds];

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "1 1 auto", flexWrap: "wrap" }}>
          <form className="admin-search" onSubmit={(e) => e.preventDefault()}>
            <svg className="admin-search-icon" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search deals, contact, company…"
              aria-label="Search deals"
            />
            {search && (
              <button type="button" className="admin-search-clear" aria-label="Clear search" onClick={() => setSearch("")}>
                <svg viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </form>
          {view === "list" && (
            <button
              type="button"
              className={`admin-btn admin-btn--sm${showArchived ? " admin-btn--primary" : ""}`}
              onClick={() => {
                setShowArchived((v) => !v);
                clearSelection();
              }}
            >
              {showArchived ? "Showing archived" : "Show archived"}
            </button>
          )}
        </div>
        <div className="admin-viewtoggle" role="group" aria-label="Deal view">
          <button
            type="button"
            className={view === "board" ? "is-active" : ""}
            aria-pressed={view === "board"}
            onClick={() => changeView("board")}
          >
            Board
          </button>
          <button
            type="button"
            className={view === "list" ? "is-active" : ""}
            aria-pressed={view === "list"}
            onClick={() => changeView("list")}
          >
            List
          </button>
        </div>
      </div>

      {banner && (
        <div className="admin-alert admin-alert--err" style={{ marginBottom: 12 }}>
          {banner}
        </div>
      )}
      {notice && (
        <div className="admin-alert admin-alert--ok" style={{ marginBottom: 12 }}>
          {notice}
        </div>
      )}

      {pendingLost && (
        <div className="admin-alert" style={{ marginBottom: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span>Why was this deal lost?</span>
          <select className="admin-input" style={{ maxWidth: 200 }} value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">Pick a reason…</option>
            {LOST_REASONS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="admin-btn admin-btn--danger"
            disabled={!reason}
            onClick={() => {
              applyMove(pendingLost.cardId, pendingLost.toColumnId, { lostReason: reason }, pendingLost.toIndex);
              setPendingLost(null);
            }}
          >
            Mark lost
          </button>
          <button type="button" className="admin-btn" onClick={() => setPendingLost(null)}>
            Cancel
          </button>
        </div>
      )}

      {pendingWon && (
        <div className="admin-alert" style={{ marginBottom: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span>Final deal amount ({(cards.find((c) => c.id === pendingWon.cardId)?.currency ?? "usd").toUpperCase()})</span>
          <input
            className="admin-input"
            style={{ maxWidth: 140 }}
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            autoFocus
            value={wonAmount}
            onChange={(e) => setWonAmount(e.target.value)}
          />
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            disabled={!(Number(wonAmount) > 0)}
            onClick={() => {
              applyMove(pendingWon.cardId, pendingWon.toColumnId, { wonAmount: Number(wonAmount) }, pendingWon.toIndex);
              setPendingWon(null);
            }}
          >
            Mark won
          </button>
          <button type="button" className="admin-btn" onClick={() => setPendingWon(null)}>
            Cancel
          </button>
        </div>
      )}

      {view === "board" ? (
        <KanbanBoard<DealCard>
          columns={boardColumns}
          cards={activeCards}
          onMove={move}
          onReorder={reorder}
          onCardClick={(c) => setSelectedId(c.id)}
          renderCard={(c) => (
            <>
              <div className="sap-card-title">{c.title || c.personName || c.companyName || "(untitled deal)"}</div>
              <div className="sap-card-sub">{c.companyName || c.personName || "—"}</div>
              <NextStepLine card={c} />
              <div className="sap-card-meta">
                <Badge tone="info">{formatCents(c.amountUsdCents, "usd")}</Badge>
                {c.probability != null && <span className="sap-card-sub">{c.probability}%</span>}
                {(() => {
                  const d = idleDays(c.updatedAt);
                  return c.status === "open" && d != null && d > 14 ? (
                    <Badge tone="warn">idle {d}d</Badge>
                  ) : null;
                })()}
              </div>
              {c.columnId === HANDOFF_COLUMN_ID && (
                <div className="sap-card-handoff" style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }} onClick={(e) => e.stopPropagation()}>
                  {rejecting === c.id ? (
                    <>
                      <select className="admin-input" style={{ maxWidth: 150, fontSize: 12 }} value={reason} onChange={(e) => setReason(e.target.value)}>
                        <option value="">Reason…</option>
                        {REJECT_REASONS.map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </select>
                      <button type="button" className="admin-btn admin-btn--danger" disabled={!reason} onClick={() => decide(c.id, "rejected", reason)}>
                        Confirm
                      </button>
                      <button type="button" className="admin-btn" onClick={() => setRejecting(null)}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="admin-btn admin-btn--primary" onClick={() => decide(c.id, "accepted")}>
                        Accept
                      </button>
                      <button
                        type="button"
                        className="admin-btn"
                        onClick={() => {
                          setRejecting(c.id);
                          setReason("");
                        }}
                      >
                        Reject…
                      </button>
                    </>
                  )}
                </div>
              )}
            </>
          )}
          columnFooter={(_col, colCards) => {
            const total = colCards.reduce((s, c) => s + (c.amountUsdCents ?? 0), 0);
            const weighted = colCards.reduce(
              (s, c) => s + (c.amountUsdCents ?? 0) * ((c.probability ?? 0) / 100),
              0,
            );
            return (
              <div className="sap-col-foot">
                <span>{formatCents(total)}</span>
                <span className="sap-card-sub">{formatCents(weighted)} weighted</span>
              </div>
            );
          }}
        />
      ) : (
        <>
          <DealsList
            cards={sortedListCards}
            columns={columns}
            selected={selectedIds}
            onToggle={toggleSelect}
            onToggleAll={toggleSelectAll}
            onRowClick={(c) => setSelectedId(c.id)}
            sort={listSort}
            onSort={sortList}
            // Drag-to-reorder only makes sense against the natural priority
            // order — once a column sort or search is applied, rows no longer
            // sit at a rank you can meaningfully drag.
            reorderEnabled={!listSort && !query}
            onReorder={reorder}
            emptyText={query ? "No deals match your search." : showArchived ? "No archived deals." : "No deals yet."}
          />

          {selectedIds.size > 0 && (
            <div className="admin-bulkbar">
              <span className="admin-bulkbar-count">{selectedIds.size} selected</span>
              {!showArchived && (
                <>
                  <button type="button" className="admin-btn admin-btn--sm" onClick={() => setBulkOpen(true)}>
                    Edit…
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn--sm"
                    onClick={async () => {
                      setBanner(null);
                      const r = await bulkArchiveDeals(selectedIdList);
                      if (!r.ok) setBanner(r.error);
                      else {
                        const now = new Date().toISOString();
                        setCards((cs) => cs.map((c) => (selectedIds.has(c.id) ? { ...c, archivedAt: now } : c)));
                        setNotice(r.message ?? null);
                        clearSelection();
                        router.refresh();
                      }
                    }}
                  >
                    Archive
                  </button>
                </>
              )}
              <button
                type="button"
                className="admin-btn admin-btn--sm admin-btn--danger"
                onClick={async () => {
                  setBanner(null);
                  const r = await bulkDeleteDeals(selectedIdList);
                  if (!r.ok) setBanner(r.error);
                  else {
                    const gone = new Set(r.deletedIds);
                    setCards((cs) => cs.filter((c) => !gone.has(c.id)));
                    setNotice(r.message ?? null);
                    clearSelection();
                    router.refresh();
                  }
                }}
              >
                Delete
              </button>
              <div className="admin-bulkbar-spacer" />
              <button type="button" className="admin-btn admin-btn--sm" onClick={clearSelection}>
                Clear
              </button>
            </div>
          )}
        </>
      )}

      {bulkOpen && (
        <BulkEditModal
          count={selectedIds.size}
          stageOptions={stageOptions}
          onCancel={() => setBulkOpen(false)}
          onApply={async (patch) => {
            const r = await bulkUpdateDeals(selectedIdList, patch);
            if (!r.ok) return r;
            setCards((cs) =>
              cs.map((c) =>
                selectedIds.has(c.id)
                  ? {
                      ...c,
                      ...(patch.stage_id !== undefined ? { stageId: patch.stage_id, columnId: patch.stage_id, status: "open" } : {}),
                      ...(patch.probability !== undefined ? { probability: patch.probability } : {}),
                      ...(patch.expected_close_date !== undefined ? { expectedClose: patch.expected_close_date } : {}),
                      ...(patch.source !== undefined ? { source: patch.source } : {}),
                    }
                  : c,
              ),
            );
            setNotice(r.message ?? null);
            setBulkOpen(false);
            clearSelection();
            router.refresh();
            return r;
          }}
        />
      )}

      <DetailDrawer
        open={!!selected}
        onClose={() => setSelectedId(null)}
        eyebrow={selected ? humanize(selected.status) : ""}
        title={selected?.title || selected?.personName || "Deal"}
      >
        {selected && (
          <DealDetail
            card={selected}
            stages={columns.filter((c) => c.id !== HANDOFF_COLUMN_ID)}
            lostSet={lostSet}
            wonSet={wonSet}
            onChangeStage={applyMove}
            onDecideHandoff={decide}
            onPatch={(patch) => patchCard(selected.id, patch)}
            onRemove={() => removeCard(selected.id)}
            onClose={() => setSelectedId(null)}
          />
        )}
      </DetailDrawer>
    </>
  );
}

type DealFieldForm = {
  title: string;
  amount: string;
  currency: string;
  probability: string;
  expectedClose: string;
  source: string;
  nextStep: string;
  nextStepDate: string;
  proposalUrl: string;
  contractUrl: string;
};

export function DealDetail({
  card,
  stages,
  lostSet,
  wonSet,
  onChangeStage,
  onDecideHandoff,
  onPatch,
  onRemove,
  onClose,
}: {
  card: DealCard;
  stages: KanbanColumn[];
  lostSet: Set<string>;
  wonSet: Set<string>;
  onChangeStage: (cardId: string, toStageId: string, opts?: MoveOpts) => void;
  onDecideHandoff: (cardId: string, decision: "accepted" | "rejected", rejectReason?: string) => void;
  onPatch: (patch: Partial<DealCard>) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const archived = !!card.archivedAt;
  const pendingHandoff = card.handoffStatus === "pending";
  const [pendingLostStage, setPendingLostStage] = useState<string | null>(null);
  const [lostReason, setLostReason] = useState("");
  const [pendingWonStage, setPendingWonStage] = useState<string | null>(null);
  const [wonAmount, setWonAmount] = useState("");
  const [rejectingHandoff, setRejectingHandoff] = useState(false);
  const [handoffReason, setHandoffReason] = useState("");
  const [demoteReason, setDemoteReason] = useState("");
  const [restoreErr, setRestoreErr] = useState<string | null>(null);

  const { form: dealForm, field: dealField, commit: dealCommit, status: dealStatus } = useAutosave<DealFieldForm>(
    {
      title: card.title ?? "",
      amount: card.amountCents != null ? (card.amountCents / 100).toString() : "",
      currency: (card.currency ?? "usd").toLowerCase(),
      probability: card.probability != null ? String(card.probability) : "",
      expectedClose: card.expectedClose ?? "",
      source: card.source ?? "",
      nextStep: card.nextStep ?? "",
      nextStepDate: card.nextStepDate ?? "",
      proposalUrl: card.proposalUrl ?? "",
      contractUrl: card.contractUrl ?? "",
    },
    saveDealField,
  );
  const { title, amount, currency, probability, expectedClose, source, nextStep, nextStepDate, proposalUrl, contractUrl } = dealForm;

  const currencyOptions = CURRENCIES.includes(currency) ? CURRENCIES : [currency, ...CURRENCIES];

  // Each blur/change commits exactly one field — map it to the DealPatch shape
  // updateDeal expects and mirror the parsed value back onto the board's card.
  async function saveDealField(patch: Partial<DealFieldForm>) {
    const [key, value] = Object.entries(patch)[0] as [keyof DealFieldForm, string];
    switch (key) {
      case "title": {
        const r = await updateDeal(card.id, { title: value });
        if (r.ok) onPatch({ title: value.trim() });
        return r;
      }
      case "amount": {
        const amt = value.trim() === "" ? 0 : Number(value);
        const r = await updateDeal(card.id, { amount: amt });
        if (r.ok) onPatch({ amountCents: Math.round(amt * 100) });
        return r;
      }
      case "currency": {
        const r = await updateDeal(card.id, { currency: value });
        if (r.ok) onPatch({ currency: value });
        return r;
      }
      case "probability": {
        const prob = value.trim() === "" ? null : Number(value);
        const r = await updateDeal(card.id, { probability: prob });
        if (r.ok) onPatch({ probability: prob });
        return r;
      }
      case "expectedClose": {
        const r = await updateDeal(card.id, { expected_close_date: value || null });
        if (r.ok) onPatch({ expectedClose: value || null });
        return r;
      }
      case "source": {
        const r = await updateDeal(card.id, { source: value.trim() || null });
        if (r.ok) onPatch({ source: value.trim() || null });
        return r;
      }
      case "nextStep": {
        const r = await updateDeal(card.id, { next_step: value.trim() || null });
        if (r.ok) onPatch({ nextStep: value.trim() || null });
        return r;
      }
      case "nextStepDate": {
        const r = await updateDeal(card.id, { next_step_date: value || null });
        if (r.ok) onPatch({ nextStepDate: value || null });
        return r;
      }
      case "proposalUrl": {
        const r = await updateDeal(card.id, { proposal_url: value.trim() || null });
        if (r.ok) onPatch({ proposalUrl: value.trim() || null });
        return r;
      }
      case "contractUrl": {
        const r = await updateDeal(card.id, { contract_url: value.trim() || null });
        if (r.ok) onPatch({ contractUrl: value.trim() || null });
        return r;
      }
      default:
        return { ok: true as const };
    }
  }

  return (
    <>
      {pendingHandoff && (
        <div style={{ marginBottom: 16 }}>
          <div className="admin-label" style={{ marginBottom: 6 }}>
            SDR handoff
          </div>
          {rejectingHandoff ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <select
                className="admin-input"
                aria-label="Reject reason"
                value={handoffReason}
                onChange={(e) => setHandoffReason(e.target.value)}
              >
                <option value="">Why reject this handoff?</option>
                {REJECT_REASONS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="admin-btn admin-btn--danger"
                  disabled={!handoffReason}
                  onClick={() => onDecideHandoff(card.id, "rejected", handoffReason)}
                >
                  Confirm reject
                </button>
                <button type="button" className="admin-btn" onClick={() => setRejectingHandoff(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                onClick={() => onDecideHandoff(card.id, "accepted")}
              >
                Accept handoff
              </button>
              <button
                type="button"
                className="admin-btn"
                onClick={() => {
                  setRejectingHandoff(true);
                  setHandoffReason("");
                }}
              >
                Reject…
              </button>
            </div>
          )}
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <div className="admin-label" style={{ marginBottom: 6 }}>
          Stage
        </div>
        <select
          className="admin-input"
          aria-label="Deal stage"
          value={pendingLostStage ?? pendingWonStage ?? (pendingHandoff ? "" : card.stageId ?? "")}
          onChange={(e) => {
            const to = e.target.value;
            if (!to) return;
            if (lostSet.has(to)) {
              setPendingLostStage(to);
              setPendingWonStage(null);
              setLostReason("");
            } else if (wonSet.has(to)) {
              setPendingWonStage(to);
              setPendingLostStage(null);
              setWonAmount(amount);
            } else {
              setPendingLostStage(null);
              setPendingWonStage(null);
              onChangeStage(card.id, to);
            }
          }}
        >
          {pendingHandoff && <option value="">Accept into stage…</option>}
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        {pendingHandoff && (
          <div className="admin-hint" style={{ marginTop: 6 }}>
            Choosing a stage accepts the SDR handoff.
          </div>
        )}
        {pendingLostStage && (
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
            <select
              className="admin-input"
              aria-label="Lost reason"
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
            >
              <option value="">Why was this deal lost?</option>
              {LOST_REASONS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="admin-btn admin-btn--danger"
                disabled={!lostReason}
                onClick={() => {
                  onChangeStage(card.id, pendingLostStage, { lostReason });
                  setPendingLostStage(null);
                }}
              >
                Mark lost
              </button>
              <button type="button" className="admin-btn" onClick={() => setPendingLostStage(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}
        {pendingWonStage && (
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="admin-field">
              <label className="admin-label">Final deal amount ({currency.toUpperCase()})</label>
              <input
                className="admin-input"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                autoFocus
                value={wonAmount}
                onChange={(e) => setWonAmount(e.target.value)}
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                disabled={!(Number(wonAmount) > 0)}
                onClick={() => {
                  onChangeStage(card.id, pendingWonStage, { wonAmount: Number(wonAmount) });
                  setPendingWonStage(null);
                }}
              >
                Mark won
              </button>
              <button type="button" className="admin-btn" onClick={() => setPendingWonStage(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {!archived && !pendingHandoff && card.status === "open" && card.personId && (
        <div style={{ marginBottom: 16 }}>
          <ConfirmButton
            className="admin-btn"
            label="Demote to lead"
            title="Send this deal back to the leads queue?"
            body={
              <>
                <p style={{ marginBottom: 8 }}>
                  "{card.title || "This deal"}" moves back to the SDR queue as a lead. The deal is
                  archived, not deleted — restore it any time from the danger zone below.
                </p>
                <input
                  className="admin-input"
                  placeholder="Why? (optional)"
                  value={demoteReason}
                  onChange={(e) => setDemoteReason(e.target.value)}
                />
              </>
            }
            confirmLabel="Demote to lead"
            onConfirm={() => demoteDealToLead(card.id, demoteReason)}
            onDone={() => {
              onPatch({ archivedAt: new Date().toISOString() });
              setDemoteReason("");
              onClose();
            }}
          />
        </div>
      )}

      <dl className="admin-kv" style={{ marginBottom: 16 }}>
        <dt>Status</dt>
        <dd>
          <Badge tone={statusTone(card.status ?? "")}>{humanize(card.status)}</Badge>
          {pendingHandoff && (
            <>
              {" "}
              <Badge tone="warn">Handoff pending</Badge>
            </>
          )}
          {archived && (
            <>
              {" "}
              <Badge tone="neutral">Archived</Badge>
            </>
          )}
        </dd>
        <dt>Company</dt>
        <dd>{card.companyName || "—"}</dd>
        <dt>Contact</dt>
        <dd>
          {card.personId ? (
            <Link href={`/admin/contacts/${card.personId}`} className="admin-cell-strong">
              {card.personName || "View contact"}
            </Link>
          ) : (
            card.personName || "—"
          )}
        </dd>
        {card.lostReason && (
          <>
            <dt>Lost reason</dt>
            <dd>{humanize(card.lostReason)}</dd>
          </>
        )}
      </dl>

      <ReferrerField
        dealId={card.id}
        referrerId={card.referrerId}
        referrerName={card.referrerName}
        onChange={(referrerId, referrerName) => onPatch({ referrerId, referrerName })}
      />

      <ReferrerCompanyField
        dealId={card.id}
        referrerCompanyId={card.referrerCompanyId}
        referrerCompanyName={card.referrerCompanyName}
        onChange={(referrerCompanyId, referrerCompanyName) => onPatch({ referrerCompanyId, referrerCompanyName })}
      />

      <div className="admin-form">
        <div style={{ display: "flex", justifyContent: "flex-end", fontSize: 12.5 }}>
          <AutosaveIndicator status={dealStatus} />
        </div>
        <div className="admin-field">
          <label className="admin-label">Title</label>
          <input
            className="admin-input"
            value={title}
            onChange={(e) => dealField("title", e.target.value)}
            onBlur={(e) => dealCommit("title", e.target.value)}
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
          <div className="admin-field">
            <label className="admin-label">Amount</label>
            <input
              className="admin-input"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(e) => dealField("amount", e.target.value)}
              onBlur={(e) => dealCommit("amount", e.target.value)}
            />
          </div>
          <div className="admin-field">
            <label className="admin-label">Currency</label>
            <select
              className="admin-select"
              value={currency}
              onChange={(e) => {
                dealField("currency", e.target.value);
                dealCommit("currency", e.target.value);
              }}
            >
              {currencyOptions.map((c) => (
                <option key={c} value={c}>
                  {c.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="admin-field">
            <label className="admin-label">Probability %</label>
            <input
              className="admin-input"
              type="number"
              min="0"
              max="100"
              value={probability}
              onChange={(e) => dealField("probability", e.target.value)}
              onBlur={(e) => dealCommit("probability", e.target.value)}
            />
          </div>
          <div className="admin-field">
            <label className="admin-label">Expected close</label>
            <input
              className="admin-input"
              type="date"
              value={expectedClose}
              onChange={(e) => {
                dealField("expectedClose", e.target.value);
                dealCommit("expectedClose", e.target.value);
              }}
            />
          </div>
        </div>
        <div className="admin-field">
          <label className="admin-label">Source</label>
          <input
            className="admin-input"
            value={source}
            onChange={(e) => dealField("source", e.target.value)}
            onBlur={(e) => dealCommit("source", e.target.value)}
          />
        </div>
        <div className="admin-field">
          <label className="admin-label">Next step</label>
          <input
            className="admin-input"
            placeholder="What happens next?"
            value={nextStep}
            onChange={(e) => dealField("nextStep", e.target.value)}
            onBlur={(e) => dealCommit("nextStep", e.target.value)}
          />
        </div>
        <div className="admin-field">
          <label className="admin-label">Next step date</label>
          <input
            className="admin-input"
            type="date"
            value={nextStepDate}
            onChange={(e) => {
              dealField("nextStepDate", e.target.value);
              dealCommit("nextStepDate", e.target.value);
            }}
          />
        </div>
        <div className="admin-field">
          <label className="admin-label">Proposal link</label>
          <input
            className="admin-input"
            type="url"
            placeholder="https://…"
            value={proposalUrl}
            onChange={(e) => dealField("proposalUrl", e.target.value)}
            onBlur={(e) => dealCommit("proposalUrl", e.target.value)}
          />
        </div>
        <div className="admin-field">
          <label className="admin-label">Contract link</label>
          <input
            className="admin-input"
            type="url"
            placeholder="https://…"
            value={contractUrl}
            onChange={(e) => dealField("contractUrl", e.target.value)}
            onBlur={(e) => dealCommit("contractUrl", e.target.value)}
          />
        </div>
        {dealStatus.state === "error" && <div className="admin-alert admin-alert--err">{dealStatus.error}</div>}
      </div>

      <DealCommunications dealId={card.id} />

      <div className="admin-danger-zone" style={{ marginTop: 18 }}>
        <div className="admin-danger-zone-title">Danger zone</div>
        {archived ? (
          <div className="admin-danger-row">
            <span className="admin-danger-row-text">
              This deal is archived and hidden from the board.
              {restoreErr && <div className="admin-alert admin-alert--err" style={{ marginTop: 6 }}>{restoreErr}</div>}
            </span>
            <button
              type="button"
              className="admin-btn"
              onClick={async () => {
                const r = await restoreDeal(card.id);
                if (r.ok) onPatch({ archivedAt: null });
                else setRestoreErr(r.error);
              }}
            >
              Restore
            </button>
          </div>
        ) : (
          <div className="admin-danger-row">
            <span className="admin-danger-row-text">
              Archive hides this deal from the board and forecast but keeps the record. Reversible.
            </span>
            <ConfirmButton
              className="admin-btn"
              label="Archive"
              title="Archive this deal?"
              body={`"${card.title || "This deal"}" will be hidden from the board. You can restore it any time.`}
              confirmLabel="Archive"
              onConfirm={() => archiveDeal(card.id)}
              onDone={() => {
                onPatch({ archivedAt: new Date().toISOString() });
                onClose();
              }}
            />
          </div>
        )}
        <div className="admin-danger-row">
          <span className="admin-danger-row-text">
            Permanently delete this deal. Cannot be undone, and is blocked if it has linked inquiries or projects.
          </span>
          <ConfirmButton
            label="Delete permanently"
            title="Permanently delete this deal?"
            body={
              <>
                This deletes <strong>{card.title || "this deal"}</strong>. This cannot be undone.
              </>
            }
            confirmLabel="Delete permanently"
            onConfirm={() => deleteDeal(card.id)}
            onDone={() => {
              onRemove();
              onClose();
            }}
          />
        </div>
      </div>
    </>
  );
}

// The deal's referrer — the contact who sent the introduction. Type to search
// existing contacts; if they're not in the CRM yet, add them (name + email) as
// a real contact in one step. One referrer per deal.
function ReferrerField({
  dealId,
  referrerId,
  referrerName,
  onChange,
}: {
  dealId: string;
  referrerId: string | null;
  referrerName: string | null;
  onChange: (referrerId: string | null, referrerName: string | null) => void;
}) {
  const [mode, setMode] = useState<"idle" | "search" | "new">("idle");
  const [term, setTerm] = useState("");
  const [hits, setHits] = useState<PersonHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");

  // Debounced typeahead, only while the search box is open.
  useEffect(() => {
    if (mode !== "search") return;
    const q = term.trim();
    if (q.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      const r = await searchPeople(q);
      setHits(r);
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [term, mode]);

  function reset() {
    setMode("idle");
    setTerm("");
    setHits([]);
    setErr(null);
    setNewName("");
    setNewEmail("");
  }

  async function link(hit: PersonHit) {
    setBusy(true);
    setErr(null);
    const r = await setDealReferrer(dealId, hit.id);
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    onChange(r.referrer?.id ?? null, r.referrer?.name ?? null);
    reset();
  }

  async function clear() {
    setBusy(true);
    setErr(null);
    const r = await setDealReferrer(dealId, null);
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    onChange(null, null);
    reset();
  }

  async function createNew() {
    setBusy(true);
    setErr(null);
    const r = await createReferrerForDeal(dealId, newName, newEmail);
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    onChange(r.referrer.id, r.referrer.name);
    reset();
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div className="admin-label" style={{ marginBottom: 6 }}>
        Referrer
      </div>

      {mode === "idle" &&
        (referrerId ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Link href={`/admin/contacts/${referrerId}`} className="admin-cell-strong">
              {referrerName || "View contact"}
            </Link>
            <button type="button" className="admin-btn admin-btn--sm" onClick={() => setMode("search")} disabled={busy}>
              Change
            </button>
            <button type="button" className="admin-btn admin-btn--sm" onClick={clear} disabled={busy}>
              Remove
            </button>
          </div>
        ) : (
          <button type="button" className="admin-btn admin-btn--sm" onClick={() => setMode("search")}>
            Add referrer
          </button>
        ))}

      {mode === "search" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            className="admin-input"
            autoFocus
            placeholder="Search contacts by name or email…"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
          {term.trim().length >= 2 && (
            <div
              style={{
                border: "1px solid var(--admin-line)",
                borderRadius: 8,
                overflow: "hidden",
                maxHeight: 220,
                overflowY: "auto",
              }}
            >
              {searching ? (
                <div className="admin-hint" style={{ padding: "8px 10px" }}>
                  Searching…
                </div>
              ) : hits.length === 0 ? (
                <div className="admin-hint" style={{ padding: "8px 10px" }}>
                  No matching contacts. Add them as a new contact below.
                </div>
              ) : (
                hits.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => link(h)}
                    disabled={busy}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      gap: 2,
                      width: "100%",
                      padding: "8px 10px",
                      background: "var(--admin-surface)",
                      border: "none",
                      borderBottom: "1px solid var(--admin-line-soft)",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span className="admin-cell-strong">{h.name}</span>
                    <span className="admin-cell-muted">{h.email}</span>
                  </button>
                ))
              )}
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="admin-btn admin-btn--sm"
              onClick={() => {
                setNewName(term.trim());
                setNewEmail("");
                setErr(null);
                setMode("new");
              }}
            >
              + Add new contact
            </button>
            <button type="button" className="admin-btn admin-btn--sm" onClick={reset}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {mode === "new" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="admin-field">
            <label className="admin-label">Name</label>
            <input className="admin-input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Full name" />
          </div>
          <div className="admin-field">
            <label className="admin-label">Email</label>
            <input className="admin-input" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="name@example.com" />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="admin-btn admin-btn--primary admin-btn--sm" onClick={createNew} disabled={busy}>
              {busy ? "Saving…" : "Create & link"}
            </button>
            <button type="button" className="admin-btn admin-btn--sm" onClick={() => setMode("search")} disabled={busy}>
              Back
            </button>
          </div>
        </div>
      )}

      {err && (
        <div className="admin-alert admin-alert--err" style={{ marginTop: 8 }}>
          {err}
        </div>
      )}
    </div>
  );
}

// The deal's referring company — the org that sent the introduction. Type to
// search existing companies and pick one. Separate from the person referrer
// above; companies are picked here, not created. One referring company per deal.
function ReferrerCompanyField({
  dealId,
  referrerCompanyId,
  referrerCompanyName,
  onChange,
}: {
  dealId: string;
  referrerCompanyId: string | null;
  referrerCompanyName: string | null;
  onChange: (referrerCompanyId: string | null, referrerCompanyName: string | null) => void;
}) {
  const [mode, setMode] = useState<"idle" | "search">("idle");
  const [term, setTerm] = useState("");
  const [hits, setHits] = useState<CompanyHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Debounced typeahead, only while the search box is open.
  useEffect(() => {
    if (mode !== "search") return;
    const q = term.trim();
    if (q.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      const r = await searchCompanies(q);
      setHits(r);
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [term, mode]);

  function reset() {
    setMode("idle");
    setTerm("");
    setHits([]);
    setErr(null);
  }

  async function link(hit: CompanyHit) {
    setBusy(true);
    setErr(null);
    const r = await setDealReferrerCompany(dealId, hit.id);
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    onChange(r.referrerCompany?.id ?? null, r.referrerCompany?.name ?? null);
    reset();
  }

  async function clear() {
    setBusy(true);
    setErr(null);
    const r = await setDealReferrerCompany(dealId, null);
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    onChange(null, null);
    reset();
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div className="admin-label" style={{ marginBottom: 6 }}>
        Referring company
      </div>

      {mode === "idle" &&
        (referrerCompanyId ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Link href={`/admin/revenue/companies/${referrerCompanyId}`} className="admin-cell-strong">
              {referrerCompanyName || "View company"}
            </Link>
            <button type="button" className="admin-btn admin-btn--sm" onClick={() => setMode("search")} disabled={busy}>
              Change
            </button>
            <button type="button" className="admin-btn admin-btn--sm" onClick={clear} disabled={busy}>
              Remove
            </button>
          </div>
        ) : (
          <button type="button" className="admin-btn admin-btn--sm" onClick={() => setMode("search")}>
            Add referring company
          </button>
        ))}

      {mode === "search" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            className="admin-input"
            autoFocus
            placeholder="Search companies by name…"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
          {term.trim().length >= 2 && (
            <div
              style={{
                border: "1px solid var(--admin-line)",
                borderRadius: 8,
                overflow: "hidden",
                maxHeight: 220,
                overflowY: "auto",
              }}
            >
              {searching ? (
                <div className="admin-hint" style={{ padding: "8px 10px" }}>
                  Searching…
                </div>
              ) : hits.length === 0 ? (
                <div className="admin-hint" style={{ padding: "8px 10px" }}>
                  No matching companies.
                </div>
              ) : (
                hits.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => link(h)}
                    disabled={busy}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      gap: 2,
                      width: "100%",
                      padding: "8px 10px",
                      background: "var(--admin-surface)",
                      border: "none",
                      borderBottom: "1px solid var(--admin-line-soft)",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span className="admin-cell-strong">{h.name || "Unnamed company"}</span>
                  </button>
                ))
              )}
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="admin-btn admin-btn--sm" onClick={reset}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {err && (
        <div className="admin-alert admin-alert--err" style={{ marginTop: 8 }}>
          {err}
        </div>
      )}
    </div>
  );
}

// A deal's communication log. Free-text entries append to the shared activity
// log (interactions), newest first. Automatic stage-change rows are filtered out
// server-side so this reads as a human conversation history.
function DealCommunications({ dealId }: { dealId: string }) {
  const [items, setItems] = useState<Communication[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setLoadErr(null);
    getDealCommunications(dealId).then((r) => {
      if (!live) return;
      if (r.ok) setItems(r.items);
      else setLoadErr(r.error);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [dealId]);

  async function add() {
    const text = body.trim();
    if (!text) return;
    setSaving(true);
    setSaveErr(null);
    const r = await addDealCommunication(dealId, text);
    setSaving(false);
    if (!r.ok) return setSaveErr(r.error);
    setItems((cur) => [r.item, ...cur]);
    setBody("");
  }

  return (
    <div style={{ marginTop: 18 }}>
      <div className="admin-label" style={{ marginBottom: 6 }}>
        Communications
      </div>

      <div className="admin-field">
        <textarea
          className="admin-input"
          rows={3}
          placeholder="Log a call, email, or note…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>
      <div className="admin-form-actions" style={{ marginBottom: 12 }}>
        <button type="button" className="admin-btn admin-btn--primary admin-btn--sm" onClick={add} disabled={saving || !body.trim()}>
          {saving ? "Adding…" : "Add communication"}
        </button>
      </div>
      {saveErr && (
        <div className="admin-alert admin-alert--err" style={{ marginBottom: 12 }}>
          {saveErr}
        </div>
      )}

      {loading ? (
        <div className="admin-hint">Loading…</div>
      ) : loadErr ? (
        <div className="admin-alert admin-alert--err">{loadErr}</div>
      ) : items.length === 0 ? (
        <div className="admin-empty">No communications yet.</div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((c) => (
            <li
              key={c.id}
              style={{
                borderLeft: "2px solid var(--admin-line-strong)",
                paddingLeft: 10,
              }}
            >
              <div className="admin-cell-muted" style={{ marginBottom: 2 }}>
                {humanize(c.kind)} · {formatDate(c.occurredAt)}
              </div>
              <div style={{ whiteSpace: "pre-wrap" }}>{c.body || c.subject || "—"}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Non-drag alternative to the kanban: a flat table with multi-select. Row tap
// opens the shared DealDetail drawer; the checkboxes drive the bulk action bar.
//
// Drag-to-reorder (reorderEnabled) only applies against the natural priority
// order — the parent gates it off whenever a column sort or search is active.
// When enabled, rows are grouped into one Droppable per stage (mirroring the
// board's columns) so a drag can only re-rank within a stage, never across one.
function DealsList({
  cards,
  columns,
  selected,
  onToggle,
  onToggleAll,
  onRowClick,
  sort,
  onSort,
  reorderEnabled,
  onReorder,
  emptyText,
}: {
  cards: DealCard[];
  columns: KanbanColumn[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onRowClick: (card: DealCard) => void;
  sort: ListSort | null;
  onSort: (key: string) => void;
  reorderEnabled: boolean;
  onReorder: (cardId: string, columnId: string, toIndex: number) => void;
  emptyText: string;
}) {
  const stageLabel = new Map(columns.map((c) => [c.id, c.label]));
  const allSelected = cards.length > 0 && cards.every((c) => selected.has(c.id));
  const colCount = reorderEnabled ? 8 : 7;

  const sortableTh = (label: string, key: string, align?: "right") => (
    <th style={align === "right" ? { textAlign: "right" } : undefined}>
      <button type="button" className="admin-th-sort" onClick={() => onSort(key)}>
        {label}
        {sort?.key === key ? (sort.dir === "desc" ? " ↓" : " ↑") : ""}
      </button>
    </th>
  );

  function handleDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result;
    if (!destination || destination.droppableId !== source.droppableId) return;
    if (destination.index === source.index) return;
    onReorder(draggableId, destination.droppableId, destination.index);
  }

  function rowCells(c: DealCard) {
    const d = idleDays(c.updatedAt);
    const idle = c.status === "open" && d != null && d > 14;
    const isSel = selected.has(c.id);
    return (
      <>
        <td className="admin-cell-check" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            aria-label={`Select ${c.title || "deal"}`}
            checked={isSel}
            onChange={() => onToggle(c.id)}
          />
        </td>
        <td>
          <div className="admin-cell-strong">
            {c.title || c.personName || c.companyName || "(untitled deal)"}
          </div>
          <div className="admin-cell-muted">{c.companyName || c.personName || "—"}</div>
        </td>
        <td>
          {c.columnId === HANDOFF_COLUMN_ID ? (
            <Badge tone="warn">New from SDR</Badge>
          ) : (
            stageLabel.get(c.columnId) ?? "—"
          )}
        </td>
        <td style={{ textAlign: "right" }}>{formatCents(c.amountUsdCents, "usd")}</td>
        <td style={{ textAlign: "right" }}>{c.probability != null ? `${c.probability}%` : "—"}</td>
        <td>
          {c.status !== "open" ? (
            <span className="admin-cell-muted">—</span>
          ) : c.nextStepDate ? (
            <span>
              {c.nextStep || "next step"} · {formatDate(c.nextStepDate)}
            </span>
          ) : (
            <span style={{ color: "var(--admin-err-ink)", fontWeight: 600 }}>No next step</span>
          )}
        </td>
        <td>
          <Badge tone={statusTone(c.status ?? "")}>{humanize(c.status)}</Badge>
          {idle && (
            <>
              {" "}
              <Badge tone="warn">idle {d}d</Badge>
            </>
          )}
        </td>
      </>
    );
  }

  const groups = reorderEnabled
    ? columns.map((col) => ({ col, rows: cards.filter((c) => c.columnId === col.id) })).filter((g) => g.rows.length > 0)
    : null;

  return (
    <div className="admin-table-wrap">
      <div className="admin-table-scroll">
        <table className="admin-table">
          <thead>
            <tr>
              {reorderEnabled && <th className="admin-cell-drag" aria-hidden />}
              <th className="admin-cell-check">
                <input type="checkbox" aria-label="Select all deals" checked={allSelected} onChange={onToggleAll} />
              </th>
              {sortableTh("Deal", "deal")}
              {sortableTh("Stage", "stage")}
              {sortableTh("Amount", "amount", "right")}
              {sortableTh("Prob", "prob", "right")}
              {sortableTh("Next step", "nextstep")}
              {sortableTh("Status", "status")}
            </tr>
          </thead>
          {cards.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={colCount}>
                  <div className="admin-empty">{emptyText}</div>
                </td>
              </tr>
            </tbody>
          ) : groups ? (
            <DragDropContext onDragEnd={handleDragEnd}>
              {groups.map(({ col, rows }) => (
                <Droppable droppableId={col.id} key={col.id}>
                  {(provided) => (
                    <tbody ref={provided.innerRef} {...provided.droppableProps}>
                      <tr className="admin-table-group-row">
                        <td colSpan={colCount}>{col.label}</td>
                      </tr>
                      {rows.map((c, i) => (
                        <Draggable draggableId={c.id} index={i} key={c.id}>
                          {(dp, ds) => (
                            <tr
                              ref={dp.innerRef}
                              {...dp.draggableProps}
                              className={`is-clickable${selected.has(c.id) ? " is-selected" : ""}${c.archivedAt ? " admin-row-archived" : ""}${ds.isDragging ? " is-dragging" : ""}`}
                              onClick={() => onRowClick(c)}
                            >
                              <td className="admin-cell-drag" {...dp.dragHandleProps} onClick={(e) => e.stopPropagation()}>
                                ⠿
                              </td>
                              {rowCells(c)}
                            </tr>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </tbody>
                  )}
                </Droppable>
              ))}
            </DragDropContext>
          ) : (
            <tbody>
              {cards.map((c) => (
                <tr
                  key={c.id}
                  className={`is-clickable${selected.has(c.id) ? " is-selected" : ""}${c.archivedAt ? " admin-row-archived" : ""}`}
                  onClick={() => onRowClick(c)}
                >
                  {rowCells(c)}
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </div>
    </div>
  );
}

type BulkPatch = {
  stage_id?: string;
  probability?: number | null;
  expected_close_date?: string | null;
  source?: string | null;
};

function BulkEditModal({
  count,
  stageOptions,
  onApply,
  onCancel,
}: {
  count: number;
  stageOptions: StageOption[];
  onApply: (patch: BulkPatch) => Promise<{ ok: true } | { ok: false; error: string }>;
  onCancel: () => void;
}) {
  const [stage, setStage] = useState("");
  const [probability, setProbability] = useState("");
  const [expectedClose, setExpectedClose] = useState("");
  const [source, setSource] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply() {
    const patch: BulkPatch = {};
    if (stage) patch.stage_id = stage;
    if (probability.trim() !== "") patch.probability = Number(probability);
    if (expectedClose) patch.expected_close_date = expectedClose;
    if (source.trim() !== "") patch.source = source.trim();
    if (Object.keys(patch).length === 0) {
      setError("Fill at least one field to apply.");
      return;
    }
    setPending(true);
    setError(null);
    const r = await onApply(patch);
    setPending(false);
    if (!r.ok) setError(r.error);
  }

  return (
    <div className="admin-modal-backdrop" onClick={() => !pending && onCancel()}>
      <div className="admin-modal" role="dialog" aria-modal="true" aria-label="Bulk edit deals" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-title">Edit {count} deal{count === 1 ? "" : "s"}</div>
        <div className="admin-modal-body">Only the fields you fill are changed. Leave a field blank to keep it as-is.</div>

        <div className="admin-form" style={{ marginTop: 14 }}>
          <div className="admin-field">
            <label className="admin-label">Move to stage</label>
            <select className="admin-select" value={stage} onChange={(e) => setStage(e.target.value)}>
              <option value="">Keep current</option>
              {stageOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div className="admin-field">
              <label className="admin-label">Probability %</label>
              <input className="admin-input" type="number" min="0" max="100" value={probability} onChange={(e) => setProbability(e.target.value)} />
            </div>
            <div className="admin-field">
              <label className="admin-label">Expected close</label>
              <input className="admin-input" type="date" value={expectedClose} onChange={(e) => setExpectedClose(e.target.value)} />
            </div>
          </div>
          <div className="admin-field">
            <label className="admin-label">Source</label>
            <input className="admin-input" value={source} onChange={(e) => setSource(e.target.value)} />
          </div>
        </div>

        {error && (
          <div className="admin-alert admin-alert--err" style={{ marginTop: 12 }}>
            {error}
          </div>
        )}

        <div className="admin-modal-actions">
          <button type="button" className="admin-btn" onClick={onCancel} disabled={pending}>
            Cancel
          </button>
          <button type="button" className="admin-btn admin-btn--primary" onClick={apply} disabled={pending}>
            {pending ? "Applying…" : `Apply to ${count}`}
          </button>
        </div>
      </div>
    </div>
  );
}
