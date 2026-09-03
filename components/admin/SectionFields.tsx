"use client";

import { SECTION_META, type SectionType } from "@/lib/newsletter";

// The section-specific inputs (a webinar's date and time), rendered from
// SECTION_META[type].fields. Shared by the /team contribution form and the
// admin add-item form so the two can never drift: a field added to a section
// appears in both places at once.

export function SectionFields({
  sectionType,
  values,
  onChange,
  idPrefix,
}: {
  sectionType: SectionType;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  idPrefix: string;
}) {
  // formHidden fields are display-only — training's Delivery comes from the
  // website, so asking a contributor for it would be asking for a value they
  // do not decide.
  const fields = (SECTION_META[sectionType].fields ?? []).filter((f) => !f.formHidden);
  if (fields.length === 0) return null;

  return (
    <>
      {fields.map((f) => (
        <div className="admin-field" key={f.key}>
          <label className="admin-label" htmlFor={`${idPrefix}-${f.key}`}>
            {f.label}
          </label>
          <input
            id={`${idPrefix}-${f.key}`}
            className="admin-input"
            type={f.type === "date" ? "date" : "text"}
            value={values[f.key] ?? ""}
            maxLength={200}
            placeholder={f.placeholder}
            onChange={(e) => onChange(f.key, e.target.value)}
          />
        </div>
      ))}
    </>
  );
}
