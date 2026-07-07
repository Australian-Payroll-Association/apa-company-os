"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, statusTone } from "@/components/admin/Badge";
import { formatDate, humanize } from "@/lib/admin/format";
import {
  addApplicationNote,
  getApplicationNotes,
  getApplicationStages,
  updateApplication,
  type AppNote,
  type StageOption,
} from "./actions";

export type AppManageData = {
  id: string;
  jobReqId: string | null;
  personId: string | null;
  jobReqTitle: string | null;
  candidateName: string | null;
  status: string | null;
  rating: number | null;
  rejectionReason: string | null;
  currentStageId: string | null;
  currentStageName: string | null;
  appliedAt: string | null;
  decidedAt: string | null;
};

const STATUS_OPTIONS = [
  ["active", "Active"],
  ["on_hold", "On hold"],
  ["hired", "Hired"],
  ["rejected", "Rejected"],
] as const;

// Editable "manage" surface for one application, rendered inside the row's side
// shelf (DetailDrawer). Field changes (stage, status, rating, rejection reason)
// commit together on Save; notes post individually to the thread below.
export function ApplicationManage({ app }: { app: AppManageData }) {
  const router = useRouter();

  const [stageId, setStageId] = useState(app.currentStageId ?? "");
  const [status, setStatus] = useState(app.status ?? "active");
  const [rating, setRating] = useState<number | null>(app.rating ?? null);
  const [rejectionReason, setRejectionReason] = useState(app.rejectionReason ?? "");

  const [stages, setStages] = useState<StageOption[]>([]);
  const [stagesLoading, setStagesLoading] = useState(true);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Load this req's hiring stages when the shelf opens.
  useEffect(() => {
    if (!app.jobReqId) {
      setStagesLoading(false);
      return;
    }
    let live = true;
    setStagesLoading(true);
    getApplicationStages(app.jobReqId).then((r) => {
      if (!live) return;
      if (r.ok) setStages(r.stages);
      setStagesLoading(false);
    });
    return () => {
      live = false;
    };
  }, [app.jobReqId]);

  const showRejectionReason = status === "rejected" || rejectionReason.trim() !== "";

  async function save() {
    setSaving(true);
    setMsg(null);

    const patch: Parameters<typeof updateApplication>[1] = {};
    if (status !== (app.status ?? "active")) patch.status = status;
    if (rating !== (app.rating ?? null)) patch.rating = rating;
    if (rejectionReason.trim() !== (app.rejectionReason ?? "")) {
      patch.rejection_reason = rejectionReason.trim() || null;
    }
    const nextStage = stageId || null;
    if (nextStage !== (app.currentStageId ?? null)) patch.current_stage_id = nextStage;

    if (Object.keys(patch).length === 0) {
      setSaving(false);
      setMsg({ ok: true, text: "Nothing changed." });
      return;
    }

    const r = await updateApplication(app.id, patch);
    setSaving(false);
    if (!r.ok) {
      setMsg({ ok: false, text: r.error });
      return;
    }
    setMsg({ ok: true, text: "Saved." });
    router.refresh();
  }

  return (
    <>
      <dl className="admin-kv" style={{ marginBottom: 16 }}>
        <dt>Candidate</dt>
        <dd>{app.candidateName || "—"}</dd>
        <dt>Job req</dt>
        <dd>{app.jobReqTitle || "—"}</dd>
        <dt>Status</dt>
        <dd>{app.status ? <Badge tone={statusTone(app.status)}>{humanize(app.status)}</Badge> : "—"}</dd>
        <dt>Applied</dt>
        <dd>{app.appliedAt ? formatDate(app.appliedAt) : "—"}</dd>
        {app.decidedAt && (
          <>
            <dt>Decided</dt>
            <dd>{formatDate(app.decidedAt)}</dd>
          </>
        )}
      </dl>

      <form
        className="admin-form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {msg && <div className={`admin-alert ${msg.ok ? "admin-alert--ok" : "admin-alert--err"}`}>{msg.text}</div>}

        <div className="admin-field">
          <label className="admin-label">Stage</label>
          {app.jobReqId ? (
            <select
              className="admin-select"
              aria-label="Hiring stage"
              value={stageId}
              disabled={stagesLoading}
              onChange={(e) => setStageId(e.target.value)}
            >
              {stagesLoading && <option value={stageId}>{app.currentStageName || "Loading…"}</option>}
              {!stagesLoading && <option value="">No stage</option>}
              {!stagesLoading &&
                stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.isTerminal ? " (final)" : ""}
                  </option>
                ))}
            </select>
          ) : (
            <div className="admin-hint">No job req linked, so there is no stage to set.</div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="admin-field">
            <label className="admin-label">Status</label>
            <select className="admin-select" value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-field">
            <label className="admin-label">Rating</label>
            <StarRating value={rating} onChange={setRating} />
          </div>
        </div>

        {showRejectionReason && (
          <div className="admin-field">
            <label className="admin-label">Rejection reason</label>
            <input
              className="admin-input"
              placeholder="Why was this candidate rejected?"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            />
          </div>
        )}

        <div className="admin-form-actions">
          <button type="submit" className="admin-btn admin-btn--primary" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>

      <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {app.personId && (
          <Link href={`/admin/contacts/${app.personId}`} className="admin-btn">
            Open contact
          </Link>
        )}
        {app.jobReqId && (
          <Link href={`/admin/talent/jobs/${app.jobReqId}`} className="admin-btn">
            Open job req
          </Link>
        )}
      </div>

      <ApplicationNotes applicationId={app.id} />
    </>
  );
}

