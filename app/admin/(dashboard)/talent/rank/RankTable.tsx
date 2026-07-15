"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { Badge, statusTone } from "@/components/admin/Badge";
import { formatDate, humanize } from "@/lib/admin/format";

export type RankRow = {
  applicationId: string;
  personId: string;
  family: string;
  name: string;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  reqTitle: string | null;
  reqTitles: string[];
  status: string | null;
  appliedAt: string | null;
  resumeDocumentId: string | null;
  rating: number | null;
  overview: string | null;
  strengths: string[];
  gaps: string[];
  recruiterRating: string | null;
};

export function RankTable({
  rows,
  families,
}: {
  rows: RankRow[];
  families: { key: string; label: string }[];
}) {
  const [family, setFamily] = useState(families[0]?.key ?? "");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const famRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => r.family === family)
      .filter(
        (r) =>
          !q ||
          r.name.toLowerCase().includes(q) ||
          (r.email ?? "").toLowerCase().includes(q) ||
          r.reqTitles.some((t) => t.toLowerCase().includes(q)),
      );
  }, [rows, family, query]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.family, (m.get(r.family) ?? 0) + 1);
    return m;
  }, [rows]);

  return (
    <>
      <div className="admin-toolbar" style={{ gap: 10, flexWrap: "wrap" }}>
        {families.map((f) => (
          <button
            key={f.key}
            type="button"
            className="admin-pagebtn"
            aria-pressed={family === f.key}
            style={family === f.key ? { fontWeight: 600, textDecoration: "underline" } : undefined}
            onClick={() => {
              setFamily(f.key);
              setOpen(null);
            }}
          >
            {f.label} ({counts.get(f.key) ?? 0})
          </button>
        ))}
        <input
          className="admin-input"
          style={{ marginLeft: "auto", maxWidth: 240 }}
          placeholder="Search name, email, req…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="admin-table-wrap">
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: 44 }}>#</th>
                <th>Candidate</th>
                <th>Applied for</th>
                <th style={{ textAlign: "right" }}>AI fit</th>
                <th style={{ textAlign: "right" }}>Recruiter</th>
                <th>Status</th>
                <th>Applied</th>
                <th>Resume</th>
              </tr>
            </thead>
            <tbody>
              {famRows.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <div className="admin-empty">No candidates in this family match.</div>
                  </td>
                </tr>
              )}
              {famRows.map((r, i) => (
                <Fragment key={`${r.family}:${r.personId}`}>
                  <tr
                    className="is-clickable"
                    onClick={() => setOpen(open === r.applicationId ? null : r.applicationId)}
                  >
                    <td className="admin-cell-mono">{r.rating != null ? i + 1 : "—"}</td>
                    <td>
                      <span className="admin-cell-strong">{r.name}</span>
                      {r.email && <div className="admin-cell-muted">{r.email}</div>}
                    </td>
                    <td>{r.reqTitles.join(", ") || <span className="admin-cell-muted">—</span>}</td>
                    <td className="admin-cell-mono" style={{ textAlign: "right" }}>
                      {r.rating != null ? r.rating.toFixed(1) : <span className="admin-cell-muted">—</span>}
                    </td>
                    <td className="admin-cell-mono" style={{ textAlign: "right" }}>
                      {r.recruiterRating ?? <span className="admin-cell-muted">—</span>}
                    </td>
                    <td>{r.status ? <Badge tone={statusTone(r.status)}>{humanize(r.status)}</Badge> : "—"}</td>
                    <td>{r.appliedAt ? formatDate(r.appliedAt) : <span className="admin-cell-muted">—</span>}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {r.resumeDocumentId ? (
                        <a href={`/admin/talent/resume/${r.resumeDocumentId}`} target="_blank" rel="noreferrer">
                          View
                        </a>
                      ) : (
                        <span className="admin-cell-muted">—</span>
                      )}
                    </td>
                  </tr>
                  {open === r.applicationId && (
                    <tr>
                      <td colSpan={8} style={{ background: "var(--admin-bg-subtle, transparent)" }}>
                        {r.overview ? (
                          <div style={{ padding: "10px 6px", maxWidth: 900 }}>
                            <p style={{ margin: "0 0 8px" }}>{r.overview}</p>
                            {r.strengths.length > 0 && (
                              <ul style={{ margin: "0 0 8px", paddingLeft: 18 }}>
                                {r.strengths.map((s, j) => (
                                  <li key={j}>{s}</li>
                                ))}
                              </ul>
                            )}
                            {r.gaps.length > 0 && (
                              <p className="admin-cell-muted" style={{ margin: 0 }}>
                                Gaps: {r.gaps.join(" · ")}
                              </p>
                            )}
                            <p style={{ margin: "8px 0 0" }}>
                              <Link href={`/admin/contacts/${r.personId}`}>Open person record →</Link>
                            </p>
                          </div>
                        ) : (
                          <div className="admin-empty">
                            Not yet AI-screened for this family
                            {r.resumeDocumentId ? "" : " (no resume on file)"}.
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
