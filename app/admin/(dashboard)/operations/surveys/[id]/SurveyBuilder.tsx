"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/admin/Badge";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import {
  FIELD_TYPES,
  FIELD_TYPE_LABEL,
  ratingBounds,
  slugify,
  surveyStatusTone,
  type FieldType,
  type SurveyFieldRow,
  type SurveyRow,
} from "@/lib/admin/surveys";
import {
  addField,
  deleteField,
  deleteSurvey,
  moveField,
  setSurveyStatus,
  updateField,
  updateSurveyMeta,
  type FieldInput,
} from "../actions";

type ActionResult = { ok: true } | { ok: false; error: string };

type QuestionDraft = {
  label: string;
  helpText: string;
  required: boolean;
  choicesText: string;
  min: number;
  max: number;
  minLabel: string;
  maxLabel: string;
};

const emptyDraft: QuestionDraft = {
  label: "",
  helpText: "",
  required: true,
  choicesText: "",
  min: 1,
  max: 5,
  minLabel: "",
  maxLabel: "",
};

function draftFrom(field: SurveyFieldRow): QuestionDraft {
  const { min, max } = ratingBounds(field.config);
  return {
    label: field.label,
    helpText: field.help_text ?? "",
    required: field.required,
    choicesText: (field.config?.choices ?? []).join("\n"),
    min,
    max,
    minLabel: field.config?.min_label ?? "",
    maxLabel: field.config?.max_label ?? "",
  };
}

const toInput = (d: QuestionDraft): FieldInput => ({
  label: d.label,
  helpText: d.helpText,
  required: d.required,
  choicesText: d.choicesText,
  min: d.min,
  max: d.max,
  minLabel: d.minLabel,
  maxLabel: d.maxLabel,
});

// Type-specific config inputs shared by the add and edit forms. `locked` means
// the survey already has responses: options and scale are frozen server-side,
// so the inputs are disabled here too.
function ConfigInputs({
  type,
  draft,
  setDraft,
  locked,
}: {
  type: FieldType;
  draft: QuestionDraft;
  setDraft: (d: QuestionDraft) => void;
  locked: boolean;
}) {
  if (type === "single_choice" || type === "multi_choice") {
    return (
      <div className="admin-field">
        <label className="admin-label">Options (one per line)</label>
        <textarea
          className="admin-textarea"
          rows={4}
          value={draft.choicesText}
          onChange={(e) => setDraft({ ...draft, choicesText: e.target.value })}
          disabled={locked}
          placeholder={"Option A\nOption B"}
        />
        {locked && <span className="admin-hint">Options are frozen once responses exist.</span>}
      </div>
    );
  }
  if (type === "rating") {
    return (
      <>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="admin-field">
            <label className="admin-label">Min</label>
            <input
              className="admin-input"
              type="number"
              min={0}
              max={9}
              value={draft.min}
              onChange={(e) => setDraft({ ...draft, min: Number(e.target.value) })}
              disabled={locked}
            />
          </div>
          <div className="admin-field">
            <label className="admin-label">Max</label>
            <input
              className="admin-input"
              type="number"
              min={1}
              max={10}
              value={draft.max}
              onChange={(e) => setDraft({ ...draft, max: Number(e.target.value) })}
              disabled={locked}
            />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="admin-field">
            <label className="admin-label">Min label (optional)</label>
            <input
              className="admin-input"
              value={draft.minLabel}
              onChange={(e) => setDraft({ ...draft, minLabel: e.target.value })}
              disabled={locked}
              placeholder="Not likely"
            />
          </div>
          <div className="admin-field">
            <label className="admin-label">Max label (optional)</label>
            <input
              className="admin-input"
              value={draft.maxLabel}
              onChange={(e) => setDraft({ ...draft, maxLabel: e.target.value })}
              disabled={locked}
              placeholder="Extremely likely"
            />
          </div>
        </div>
        {!locked && (
          <button
            type="button"
            className="admin-btn admin-btn--sm"
            onClick={() =>
              setDraft({
                ...draft,
                min: 0,
                max: 10,
                minLabel: draft.minLabel || "Not likely",
                maxLabel: draft.maxLabel || "Extremely likely",
              })
            }
          >
            Use NPS scale (0–10)
          </button>
        )}
      </>
    );
  }
  return null;
}

