"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { pullTraining, setTrainingWindow } from "../actions";

// The window the training pull reads, and the button that runs it.
//
// It is its own control rather than part of the edition's dates because the
// training table advertises past the edition month — July's ran to 14 August,
// September's to 15 October. Left blank, the pull uses the edition period plus
// six weeks, so this only needs touching when a month is unusual.

type Msg = { tone: "ok" | "err"; text: string } | null;

export function TrainingWindow({
  id,
  from,
  to,
  fallbackFrom,
  fallbackTo,
}: {
  id: string;
  from: string | null;
  to: string | null;
  fallbackFrom: string;
  fallbackTo: string;
}) {
  const router = useRouter();
  const [fromValue, setFromValue] = useState(from ?? "");
  const [toValue, setToValue] = useState(to ?? "");
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

  const usingFallback = !from && !to;

  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="admin-field" style={{ margin: 0 }}>
          <label className="admin-label" htmlFor="tw-from">
            Training from
          </label>
          <input
            id="tw-from"
            type="date"
            className="admin-input"
            value={fromValue}
            onChange={(e) => setFromValue(e.target.value)}
          />
        </div>
        <div className="admin-field" style={{ margin: 0 }}>
          <label className="admin-label" htmlFor="tw-to">
            Training to
          </label>
          <input
            id="tw-to"
            type="date"
            className="admin-input"
            value={toValue}
            onChange={(e) => setToValue(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="admin-btn"
          disabled={pending}
          onClick={() => run(() => setTrainingWindow(id, { from: fromValue, to: toValue }))}
        >
          Save window &amp; pull
        </button>
        <button
          type="button"
          className="admin-btn admin-btn--primary"
          disabled={pending}
          onClick={() => run(() => pullTraining(id))}
        >
          {pending ? "Pulling…" : "Pull training from the website"}
        </button>
      </div>

      <p className="admin-page-sub" style={{ marginTop: 8, marginBottom: 0, fontSize: 12 }}>
        {usingFallback
          ? `Using the default window, ${fallbackFrom} to ${fallbackTo} (the edition period plus six weeks). Set dates above to override it, and saving pulls the courses in.`
          : "Reads Virtual Classroom courses from austpayroll.com.au/training. Saving the window pulls them in."}
      </p>

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
