"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, statusTone } from "@/components/admin/Badge";
import { DetailDrawer } from "@/components/admin/DetailDrawer";
import { formatDate, humanize } from "@/lib/admin/format";
import { updateApplication } from "../applications/actions";

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
  rating: number | null; // AI fit, 0-5
  recruiterStars: number | null; // recruiter's own 1-5 rating (applications.rating)
  overview: string | null;
  strengths: string[];
  gaps: string[];
  recruiterRating: string | null; // legacy imported score, e.g. "8.5/10" — read-only reference
};

type SortKey = "ai" | "recruiter";

export function RankTable({
  rows,
  families,
}: {
  rows: RankRow[];
  families: { key: string; label: string }[];
}) {
  const router = useRouter();
  const [family, setFamily] = useState(families[0]?.key ?? "");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "ai", dir: "desc" });

  // Recruiter ratings the user has just changed, applied optimistically over the
  // server value so the table re-sorts before the refresh lands.
  const [overrides, setOverrides] = useState<Record<string, number | null>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const recruiterOf = (r: RankRow) =>
    r.applicationId in overrides ? overrides[r.applicationId] : r.recruiterStars;

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.family, (m.get(r.family) ?? 0) + 1);
    return m;
  }, [rows]);

  const famRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = rows
      .filter((r) => r.family === family)
      .filter(
        (r) =>
          !q ||
          r.name.toLowerCase().includes(q) ||
          (r.email ?? "").toLowerCase().includes(q) ||
          r.reqTitles.some((t) => t.toLowerCase().includes(q)),
      );
    const val = (r: RankRow) => (sort.key === "ai" ? r.rating : recruiterOf(r));
    return [...filtered].sort((a, b) => {
      const av = val(a);
      const bv = val(b);
      // Unrated always sinks to the bottom, regardless of direction.
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return sort.dir === "desc" ? bv - av : av - bv;
    });
    // recruiterOf depends on overrides; include it so the list re-sorts on edit.
  }, [rows, family, query, sort, overrides]);

  const selected = openId ? famRows.find((r) => r.applicationId === openId) ?? null : null;

  function onSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }));
  }

  async function setRecruiter(r: RankRow, star: number) {
    const next = recruiterOf(r) === star ? null : star; // click the current value to clear
    setSavingId(r.applicationId);
    setSaveErr(null);
    const res = await updateApplication(r.applicationId, { rating: next });
    setSavingId(null);
    if (!res.ok) {
      setSaveErr(res.error);
      return;
    }
    setOverrides((o) => ({ ...o, [r.applicationId]: next }));
    router.refresh();
  }

  const sortArrow = (key: SortKey) => (sort.key === key ? (sort.dir === "desc" ? " ↓" : " ↑") : "");

  return (
    <>
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
        <span className="admin-cell-muted" style={{ fontSize: 12.5, marginLeft: "auto" }}>
          Sorted by {sort.key === "ai" ? "AI fit" : "recruiter rating"} ({sort.dir === "desc" ? "high→low" : "low→high"})
        </span>
      </div>

      {saveErr && (
        <div className="admin-alert admin-alert--err" style={{ marginBottom: 12 }}>
          {saveErr}
        </div>
      )}

      <div className="admin-table-wrap">
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: 44 }}>#</th>
                <th>Candidate</th>
                <th>Applied for</th>
                <th style={{ textAlign: "right" }}>
                  <button type="button" className="admin-th-sort" onClick={() => onSort("ai")}>
                    AI fit{sortArrow("ai")}
                  </button>
                </th>
                <th style={{ textAlign: "right" }}>
                  <button type="button" className="admin-th-sort" onClick={() => onSort("recruiter")}>
                    Recruiter{sortArrow("recruiter")}
                  </button>
                </th>
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
                famRows.map((r, i) => {
                  const rec = recruiterOf(r);
                  return (
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
                      <td className="admin-cell-mono">{i + 1}</td>
                      <td>
                        <span className="admin-cell-strong">{r.name}</span>
                        {r.email && <div className="admin-cell-muted">{r.email}</div>}
                      </td>
                      <td>{r.reqTitles.join(", ") || <span className="admin-cell-muted">—</span>}</td>
                      <td className="admin-cell-mono" style={{ textAlign: "right" }}>
                        {r.rating != null ? r.rating.toFixed(1) : <span className="admin-cell-muted">—</span>}
                      </td>
                      <td className="admin-cell-mono" style={{ textAlign: "right" }}>
                        {rec != null ? `${rec}★` : <span className="admin-cell-muted">—</span>}
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
                  );
                })
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
              {selected.appliedAt && (
                <span className="admin-cell-muted" style={{ fontSize: 13 }}>
                  Applied {formatDate(selected.appliedAt)}
                </span>
              )}
            </div>

            {/* Recruiter's own rating — editable, saves on click */}
            <div>
              <div className="admin-label" style={{ marginBottom: 4 }}>
                Recruiter rating{" "}
                {savingId === selected.applicationId ? <span className="admin-cell-muted">· saving…</span> : null}
              </div>
              <StarRating
                value={recruiterOf(selected)}
                disabled={savingId === selected.applicationId}
                onPick={(n) => setRecruiter(selected, n)}
              />
              {selected.recruiterRating && (
                <div className="admin-cell-muted" style={{ fontSize: 12.5, marginTop: 4 }}>
                  Imported score: {selected.recruiterRating}
                </div>
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
                  <div className="admin-label" style={{ marginBottom: 4 }}>
                    AI screen — overview{selected.rating != null ? ` · fit ${selected.rating.toFixed(1)}/5` : ""}
                  </div>
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

// 1–5 stars. Picking the current value clears it back to none.
function StarRating({
  value,
  disabled,
  onPick,
}: {
  value: number | null;
  disabled?: boolean;
  onPick: (n: number) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, height: 34 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          aria-pressed={value != null && n <= value}
          disabled={disabled}
          onClick={() => onPick(n)}
          style={{
            background: "none",
            border: "none",
            cursor: disabled ? "default" : "pointer",
            padding: 0,
            fontSize: 22,
            lineHeight: 1,
            color: value != null && n <= value ? "var(--admin-accent)" : "var(--admin-line-strong)",
          }}
        >
          {value != null && n <= value ? "★" : "☆"}
        </button>
      ))}
    </div>
  );
}
