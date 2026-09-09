"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { draftEdition, saveDraft } from "../actions";

// The draft, and the button that writes it.
//
// Two views, because a reviewer is doing two different jobs. Markdown is for
// checking the words, the figures and the citations. Preview is for checking
// it will not arrive looking broken — the training table in particular, which
// is pipe characters in Markdown and only becomes a table once rendered.
//
// The preview is an iframe with srcDoc, not a div: the email's HTML carries
// its own <body> styling and would otherwise inherit and leak admin CSS,
// showing the reviewer something the recipient will never see.

type Msg = { tone: "ok" | "err"; text: string } | null;

export function DraftPanel({
  editionId,
  subject,
  preheader,
  bodyMd,
  previewHtml,
  itemCount,
}: {
  editionId: string;
  subject: string | null;
  preheader: string | null;
  bodyMd: string | null;
  previewHtml: string | null;
  itemCount: number;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  const [view, setView] = useState<"markdown" | "preview">("preview");
  const hasDraft = Boolean(bodyMd);

  // Hand editing. The writer cannot supply what its sources do not carry — a
  // course start time the training website never published is the case that
  // prompted this — so the reviewer fixes the line rather than regenerating
  // the whole edition and hoping.
  //
  // Edit state is seeded from the props when editing starts and discarded when
  // it ends, so after a save the server's copy is what shows rather than a
  // stale local one.
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ subject: "", preheader: "", bodyMd: "" });

  function startEditing() {
    setMsg(null);
    setForm({ subject: subject ?? "", preheader: preheader ?? "", bodyMd: bodyMd ?? "" });
    setEditing(true);
  }

  function save() {
    setMsg(null);
    start(async () => {
      const result = await saveDraft(editionId, form);
      if (result.ok) {
        setEditing(false);
        if (result.message) setMsg({ tone: "ok", text: result.message });
        router.refresh();
      } else {
        setMsg({ tone: "err", text: result.error ?? "That didn't work." });
      }
    });
  }

  function run() {
    // Regenerating destroys hand edits and there is no undo. Cheap to ask.
    if (hasDraft && !window.confirm("Regenerate this draft? Any manual edits will be replaced.")) {
      return;
    }
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
          disabled={pending || itemCount === 0 || editing}
          onClick={run}
        >
          {pending && !editing ? "Writing…" : hasDraft ? "Regenerate draft" : "Write the draft"}
        </button>
        {hasDraft && !editing && (
          <button type="button" className="admin-btn" disabled={pending} onClick={startEditing}>
            Edit draft
          </button>
        )}
        {editing && (
          <>
            <button
              type="button"
              className="admin-btn admin-btn--primary"
              disabled={pending}
              onClick={save}
            >
              {pending ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              className="admin-btn"
              disabled={pending}
              onClick={() => {
                setEditing(false);
                setMsg(null);
              }}
            >
              Cancel
            </button>
          </>
        )}
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
            {editing ? (
              <input
                className="admin-input"
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                style={{ width: "100%" }}
              />
            ) : (
              <p style={{ margin: 0 }}>{subject}</p>
            )}
          </div>
          {(editing || preheader) && (
            <div className="admin-field" style={{ marginTop: 10 }}>
              <label className="admin-label">Preheader</label>
              {editing ? (
                <input
                  className="admin-input"
                  value={form.preheader}
                  onChange={(e) => setForm((f) => ({ ...f, preheader: e.target.value }))}
                  style={{ width: "100%" }}
                />
              ) : (
                <p className="admin-page-sub" style={{ margin: 0 }}>
                  {preheader}
                </p>
              )}
            </div>
          )}
          <div className="admin-field" style={{ marginTop: 10 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <label className="admin-label">Body</label>
              {/* The view switch is meaningless while editing: you are editing
                  Markdown, and a preview of unsaved text would be a third
                  version of the truth on screen. */}
              {!editing && (
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    className={`admin-btn${view === "preview" ? " admin-btn--primary" : ""}`}
                    onClick={() => setView("preview")}
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    className={`admin-btn${view === "markdown" ? " admin-btn--primary" : ""}`}
                    onClick={() => setView("markdown")}
                  >
                    Markdown
                  </button>
                </div>
              )}
            </div>

            {editing ? (
              <textarea
                className="admin-textarea"
                value={form.bodyMd}
                onChange={(e) => setForm((f) => ({ ...f, bodyMd: e.target.value }))}
                spellCheck
                style={{
                  width: "100%",
                  minHeight: 520,
                  marginTop: 8,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                  fontSize: 13,
                  lineHeight: 1.6,
                  resize: "vertical",
                }}
              />
            ) : view === "preview" && previewHtml ? (
              <iframe
                title="Inbox preview"
                srcDoc={previewHtml}
                sandbox=""
                style={{
                  width: "100%",
                  height: 620,
                  border: "1px solid var(--admin-line, rgba(128,128,128,0.25))",
                  borderRadius: "var(--admin-radius-sm, 6px)",
                  background: "#ffffff",
                  marginTop: 8,
                }}
              />
            ) : (
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
            )}
          </div>
        </div>
      )}
    </div>
  );
}
