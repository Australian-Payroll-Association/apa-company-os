"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitContribution } from "./actions";
import { CONTRIBUTABLE_SECTIONS, SECTION_META, type SectionType } from "@/lib/newsletter";
import { SectionFields } from "@/components/admin/SectionFields";

// One section per submission. The hint under the picker is the part that does
// the work: the whole reason intake exists is that things came back
// half-finished, so each section says what "finished" looks like before the
// person starts typing.

export function ContributeForm({ editionId }: { editionId: string }) {
  const router = useRouter();
  const [sectionType, setSectionType] = useState<SectionType>(CONTRIBUTABLE_SECTIONS[0]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [details, setDetails] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const meta = SECTION_META[sectionType];
  // Training submits as a date range, so it does not need the body filled.
  const bodyRequired = meta.bodyRequired !== false;
  const canSubmit = bodyRequired ? Boolean(body.trim()) : Object.values(details).some((v) => v.trim());

  async function submit() {
    setSaving(true);
    setError(null);
    setSent(null);
    const result = await submitContribution({ editionId, sectionType, title, body, linkUrl, details });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setTitle("");
    setBody("");
    setLinkUrl("");
    setDetails({});
    setSent(`Added to ${meta.label}. Add another whenever you like.`);
    router.refresh();
  }

  return (
    <div className="admin-card" style={{ padding: "22px 24px" }}>
      <h2 className="admin-card-title">Add something to this edition</h2>
      <p className="admin-page-sub" style={{ marginTop: 0 }}>
        One item per submission. Add as many as you like, any time before the deadline.
      </p>

      <div className="admin-form" style={{ marginTop: 14 }}>
        <div className="admin-field">
          <label className="admin-label" htmlFor="nl-section">
            What is it?
          </label>
          <select
            id="nl-section"
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

        <SectionFields sectionType={sectionType} values={details} onChange={(k, v) => setDetails((d) => ({ ...d, [k]: v }))} idPrefix="nl" />

        <div className="admin-field">
          <label className="admin-label" htmlFor="nl-title">
            {meta.titleLabel ?? "Heading"} <span style={{ fontWeight: 400, opacity: 0.7 }}>(optional)</span>
          </label>
          <input
            id="nl-title"
            className="admin-input"
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="A short label the writer can scan"
          />
        </div>

        <div className="admin-field">
          <label className="admin-label" htmlFor="nl-body">
            {meta.bodyLabel ?? "Detail"}
          </label>
          <textarea
            id="nl-body"
            className="admin-textarea"
            rows={7}
            value={body}
            maxLength={5000}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write it in full. The draft is generated from this, so half a sentence produces half a newsletter."
          />
        </div>

        <div className="admin-field">
          <label className="admin-label" htmlFor="nl-link">
            {meta.linkLabel ?? "Link"} <span style={{ fontWeight: 400, opacity: 0.7 }}>(optional)</span>
          </label>
          <input
            id="nl-link"
            className="admin-input"
            value={linkUrl}
            maxLength={500}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://…"
          />
        </div>

        {error && <div className="admin-alert admin-alert--err">{error}</div>}
        {sent && <div className="admin-alert admin-alert--ok">{sent}</div>}

        <div className="admin-form-actions">
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            onClick={submit}
            disabled={saving || !canSubmit}
          >
            {saving ? "Adding…" : "Add to edition"}
          </button>
        </div>
      </div>
    </div>
  );
}
