"use client";

import { useState, useTransition } from "react";
import { updatePerson } from "../actions";
import type { Person } from "@/lib/admin/contacts";

// Known persona values (company_os has no enum on people.persona). "" = Unset.
const PERSONA_OPTIONS = [
  { value: "", label: "Unset" },
  { value: "job_seeker", label: "Job seeker" },
  { value: "prospect", label: "Prospect" },
  { value: "client", label: "Client" },
  { value: "employee", label: "Employee" },
];

export function PersonEditForm({ person, onSaved }: { person: Person; onSaved?: () => void }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [form, setForm] = useState({
    full_name: person.full_name ?? "",
    phone: person.phone ?? "",
    persona: person.persona ?? "",
    country: person.country ?? "",
    linkedin_url: person.linkedin_url ?? "",
    notes: person.notes ?? "",
    do_not_contact: !!person.do_not_contact,
  });

  function field<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      const r = await updatePerson(person.id, form);
      setMsg(r.ok ? { ok: true, text: "Saved." } : { ok: false, text: r.error });
      if (r.ok) onSaved?.();
    });
  }

  return (
    <form className="admin-form" onSubmit={save}>
      {msg && (
        <div className={`admin-alert ${msg.ok ? "admin-alert--ok" : "admin-alert--err"}`}>{msg.text}</div>
      )}
      <div className="admin-field">
        <label className="admin-label">Full name</label>
        <input className="admin-input" value={form.full_name} onChange={(e) => field("full_name", e.target.value)} />
      </div>
      <div className="admin-field">
        <label className="admin-label">Phone</label>
        <input className="admin-input" value={form.phone} onChange={(e) => field("phone", e.target.value)} />
      </div>
      <div className="admin-field">
        <label className="admin-label">Persona</label>
        <select className="admin-input" value={form.persona} onChange={(e) => field("persona", e.target.value)}>
          {PERSONA_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
          {form.persona && !PERSONA_OPTIONS.some((o) => o.value === form.persona) && (
            <option value={form.persona}>{form.persona}</option>
          )}
        </select>
      </div>
      <div className="admin-field">
        <label className="admin-label">Country</label>
        <input className="admin-input" value={form.country} onChange={(e) => field("country", e.target.value)} />
      </div>
      <div className="admin-field">
        <label className="admin-label">LinkedIn</label>
        <input className="admin-input" value={form.linkedin_url} onChange={(e) => field("linkedin_url", e.target.value)} />
      </div>
      <div className="admin-field">
        <label className="admin-label">Notes</label>
        <textarea className="admin-textarea" value={form.notes} onChange={(e) => field("notes", e.target.value)} />
      </div>
      <label className="admin-field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <input
          type="checkbox"
          checked={form.do_not_contact}
          onChange={(e) => field("do_not_contact", e.target.checked)}
        />
        <span className="admin-label" style={{ margin: 0 }}>
          Do not contact
        </span>
      </label>
      <div className="admin-form-actions">
        <button type="submit" className="admin-btn admin-btn--primary" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
