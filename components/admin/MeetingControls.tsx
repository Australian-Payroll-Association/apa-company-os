"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  setMeetingPublished,
  deleteMeeting,
  retryMeetingSummary,
  updateMeeting,
} from "@/app/admin/(dashboard)/revenue/meetings/actions";

// Per-meeting admin controls: publish toggle (the portal gate), AI retry,
// archive, and an inline edit form for title / date / attendees / summary. The
// summary/transcript display is server-rendered by MeetingsList; this only owns
// the mutations, then router.refresh() re-renders the card.
export function MeetingControls({
  id,
  published,
  aiStatus,
  initial,
}: {
  id: string;
  published: boolean;
  aiStatus: "pending" | "ready" | "failed";
  initial: { title: string; meetingDate: string; attendees: string; summary: string };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fields, setFields] = useState(initial);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setErr(null);
    start(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
      else setErr(res.error ?? "Something went wrong.");
    });
  }

  return (
    <div style={{ marginTop: 12 }}>
      {err && <div className="admin-alert admin-alert--err" style={{ marginBottom: 8 }}>{err}</div>}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button
          type="button"
          className={`admin-btn ${published ? "" : "admin-btn--primary"}`}
          disabled={pending}
          onClick={() => run(() => setMeetingPublished(id, !published))}
        >
          {published ? "Unpublish" : "Publish to client"}
        </button>
        <button type="button" className="admin-btn" disabled={pending} onClick={() => setEditing((v) => !v)}>
          {editing ? "Cancel" : "Edit"}
        </button>
        {aiStatus === "failed" && (
          <button type="button" className="admin-btn" disabled={pending} onClick={() => run(() => retryMeetingSummary(id))}>
            Retry summary
          </button>
        )}
        <button
          type="button"
          className="admin-btn admin-btn--danger"
          disabled={pending}
          onClick={() => {
            if (confirm("Delete this meeting permanently? This removes the transcript and cannot be undone.")) {
              run(() => deleteMeeting(id));
            }
          }}
        >
          Delete
        </button>
      </div>

      {editing && (
        <div className="admin-form" style={{ marginTop: 12 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div className="admin-field" style={{ flex: "2 1 220px" }}>
              <label className="admin-label">Title</label>
              <input
                className="admin-input"
                value={fields.title}
                onChange={(e) => setFields({ ...fields, title: e.target.value })}
              />
            </div>
            <div className="admin-field" style={{ flex: "1 1 160px" }}>
              <label className="admin-label">Meeting date</label>
              <input
                type="date"
                className="admin-input"
                value={fields.meetingDate}
                onChange={(e) => setFields({ ...fields, meetingDate: e.target.value })}
              />
            </div>
          </div>
          <div className="admin-field">
            <label className="admin-label">Attendees</label>
            <input
              className="admin-input"
              value={fields.attendees}
              onChange={(e) => setFields({ ...fields, attendees: e.target.value })}
              placeholder="Comma-separated"
            />
          </div>
          <div className="admin-field">
            <label className="admin-label">Summary (Markdown)</label>
            <textarea
              className="admin-input"
              rows={8}
              value={fields.summary}
              onChange={(e) => setFields({ ...fields, summary: e.target.value })}
              style={{ resize: "vertical", fontFamily: "inherit" }}
            />
          </div>
          <div className="admin-form-actions">
            <button
              type="button"
              className="admin-btn admin-btn--primary"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const res = await updateMeeting(id, fields);
                  if (res.ok) setEditing(false);
                  return res;
                })
              }
            >
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
