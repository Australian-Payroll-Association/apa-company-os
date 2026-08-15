"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/admin/Badge";
import { formatDate, humanize } from "@/lib/admin/format";
import { PRIORITY_LABEL, PRIORITY_TONE } from "@/lib/boards/types";
import type { MyWork, ActorBoard } from "@/lib/team/boards";
import { moveCard } from "@/app/admin/(dashboard)/boards/[slug]/actions";

export function MyTasks({ work, boards }: { work: MyWork; boards: ActorBoard[] }) {
  const router = useRouter();
  const [banner, setBanner] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function markDone(taskId: string, doneColumnId: string | null, boardSlug: string) {
    if (!doneColumnId) {
      setBanner("That board has no done column.");
      return;
    }
    setBanner(null);
    setBusyId(taskId);
    moveCard(taskId, doneColumnId, boardSlug).then((r) => {
      setBusyId(null);
      if (!r.ok) setBanner(r.error);
      else startTransition(() => router.refresh());
    });
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      {banner && (
        <div className="admin-alert admin-alert--err" style={{ marginBottom: 12 }}>
          {banner}
        </div>
      )}

      <section className="admin-card admin-section-card" style={{ marginBottom: 18 }}>
        <h2 className="admin-card-title" style={{ marginBottom: 10 }}>
          My boards <span className="admin-cell-muted">({boards.length})</span>
        </h2>
        {boards.length === 0 ? (
          <span className="admin-cell-muted">You are not on any boards yet.</span>
        ) : (
          <div className="mp-kpi-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
            {boards.map((b) => (
              <Link
                key={b.id}
                href={`/team/boards/${b.slug}`}
                className="admin-card admin-section-card is-clickable"
                style={{ display: "block", textDecoration: "none" }}
              >
                <span className="admin-cell-strong">{b.name}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="admin-card admin-section-card" style={{ marginBottom: 18 }}>
        <h2 className="admin-card-title" style={{ marginBottom: 10 }}>
          Assigned to me <span className="admin-cell-muted">({work.tasks.length})</span>
        </h2>
        {work.tasks.length === 0 ? (
          <span className="admin-cell-muted">Nothing assigned. Enjoy it.</span>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th style={{ width: 150 }}>Board</th>
                  <th style={{ width: 90 }}>Column</th>
                  <th style={{ width: 90 }}>Priority</th>
                  <th style={{ width: 110 }}>Due</th>
                  <th style={{ width: 90 }}></th>
                </tr>
              </thead>
              <tbody>
                {work.tasks.map((t) => {
                  const overdue = t.dueDate != null && t.dueDate < today;
                  return (
                    <tr key={t.id}>
                      <td className="admin-cell-strong">{t.title}</td>
                      <td>
                        <Link href={`/team/boards/${t.boardSlug}`} className="admin-cell-strong">
                          {t.boardName}
                        </Link>
                      </td>
                      <td className="admin-cell-muted">{t.columnName}</td>
                      <td>
                        <Badge tone={PRIORITY_TONE[t.priority]}>{PRIORITY_LABEL[t.priority]}</Badge>
                      </td>
                      <td className="admin-cell-muted" style={{ color: overdue ? "var(--admin-err-ink)" : undefined }}>
                        {t.dueDate ? formatDate(t.dueDate) : "—"}
                      </td>
                      <td>
                        <button
                          className="admin-btn admin-btn--sm"
                          disabled={busyId === t.id}
                          onClick={() => markDone(t.id, t.doneColumnId, t.boardSlug)}
                        >
                          {busyId === t.id ? "…" : "Done"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {work.commitments.length > 0 && (
        <section className="admin-card admin-section-card">
          <h2 className="admin-card-title" style={{ marginBottom: 10 }}>
            My open commitments <span className="admin-cell-muted">({work.commitments.length})</span>
          </h2>
          <div className="admin-hint" style={{ marginBottom: 8 }}>
            From your 1-1s. Update these in{" "}
            <Link href="/team/my-coaching" className="admin-cell-strong">
              My Coaching
            </Link>
            .
          </div>
          {work.commitments.map((c) => (
            <div
              key={c.id}
              style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderTop: "1px solid var(--admin-line)" }}
            >
              <span className="admin-cell-strong" style={{ flex: 1 }}>
                {c.title}
              </span>
              <Badge tone="info">{humanize(c.status)}</Badge>
              {c.dueOn && <span className="admin-cell-muted">{formatDate(c.dueOn)}</span>}
            </div>
          ))}
        </section>
      )}
    </>
  );
}
