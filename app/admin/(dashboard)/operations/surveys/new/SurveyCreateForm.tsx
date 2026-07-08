"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { slugify } from "@/lib/admin/surveys";
import { createSurvey } from "../actions";

export function SurveyCreateForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createSurvey({
        name,
        slug,
        description,
        introText: "",
        thankYouText: "",
        isAnonymous,
      });
      if (res.ok) router.push(`/admin/operations/surveys/${res.id}`);
      else setError(res.error);
    });
  }

  return (
    <div className="admin-card" style={{ maxWidth: 560 }}>
      {error && <div className="admin-alert admin-alert--err">{error}</div>}
      <form className="admin-form" onSubmit={submit}>
        <div className="admin-field">
          <label className="admin-label" htmlFor="sv-name">Name</label>
          <input
            id="sv-name"
            className="admin-input"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
            placeholder="Q3 team pulse"
            required
          />
        </div>

        <div className="admin-field">
          <label className="admin-label" htmlFor="sv-slug">Slug</label>
          <input
            id="sv-slug"
            className="admin-input"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            placeholder="q3-team-pulse"
            required
          />
          <span className="admin-hint">Public link: /surveys/{slug || "…"} (frozen after publishing)</span>
        </div>

        <div className="admin-field">
          <label className="admin-label" htmlFor="sv-desc">Description (optional)</label>
          <textarea
            id="sv-desc"
            className="admin-textarea"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <label className="admin-timeoff-check">
          <input
            type="checkbox"
            checked={isAnonymous}
            onChange={(e) => setIsAnonymous(e.target.checked)}
          />
          Anonymous — responses never store who answered
        </label>

        <div className="admin-form-actions">
          <button type="submit" className="admin-btn admin-btn--primary" disabled={pending}>
            {pending ? "Creating…" : "Create draft"}
          </button>
        </div>
      </form>
    </div>
  );
}
