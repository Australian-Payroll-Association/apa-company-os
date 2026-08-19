"use client";

// Sprint detail: plan vs actual for one sprint, plus the sprint brief (goal,
// retro takeaways, client-specific meeting summary). Shared by
// /admin/boards/[slug]/sprints/[id] and /team/boards/[slug]/sprints/[id];
// the page wrappers do the authorization, updateSprintBrief re-checks on write.
// "Plan" is deliberately not locked: it is whatever is committed to the sprint
// right now (cards can join mid-sprint), measured in cards and Human Tokens.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/admin/Badge";
import { formatDate } from "@/lib/admin/format";
import { PRIORITY_LABEL, PRIORITY_TONE, initials } from "@/lib/boards/types";
import type { BoardDetail, BoardCard } from "@/lib/boards/data";
import { updateSprintBrief } from "../../actions";

export function SprintView({ detail, sprintId }: { detail: BoardDetail; sprintId: string }) {
  const router = useRouter();
  const { board, columns, sprints } = detail;
  const sprint = sprints.find((s) => s.id === sprintId)!;

  const cards = useMemo(() => detail.cards.filter((c) => c.sprint_id === sprintId), [detail.cards, sprintId]);
  const columnName = useMemo(() => new Map(columns.map((c) => [c.id, c.name])), [columns]);

  const [banner, setBanner] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [brief, setBrief] = useState({
    goal: sprint.goal ?? "",
    focusImprovement: sprint.focus_improvement ?? "",
    goingWell: sprint.going_well ?? "",
    meetingSummary: sprint.meeting_summary ?? "",
  });
  const [saving, startSaving] = useTransition();

  function saveBrief() {
    setBanner(null);
    startSaving(async () => {
      const r = await updateSprintBrief(sprint.id, brief, board.slug);
      if (!r.ok) return setBanner(r.error);
      setEditing(false);
      router.refresh();
    });
  }

  // ── Plan vs actual ────────────────────────────────────────────────────────
  const tokens = (c: BoardCard) => c.human_tokens ?? 0;
  const done = cards.filter((c) => c.status === "done");
  const open = cards.filter((c) => c.status !== "done");
  const plannedHT = cards.reduce((s, c) => s + tokens(c), 0);
  const doneHT = done.reduce((s, c) => s + tokens(c), 0);
  const unestimated = cards.filter((c) => c.human_tokens == null).length;
  const cardPct = cards.length ? Math.round((done.length / cards.length) * 100) : 0;
  const htPct = plannedHT ? Math.round((doneHT / plannedHT) * 100) : 0;

  type PersonLine = { name: string; done: number; total: number; doneHT: number; totalHT: number };
  const byAssignee = useMemo(() => {
    const map = new Map<string, PersonLine>();
    for (const c of cards) {
      const name = c.assignee_name ?? "Unassigned";
      const line = map.get(name) ?? { name, done: 0, total: 0, doneHT: 0, totalHT: 0 };
      line.total += 1;
      line.totalHT += tokens(c);
      if (c.status === "done") {
        line.done += 1;
        line.doneHT += tokens(c);
      }
      map.set(name, line);
    }
    return [...map.values()].sort((a, b) => b.totalHT - a.totalHT || b.total - a.total);
  }, [cards]);

  const bar = (pct: number) => (
    <div style={{ height: 6, borderRadius: 99, background: "var(--admin-line)", overflow: "hidden" }}>
      <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: "var(--admin-accent)" }} />
    </div>
  );

  const briefField = (label: string, key: keyof typeof brief, placeholder: string, display: string | null) => (
    <div className="admin-field">
      <label className="admin-label">{label}</label>
      {editing ? (
        <textarea
          className="admin-textarea"
          rows={2}
          value={brief[key]}
          placeholder={placeholder}
          onChange={(e) => setBrief({ ...brief, [key]: e.target.value })}
        />
      ) : display ? (
        <div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{display}</div>
      ) : (
        <div className="admin-cell-muted" style={{ fontSize: 13 }}>{placeholder}</div>
      )}
    </div>
  );

  const cardRow = (c: BoardCard) => (
    <div
      key={c.id}
      style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderTop: "1px solid var(--admin-line)", flexWrap: "wrap" }}
    >
      <Badge tone={PRIORITY_TONE[c.priority]}>{PRIORITY_LABEL[c.priority]}</Badge>
      <span className={c.status === "done" ? "admin-cell-muted" : "admin-cell-strong"} style={{ flex: "1 1 240px" }}>
        {c.title}
      </span>
      <span className="admin-cell-muted" style={{ fontSize: 12 }}>
        {c.board_column_id ? columnName.get(c.board_column_id) ?? "" : ""}
      </span>
      {c.assignee_name && (
        <span className="admin-cell-muted" style={{ fontSize: 12 }} title={c.assignee_name}>
          {initials(c.assignee_name)}
        </span>
      )}
      <span className="admin-cell-muted" style={{ fontSize: 12, width: 52, textAlign: "right" }}>
        {c.human_tokens != null ? `${c.human_tokens} HT` : "–"}
      </span>
    </div>
  );

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {banner && <div className="admin-alert admin-alert--err">{banner}</div>}

      <section className="admin-card" style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: 15 }}>Sprint brief</h2>
          <Badge tone={sprint.status === "active" ? "ok" : "neutral"}>{sprint.status}</Badge>
          {(sprint.starts_on || sprint.ends_on) && (
            <span className="admin-cell-muted" style={{ fontSize: 12 }}>
              {sprint.starts_on ? formatDate(sprint.starts_on) : "?"} to {sprint.ends_on ? formatDate(sprint.ends_on) : "?"}
            </span>
          )}
          <span style={{ marginLeft: "auto" }}>
            {editing ? (
              <span style={{ display: "flex", gap: 8 }}>
                <button className="admin-btn admin-btn--sm admin-btn--primary" onClick={saveBrief} disabled={saving}>
                  Save
                </button>
                <button className="admin-btn admin-btn--sm" onClick={() => setEditing(false)} disabled={saving}>
                  Cancel
                </button>
              </span>
            ) : (
              <button className="admin-btn admin-btn--sm" onClick={() => setEditing(true)}>
                Edit brief
              </button>
            )}
          </span>
        </div>
        {briefField("Goal", "goal", "What this sprint is for.", sprint.goal)}
        {briefField(
          "#1 thing we're improving",
          "focusImprovement",
          "The one improvement this sprint, from the retrospective.",
          sprint.focus_improvement,
        )}
        {briefField("What's going well", "goingWell", "Wins worth keeping, from the retrospective.", sprint.going_well)}
        {briefField(
          "Meeting summary",
          "meetingSummary",
          "Client-specific notes from the planning meeting.",
          sprint.meeting_summary,
        )}
      </section>

      <section className="admin-card" style={{ padding: 16 }}>
        <h2 style={{ margin: "0 0 12px", fontSize: 15 }}>Plan vs actual</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          <div>
            <div className="admin-label">Cards</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>
              {done.length}
              <span className="admin-cell-muted" style={{ fontSize: 14, fontWeight: 600 }}> / {cards.length} done</span>
            </div>
            {bar(cardPct)}
          </div>
          <div>
            <div className="admin-label">Human Tokens</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>
              {doneHT}
              <span className="admin-cell-muted" style={{ fontSize: 14, fontWeight: 600 }}> / {plannedHT} delivered</span>
            </div>
            {bar(htPct)}
            {unestimated > 0 && (
              <div className="admin-cell-muted" style={{ fontSize: 12, marginTop: 4 }}>
                {unestimated} card{unestimated === 1 ? "" : "s"} without an estimate
              </div>
            )}
          </div>
        </div>

        {byAssignee.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div className="admin-label">By assignee</div>
            {byAssignee.map((p) => (
              <div
                key={p.name}
                style={{ display: "flex", gap: 10, alignItems: "center", padding: "6px 0", borderTop: "1px solid var(--admin-line)" }}
              >
                <span className="admin-cell-strong" style={{ flex: "1 1 160px" }}>{p.name}</span>
                <span className="admin-cell-muted" style={{ fontSize: 12 }}>
                  {p.done}/{p.total} cards
                </span>
                <span className="admin-cell-muted" style={{ fontSize: 12, width: 110, textAlign: "right" }}>
                  {p.doneHT}/{p.totalHT} HT
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="admin-card" style={{ padding: 16 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 15 }}>
          In play <span className="admin-cell-muted" style={{ fontWeight: 600 }}>({open.length})</span>
        </h2>
        {open.length ? open.map(cardRow) : <div className="admin-cell-muted" style={{ fontSize: 13 }}>Nothing open.</div>}
        <h2 style={{ margin: "16px 0 4px", fontSize: 15 }}>
          Done <span className="admin-cell-muted" style={{ fontWeight: 600 }}>({done.length})</span>
        </h2>
        {done.length ? done.map(cardRow) : <div className="admin-cell-muted" style={{ fontSize: 13 }}>Nothing finished yet.</div>}
      </section>
    </div>
  );
}
