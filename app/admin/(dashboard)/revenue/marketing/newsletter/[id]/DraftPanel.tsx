"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { draftEdition } from "../actions";

// The draft, and the button that writes it.
//
// Deliberately shows the Markdown rather than rendering it: this is the
// reviewer's copy, and what they are checking is the words, the figures and
// the citations. A rendered preview belongs with the broadcast, where what
// matters is how it will look in an inbox.

type Msg = { tone: "ok" | "err"; text: string } | null;

export function DraftPanel({
  editionId,
  subject,
  preheader,
  bodyMd,
  itemCount,
}: {
  editionId: string;
  subject: string | null;
  preheader: string | null;
  bodyMd: string | null;
  itemCount: number;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  const hasDraft = Boolean(bodyMd);

  function run() {
    setMsg(null);
    start(async () => {
      const result = await draftEdition(editionId);
      if (result.ok) {
        if (result.message) setMsg({ tone: "ok", text: result.message });
        router.refresh();
      } else {
        setMsg({ tone: "err", text: result.error ?? "That didn't work." });
      }
    });
  }

  return (
    <div className="admin-card" style={{ padding: "20px 22px", marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <h2 className="admin-card-title" style={{ margin: 0 }}>
          Draft
        </h2>
        {hasDraft && <span className="admin-cell-muted">written from {itemCount} included items</span>}
      </div>

      {!hasDraft && (
        <p className="admin-page-sub" style={{ marginTop: 6 }}>
          Nothing drafted yet. Everything marked as included gets assembled into one edition in APA&rsquo;s
          voice, following the running order above.
        </p>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <button
          type="button"
          className={`admin-btn${hasDraft ? "" : " admin-btn--primary"}`}
          disabled={pending || itemCount === 0}
          onClick={run}
        >
          {pending ? "Writing…" : hasDraft ? "Regenerate draft" : "Write the draft"}
        </button>
      </div>

      {itemCount === 0 && (
        <p className="admin-page-sub" style={{ marginTop: 8, marginBottom: 0, fontSize: 12 }}>
          Include at least one item first.
        </p>
      )}

      {msg && (
        <div
          className={`admin-alert ${msg.tone === "ok" ? "admin-alert--ok" : "admin-alert--err"}`}
          style={{ marginTop: 10 }}
        >
          {msg.text}
        </div>
      )}

      {hasDraft && (
        <div style={{ marginTop: 16 }}>
          <div className="admin-field">
            <label className="admin-label">Subject</label>
            <p style={{ margin: 0 }}>{subject}</p>
          </div>
          {preheader && (
            <div className="admin-field" style={{ marginTop: 10 }}>
              <label className="admin-label">Preheader</label>
              <p className="admin-page-sub" style={{ margin: 0 }}>
                {preheader}
              </p>
            </div>
          )}
          <div className="admin-field" style={{ marginTop: 10 }}>
            <label className="admin-label">Body</label>
            <pre
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontFamily: "inherit",
                fontSize: 13,
                lineHeight: 1.6,
                background: "var(--admin-sunk, rgba(128,128,128,0.06))",
                padding: "14px 16px",
                borderRadius: "var(--admin-radius-sm, 6px)",
                maxHeight: 520,
                overflowY: "auto",
              }}
            >
              {bodyMd}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
