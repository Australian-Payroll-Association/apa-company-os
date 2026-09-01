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

// Same visual language as the team timesheet's day-groups (.tsheet-daygroup-head
// / .tsheet-rowlist / .tsheet-row) — a header row per employee, a row per line
// item, rather than a bespoke card-and-table layout.
function EmployeeGroupBlock({ group, defaultOpen }: { group: EmployeeGroup; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="tsheet-daygroup-head"
        style={{ width: "100%", background: "none", border: "none", cursor: "pointer", font: "inherit" }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span aria-hidden style={{ display: "inline-block", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s", color: "var(--admin-muted)" }}>
            ▸
          </span>
          {group.employeeId}
          <span className="tsheet-daygroup-total" style={{ fontWeight: 400 }}>
            {group.rows.length} line{group.rows.length === 1 ? "" : "s"}
          </span>
        </span>
        {group.flaggedCount > 0 ? (
          <Badge tone="err">
            {group.flaggedCount} flagged · {formatCents(group.varianceCents)}
          </Badge>
        ) : (
          <Badge tone="ok">matches</Badge>
        )}
      </button>
      {open && (
        <div className="tsheet-rowlist" style={{ marginTop: 8, marginBottom: 8 }}>
          {group.rows.map((v, i) => (
            <div className="tsheet-row" key={i} style={{ gridTemplateColumns: "1fr auto auto auto" }}>
              <div className="tsheet-row-main">
                <span className="tsheet-row-project">{v.component.replace(/_/g, " ")}</span>
                <span className="tsheet-row-client">
                  {formatDate(v.periodStart)} – {formatDate(v.periodEnd)}
                </span>
              </div>
              <span className="tsheet-row-hours">{formatCents(v.expectedCents)}</span>
              <span className="tsheet-row-hours">{formatCents(v.actualCents)}</span>
              {v.flagged ? (
                <Badge tone={v.varianceCents < 0 ? "err" : "warn"}>{formatCents(v.varianceCents)}</Badge>
              ) : (
                <span className="tsheet-row-hours">{formatCents(v.varianceCents)}</span>
              )}
            </div>
          ))}
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
    return <p className="tsheet-empty">No overlapping employee/pay-period data between the workbook's tabs.</p>;
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, fontFamily: "var(--font-display)" }}>
          By employee <span className="admin-cell-muted" style={{ fontWeight: 400 }}>({groups.length})</span>
        </h2>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)} />
          Flagged only ({flaggedEmployeeCount})
        </label>
      </div>
      <div className="tsheet-entries" style={{ marginTop: 0 }}>
        {visible.length === 0 ? (
          <p className="tsheet-empty">No flagged employees — nothing to show.</p>
        ) : (
          visible.map((g) => <EmployeeGroupBlock key={g.employeeId} group={g} defaultOpen={g.flaggedCount > 0} />)
        )}
      </div>
    </div>
  );
}
