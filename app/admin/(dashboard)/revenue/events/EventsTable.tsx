"use client";

import { useMemo, useState } from "react";
import { DetailDrawer } from "@/components/admin/DetailDrawer";
import { eventStatusBadge } from "./EventStatusBadge";
import { formatCents, formatDate, humanize } from "@/lib/admin/format";
import Link from "next/link";
import { EVENT_TYPES, EVENT_STATUSES, type EventType, type EventStatus, type EventVisibility } from "@/lib/events";
import { EventManage, type EventAttendee, type EventTierRow } from "./EventManage";

export type EventRow = {
  id: string;
  slug: string;
  type: EventType;
  status: EventStatus;
  visibility: EventVisibility;
  title: string;
  location: string | null;
  startsAt: string | null;
  endsAt: string | null;
  capacity: number | null;
  landingPath: string | null;
  notes: string | null;
  archivedAt: string | null;
  tiers: EventTierRow[];
  attendees: EventAttendee[];
  registeredCount: number;
  totalCount: number;
  fromUsdCents: number;
  collectedUsdCents: number;
};

const PAGE_SIZES = [25, 50, 100];

function dateRange(start: string | null, end: string | null): string {
  if (!start) return "—";
  const s = formatDate(start);
  if (!end || formatDate(end) === s) return s;
  return `${s} → ${formatDate(end)}`;
}

// Client-owned events table: rows + manage shelf live in one client tree so a
// row click reliably opens the DetailDrawer (see components/admin/DataTable's
// getRowPreview — a server-rendered preview injecting a client shelf never
// opens; same lesson as the retreats and job reqs lists). The catalogue is
// small, so search/type/status filter and paging happen client-side.
export function EventsTable({ rows }: { rows: EventRow[] }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const query = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter === "archived") {
        if (!r.archivedAt) return false;
      } else {
        if (r.archivedAt) return false;
        if (statusFilter && r.status !== statusFilter) return false;
      }
      if (typeFilter && r.type !== typeFilter) return false;
      if (!query) return true;
      return [r.title, r.location, r.slug].some((v) => (v ? v.toLowerCase().includes(query) : false));
    });
  }, [rows, statusFilter, typeFilter, query]);

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
          placeholder="Search event, location, or slug…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          aria-label="Search events"
        />
        <select
          className="admin-select"
          style={{ maxWidth: 160 }}
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by type"
        >
          <option value="">All types</option>
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {humanize(t)}
            </option>
          ))}
        </select>
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
          {EVENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {humanize(s)}
            </option>
          ))}
          <option value="archived">Archived</option>
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
                <th>Event</th>
                <th>Type</th>
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
                  <td colSpan={8}>
                    <div className="admin-empty">No events match.</div>
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
                      <span className="admin-cell-strong">{r.title}</span>
                    </td>
                    <td>{humanize(r.type)}</td>
                    <td>{r.location || <span className="admin-cell-muted">—</span>}</td>
                    <td>{dateRange(r.startsAt, r.endsAt)}</td>
                    <td className="admin-cell-mono" style={{ textAlign: "right" }}>
                      {r.totalCount > r.registeredCount
                        ? `${r.registeredCount} (${r.totalCount} incl. other)`
                        : String(r.registeredCount)}
                    </td>
                    <td className="admin-cell-mono" style={{ textAlign: "right" }}>
                      {r.tiers.length === 0 ? "Free" : formatCents(r.fromUsdCents, "usd")}
                    </td>
                    <td className="admin-cell-mono" style={{ textAlign: "right" }}>
                      {formatCents(r.collectedUsdCents, "usd")}
                    </td>
                    <td>{eventStatusBadge(r.status, r.archivedAt)}</td>
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

      <DetailDrawer
        open={!!selected}
        onClose={() => setSelectedId(null)}
        eyebrow="Event"
        title={selected?.title}
        action={
          selected && (
            <Link href={`/admin/revenue/events/${selected.id}`} className="admin-btn">
              Open event page →
            </Link>
          )
        }
      >
        {selected && <EventManage event={selected} />}
      </DetailDrawer>
    </>
  );
}
