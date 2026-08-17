"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/admin/Badge";
import { initials } from "@/lib/boards/types";
import type { BoardListItem } from "@/lib/boards/data";

const VIEW_KEY = "boards:view";
type View = "cards" | "list";

export function BoardsIndex({ boards, newBoard }: { boards: BoardListItem[]; newBoard: ReactNode }) {
  const router = useRouter();
  // Cards on first paint (SSR-safe); the stored preference applies after mount.
  const [view, setView] = useState<View>("cards");
  useEffect(() => {
    if (localStorage.getItem(VIEW_KEY) === "list") setView("list");
  }, []);
  function pick(v: View) {
    setView(v);
    localStorage.setItem(VIEW_KEY, v);
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
        <div style={{ flex: 1, minWidth: 0 }}>{newBoard}</div>
        <div className="admin-viewtoggle" role="group" aria-label="Boards view">
          <button className={view === "cards" ? "is-active" : ""} onClick={() => pick("cards")}>
            Cards
          </button>
          <button className={view === "list" ? "is-active" : ""} onClick={() => pick("list")}>
            List
          </button>
        </div>
      </div>

      {boards.length === 0 ? (
        <div className="admin-card admin-section-card">
          <span className="admin-cell-muted">No boards yet.</span>
        </div>
      ) : view === "cards" ? (
        <div className="mp-kpi-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
          {boards.map((b) => {
            const total = b.open_count + b.done_count;
            const pct = total > 0 ? Math.round((b.done_count / total) * 100) : 0;
            const shown = b.member_names.slice(0, 4);
            const extra = b.member_names.length - shown.length;
            return (
              <Link
                key={b.id}
                href={`/admin/boards/${b.slug}`}
                className="admin-card admin-section-card is-clickable"
                style={{ display: "flex", flexDirection: "column", gap: 0, textDecoration: "none" }}
              >
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                  <span className="admin-cell-strong" style={{ fontSize: 15 }}>
                    {b.name}
                  </span>
                  {b.client_name && <Badge tone="info">Client</Badge>}
                </div>
                <div className="admin-cell-muted" style={{ marginTop: 4, minHeight: 18 }}>
                  {b.client_name ?? "Internal"}
                </div>
                <div style={{ marginTop: 14 }}>
                  <div
                    className="admin-cell-muted"
                    style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}
                  >
                    <span>
                      {total === 0 ? "No cards yet" : b.open_count === 0 ? "All done" : `${b.open_count} open`}
                    </span>
                    {total > 0 && <span>{pct}% done</span>}
                  </div>
                  <div className="board-progress">
                    <div className="board-progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span className="board-avatar-stack">
                    {shown.map((name, i) => (
                      <span key={`${name}-${i}`} className="sap-avatar" title={name}>
                        {initials(name)}
                      </span>
                    ))}
                    {extra > 0 && <span className="board-avatar-more">+{extra}</span>}
                    {b.member_names.length === 0 && (
                      <span className="admin-cell-muted" style={{ fontSize: 12 }}>
                        No members
                      </span>
                    )}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="admin-table-wrap">
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Board</th>
                  <th>Client</th>
                  <th>Open</th>
                  <th>Done</th>
                  <th>Members</th>
                </tr>
              </thead>
              <tbody>
                {boards.map((b) => {
                  const total = b.open_count + b.done_count;
                  const pct = total > 0 ? Math.round((b.done_count / total) * 100) : 0;
                  const shown = b.member_names.slice(0, 5);
                  const extra = b.member_names.length - shown.length;
                  return (
                    <tr
                      key={b.id}
                      className="is-clickable"
                      tabIndex={0}
                      onClick={() => router.push(`/admin/boards/${b.slug}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") router.push(`/admin/boards/${b.slug}`);
                      }}
                    >
                      <td className="admin-cell-strong">{b.name}</td>
                      <td>
                        {b.client_name ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                            {b.client_name} <Badge tone="info">Client</Badge>
                          </span>
                        ) : (
                          <span className="admin-cell-muted">Internal</span>
                        )}
                      </td>
                      <td className="admin-cell-mono">{b.open_count}</td>
                      <td>
                        {total === 0 ? (
                          <span className="admin-cell-muted">—</span>
                        ) : (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                            <span className="board-progress" style={{ width: 72, display: "inline-block" }}>
                              <span className="board-progress-fill" style={{ width: `${pct}%`, display: "block" }} />
                            </span>
                            <span className="admin-cell-mono">{pct}%</span>
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="board-avatar-stack">
                          {shown.map((name, i) => (
                            <span key={`${name}-${i}`} className="sap-avatar" title={name}>
                              {initials(name)}
                            </span>
                          ))}
                          {extra > 0 && <span className="board-avatar-more">+{extra}</span>}
                          {b.member_names.length === 0 && <span className="admin-cell-muted">—</span>}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
