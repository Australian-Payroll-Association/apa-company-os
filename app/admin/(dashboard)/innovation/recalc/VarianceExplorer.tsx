"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/admin/Badge";
import { formatCents, formatDate } from "@/lib/admin/format";
import type { VarianceRow } from "@/lib/recalc/types";

type EmployeeGroup = {
  employeeId: string;
  rows: VarianceRow[];
  expectedCents: number;
  actualCents: number;
  varianceCents: number;
  flaggedCount: number;
};

function groupByEmployee(rows: VarianceRow[]): EmployeeGroup[] {
  const byId = new Map<string, VarianceRow[]>();
  for (const r of rows) {
    const list = byId.get(r.employeeId) ?? [];
    list.push(r);
    byId.set(r.employeeId, list);
  }
  const groups: EmployeeGroup[] = [];
  for (const [employeeId, groupRows] of byId) {
    const expectedCents = groupRows.reduce((s, r) => s + r.expectedCents, 0);
    const actualCents = groupRows.reduce((s, r) => s + r.actualCents, 0);
    const flaggedCount = groupRows.filter((r) => r.flagged).length;
    groups.push({ employeeId, rows: groupRows, expectedCents, actualCents, varianceCents: actualCents - expectedCents, flaggedCount });
  }
  // Flagged employees first (worst variance first within that), then everyone else alphabetically.
  groups.sort((a, b) => {
    if (a.flaggedCount !== b.flaggedCount) return b.flaggedCount - a.flaggedCount;
    if (a.flaggedCount > 0) return Math.abs(b.varianceCents) - Math.abs(a.varianceCents);
    return a.employeeId.localeCompare(b.employeeId);
  });
  return groups;
}

function EmployeeRow({ group, defaultOpen }: { group: EmployeeGroup; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="admin-card" style={{ padding: 0, overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "14px 16px",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          font: "inherit",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span aria-hidden style={{ display: "inline-block", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>
            ▸
          </span>
          <span className="admin-cell-strong" style={{ fontSize: 15 }}>
            {group.employeeId}
          </span>
          <span className="admin-cell-muted" style={{ fontSize: 12 }}>
            {group.rows.length} line{group.rows.length === 1 ? "" : "s"}
          </span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {group.flaggedCount > 0 ? (
            <Badge tone="err">
              {group.flaggedCount} flagged · {formatCents(group.varianceCents)}
            </Badge>
          ) : (
            <Badge tone="ok">matches</Badge>
          )}
        </span>
      </button>
      {open && (
        <div className="admin-table-wrap" style={{ borderTop: "1px solid var(--admin-line)" }}>
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Pay period</th>
                  <th>Component</th>
                  <th>Expected</th>
                  <th>Actual</th>
                  <th>Variance</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((v, i) => (
                  <tr key={i}>
                    <td>
                      {formatDate(v.periodStart)} – {formatDate(v.periodEnd)}
                    </td>
                    <td>{v.component.replace(/_/g, " ")}</td>
                    <td>{formatCents(v.expectedCents)}</td>
                    <td>{formatCents(v.actualCents)}</td>
                    <td>
                      {v.flagged ? (
                        <Badge tone={v.varianceCents < 0 ? "err" : "warn"}>{formatCents(v.varianceCents)}</Badge>
                      ) : (
                        formatCents(v.varianceCents)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export function VarianceExplorer({ variances }: { variances: VarianceRow[] }) {
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const groups = useMemo(() => groupByEmployee(variances), [variances]);
  const visible = flaggedOnly ? groups.filter((g) => g.flaggedCount > 0) : groups;
  const flaggedEmployeeCount = groups.filter((g) => g.flaggedCount > 0).length;

  if (variances.length === 0) {
    return <div className="admin-empty">No overlapping employee/pay-period data between the workbook's tabs.</div>;
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
          By employee <span className="admin-cell-muted" style={{ fontWeight: 400 }}>({groups.length})</span>
        </h2>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)} />
          Flagged only ({flaggedEmployeeCount})
        </label>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {visible.length === 0 ? (
          <div className="admin-empty">No flagged employees — nothing to show.</div>
        ) : (
          visible.map((g) => <EmployeeRow key={g.employeeId} group={g} defaultOpen={g.flaggedCount > 0} />)
        )}
      </div>
    </div>
  );
}
