"use client";

import { useMemo, useState } from "react";
import { DetailDrawer } from "@/components/admin/DetailDrawer";
import { Badge } from "@/components/admin/Badge";
import { formatCents, formatDate } from "@/lib/admin/format";
import { RetreatManage, type RetreatManageData } from "./RetreatManage";

export type RetreatRow = RetreatManageData;

const PAGE_SIZES = [25, 50, 100];

function dateRange(start: string | null, end: string | null): string {
  if (!start) return "—";
  const s = formatDate(start);
  if (!end || formatDate(end) === s) return s;
  return `${s} → ${formatDate(end)}`;
}

// Client-owned retreats table: rows + manage shelf live in one client tree so
// a row click reliably opens the DetailDrawer (a client shelf injected into a
// server-rendered row preview never opens — same lesson as the job reqs
// list). The catalogue is small; search, status filter, and paging happen
// client-side.
export function RetreatsTable({ rows }: { rows: RetreatRow[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const query = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter === "active" && !r.active) return false;
      if (statusFilter === "inactive" && r.active) return false;
      if (!query) return true;
      return [r.name, r.location, r.cohortSlug].some((v) => (v ? v.toLowerCase().includes(query) : false));
    });
  }, [rows, statusFilter, query]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const startIdx = (clampedPage - 1) * pageSize;
  const pageRows = filtered.slice(startIdx, startIdx + pageSize);
  const start = total === 0 ? 0 : startIdx + 1;
  const end = Math.min(startIdx + pageSize, total);

  const selected = selectedId ? rows.find((r) => r.id === selectedId) ?? null : null;

  return (
    <>
      <div className="admin-toolbar" style={{ gap: 10, flexWrap: "wrap" }}>
        <input
          className="admin-input"
          style={{ maxWidth: 280 }}
          placeholder="Search retreat or location…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          aria-label="Search retreats"
        />
        <select
          className="admin-select"
          style={{ maxWidth: 160 }}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select
          className="admin-select"
          style={{ maxWidth: 130 }}
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(1);
          }}
          aria-label="Rows per page"
        >
          {PAGE_SIZES.map((n) => (
            <option key={n} value={n}>
              {n} / page
            </option>
          ))}
        </select>
      </div>

      <div className="admin-table-wrap">
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Retreat</th>
                <th>Location</th>
                <th>Dates</th>
                <th style={{ textAlign: "right" }}>Registered</th>
                <th style={{ textAlign: "right" }}>From</th>
                <th style={{ textAlign: "right" }}>Collected</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="admin-empty">No retreats match.</div>
                  </td>
                </tr>
              ) : (
                pageRows.map((r) => (
                  <tr
                    key={r.id}
                    className="is-clickable"
                    onClick={() => setSelectedId(r.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedId(r.id);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-haspopup="dialog"
                  >
                    <td>
                      <span className="admin-cell-strong">{r.name}</span>
                    </td>
                    <td>{r.location || <span className="admin-cell-muted">—</span>}</td>
                    <td>{dateRange(r.dateStart, r.dateEnd)}</td>
                    <td className="admin-cell-mono" style={{ textAlign: "right" }}>
                      {r.registrations > r.confirmed ? `${r.confirmed} (${r.registrations} incl. unconfirmed)` : String(r.confirmed)}
                    </td>
                    <td className="admin-cell-mono" style={{ textAlign: "right" }}>
                      {formatCents(r.fromUsdCents, "usd")}
                    </td>
                    <td className="admin-cell-mono" style={{ textAlign: "right" }}>
                      {formatCents(r.collectedUsdCents, "usd")}
                    </td>
                    <td>{r.active ? <Badge tone="ok">Active</Badge> : <Badge tone="neutral">Inactive</Badge>}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {total > 0 && (
          <div className="admin-pagination">
            <span>
              {start.toLocaleString()}–{end.toLocaleString()} of {total.toLocaleString()}
            </span>
            <div className="admin-pagination-controls">
              <button
                type="button"
                className="admin-pagebtn"
                disabled={clampedPage <= 1}
                onClick={() => setPage(clampedPage - 1)}
              >
                Prev
              </button>
              <span className="admin-pagebtn" aria-disabled style={{ pointerEvents: "none" }}>
                {clampedPage} / {totalPages}
              </span>
              <button
                type="button"
                className="admin-pagebtn"
                disabled={clampedPage >= totalPages}
                onClick={() => setPage(clampedPage + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <DetailDrawer open={!!selected} onClose={() => setSelectedId(null)} eyebrow="Retreat" title={selected?.name}>
        {selected && <RetreatManage retreat={selected} />}
      </DetailDrawer>
    </>
  );
}
