"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendBackForChanges, signOffEdition, submitForReview } from "../actions";

// The gate. Two signatures, from two different people, before anything sends.
//
// One signature was the fork's model and it is not enough for a compliance
// publication: the person who assembles an edition is the last person able to
// notice what they got wrong in it.
//
// The panel shows who has signed and who is still needed, because a gate whose
// state you have to infer is one people route around. It refuses your second
// signature by name rather than hiding the button — being told why is more
// useful than a control that silently isn't there.

type Msg = { tone: "ok" | "err"; text: string } | null;

export function ReviewPanel({
  editionId,
  status,
  hasDraft,
  reviewerSignedBy,
  reviewerSignedAt,
  adminSignedBy,
  adminSignedAt,
  reviewNotes,
  viewerEmail,
}: {
  editionId: string;
  status: string;
  hasDraft: boolean;
  reviewerSignedBy: string | null;
  reviewerSignedAt: string | null;
  adminSignedBy: string | null;
  adminSignedAt: string | null;
  reviewNotes: string | null;
  viewerEmail: string;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [notes, setNotes] = useState("");

  const inReview = status === "in_review";
  const cleared = Boolean(reviewerSignedBy && adminSignedBy);
  const alreadySigned = viewerEmail === reviewerSignedBy || viewerEmail === adminSignedBy;

  function act(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    setMsg(null);
    start(async () => {
      const result = await fn();
      if (result.ok) {
        setRejecting(false);
        setNotes("");
        if (result.message) setMsg({ tone: "ok", text: result.message });
        router.refresh();
      } else {
        setMsg({ tone: "err", text: result.error ?? "That didn't work." });
      }
    });
  }

  const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-AU") : "");

  return (
    <div className="admin-card" style={{ padding: "20px 22px", marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <h2 className="admin-card-title" style={{ margin: 0 }}>
          Review
        </h2>
        {cleared && <span className="admin-cell-muted">cleared to send</span>}
      </div>

      {!hasDraft ? (
        <p className="admin-page-sub" style={{ marginTop: 6, marginBottom: 0 }}>
          Nothing to review yet. Write the draft first.
        </p>
      ) : (
        <>
          <p className="admin-page-sub" style={{ marginTop: 6 }}>
            Two people have to sign this off before it can send, and they have to be two different
            people. Changing the draft after a signature clears both.
          </p>

          {/* Both slots always shown, filled or not. "Who still needs to sign"
              is the question this panel exists to answer. */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            {[
              { label: "First signature", by: reviewerSignedBy, at: reviewerSignedAt },
              { label: "Second signature", by: adminSignedBy, at: adminSignedAt },
            ].map((slot) => (
              <div
                key={slot.label}
                style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}
              >
                <span className="admin-label" style={{ minWidth: 130 }}>
                  {slot.label}
                </span>
                {slot.by ? (
                  <span>
                    {slot.by}
                    <span className="admin-cell-muted" style={{ marginLeft: 8, fontSize: 12 }}>
                      {when(slot.at)}
                    </span>
                  </span>
                ) : (
                  <span className="admin-cell-muted">not signed</span>
                )}
              </div>
            ))}
          </div>

          {reviewNotes && (
            <div className="admin-alert admin-alert--warn" style={{ marginTop: 12 }}>
              <strong style={{ display: "block", marginBottom: 4 }}>Sent back for changes</strong>
              <span style={{ whiteSpace: "pre-wrap" }}>{reviewNotes}</span>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
            {!inReview && !cleared && (
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                disabled={pending || status === "published" || status === "cancelled"}
                onClick={() => act(() => submitForReview(editionId))}
              >
                {pending ? "Sending…" : "Send for review"}
              </button>
            )}

            {inReview && !cleared && !rejecting && (
              <>
                <button
                  type="button"
                  className="admin-btn admin-btn--primary"
                  disabled={pending || alreadySigned}
                  onClick={() => act(() => signOffEdition(editionId))}
                >
                  {pending ? "Signing…" : "Sign off"}
                </button>
                <button
                  type="button"
                  className="admin-btn"
                  disabled={pending}
                  onClick={() => setRejecting(true)}
                >
                  Send back for changes
                </button>
              </>
            )}

            {rejecting && (
              <div style={{ width: "100%" }}>
                <label className="admin-label">What needs changing?</label>
                <textarea
                  className="admin-textarea"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Be specific — this is what the writer works from."
                  style={{ width: "100%", minHeight: 110, marginTop: 4 }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button
                    type="button"
                    className="admin-btn admin-btn--primary"
                    disabled={pending || !notes.trim()}
                    onClick={() => act(() => sendBackForChanges(editionId, notes))}
                  >
                    {pending ? "Sending…" : "Send back"}
                  </button>
                  <button
                    type="button"
                    className="admin-btn"
                    disabled={pending}
                    onClick={() => {
                      setRejecting(false);
                      setNotes("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {inReview && alreadySigned && !cleared && (
            <p className="admin-page-sub" style={{ marginTop: 8, marginBottom: 0, fontSize: 12 }}>
              You&rsquo;ve signed this. The other signature has to come from someone else.
            </p>
          )}

          {cleared && (
            <div className="admin-alert admin-alert--ok" style={{ marginTop: 12 }}>
              Signed off by {reviewerSignedBy} and {adminSignedBy}. Sending is Phase 4 and is not
              built yet, so nothing goes out from here.
            </div>
          )}

          {msg && (
            <div
              className={`admin-alert ${msg.tone === "ok" ? "admin-alert--ok" : "admin-alert--err"}`}
              style={{ marginTop: 10 }}
            >
              {msg.text}
            </div>
          )}
        </>
      )}
    </div>
  );
}
