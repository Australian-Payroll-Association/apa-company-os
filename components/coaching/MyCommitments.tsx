"use client";

import { useState, useTransition } from "react";
import type { Commitment, CommitmentStatus } from "@/lib/coaching/data";
import { COMMITMENT_STATUS_LABELS, OPEN_COMMITMENT_STATUSES } from "@/lib/coaching/data";
import { updateMyCommitment } from "@/app/team/(dashboard)/my-coaching/actions";

// The member's interactive commitment list on /team/my-coaching: status +
// one-line note per commitment. Updating any of them also answers the latest
// mid-cycle check-in (handled server-side).

const STATUS_BADGE: Record<CommitmentStatus, string> = {
  open: "admin-badge--info",
  on_track: "admin-badge--ok",
  needs_attention: "admin-badge--warn",
  completed: "admin-badge--ok",
  dropped: "admin-badge--err",
  blocked: "admin-badge--err",
};

function fmt(iso: string | null): string {
  if (!iso) return "";
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export function MyCommitments({ commitments }: { commitments: Commitment[] }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const open = commitments.filter((c) => (OPEN_COMMITMENT_STATUSES as CommitmentStatus[]).includes(c.status));
  const closed = commitments.filter(
    (c) => !(OPEN_COMMITMENT_STATUSES as CommitmentStatus[]).includes(c.status),
  );

  const update = (id: string, status: CommitmentStatus, note: string) => {
    setError(null);
    startTransition(async () => {
      const res = await updateMyCommitment(id, status, note);
      if (!res.ok) setError(res.error);
    });
  };

  return (
    <>
      {error && <div className="admin-alert admin-alert--err">{error}</div>}
      {open.length === 0 && <div className="admin-empty">No open commitments right now.</div>}
      {open.map((c) => (
        <Row key={c.id} c={c} busy={busy} update={update} />
      ))}
      {closed.length > 0 && (
        <details className="coach-closed">
          <summary>{closed.length} closed</summary>
          {closed.map((c) => (
            <div key={c.id} className="coach-commitment is-closed">
              <span className={`admin-badge ${STATUS_BADGE[c.status]}`}>
                {COMMITMENT_STATUS_LABELS[c.status]}
              </span>
              <span>{c.title}</span>
            </div>
          ))}
        </details>
      )}
    </>
  );
}

function Row({
  c,
  busy,
  update,
}: {
  c: Commitment;
  busy: boolean;
  update: (id: string, status: CommitmentStatus, note: string) => void;
}) {
  const [note, setNote] = useState(c.statusNote ?? "");
  return (
    <div className="coach-commitment">
      <div className="coach-commitment-main">
        <span className={`admin-badge ${STATUS_BADGE[c.status]}`}>{COMMITMENT_STATUS_LABELS[c.status]}</span>
        <span className="coach-commitment-title">{c.title}</span>
        <span className="admin-cell-muted">
          {c.owner === "coach" ? "your coach owns this" : "yours"}
          {c.dueOn ? ` · due ${fmt(c.dueOn)}` : ""}
        </span>
      </div>
      <div className="coach-commitment-controls">
        <select
          className="admin-input"
          value={c.status}
          disabled={busy}
          onChange={(e) => update(c.id, e.target.value as CommitmentStatus, note)}
        >
          {Object.entries(COMMITMENT_STATUS_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <input
          className="admin-input"
          placeholder="One-line status update…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => {
            if ((c.statusNote ?? "") !== note) update(c.id, c.status, note);
          }}
        />
      </div>
    </div>
  );
}
