"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addSubmissionAsAdmin } from "../actions";
import { CONTRIBUTABLE_SECTIONS, SECTION_META, type SectionType } from "@/lib/newsletter";
import { SectionFields } from "@/components/admin/SectionFields";

// Admin-side add. Deliberately the same field set and the same hints as the
// /team form, so an item added here is indistinguishable from one a contributor
// sent in — and so there is only one thing to learn.
//
// Collapsed by default: this page is for reading what came in, and a permanently
// open form would push the sections themselves below the fold.

export function AddSubmissionForm({ editionId }: { editionId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sectionType, setSectionType] = useState<SectionType>(CONTRIBUTABLE_SECTIONS[0]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [details, setDetails] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const meta = SECTION_META[sectionType];

  async function submit() {
    setSaving(true);
    setError(null);
    setDone(null);
    const result = await addSubmissionAsAdmin({ editionId, sectionType, title, body, linkUrl, details });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setTitle("");
    setBody("");
    setLinkUrl("");
    setDetails({});
    setDone(result.message ?? "Added.");
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" className="admin-btn" onClick={() => setOpen(true)}>
        Add an item
      </button>
    );
  }

  return (
    <div style={{ marginTop: 4 }}>
      <div className="admin-form">
        <div className="admin-field">
          <label className="admin-label" htmlFor="adm-section">
            What is it?
          </label>
          <select
            id="adm-section"
            className="admin-select"
            value={sectionType}
            onChange={(e) => { setSectionType(e.target.value as SectionType); setDetails({}); }}
          >
            {CONTRIBUTABLE_SECTIONS.map((t) => (
              <option key={t} value={t}>
                {SECTION_META[t].label}
              </option>
            ))}
          </select>
          <p className="admin-page-sub" style={{ marginTop: 6, marginBottom: 0 }}>
            {meta.hint}
          </p>
        </div>

        <SectionFields sectionType={sectionType} values={details} onChange={(k, v) => setDetails((d) => ({ ...d, [k]: v }))} idPrefix="adm" />

        <div className="admin-field">
          <label className="admin-label" htmlFor="adm-title">
            {meta.titleLabel ?? "Heading"} <span style={{ fontWeight: 400, opacity: 0.7 }}>(optional)</span>
          </label>
          <input
            id="adm-title"
            className="admin-input"
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="A short label the writer can scan"
          />
        </div>

        <div className="admin-field">
          <label className="admin-label" htmlFor="adm-body">
            {meta.bodyLabel ?? "Detail"}
          </label>
          <textarea
            id="adm-body"
            className="admin-textarea"
            rows={6}
            value={body}
            maxLength={5000}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write it in full. The draft is generated from this."
          />
        </div>

        <div className="admin-field">
          <label className="admin-label" htmlFor="adm-link">
            {meta.linkLabel ?? "Link"} <span style={{ fontWeight: 400, opacity: 0.7 }}>(optional)</span>
          </label>
          <input
            id="adm-link"
            className="admin-input"
            value={linkUrl}
            maxLength={500}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://…"
          />
        </div>

        {error && <div className="admin-alert admin-alert--err">{error}</div>}
        {done && <div className="admin-alert admin-alert--ok">{done}</div>}

        <div className="admin-form-actions" style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            onClick={submit}
            disabled={saving || !body.trim()}
          >
            {saving ? "Adding…" : "Add to edition"}
          </button>
          <button type="button" className="admin-btn" onClick={() => setOpen(false)} disabled={saving}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
