"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge, statusTone } from "@/components/admin/Badge";
import { DetailDrawer } from "@/components/admin/DetailDrawer";
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
  const [openId, setOpenId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.family, (m.get(r.family) ?? 0) + 1);
    return m;
  }, [rows]);

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

  const selected = openId ? famRows.find((r) => r.applicationId === openId) ?? null : null;

  return (
    <>
      {/* Family tabs — the one switcher across the whole page */}
      <div className="admin-tabs" role="tablist">
        {families.map((f) => (
          <button
            key={f.key}
            role="tab"
            aria-selected={family === f.key}
            className={`admin-tab${family === f.key ? " is-active" : ""}`}
            onClick={() => {
              setFamily(f.key);
              setOpenId(null);
            }}
          >
            {f.label} ({counts.get(f.key) ?? 0})
          </button>
        ))}
      </div>

      <div className="admin-toolbar" style={{ gap: 10, flexWrap: "wrap" }}>
        <input
          className="admin-input"
          style={{ maxWidth: 260 }}
          placeholder="Search name, email, req…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search candidates"
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
              </tr>
            </thead>
            <tbody>
              {famRows.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="admin-empty">No candidates in this family match.</div>
                  </td>
                </tr>
              ) : (
                famRows.map((r, i) => (
                  <tr
                    key={`${r.family}:${r.personId}`}
                    className="is-clickable"
                    onClick={() => setOpenId(r.applicationId)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setOpenId(r.applicationId);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-haspopup="dialog"
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
                    <td>
                      {r.status ? (
                        <Badge tone={statusTone(r.status)}>{humanize(r.status)}</Badge>
                      ) : (
                        <span className="admin-cell-muted">—</span>
                      )}
                    </td>
                    <td>{r.appliedAt ? formatDate(r.appliedAt) : <span className="admin-cell-muted">—</span>}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <DetailDrawer
        open={!!selected}
        onClose={() => setOpenId(null)}
        eyebrow={
          selected
            ? `${families.find((f) => f.key === selected.family)?.label ?? "Candidate"}${
                selected.rating != null ? ` · AI fit ${selected.rating.toFixed(1)}/5` : ""
              }`
            : "Candidate"
        }
        title={selected?.name ?? "Candidate"}
        action={
          selected?.resumeDocumentId ? (
            <a
              className="admin-btn admin-btn--sm"
              href={`/admin/talent/resume/${selected.resumeDocumentId}`}
              target="_blank"
              rel="noreferrer"
            >
              Resume ↗
            </a>
          ) : undefined
        }
      >
        {selected && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, fontSize: 14 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {selected.status && <Badge tone={statusTone(selected.status)}>{humanize(selected.status)}</Badge>}
              {selected.recruiterRating && <Badge>Recruiter {selected.recruiterRating}</Badge>}
              {selected.appliedAt && (
                <span className="admin-cell-muted" style={{ fontSize: 13 }}>
                  Applied {formatDate(selected.appliedAt)}
                </span>
              )}
            </div>

            {selected.reqTitles.length > 0 && (
              <div>
                <div className="admin-label" style={{ marginBottom: 4 }}>Applied for</div>
                <div>{selected.reqTitles.join(", ")}</div>
              </div>
            )}

            {selected.overview ? (
              <>
                <div>
                  <div className="admin-label" style={{ marginBottom: 4 }}>AI screen — overview</div>
                  <div style={{ whiteSpace: "pre-wrap" }}>{selected.overview}</div>
                </div>
                {selected.strengths.length > 0 && (
                  <div>
                    <div className="admin-label" style={{ marginBottom: 4 }}>Strengths</div>
                    <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
                      {selected.strengths.map((s, j) => (
                        <li key={j}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {selected.gaps.length > 0 && (
                  <div>
                    <div className="admin-label" style={{ marginBottom: 4 }}>Gaps</div>
                    <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
                      {selected.gaps.map((g, j) => (
                        <li key={j}>{g}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <div className="admin-empty">
                Not yet AI-screened for this family
                {selected.resumeDocumentId ? "" : " (no resume on file)"}.
              </div>
            )}

            <div>
              <div className="admin-label" style={{ marginBottom: 4 }}>Contact</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {selected.email ? <a href={`mailto:${selected.email}`}>{selected.email}</a> : null}
                {selected.phone && <span>{selected.phone}</span>}
                {selected.linkedinUrl && (
                  <a href={selected.linkedinUrl} target="_blank" rel="noreferrer">
                    LinkedIn ↗
                  </a>
                )}
                {!selected.email && !selected.phone && !selected.linkedinUrl && (
                  <span className="admin-cell-muted">No contact details on file.</span>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 16, paddingTop: 4 }}>
              <Link href={`/admin/contacts/${selected.personId}`} className="admin-btn">
                Open person record →
              </Link>
            </div>
          </div>
        )}
      </DetailDrawer>
    </>
  );
}
