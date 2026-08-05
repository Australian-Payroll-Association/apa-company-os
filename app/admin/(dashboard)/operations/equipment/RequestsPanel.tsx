"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/admin/Badge";
import { formatDate, humanize } from "@/lib/admin/format";
import type { PendingRequest } from "@/lib/admin/equipment";
import { decideEquipmentRequest } from "./actions";

// Open asks from /team, above the register. Approving does not create anything:
// an admin still adds the item and assigns it, then marks the request fulfilled.
// Pretending to automate procurement would be worse than the two steps.
export function RequestsPanel({ requests }: { requests: PendingRequest[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (requests.length === 0) return null;

  async function decide(id: string, status: "approved" | "declined") {
    setBusy(id);
    setErr(null);
    const r = await decideEquipmentRequest(id, status);
    setBusy(null);
    if (r.ok) router.refresh();
    else setErr(r.error);
  }

  return (
    <div className="admin-card admin-section-card" style={{ marginBottom: 14 }}>
      <div className="admin-shelf-heading" style={{ marginBottom: 10 }}>
        Equipment requests
        <Badge tone="warn">{requests.length} open</Badge>
      </div>
      {err && <div className="admin-alert admin-alert--err" style={{ marginBottom: 10 }}>{err}</div>}
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
        {requests.map((r) => (
          <li
            key={r.id}
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              borderLeft: "2px solid var(--admin-line)",
              paddingLeft: 12,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div className="admin-cell-strong">
                {r.person?.full_name ?? "Unknown"} · {humanize(r.type)}
              </div>
              {r.reason && <div style={{ fontSize: 13 }}>{r.reason}</div>}
              <div className="admin-cell-muted" style={{ fontSize: 12 }}>
                Asked {formatDate(r.created_at)}
                {r.needed_by && ` · needed by ${formatDate(r.needed_by)}`}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flex: "none" }}>
              <button
                type="button"
                className="admin-btn admin-btn--sm"
                disabled={busy === r.id}
                onClick={() => decide(r.id, "declined")}
              >
                Decline
              </button>
              <button
                type="button"
                className="admin-btn admin-btn--sm admin-btn--primary"
                disabled={busy === r.id}
                onClick={() => decide(r.id, "approved")}
              >
                Approve
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
