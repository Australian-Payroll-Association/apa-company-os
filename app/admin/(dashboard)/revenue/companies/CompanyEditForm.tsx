"use client";

import { useState } from "react";
import { INDUSTRY_CATEGORIES, SIZE_BANDS, PRIORITY_LEVELS } from "@/lib/admin/company-enums";
import { COUNTRIES } from "@/lib/admin/countries";
import { humanize } from "@/lib/admin/format";
import { updateCompany, type CompanyPatch } from "./actions";

export type EditableCompany = {
  id: string;
  name: string | null;
  domain: string | null;
  industry: string | null;
  industry_normalized?: string | null;
  size_band: string | null;
  country: string | null;
  website: string | null;
  priority: string | null;
  notes?: string | null;
};

// Shared basics form. `showNotes` gates the notes field so the compact list
// drawer (which never loads notes) can't accidentally blank it on save.
export function CompanyEditForm({
  company,
  showNotes = false,
  onSaved,
}: {
  company: EditableCompany;
  showNotes?: boolean;
  onSaved?: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [form, setForm] = useState({
    name: company.name ?? "",
    domain: company.domain ?? "",
    industry: company.industry ?? "",
    industry_normalized: company.industry_normalized ?? "",
    size_band: company.size_band ?? "",
    country: company.country ?? "",
    website: company.website ?? "",
    priority: company.priority ?? "",
    notes: company.notes ?? "",
  });

  function field<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const patch: CompanyPatch = {
      name: form.name,
      domain: form.domain,
      industry: form.industry,
      industry_normalized: form.industry_normalized,
      size_band: form.size_band,
      country: form.country,
      website: form.website,
      priority: form.priority,
    };
    if (showNotes) patch.notes = form.notes;
    const r = await updateCompany(company.id, patch);
    setSaving(false);
    setMsg(r.ok ? { ok: true, text: "Saved." } : { ok: false, text: r.error });
    if (r.ok) onSaved?.();
  }

  return (
    <form className="admin-form" onSubmit={save}>
      {msg && (
        <div className={`admin-alert ${msg.ok ? "admin-alert--ok" : "admin-alert--err"}`}>{msg.text}</div>
      )}
      <div className="admin-field">
        <label className="admin-label">Name</label>
        <input className="admin-input" value={form.name} onChange={(e) => field("name", e.target.value)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div className="admin-field">
          <label className="admin-label">Domain</label>
          <input className="admin-input" value={form.domain} onChange={(e) => field("domain", e.target.value)} placeholder="acme.com" />
        </div>
        <div className="admin-field">
          <label className="admin-label">Website</label>
          <input className="admin-input" value={form.website} onChange={(e) => field("website", e.target.value)} placeholder="https://…" />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div className="admin-field">
          <label className="admin-label">Industry</label>
          <input className="admin-input" value={form.industry} onChange={(e) => field("industry", e.target.value)} />
        </div>
        <div className="admin-field">
          <label className="admin-label">Category</label>
          <select className="admin-input" value={form.industry_normalized} onChange={(e) => field("industry_normalized", e.target.value)}>
            <option value="">—</option>
            {INDUSTRY_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div className="admin-field">
          <label className="admin-label">Size (employees)</label>
          <select className="admin-input" value={form.size_band} onChange={(e) => field("size_band", e.target.value)}>
            <option value="">—</option>
            {SIZE_BANDS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
        <div className="admin-field" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div className="admin-field">
          <label className="admin-label">Country</label>
          <select className="admin-input" value={form.country} onChange={(e) => field("country", e.target.value)}>
            <option value="">—</option>
            {/* Preserve an existing value that isn't in the canonical list. */}
            {form.country && !(COUNTRIES as readonly string[]).includes(form.country) && (
              <option value={form.country}>{form.country}</option>
            )}
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="admin-field">
          <label className="admin-label">Priority</label>
          <select className="admin-input" value={form.priority} onChange={(e) => field("priority", e.target.value)}>
            <option value="">—</option>
            {PRIORITY_LEVELS.map((p) => (
              <option key={p} value={p}>{humanize(p)}</option>
            ))}
          </select>
        </div>
      </div>
      {showNotes && (
        <div className="admin-field">
          <label className="admin-label">Notes</label>
          <textarea className="admin-textarea" value={form.notes} onChange={(e) => field("notes", e.target.value)} />
        </div>
      )}
      <div className="admin-form-actions">
        <button type="submit" className="admin-btn admin-btn--primary" disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
