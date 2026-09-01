"use client";

import { useState } from "react";
import { PersonSelect, type PersonSelectOption } from "@/components/admin/PersonSelect";
import type { PersonOption } from "@/lib/admin/people-options";
import { createEngagement } from "../actions";

export function NewEngagementForm({ people }: { people: PersonOption[] }) {
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientContactName, setClientContactName] = useState("");
  const [consultantPersonId, setConsultantPersonId] = useState("");
  const [consultantEmail, setConsultantEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options: PersonSelectOption[] = people.map((p) => ({ value: p.id, label: p.name }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const r = await createEngagement({ clientName, clientEmail, clientContactName, consultantPersonId, consultantEmail });
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
        <label className="admin-label" htmlFor="clientContactName">Client contact name</label>
        <input
          id="clientContactName"
          className="admin-input"
          type="text"
          value={clientContactName}
          onChange={(e) => setClientContactName(e.target.value)}
          placeholder="e.g. Jordan Smith — optional, used in the invite greeting"
        />
      </div>
      <div className="admin-field">
        <label className="admin-label" htmlFor="clientEmail">Client email</label>
        <input
          id="clientEmail"
          className="admin-input"
          type="email"
          value={clientEmail}
          onChange={(e) => setClientEmail(e.target.value)}
          placeholder="e.g. jordan@client.com.au"
          required
        />
        <p className="admin-hint">The discovery link is emailed here as soon as the review is created.</p>
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
      </div>
      <div className="admin-field">
        <label className="admin-label" htmlFor="consultantEmail">Consultant email</label>
        <input
          id="consultantEmail"
          className="admin-input"
          type="email"
          value={consultantEmail}
          onChange={(e) => setConsultantEmail(e.target.value)}
          placeholder="e.g. you@austpayroll.com.au"
        />
        <p className="admin-hint">
          The invite sends from this address and replies land here; submission alerts go here too. Leave blank to send
          from the system default — until austpayroll.com.au is verified for sending, an address on that domain may
          fail to send from here.
        </p>
      </div>
      <div className="admin-form-actions">
        <button type="submit" className="admin-btn admin-btn--primary" disabled={saving}>
          {saving ? "Creating…" : "Create review"}
        </button>
      </div>
    </form>
  );
}