// 1–5 stars. Clicking the current rating again clears it back to none.
function StarRating({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, height: 34 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          aria-pressed={value != null && n <= value}
          onClick={() => onChange(value === n ? null : n)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            fontSize: 20,
            lineHeight: 1,
            color: value != null && n <= value ? "var(--admin-accent)" : "var(--admin-line-strong)",
          }}
        >
          {value != null && n <= value ? "★" : "☆"}
        </button>
      ))}
      {value != null && (
        <button
          type="button"
          className="admin-btn admin-btn--sm"
          style={{ marginLeft: 4 }}
          onClick={() => onChange(null)}
        >
          Clear
        </button>
      )}
    </div>
  );
}

// The application's note thread. Free-text entries append to the shared activity
// log (interactions), newest first. Mirrors the deal communications component.
function ApplicationNotes({ applicationId }: { applicationId: string }) {
  const [items, setItems] = useState<AppNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setLoadErr(null);
    getApplicationNotes(applicationId).then((r) => {
      if (!live) return;
      if (r.ok) setItems(r.items);
      else setLoadErr(r.error);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [applicationId]);

  async function add() {
    const text = body.trim();
    if (!text) return;
    setSaving(true);
    setSaveErr(null);
    const r = await addApplicationNote(applicationId, text);
    setSaving(false);
    if (!r.ok) return setSaveErr(r.error);
    setItems((cur) => [r.item, ...cur]);
    setBody("");
  }

  return (
    <div style={{ marginTop: 18 }}>
      <div className="admin-label" style={{ marginBottom: 6 }}>
        Notes
      </div>

      <div className="admin-field">
        <textarea
          className="admin-input"
          rows={3}
          placeholder="Add a note about this application…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>
      <div className="admin-form-actions" style={{ marginBottom: 12 }}>
        <button
          type="button"
          className="admin-btn admin-btn--primary admin-btn--sm"
          onClick={add}
          disabled={saving || !body.trim()}
        >
          {saving ? "Adding…" : "Add note"}
        </button>
      </div>
      {saveErr && (
        <div className="admin-alert admin-alert--err" style={{ marginBottom: 12 }}>
          {saveErr}
        </div>
      )}

      {loading ? (
        <div className="admin-hint">Loading…</div>
      ) : loadErr ? (
        <div className="admin-alert admin-alert--err">{loadErr}</div>
      ) : items.length === 0 ? (
        <div className="admin-empty">No notes yet.</div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((n) => (
            <li key={n.id} style={{ borderLeft: "2px solid var(--admin-line-strong)", paddingLeft: 10 }}>
              <div className="admin-cell-muted" style={{ marginBottom: 2 }}>
                {humanize(n.kind)} · {formatDate(n.occurredAt)}
              </div>
              <div style={{ whiteSpace: "pre-wrap" }}>{n.body || "—"}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