function QuestionForm({
  type,
  draft,
  setDraft,
  locked,
  pending,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  type: FieldType;
  draft: QuestionDraft;
  setDraft: (d: QuestionDraft) => void;
  locked: boolean;
  pending: boolean;
  submitLabel: string;
  onSubmit: () => void;
  onCancel?: () => void;
}) {
  return (
    <div className="admin-form" style={{ display: "grid", gap: 12 }}>
      <div className="admin-field">
        <label className="admin-label">Question</label>
        <input
          className="admin-input"
          value={draft.label}
          onChange={(e) => setDraft({ ...draft, label: e.target.value })}
          placeholder="How was your week?"
        />
      </div>
      <div className="admin-field">
        <label className="admin-label">Help text (optional)</label>
        <input
          className="admin-input"
          value={draft.helpText}
          onChange={(e) => setDraft({ ...draft, helpText: e.target.value })}
        />
      </div>
      <ConfigInputs type={type} draft={draft} setDraft={setDraft} locked={locked} />
      <label className="admin-timeoff-check">
        <input
          type="checkbox"
          checked={draft.required}
          onChange={(e) => setDraft({ ...draft, required: e.target.checked })}
        />
        Required
      </label>
      <div className="admin-form-actions">
        <button
          type="button"
          className="admin-btn admin-btn--primary"
          disabled={pending}
          onClick={onSubmit}
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="admin-btn" disabled={pending} onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

export function SurveyBuilder({
  survey,
  fields,
  responseCount,
}: {
  survey: SurveyRow;
  fields: SurveyFieldRow[];
  responseCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [banner, setBanner] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const locked = responseCount > 0;

  // Meta form
  const [name, setName] = useState(survey.name);
  const [slug, setSlug] = useState(survey.slug);
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState(survey.description ?? "");
  const [introText, setIntroText] = useState(survey.intro_text ?? "");
  const [thankYouText, setThankYouText] = useState(survey.thank_you_text ?? "");
  const [isAnonymous, setIsAnonymous] = useState(survey.is_anonymous);

  // Questions
  const [addType, setAddType] = useState<FieldType>("short_text");
  const [addDraft, setAddDraft] = useState<QuestionDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<QuestionDraft>(emptyDraft);

  function run(fn: () => Promise<ActionResult>, okText: string, after?: () => void) {
    setBanner(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        setBanner({ tone: "ok", text: okText });
        after?.();
        router.refresh();
      } else {
        setBanner({ tone: "err", text: res.error });
      }
    });
  }

  function copyLink() {
    const url = `${window.location.origin}/surveys/${survey.slug}`;
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {banner && (
        <div className={`admin-alert admin-alert--${banner.tone}`}>{banner.text}</div>
      )}

      {/* Status + sharing */}
      <div className="admin-card admin-section-card">
        <h2 className="admin-card-title">Status</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Badge tone={surveyStatusTone(survey.status)}>{survey.status}</Badge>
          {survey.is_anonymous && <Badge tone="info">anonymous</Badge>}
          <span className="admin-cell-muted">
            {responseCount} response{responseCount === 1 ? "" : "s"}
          </span>
          <span style={{ flex: 1 }} />
          {survey.status === "draft" && (
            <button
              className="admin-btn admin-btn--primary"
              disabled={pending}
              onClick={() => run(() => setSurveyStatus(survey.id, "published"), "Survey published.")}
            >
              Publish
            </button>
          )}
          {survey.status === "published" && (
            <button
              className="admin-btn"
              disabled={pending}
              onClick={() => run(() => setSurveyStatus(survey.id, "closed"), "Survey closed.")}
            >
              Close
            </button>
          )}
          {survey.status === "closed" && (
            <button
              className="admin-btn"
              disabled={pending}
              onClick={() => run(() => setSurveyStatus(survey.id, "published"), "Survey reopened.")}
            >
              Reopen
            </button>
          )}
          {responseCount === 0 && (
            <ConfirmButton
              className="admin-btn admin-btn--danger"
              label="Delete"
              title="Delete this survey?"
              body={`"${survey.name}" and its questions will be permanently deleted.`}
              confirmLabel="Delete survey"
              onConfirm={() => deleteSurvey(survey.id)}
              onDone={() => router.push("/admin/operations/surveys")}
            />
          )}
        </div>
        {survey.status === "published" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
            <code className="admin-cell-mono">/surveys/{survey.slug}</code>
            <button className="admin-btn admin-btn--sm" onClick={copyLink}>
              {copied ? "Copied ✓" : "Copy link"}
            </button>
            <a
              className="admin-btn admin-btn--sm"
              href={`/surveys/${survey.slug}`}
              target="_blank"
              rel="noreferrer"
            >
              Open ↗
            </a>
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="admin-card admin-section-card">
        <h2 className="admin-card-title">Details</h2>
        <form
          className="admin-form"
          style={{ display: "grid", gap: 12, maxWidth: 560 }}
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () =>
                updateSurveyMeta(survey.id, {
                  name,
                  slug,
                  description,
                  introText,
                  thankYouText,
                  isAnonymous,
                }),
              "Survey saved.",
            );
          }}
        >
          <div className="admin-field">
            <label className="admin-label" htmlFor="sb-name">Name</label>
            <input
              id="sb-name"
              className="admin-input"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (survey.status === "draft" && !slugTouched) setSlug(slugify(e.target.value));
              }}
              required
            />
          </div>
          <div className="admin-field">
            <label className="admin-label" htmlFor="sb-slug">Public link</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="admin-cell-muted" style={{ whiteSpace: "nowrap" }}>/surveys/</span>
              <input
                id="sb-slug"
                className="admin-input"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value);
                }}
                disabled={survey.status !== "draft"}
                required
              />
            </div>
            <span className="admin-hint">
              {survey.status === "draft"
                ? "Fills in from the name; edit it for a tidier link. Frozen after publishing."
                : "Frozen after publishing."}
            </span>
          </div>
          <div className="admin-field">
            <label className="admin-label" htmlFor="sb-desc">Description (optional)</label>
            <textarea
              id="sb-desc"
              className="admin-textarea"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="admin-field">
            <label className="admin-label" htmlFor="sb-intro">Intro text (first screen, optional)</label>
            <textarea
              id="sb-intro"
              className="admin-textarea"
              rows={2}
              value={introText}
              onChange={(e) => setIntroText(e.target.value)}
            />
          </div>
          <div className="admin-field">
            <label className="admin-label" htmlFor="sb-thanks">Thank-you text (optional)</label>
            <textarea
              id="sb-thanks"
              className="admin-textarea"
              rows={2}
              value={thankYouText}
              onChange={(e) => setThankYouText(e.target.value)}
            />
          </div>
          <label className="admin-timeoff-check">
            <input
              type="checkbox"
              checked={isAnonymous}
              disabled={locked}
              onChange={(e) => setIsAnonymous(e.target.checked)}
            />
            Anonymous — responses never store who answered
            {locked && <span className="admin-hint"> (frozen once responses exist)</span>}
          </label>
          <div className="admin-form-actions">
            <button type="submit" className="admin-btn admin-btn--primary" disabled={pending}>
              {pending ? "Saving…" : "Save details"}
            </button>
          </div>
        </form>
      </div>

      {/* Questions */}
      <div className="admin-card admin-section-card">
        <h2 className="admin-card-title">Questions</h2>
        {locked && (
          <div className="admin-alert admin-alert--ok" style={{ marginBottom: 12 }}>
            This survey has responses: wording can be edited and questions added, but types,
            options, and scales are frozen, and questions cannot be deleted.
          </div>
        )}

        {fields.length === 0 ? (
          <div className="admin-empty">No questions yet. Add the first one below.</div>
        ) : (
          <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
            {fields.map((f, i) =>
              editingId === f.id ? (
                <div key={f.id} className="admin-card" style={{ padding: 16 }}>
                  <QuestionForm
                    type={f.type as FieldType}
                    draft={editDraft}
                    setDraft={setEditDraft}
                    locked={locked}
                    pending={pending}
                    submitLabel="Save question"
                    onSubmit={() =>
                      run(() => updateField(f.id, toInput(editDraft)), "Question saved.", () =>
                        setEditingId(null),
                      )
                    }
                    onCancel={() => setEditingId(null)}
                  />
                </div>
              ) : (
                <div
                  key={f.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 12px",
                    border: "1px solid var(--admin-line)",
                    borderRadius: "var(--admin-radius-sm)",
                  }}
                >
                  <span className="admin-cell-mono" style={{ minWidth: 24 }}>{i + 1}.</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="admin-cell-strong">
                      {f.label}
                      {f.required && <span title="Required"> *</span>}
                    </div>
                    <div className="admin-cell-muted">
                      {FIELD_TYPE_LABEL[f.type as FieldType] ?? f.type}
                      {(f.type === "single_choice" || f.type === "multi_choice") &&
                        ` · ${(f.config?.choices ?? []).length} options`}
                      {f.type === "rating" &&
                        ` · ${ratingBounds(f.config).min}–${ratingBounds(f.config).max}`}
                    </div>
                  </div>
                  <button
                    className="admin-btn admin-btn--sm"
                    disabled={pending || i === 0}
                    aria-label="Move up"
                    onClick={() => run(() => moveField(f.id, "up"), "Moved.")}
                  >
                    ↑
                  </button>
                  <button
                    className="admin-btn admin-btn--sm"
                    disabled={pending || i === fields.length - 1}
                    aria-label="Move down"
                    onClick={() => run(() => moveField(f.id, "down"), "Moved.")}
                  >
                    ↓
                  </button>
                  <button
                    className="admin-btn admin-btn--sm"
                    disabled={pending}
                    onClick={() => {
                      setEditingId(f.id);
                      setEditDraft(draftFrom(f));
                    }}
                  >
                    Edit
                  </button>
                  {!locked && (
                    <ConfirmButton
                      className="admin-btn admin-btn--sm admin-btn--danger"
                      label="Delete"
                      title="Delete this question?"
                      body={`"${f.label}" will be removed from the survey.`}
                      confirmLabel="Delete question"
                      onConfirm={() => deleteField(f.id)}
                      onDone={() => router.refresh()}
                    />
                  )}
                </div>
              ),
            )}
          </div>
        )}

        <h3 className="admin-card-title" style={{ marginTop: 8 }}>Add a question</h3>
        <div className="admin-field" style={{ maxWidth: 320 }}>
          <label className="admin-label" htmlFor="sb-add-type">Type</label>
          <select
            id="sb-add-type"
            className="admin-select"
            value={addType}
            onChange={(e) => setAddType(e.target.value as FieldType)}
          >
            {FIELD_TYPES.map((t) => (
              <option key={t} value={t}>{FIELD_TYPE_LABEL[t]}</option>
            ))}
          </select>
        </div>
        <QuestionForm
          type={addType}
          draft={addDraft}
          setDraft={setAddDraft}
          locked={false}
          pending={pending}
          submitLabel="Add question"
          onSubmit={() =>
            run(() => addField(survey.id, addType, toInput(addDraft)), "Question added.", () =>
              setAddDraft(emptyDraft),
            )
          }
        />
      </div>
    </div>
  );
}
