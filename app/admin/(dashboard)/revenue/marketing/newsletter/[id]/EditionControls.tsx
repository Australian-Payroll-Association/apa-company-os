"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { closeEdition, pullEvents, reopenEdition, setSubmissionIncluded } from "../actions";

type Msg = { tone: "ok" | "err"; text: string } | null;

// Intake controls for one edition. Every action reports what actually happened
// — "3 added, 2 already here" rather than a silent refresh — because the pull
// is the step most likely to do nothing and leave you wondering.

export function EditionControls({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    setMsg(null);
    start(async () => {
      const result = await fn();
      if (result.ok) {
        if (result.message) setMsg({ tone: "ok", text: result.message });
        router.refresh();
      } else {
        setMsg({ tone: "err", text: result.error ?? "That didn't work." });
      }
    });
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          className="admin-btn"
          disabled={pending}
          onClick={() => run(() => pullEvents(id))}
        >
          Pull training &amp; webinars
        </button>
        {status === "open" && (
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            disabled={pending}
            onClick={() => run(() => closeEdition(id))}
          >
            Close intake
          </button>
        )}
        {status === "closed" && (
          <button
            type="button"
            className="admin-btn"
            disabled={pending}
            onClick={() => run(() => reopenEdition(id))}
          >
            Reopen intake
          </button>
        )}
      </div>
      {msg && (
        <div
          className={`admin-alert ${msg.tone === "ok" ? "admin-alert--ok" : "admin-alert--err"}`}
          style={{ marginTop: 10 }}
        >
          {msg.text}
        </div>
      )}
    </div>
  );
}

// Include/exclude is a toggle rather than a delete: an excluded item stays on
// the record and can be brought back, and a re-run of the events pull will not
// resurrect something the admin deliberately dropped.
export function IncludeToggle({ id, included }: { id: string; included: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      className={`admin-btn admin-btn--sm${included ? "" : " admin-btn--primary"}`}
      disabled={pending}
      onClick={() =>
        start(async () => {
          await setSubmissionIncluded(id, !included);
          router.refresh();
        })
      }
    >
      {pending ? "…" : included ? "Exclude" : "Include"}
    </button>
  );
}
