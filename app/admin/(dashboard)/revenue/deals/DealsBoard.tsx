"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KanbanBoard, type KanbanColumn } from "@/components/admin/KanbanBoard";
import { DetailDrawer } from "@/components/admin/DetailDrawer";
import { Badge, statusTone } from "@/components/admin/Badge";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { formatCents, formatDate, humanize } from "@/lib/admin/format";
import {
  archiveDeal,
  bulkArchiveDeals,
  bulkDeleteDeals,
  bulkUpdateDeals,
  decideHandoff,
  deleteDeal,
  moveDealStage,
  restoreDeal,
  updateDeal,
} from "./actions";

export const HANDOFF_COLUMN_ID = "handoff";

export type StageOption = { id: string; name: string };

export type DealCard = {
  id: string;
  columnId: string;
  stageId: string | null;
  title: string | null;
  personId: string | null;
  personName: string | null;
  companyName: string | null;
  amountCents: number | null;
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

type ListSort = { key: string; dir: "asc" | "desc" };

function dealSortValue(c: DealCard, key: string, stageLabelMap: Map<string, string>): string | number | null {
  switch (key) {
    case "deal":
      return (c.title || c.personName || c.companyName || "").toLowerCase();
    case "stage":
      return c.columnId === HANDOFF_COLUMN_ID ? "new from sdr" : (stageLabelMap.get(c.columnId) ?? "").toLowerCase();
    case "amount":
      return c.amountCents;
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
  stageOptions,
}: {
  columns: KanbanColumn[];
  initialCards: DealCard[];
  lostStageIds: string[];
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
  const [pendingLost, setPendingLost] = useState<{ cardId: string; toColumnId: string } | null>(
    null,
  );
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const lostSet = new Set(lostStageIds);
  const activeCards = cards.filter((c) => !c.archivedAt);
  const archivedCards = cards.filter((c) => c.archivedAt);
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

  function applyMove(cardId: string, toColumnId: string, lostReason?: string) {
    const prev = cards;
    setCards((cs) =>
      cs.map((c) =>
        c.id === cardId
          ? { ...c, columnId: toColumnId, stageId: toColumnId, handoffStatus: c.handoffStatus === "pending" ? "accepted" : c.handoffStatus }
          : c,
      ),
    );
    setBanner(null);
    const card = prev.find((c) => c.id === cardId);
    const chain =
      card?.handoffStatus === "pending"
        ? decideHandoff(cardId, "accepted").then((r) =>
            r.ok ? moveDealStage(cardId, toColumnId, lostReason) : r,
          )
        : moveDealStage(cardId, toColumnId, lostReason);
    chain.then((r) => {
      if (!r.ok) {
        setCards(prev);
        setBanner(`Couldn't move deal: ${r.error}`);
      } else {
        router.refresh();
      }
    });
  }

  function move(cardId: string, toColumnId: string) {
    if (toColumnId === HANDOFF_COLUMN_ID) return;
    if (lostSet.has(toColumnId)) {
      setPendingLost({ cardId, toColumnId });
      setReason("");
      return;
    }
    applyMove(cardId, toColumnId);
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
        {view === "list" ? (
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
        ) : (
          <span />
        )}
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
              applyMove(pendingLost.cardId, pendingLost.toColumnId, reason);
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

      {view === "board" ? (
        <KanbanBoard<DealCard>
          columns={columns}
          cards={activeCards}
          onMove={move}
          onCardClick={(c) => setSelectedId(c.id)}
          renderCard={(c) => (
            <>
              <div className="sap-card-title">{c.title || c.personName || c.companyName || "(untitled deal)"}</div>
              <div className="sap-card-sub">{c.companyName || c.personName || "—"}</div>
              <NextStepLine card={c} />
              <div className="sap-card-meta">
                <Badge tone="info">{formatCents(c.amountCents, c.currency ?? undefined)}</Badge>
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
            const total = colCards.reduce((s, c) => s + (c.amountCents ?? 0), 0);
            const weighted = colCards.reduce(
              (s, c) => s + (c.amountCents ?? 0) * ((c.probability ?? 0) / 100),
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
            emptyText={showArchived ? "No archived deals." : "No deals yet."}
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

export function DealDetail({
  card,
  stages,
  lostSet,
  onChangeStage,
  onDecideHandoff,
  onPatch,
  onRemove,
  onClose,
}: {
  card: DealCard;
  stages: KanbanColumn[];
  lostSet: Set<string>;
  onChangeStage: (cardId: string, toStageId: string, lostReason?: string) => void;
  onDecideHandoff: (cardId: string, decision: "accepted" | "rejected", rejectReason?: string) => void;
  onPatch: (patch: Partial<DealCard>) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const archived = !!card.archivedAt;
  const pendingHandoff = card.handoffStatus === "pending";
  const [pendingLostStage, setPendingLostStage] = useState<string | null>(null);
  const [lostReason, setLostReason] = useState("");
  const [rejectingHandoff, setRejectingHandoff] = useState(false);
  const [handoffReason, setHandoffReason] = useState("");

  const [title, setTitle] = useState(card.title ?? "");
  const [amount, setAmount] = useState(card.amountCents != null ? (card.amountCents / 100).toString() : "");
  const [currency, setCurrency] = useState((card.currency ?? "usd").toLowerCase());
  const [probability, setProbability] = useState(card.probability != null ? String(card.probability) : "");
  const [expectedClose, setExpectedClose] = useState(card.expectedClose ?? "");
  const [source, setSource] = useState(card.source ?? "");
  const [nextStep, setNextStep] = useState(card.nextStep ?? "");
  const [nextStepDate, setNextStepDate] = useState(card.nextStepDate ?? "");
  const [proposalUrl, setProposalUrl] = useState(card.proposalUrl ?? "");
  const [contractUrl, setContractUrl] = useState(card.contractUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const currencyOptions = CURRENCIES.includes(currency) ? CURRENCIES : [currency, ...CURRENCIES];

  async function save() {
    setSaving(true);
    setMsg(null);
    const amt = amount.trim() === "" ? 0 : Number(amount);
    const prob = probability.trim() === "" ? null : Number(probability);
    const r = await updateDeal(card.id, {
      title,
      amount: amt,
      currency,
      probability: prob,
      expected_close_date: expectedClose || null,
      source: source.trim() || null,
      next_step: nextStep.trim() || null,
      next_step_date: nextStepDate || null,
      proposal_url: proposalUrl.trim() || null,
      contract_url: contractUrl.trim() || null,
    });
    setSaving(false);
    if (!r.ok) {
      setMsg({ ok: false, text: r.error });
      return;
    }
    setMsg({ ok: true, text: "Saved." });
    onPatch({
      title: title.trim(),
      amountCents: Math.round(amt * 100),
      currency,
      probability: prob,
      expectedClose: expectedClose || null,
      source: source.trim() || null,
      nextStep: nextStep.trim() || null,
      nextStepDate: nextStepDate || null,
      proposalUrl: proposalUrl.trim() || null,
      contractUrl: contractUrl.trim() || null,
    });
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
          value={pendingLostStage ?? (pendingHandoff ? "" : card.stageId ?? "")}
          onChange={(e) => {
            const to = e.target.value;
            if (!to) return;
            if (lostSet.has(to)) {
              setPendingLostStage(to);
              setLostReason("");
            } else {
              setPendingLostStage(null);
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
                  onChangeStage(card.id, pendingLostStage, lostReason);
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
      </div>

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

      <form
        className="admin-form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {msg && (
          <div className={`admin-alert ${msg.ok ? "admin-alert--ok" : "admin-alert--err"}`}>{msg.text}</div>
        )}
        <div className="admin-field">
          <label className="admin-label">Title</label>
          <input className="admin-input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
          <div className="admin-field">
            <label className="admin-label">Amount</label>
            <input className="admin-input" type="number" min="0" step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="admin-field">
            <label className="admin-label">Currency</label>
            <select className="admin-select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
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
        <div className="admin-field">
          <label className="admin-label">Next step</label>
          <input className="admin-input" placeholder="What happens next?" value={nextStep} onChange={(e) => setNextStep(e.target.value)} />
        </div>
        <div className="admin-field">
          <label className="admin-label">Next step date</label>
          <input className="admin-input" type="date" value={nextStepDate} onChange={(e) => setNextStepDate(e.target.value)} />
        </div>
        <div className="admin-field">
          <label className="admin-label">Proposal link</label>
          <input className="admin-input" type="url" placeholder="https://…" value={proposalUrl} onChange={(e) => setProposalUrl(e.target.value)} />
        </div>
        <div className="admin-field">
          <label className="admin-label">Contract link</label>
          <input className="admin-input" type="url" placeholder="https://…" value={contractUrl} onChange={(e) => setContractUrl(e.target.value)} />
        </div>
        <div className="admin-form-actions">
          <button type="submit" className="admin-btn admin-btn--primary" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>

      <div className="admin-danger-zone" style={{ marginTop: 18 }}>
        <div className="admin-danger-zone-title">Danger zone</div>
        {archived ? (
          <div className="admin-danger-row">
            <span className="admin-danger-row-text">This deal is archived and hidden from the board.</span>
            <button
              type="button"
              className="admin-btn"
              onClick={async () => {
                const r = await restoreDeal(card.id);
                if (r.ok) onPatch({ archivedAt: null });
                else setMsg({ ok: false, text: r.error });
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

// Non-drag alternative to the kanban: a flat table with multi-select. Row tap
// opens the shared DealDetail drawer; the checkboxes drive the bulk action bar.
function DealsList({
  cards,
  columns,
  selected,
  onToggle,
  onToggleAll,
  onRowClick,
  sort,
  onSort,
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
  emptyText: string;
}) {
  const stageLabel = new Map(columns.map((c) => [c.id, c.label]));
  const allSelected = cards.length > 0 && cards.every((c) => selected.has(c.id));

  const sortableTh = (label: string, key: string, align?: "right") => (
    <th style={align === "right" ? { textAlign: "right" } : undefined}>
      <button type="button" className="admin-th-sort" onClick={() => onSort(key)}>
        {label}
        {sort?.key === key ? (sort.dir === "desc" ? " ↓" : " ↑") : ""}
      </button>
    </th>
  );

  return (
    <div className="admin-table-wrap">
      <div className="admin-table-scroll">
        <table className="admin-table">
          <thead>
            <tr>
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
          <tbody>
            {cards.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="admin-empty">{emptyText}</div>
                </td>
              </tr>
            ) : (
              cards.map((c) => {
                const d = idleDays(c.updatedAt);
                const idle = c.status === "open" && d != null && d > 14;
                const isSel = selected.has(c.id);
                return (
                  <tr
                    key={c.id}
                    className={`is-clickable${isSel ? " is-selected" : ""}${c.archivedAt ? " admin-row-archived" : ""}`}
                    onClick={() => onRowClick(c)}
                  >
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
                    <td style={{ textAlign: "right" }}>{formatCents(c.amountCents, c.currency ?? undefined)}</td>
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
                  </tr>
                );
              })
            )}
          </tbody>
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
