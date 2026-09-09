"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SuggestionRow } from "@/lib/admin/newsletter-radar";
import { addSuggestedTopic, dismissSuggestedTopic, scanTopics } from "../actions";

// What the regulators changed this month, and what to do about each one.
//
// Deliberately not the Article section. A scan returns twenty-odd candidates
// and most get rejected; mixing those into the section the team writes in would
// bury the two or three real items under machine output. A suggestion becomes a
// submission at the moment someone presses Add, and not before.

type Msg = { tone: "ok" | "err"; text: string } | null;

export function TopicRadar({
  editionId,
  suggestions,
}: {
  editionId: string;
  suggestions: SuggestionRow[];
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<Msg>(null);
  const [showDismissed, setShowDismissed] = useState(false);
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const open = suggestions.filter((s) => s.status === "new");
  const dismissed = suggestions.filter((s) => s.status === "dismissed");
  const added = suggestions.filter((s) => s.status === "added");
  const shown = showDismissed ? [...open, ...dismissed] : open;

  // Grouped so a scan reads as coverage of the areas, not one long list —
  // an empty area is information too.
  const groups = new Map<string, SuggestionRow[]>();
  for (const s of shown) {
    const key = s.category ?? "Other";
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }

  function run() {
    setMsg(null);
    start(async () => {
      const result = await scanTopics(editionId);
      if (result.ok) {
        if (result.message) setMsg({ tone: "ok", text: result.message });
        router.refresh();
      } else {
        setMsg({ tone: "err", text: result.error ?? "That didn't work." });
      }
    });
  }

  function decide(id: string, action: "add" | "dismiss") {
    setMsg(null);
    setBusyId(id);
    start(async () => {
      const result =
        action === "add"
          ? await addSuggestedTopic(id, editionId)
          : await dismissSuggestedTopic(id, editionId);
      setBusyId(null);
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
          Topic radar
        </h2>
        {open.length > 0 && (
          <span className="admin-cell-muted">
            {open.length} to review
            {added.length > 0 && ` · ${added.length} added`}
          </span>
        )}
      </div>

      <p className="admin-page-sub" style={{ marginTop: 6 }}>
        Scans the ATO, Fair Work, all eight state and territory revenue offices, and the workers
        compensation authorities for changes in this edition&rsquo;s period. Nothing is written from a
        suggestion until you add it &mdash; and then the draft is written from the linked page, not
        from the summary here.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
        <button
          type="button"
          className={`admin-btn${suggestions.length === 0 ? " admin-btn--primary" : ""}`}
          disabled={pending}
          onClick={run}
        >
          {pending && !busyId ? "Scanning…" : suggestions.length === 0 ? "Scan for topics" : "Scan again"}
        </button>
        {dismissed.length > 0 && (
          <button type="button" className="admin-btn" onClick={() => setShowDismissed((v) => !v)}>
            {showDismissed ? "Hide" : "Show"} {dismissed.length} dismissed
          </button>
        )}
        {pending && !busyId && (
          <span className="admin-cell-muted" style={{ fontSize: 12 }}>
            Seven areas, each opening the pages it finds — this takes a minute or two.
          </span>
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

      {suggestions.length === 0 && !pending && (
        <p className="admin-page-sub" style={{ marginTop: 10, marginBottom: 0, fontSize: 12 }}>
          Nothing scanned yet for this edition.
        </p>
      )}

      {[...groups.entries()].map(([category, items]) => (
        <div key={category} style={{ marginTop: 18 }}>
          <h3
            className="admin-label"
            style={{ margin: "0 0 8px", textTransform: "none", letterSpacing: 0 }}
          >
            {category}
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {items.map((s) => (
              <div
                key={s.id}
                style={{
                  borderTop: "1px solid var(--admin-line, rgba(128,128,128,0.25))",
                  paddingTop: 10,
                  opacity: s.status === "dismissed" ? 0.5 : 1,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ minWidth: 0, flex: "1 1 340px" }}>
                    <strong style={{ display: "block", marginBottom: 2 }}>{s.title}</strong>
                    <p className="admin-page-sub" style={{ margin: "0 0 4px", fontSize: 12 }}>
                      {[s.sourceName, s.dateLabel].filter(Boolean).join("  ·  ")}
                      {s.confidence === "unclear" && (
                        // Surfaced rather than hidden: the scan saying it is
                        // unsure whether this falls in the month is exactly the
                        // thing a human should check.
                        <span style={{ marginLeft: 8, fontWeight: 600 }}>
                          · may be outside this period
                        </span>
                      )}
                    </p>
                    {s.summary && (
                      <p className="admin-page-sub" style={{ margin: "0 0 6px" }}>
                        {s.summary}
                      </p>
                    )}
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 12, wordBreak: "break-all" }}
                    >
                      {s.url}
                    </a>
                  </div>
                  {s.status === "new" && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        className="admin-btn admin-btn--primary"
                        disabled={pending}
                        onClick={() => decide(s.id, "add")}
                      >
                        {busyId === s.id ? "…" : "Add"}
                      </button>
                      <button
                        type="button"
                        className="admin-btn"
                        disabled={pending}
                        onClick={() => decide(s.id, "dismiss")}
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
