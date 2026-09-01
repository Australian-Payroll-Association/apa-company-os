"use client";

import { useMemo, useState, type CSSProperties } from "react";
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
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          background: "var(--admin-surface)",
          border: "1px solid var(--admin-line)",
          borderRadius: "var(--admin-radius-sm)",
          padding: "12px 14px",
          cursor: "pointer",
          font: "inherit",
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          fontSize: 14,
          color: "var(--admin-ink)",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span aria-hidden style={{ display: "inline-block", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s", color: "var(--admin-muted)" }}>
            ▸
          </span>
          {group.employeeId}
          <span style={{ fontWeight: 400, fontSize: 13, color: "var(--admin-muted)", fontFamily: "inherit" }}>
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
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16, marginBottom: 4, paddingLeft: 10 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 110px 110px 110px",
              gap: 14,
              padding: "0 14px",
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 0.3,
              color: "var(--admin-muted)",
            }}
          >
            <span>Component</span>
            <span style={{ textAlign: "right" }}>Expected</span>
            <span style={{ textAlign: "right" }}>Actual</span>
            <span style={{ textAlign: "right" }}>Variance</span>
          </div>
          {group.rows.map((v, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 110px 110px 110px",
                gap: 14,
                alignItems: "center",
                padding: "11px 14px",
                background: "var(--admin-surface)",
                border: "1px solid var(--admin-line)",
                borderRadius: "var(--admin-radius-sm)",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                <span style={{ fontWeight: 600, color: "var(--admin-ink)" }}>{v.component.replace(/_/g, " ")}</span>
                <span style={{ fontSize: 12, color: "var(--admin-muted)" }}>
                  {formatDate(v.periodStart)} – {formatDate(v.periodEnd)}
                </span>
              </div>
              <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--admin-ink)" }}>{formatCents(v.expectedCents)}</span>
              <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--admin-ink)" }}>{formatCents(v.actualCents)}</span>
              <span style={{ textAlign: "right" }}>
                {v.flagged ? (
                  <Badge tone={v.varianceCents < 0 ? "err" : "warn"}>{formatCents(v.varianceCents)}</Badge>
                ) : (
                  <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--admin-ink)" }}>{formatCents(v.varianceCents)}</span>
                )}
              </span>
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

  const emptyStyle: CSSProperties = { color: "var(--admin-muted)", fontSize: 14, padding: "24px 0", textAlign: "center" };

  if (variances.length === 0) {
    return <p style={emptyStyle}>No overlapping employee/pay-period data between the workbook's tabs.</p>;
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, fontFamily: "var(--font-display)", color: "var(--admin-ink)" }}>
          By employee <span style={{ fontWeight: 400, color: "var(--admin-muted)" }}>({groups.length})</span>
        </h2>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", color: "var(--admin-ink)" }}>
          <input type="checkbox" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)} />
          Flagged only ({flaggedEmployeeCount})
        </label>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {visible.length === 0 ? (
          <p style={emptyStyle}>No flagged employees — nothing to show.</p>
        ) : (
          visible.map((g) => <EmployeeGroupBlock key={g.employeeId} group={g} defaultOpen={g.flaggedCount > 0} />)
        )}
      </div>
    </div>
  );
}
