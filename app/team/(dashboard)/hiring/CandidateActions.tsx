"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { advanceCandidate, rejectCandidate, requestBooking } from "./manage-actions";

// The hiring manager's verbs on one candidate row. Authorization is enforced in
// the server actions; this only decides which buttons to show. Reject asks for
// confirmation because it closes the application.
export function CandidateActions({
  applicationId,
  canRequestBooking,
  bookingRequested,
}: {
  applicationId: string;
  canRequestBooking: boolean;
  bookingRequested: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [requested, setRequested] = useState(bookingRequested);

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, onOk?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onOk?.();
      router.refresh();
    });
  }

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center" }}>
      {error && (
        <span className="admin-cell-muted" style={{ color: "var(--admin-err-ink)", fontSize: 12 }}>
          {error}
        </span>
      )}
      {canRequestBooking &&
        (requested ? (
          <span className="admin-badge admin-badge--info">Booking requested</span>
        ) : (
          <button
            type="button"
            className="admin-btn admin-btn--sm"
            disabled={pending}
            onClick={() => run(() => requestBooking(applicationId), () => setRequested(true))}
          >
            Request booking
          </button>
        ))}
      <button
        type="button"
        className="admin-btn admin-btn--sm"
        disabled={pending}
        onClick={() => run(() => advanceCandidate(applicationId))}
      >
        Advance
      </button>
      <button
        type="button"
        className="admin-btn admin-btn--sm admin-btn--danger"
        disabled={pending}
        onClick={() => {
          if (window.confirm("Reject this candidate? This closes the application.")) {
            run(() => rejectCandidate(applicationId));
          }
        }}
      >
        Reject
      </button>
    </div>
  );
}
