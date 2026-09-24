"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { writeArticleNow } from "../actions";

// Writes, or rewrites, one article from its source link.
//
// Accepting a topic from the radar already writes it. This is for the two
// cases that leaves: an item accepted before writing existed, and an editor
// who has sharpened the brief and wants another go.
//
// Confirms before a rewrite, because the body it replaces may be something a
// person wrote by hand and there is no undo.

export function WriteArticleButton({
  submissionId,
  editionId,
  hasBeenWritten,
}: {
  submissionId: string;
  editionId: string;
  /** Whether the body already looks like an article rather than a brief. */
  hasBeenWritten: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  function run() {
    // Cancelling has to say so. A dialog dismissed in silence looks exactly
    // like a button that does nothing, which is how the same pattern on the
    // Regenerate button was reported.
    if (hasBeenWritten) {
      const ok = window.confirm(
        "Rewrite this article?\n\n" +
          "It will be written again from its source link, replacing the current text.",
      );
      if (!ok) {
        setMsg({ tone: "ok", text: "Rewrite cancelled — the article is unchanged." });
        return;
      }
    }
    setMsg(null);
    start(async () => {
      const result = await writeArticleNow(submissionId, editionId);
      if (result.ok) {
        if (result.message) setMsg({ tone: "ok", text: result.message });
        router.refresh();
      } else {
        setMsg({ tone: "err", text: result.error ?? "That didn't work." });
      }
    });
  }

  return (
    <>
      <button type="button" className="admin-btn" disabled={pending} onClick={run}>
        {pending ? "Writing…" : hasBeenWritten ? "Rewrite with Claude" : "Write with Claude"}
      </button>
      {msg && (
        <div
          className={`admin-alert ${msg.tone === "ok" ? "admin-alert--ok" : "admin-alert--err"}`}
          style={{ marginTop: 8, width: "100%" }}
        >
          {msg.text}
        </div>
      )}
    </>
  );
}
