"use client";

import { useState } from "react";
import Link from "next/link";
import { DetailDrawer } from "@/components/admin/DetailDrawer";
import { Badge } from "@/components/admin/Badge";
import { formatCents, formatDate } from "@/lib/admin/format";

export type CockpitDeal = {
  id: string;
  title: string;
  stage: string;
  usd: number | null;
  hasOwner: boolean;
  probability: number | null;
  nextStep: string | null;
  nextStepDate: string | null;
  company: string | null;
  person: string | null;
  gaps: string[];
};

// The cockpit's priority list: clicking a deal row opens it in the side car
// (DetailDrawer) instead of navigating away, so the rep never loses the list.
export function CockpitDeals({ deals }: { deals: CockpitDeal[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = deals.find((d) => d.id === selectedId) ?? null;

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
        eyebrow="Deal"
        title={selected?.title || "Deal"}
      >
        {selected && (
          <>
            <dl className="admin-kv">
              <dt>Company</dt>
              <dd>{selected.company || "—"}</dd>
              <dt>Contact</dt>
              <dd>{selected.person || "—"}</dd>
              <dt>Stage</dt>
              <dd>{selected.stage}</dd>
              <dt>Value</dt>
              <dd className="admin-cell-mono">{formatCents(selected.usd)}</dd>
              <dt>Owner</dt>
              <dd>
                {selected.hasOwner ? (
                  "Assigned"
                ) : (
                  <span style={{ color: "var(--admin-err-ink)" }}>Unassigned</span>
                )}
              </dd>
              <dt>Probability</dt>
              <dd>{selected.probability != null ? `${selected.probability}%` : "—"}</dd>
              <dt>Next step</dt>
              <dd>
                {selected.nextStep ? (
                  selected.nextStep
                ) : (
                  <span style={{ color: "var(--admin-faint)" }}>none set</span>
                )}
              </dd>
              <dt>Due</dt>
              <dd>{selected.nextStepDate ? formatDate(selected.nextStepDate) : "—"}</dd>
            </dl>
            {selected.gaps.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div className="lead-section-label">Missing</div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {selected.gaps.map((g) => (
                    <Badge key={g} tone="warn">
                      {g}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <div style={{ marginTop: 16 }}>
              <Link
                href={`/admin/revenue/deals?deal=${selected.id}`}
                className="admin-btn admin-btn--primary"
              >
                Open in pipeline
              </Link>
            </div>
          </>
        )}
      </DetailDrawer>
    </>
  );
}
