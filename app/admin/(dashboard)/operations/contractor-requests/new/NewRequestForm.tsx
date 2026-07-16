"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createWorkRequest } from "../actions";

export function NewRequestForm({
  contractors,
}: {
  contractors: { personId: string; label: string; hasRate: boolean }[];
}) {
  const router = useRouter();
  const [personId, setPersonId] = useState(contractors[0]?.personId ?? "");
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = contractors.find((c) => c.personId === personId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const r = await createWorkRequest({ personId, title, brief, send: true });
    setSaving(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    router.push("/admin/operations/contractor-requests");
    router.refresh();
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <label className="admin-field">
        <span>Contractor</span>
        <select value={personId} onChange={(e) => setPersonId(e.target.value)} required>
          {contractors.map((c) => (
            <option key={c.personId} value={c.personId}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      {selected && !selected.hasRate && (
        <div className="admin-alert admin-alert--err">
          This contractor has no pay rate set — add one on the Contractors page before month-end, or the
          payment roll-up will skip them.
        </div>
      )}
      <label className="admin-field">
        <span>Title</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Landing page hero redesign"
          required
        />
      </label>
      <label className="admin-field">
        <span>Brief — what needs doing, by when, and what "done" looks like</span>
        <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={8} required />
      </label>
      {error && <div className="admin-alert admin-alert--err">{error}</div>}
      <div className="admin-form-actions">
        <button type="submit" className="admin-btn admin-btn--primary" disabled={saving || contractors.length === 0}>
          {saving ? "Sending…" : "Create & send"}
        </button>
      </div>
    </form>
  );
}
