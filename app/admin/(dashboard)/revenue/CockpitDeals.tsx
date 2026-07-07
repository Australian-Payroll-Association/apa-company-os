"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DetailDrawer } from "@/components/admin/DetailDrawer";
import { Badge } from "@/components/admin/Badge";
import { formatCents, humanize } from "@/lib/admin/format";
import type { KanbanColumn } from "@/components/admin/KanbanBoard";
import { DealDetail, type DealCard } from "./deals/DealsBoard";
import { moveDealStage, decideHandoff } from "./deals/actions";

export type CockpitDeal = {
  id: string;
  title: string;
  stage: string;
  usd: number | null;
  nextStep: string | null;
  gaps: string[];
};

// The cockpit's priority list. Clicking a deal opens it in the side car with the
// *same* editable deal shelf the pipeline board uses (the shared DealDetail),
// so the cockpit and the board are identical. Mutations refresh server data.
export function CockpitDeals({
  deals,
  cards,
  stages,
  lostStageIds,
}: {
  deals: CockpitDeal[];
  cards: DealCard[];
  stages: KanbanColumn[];
  lostStageIds: string[];
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = cards.find((c) => c.id === selectedId) ?? null;
  const lostSet = new Set(lostStageIds);

  async function changeStage(cardId: string, toStageId: string, lostReason?: string) {
    const card = cards.find((c) => c.id === cardId);
    if (card?.handoffStatus === "pending") {
      const r = await decideHandoff(cardId, "accepted");
      if (!r.ok) return;
    }
    await moveDealStage(cardId, toStageId, lostReason);
    router.refresh();
  }

  async function decide(cardId: string, decision: "accepted" | "rejected", rejectReason?: string) {
    await decideHandoff(cardId, decision, rejectReason);
    if (decision === "rejected") setSelectedId(null);
    router.refresh();
  }

  if (deals.length === 0) {
    return (
      <div className="admin-empty">
        Every open deal has an owner, a value, a next step, and a date. Nice.
      </div>
    );
  }

  return (
    <>
      <div className="admin-table-scroll">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Deal</th>
              <th>Stage</th>
              <th style={{ textAlign: "right" }}>Value</th>
              <th>Missing</th>
              <th>Current next step</th>
            </tr>
          </thead>
          <tbody>
            {deals.map((d) => (
              <tr
                key={d.id}
                className="is-clickable"
                tabIndex={0}
                role="button"
                aria-haspopup="dialog"
                onClick={() => setSelectedId(d.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedId(d.id);
                  }
                }}
              >
                <td className="admin-cell-strong">{d.title}</td>
                <td className="admin-cell-muted">{d.stage}</td>
                <td className="admin-cell-mono" style={{ textAlign: "right" }}>
                  {formatCents(d.usd)}
                </td>
                <td>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {d.gaps.map((g) => (
                      <Badge key={g} tone="warn">
                        {g}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="admin-cell-muted" style={{ maxWidth: 340 }}>
                  {d.nextStep ? d.nextStep : <span style={{ color: "var(--admin-faint)" }}>none set</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DetailDrawer
        open={!!selected}
        onClose={() => setSelectedId(null)}
        eyebrow={selected ? humanize(selected.status ?? "") : ""}
        title={selected?.title || selected?.personName || "Deal"}
      >
        {selected && (
          <DealDetail
            card={selected}
            stages={stages}
            lostSet={lostSet}
            onChangeStage={changeStage}
            onDecideHandoff={decide}
            onPatch={() => router.refresh()}
            onRemove={() => {
              setSelectedId(null);
              router.refresh();
            }}
            onClose={() => setSelectedId(null)}
          />
        )}
      </DetailDrawer>
    </>
  );
}
