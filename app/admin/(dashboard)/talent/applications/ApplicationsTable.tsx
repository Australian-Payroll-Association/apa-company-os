"use client";

import { useMemo, useState } from "react";
import { DetailDrawer } from "@/components/admin/DetailDrawer";
import { Badge, statusTone } from "@/components/admin/Badge";
import { formatDate, humanize } from "@/lib/admin/format";
import { ApplicationManage, type AppManageData } from "./ApplicationManage";

export type AppRow = {
  id: string;
  candidateName: string | null;
  email: string | null;
  phone: string | null;
  headline: string | null;
  currentTitle: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  doNotHire: boolean;
  personId: string | null;
  jobReqId: string | null;
  jobReqTitle: string | null;
  stageName: string | null;
  currentStageId: string | null;
  status: string | null;
  rating: number | null;
  rejectionReason: string | null;
  appliedAt: string | null;
  decidedAt: string | null;
  coverLetter: string | null;
  answers: { q: string; a: string }[];
  resumeDocumentId: string | null;
};

const PAGE_SIZES = [25, 50, 100];

function toManageData(r: AppRow): AppManageData {
  return {
    id: r.id,
    jobReqId: r.jobReqId,
    personId: r.personId,
    jobReqTitle: r.jobReqTitle,
    candidateName: r.candidateName,
    status: r.status,
    rating: r.rating,
    rejectionReason: r.rejectionReason,
    currentStageId: r.currentStageId,
    currentStageName: r.stageName,
    appliedAt: r.appliedAt,
    decidedAt: r.decidedAt,
    coverLetter: r.coverLetter,
    answers: r.answers,
    resumeDocumentId: r.resumeDocumentId,
    email: r.email,
    phone: r.phone,
    headline: r.headline,
    currentTitle: r.currentTitle,
    linkedinUrl: r.linkedinUrl,
    portfolioUrl: r.portfolioUrl,
    doNotHire: r.doNotHire,
  };
}

// Client-owned applications table: the whole thing (rows + shelf) is one client
// tree, so a row click reliably opens the DetailDrawer (mirrors the Deals board).
// All rows load once; search, job-req filter, and paging happen client-side.
export function ApplicationsTable({ rows }: { rows: AppRow[] }) {
  const [search, setSearch] = useState("");
  const [reqFilter, setReqFilter] = useState(""); // "" = all reqs
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Distinct job reqs present in the data, for the filter dropdown.
  const reqOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) if (r.jobReqId) m.set(r.jobReqId, r.jobReqTitle || "(untitled req)");
    return [...m.entries()]
      .map(([id, title]) => ({ id, title }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [rows]);

  const query = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (reqFilter && r.jobReqId !== reqFilter) return false;
      if (!query) return true;
      return [r.candidateName, r.headline, r.jobReqTitle, r.stageName, r.status ? humanize(r.status) : null].some(
        (v) => (v ? v.toLowerCase().includes(query) : false),
      );
    });
  }, [rows, reqFilter, query]);

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
          placeholder="Search candidate, headline, or role…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          aria-label="Search applications"
        />
        <select
          className="admin-select"
          style={{ maxWidth: 240 }}
          value={reqFilter}
          onChange={(e) => {
            setReqFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by job req"
        >
          <option value="">All job reqs</option>
          {reqOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.title}
            </option>
          ))}
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
                <th>Candidate</th>
                <th>Job req</th>
                <th>Stage</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Rating</th>
                <th>Applied</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="admin-empty">No applications match.</div>
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
                      <span className={r.candidateName ? "admin-cell-strong" : "admin-cell-muted"}>
                        {r.candidateName || "—"}
                      </span>
                    </td>
                    <td>{r.jobReqTitle || <span className="admin-cell-muted">—</span>}</td>
                    <td>{r.stageName || <span className="admin-cell-muted">—</span>}</td>
                    <td>
                      {r.status ? (
                        <Badge tone={statusTone(r.status)}>{humanize(r.status)}</Badge>
                      ) : (
                        <span className="admin-cell-muted">—</span>
                      )}
                    </td>
                    <td className="admin-cell-mono" style={{ textAlign: "right" }}>
                      {r.rating != null ? `${r.rating}★` : <span className="admin-cell-muted">—</span>}
                    </td>
                    <td>{r.appliedAt ? formatDate(r.appliedAt) : <span className="admin-cell-muted">—</span>}</td>
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
        eyebrow="Application"
        title={selected?.candidateName || "Candidate"}
      >
        {selected && <ApplicationManage app={toManageData(selected)} />}
      </DetailDrawer>
    </>
  );
}
