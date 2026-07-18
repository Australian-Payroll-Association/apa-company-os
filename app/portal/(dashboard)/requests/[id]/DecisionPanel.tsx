"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelRequest, decideEstimate, decideWork } from "../actions";
import type { WorkRequestStatus } from "@/lib/admin/contractors";

// Status-driven decision panel for the client (admin RequestsShelf pattern):
// estimate review, work review, and a pre-approval cancel. Every decision can
// carry a note to the contractor; non-approvals require one.
function DecisionAction({
  label,
  primary,
  requireNote,
  placeholder,
  onConfirm,
}: {
  label: string;
  primary?: boolean;
  requireNote?: boolean;
  placeholder: string;
  onConfirm: (note: string) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const router = useRouter();
  const [openNote, setOpenNote] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    setError(null);
    startTransition(async () => {
      const r = await onConfirm(note);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setOpenNote(false);
      setNote("");
      router.refresh();
    });
  }

  if (!openNote) {
    return (
      <button type="button" className={primary ? "admin-btn admin-btn--primary" : "admin-btn"} onClick={() => setOpenNote(true)}>
        {label}
      </button>
    );
  }

  return (
    <div style={{ display: "grid", gap: 8, width: "100%" }}>
      <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={placeholder} autoFocus />
      {error && <div className="admin-alert admin-alert--err">{error}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          className={primary ? "admin-btn admin-btn--primary" : "admin-btn"}
          onClick={run}
          disabled={pending || (requireNote && !note.trim())}
        >
          {pending ? "Working…" : `Confirm ${label.toLowerCase()}`}
        </button>
        <button type="button" className="admin-btn" onClick={() => setOpenNote(false)} disabled={pending}>
          Cancel
        </button>
      </div>
    </div>
  );
}

const CANCELLABLE: WorkRequestStatus[] = ["awaiting_estimate", "estimate_submitted", "changes_requested"];

const STATUS_NOTE: Partial<Record<WorkRequestStatus, string>> = {
  awaiting_estimate: "Waiting on the contractor's estimate — you'll get an email when it's ready.",
  changes_requested: "The contractor is updating their estimate — you'll get an email when it's ready.",
  approved: "Estimate approved — work is underway. You'll get an email when it's delivered.",
  completed: "Work accepted. Your invoice arrives by email from QuickBooks.",
  rejected: "You declined this request — nothing further happens.",
  cancelled: "This request was cancelled.",
};

export function DecisionPanel({ id, status }: { id: string; status: WorkRequestStatus }) {
  const decidable = status === "estimate_submitted" || status === "work_submitted";
  const cancellable = CANCELLABLE.includes(status);
  const note = STATUS_NOTE[status];

  if (!decidable && !cancellable && !note) return null;

  return (
    <div className="admin-card admin-section-card">
      <h2 className="admin-card-title" style={{ marginBottom: 10 }}>
        {status === "estimate_submitted"
          ? "Your decision — approve this estimate?"
          : status === "work_submitted"
            ? "Your decision — accept the delivered work?"
            : "Status"}
      </h2>
      {note && <p className="admin-page-sub" style={{ marginTop: 0 }}>{note}</p>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {status === "estimate_submitted" && (
          <>
            <DecisionAction
              label="Approve estimate"
              primary
              placeholder="Optional note to the contractor"
              onConfirm={(n) => decideEstimate(id, "approved", n)}
            />
            <DecisionAction
              label="Request changes"
              requireNote
              placeholder="What should change? (sent to the contractor)"
              onConfirm={(n) => decideEstimate(id, "changes_requested", n)}
            />
            <DecisionAction
              label="Decline"
              requireNote
              placeholder="Why is this not going ahead? (sent to the contractor)"
              onConfirm={(n) => decideEstimate(id, "rejected", n)}
            />
          </>
        )}
        {status === "work_submitted" && (
          <>
            <DecisionAction
              label="Accept work"
              primary
              placeholder="Optional note to the contractor"
              onConfirm={(n) => decideWork(id, "accepted", n)}
            />
            <DecisionAction
              label="Request revision"
              requireNote
              placeholder="What needs revising? (sent to the contractor)"
              onConfirm={(n) => decideWork(id, "revision", n)}
            />
          </>
        )}
        {cancellable && (
          <DecisionAction
            label="Cancel request"
            placeholder="Optional reason (sent to the contractor)"
            onConfirm={(n) => cancelRequest(id, n)}
          />
        )}
      </div>
      {status === "estimate_submitted" && (
        <p className="admin-cell-muted" style={{ marginTop: 10, marginBottom: 0, fontSize: 12.5 }}>
          Approving means the contractor starts the work; you&apos;ll review and accept the result before
          anything is invoiced.
        </p>
      )}
      {status === "work_submitted" && (
        <p className="admin-cell-muted" style={{ marginTop: 10, marginBottom: 0, fontSize: 12.5 }}>
          Accepting closes the project and triggers your invoice at the agreed hourly rate.
        </p>
      )}
    </div>
  );
}
