"use client";

import { useState } from "react";
import { PersonSelect, type PersonSelectOption } from "@/components/admin/PersonSelect";
import type { PersonOption } from "@/lib/admin/people-options";
import { createEngagement } from "../actions";

export function NewEngagementForm({ people }: { people: PersonOption[] }) {
  const [clientName, setClientName] = useState("");
  const [consultantPersonId, setConsultantPersonId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options: PersonSelectOption[] = people.map((p) => ({ value: p.id, label: p.name }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const r = await createEngagement({ clientName, consultantPersonId });
    // createEngagement redirects on success — it only returns here on failure
    // (Next.js's redirect() throws internally and never reaches this line).
    if (r && !r.ok) {
      setSaving(false);
      setError(r.error);
    }
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      {error && <div className="admin-alert admin-alert--err">{error}</div>}
      <div className="admin-field">
        <label className="admin-label" htmlFor="clientName">Client / engagement name</label>
        <input
          id="clientName"
          className="admin-input"
          type="text"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          placeholder="e.g. Acme Pty Ltd"
          required
        />
      </div>
      <div className="admin-field">
        <label className="admin-label" htmlFor="consultant">Consultant</label>
        <PersonSelect
          id="consultant"
          value={consultantPersonId}
          onChange={setConsultantPersonId}
          options={options}
          emptyLabel="Unassigned for now"
          placeholder="Search a consultant…"
        />
        <p className="admin-hint">Gets emailed when the client submits. Can be set later.</p>
      </div>
      <div className="admin-form-actions">
        <button type="submit" className="admin-btn admin-btn--primary" disabled={saving}>
          {saving ? "Creating…" : "Create review"}
        </button>
      </div>
    </form>
  );
}
