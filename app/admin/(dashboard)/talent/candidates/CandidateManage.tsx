"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, statusTone } from "@/components/admin/Badge";
import { formatDate, humanize } from "@/lib/admin/format";
import { updateCandidate } from "./actions";

export type CandidateManageData = {
  id: string;
  headline: string | null;
  currentTitle: string | null;
  companyName: string | null;
  poolStatus: string | null;
  notes: string | null;
  availability: string | null;
  linkedinUrl: string | null;
  resumeDocumentId: string | null;
  createdAt: string;
};

const POOL_OPTIONS = [
  ["active", "Active"],
  ["passive", "Passive"],
  ["placed", "Placed"],
  ["do_not_pursue", "Do not pursue"],
] as const;

// Editable "manage" surface for one candidate, rendered inside the row's side
// shelf (DetailDrawer). Pool status, notes and availability commit together on
// Save.
export function CandidateManage({ candidate }: { candidate: CandidateManageData }) {
  const router = useRouter();

  const [poolStatus, setPoolStatus] = useState(candidate.poolStatus ?? "active");
  const [notes, setNotes] = useState(candidate.notes ?? "");
  const [availability, setAvailability] = useState(candidate.availability ?? "");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setSaving(true);
    setMsg(null);

    const patch: Parameters<typeof updateCandidate>[1] = {};
    if (poolStatus !== (candidate.poolStatus ?? "active")) patch.pool_status = poolStatus;
    if (notes.trim() !== (candidate.notes ?? "")) patch.notes = notes.trim() || null;
    if (availability.trim() !== (candidate.availability ?? "")) patch.availability = availability.trim() || null;

    if (Object.keys(patch).length === 0) {
      setSaving(false);
      setMsg({ ok: true, text: "Nothing changed." });
      return;
    }

    const r = await updateCandidate(candidate.id, patch);
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
        <dt>Headline</dt>
        <dd>{candidate.headline || "—"}</dd>
        <dt>Current</dt>
        <dd>
          {candidate.currentTitle
            ? candidate.companyName
              ? `${candidate.currentTitle} @ ${candidate.companyName}`
              : candidate.currentTitle
            : "—"}
        </dd>
        <dt>Pool</dt>
        <dd>{candidate.poolStatus ? <Badge tone={statusTone(candidate.poolStatus)}>{humanize(candidate.poolStatus)}</Badge> : "—"}</dd>
        <dt>LinkedIn</dt>
        <dd>
          {candidate.linkedinUrl ? (
            <a href={candidate.linkedinUrl} target="_blank" rel="noreferrer">
              Profile ↗
            </a>
          ) : (
            "—"
          )}
        </dd>
        <dt>Resume</dt>
        <dd>
          {candidate.resumeDocumentId ? (
            <a href={`/admin/talent/resume/${candidate.resumeDocumentId}`} target="_blank" rel="noreferrer">
              Open ↗
            </a>
          ) : (
            "—"
          )}
        </dd>
        <dt>Added</dt>
        <dd>{formatDate(candidate.createdAt)}</dd>
      </dl>

      <form
        className="admin-form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {msg && <div className={`admin-alert ${msg.ok ? "admin-alert--ok" : "admin-alert--err"}`}>{msg.text}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="admin-field">
            <label className="admin-label">Pool status</label>
            <select className="admin-select" value={poolStatus} onChange={(e) => setPoolStatus(e.target.value)}>
              {POOL_OPTIONS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-field">
            <label className="admin-label">Availability</label>
            <input
              className="admin-input"
              placeholder="e.g. 2 weeks' notice"
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
            />
          </div>
        </div>

        <div className="admin-field">
          <label className="admin-label">Notes</label>
          <textarea
            className="admin-input"
            rows={4}
            placeholder="Recruiter notes on this candidate…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="admin-form-actions">
          <button type="submit" className="admin-btn admin-btn--primary" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>

      <div style={{ marginTop: 16 }}>
        <Link href={`/admin/talent/candidates/${candidate.id}`} className="admin-btn">
          Open full profile
        </Link>
      </div>
    </>
  );
}
