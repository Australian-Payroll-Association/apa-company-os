import type { BadgeTone } from "@/components/admin/Badge";

// Domain constants and shared validation for Surveys (Operations → Workplace).
// The tables (surveys / survey_fields / survey_responses / survey_answers)
// pre-date this feature and have an external writer, so the app enforces the
// allowed values here rather than via DB CHECK constraints, and keeps the
// existing conventions: status 'published' (not 'open'), answers store the
// human-readable string in `value` and structured data in `value_json`.

export const FIELD_TYPES = [
  "short_text",
  "long_text",
  "single_choice",
  "multi_choice",
  "rating",
  "yes_no",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_TYPE_LABEL: Record<FieldType, string> = {
  short_text: "Short text",
  long_text: "Long text",
  single_choice: "Multiple choice (pick one)",
  multi_choice: "Multiple choice (pick many)",
  rating: "Rating scale",
  yes_no: "Yes / No",
};

export const SURVEY_STATUSES = ["draft", "published", "closed"] as const;
export type SurveyStatus = (typeof SURVEY_STATUSES)[number];

export function surveyStatusTone(status: string | null | undefined): BadgeTone {
  switch (status) {
    case "published":
      return "ok";
    case "draft":
      return "warn";
    default:
      return "neutral";
  }
}

// survey_fields.config. choices for the choice types; min/max (+ end labels)
// for rating. A 0–10 rating renders NPS aggregates on the results page.
export type FieldConfig = {
  choices?: string[];
  min?: number;
  max?: number;
  min_label?: string;
  max_label?: string;
};

export type SurveyRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: string;
  is_anonymous: boolean;
  intro_text: string | null;
  thank_you_text: string | null;
  created_at: string;
  updated_at: string;
};

export type SurveyFieldRow = {
  id: string;
  survey_id: string;
  position: number;
  type: string;
  label: string;
  help_text: string | null;
  required: boolean;
  config: FieldConfig | null;
};

export function ratingBounds(config: FieldConfig | null): { min: number; max: number } {
  const min = Number.isInteger(config?.min) ? (config!.min as number) : 1;
  const max = Number.isInteger(config?.max) ? (config!.max as number) : 5;
  return max > min ? { min, max } : { min: 1, max: 5 };
}

export function isNpsConfig(config: FieldConfig | null): boolean {
  const { min, max } = ratingBounds(config);
  return min === 0 && max === 10;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

// Builder input → validated config for the field type.
export function normalizeConfig(
  type: FieldType,
  input: { choicesText?: string; min?: number; max?: number; minLabel?: string; maxLabel?: string },
): { ok: true; config: FieldConfig } | { ok: false; error: string } {
  if (type === "single_choice" || type === "multi_choice") {
    const choices = (input.choicesText ?? "")
      .split("\n")
      .map((c) => c.trim())
      .filter(Boolean);
    const unique = [...new Set(choices)];
    if (unique.length < 2) return { ok: false, error: "Choice questions need at least 2 options." };
    if (unique.length > 20) return { ok: false, error: "Choice questions are capped at 20 options." };
    return { ok: true, config: { choices: unique } };
  }
  if (type === "rating") {
    const min = input.min ?? 1;
    const max = input.max ?? 5;
    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max > 10 || max <= min)
      return { ok: false, error: "Rating needs integer bounds between 0 and 10, with max above min." };
    const config: FieldConfig = { min, max };
    if (input.minLabel?.trim()) config.min_label = input.minLabel.trim();
    if (input.maxLabel?.trim()) config.max_label = input.maxLabel.trim();
    return { ok: true, config };
  }
  return { ok: true, config: {} };
}

// ---- answer validation (shared by the public API and any future importers) ----

export type AnswerValue = string | string[] | number | boolean;

export type ValidatedAnswer =
  | { ok: true; skip: true }
  | { ok: true; skip?: undefined; text: string; json: AnswerValue | null }
  | { ok: false; error: string };

const isEmpty = (raw: unknown) =>
  raw === undefined ||
  raw === null ||
  (typeof raw === "string" && raw.trim() === "") ||
  (Array.isArray(raw) && raw.length === 0);

export function validateAnswer(field: SurveyFieldRow, raw: unknown): ValidatedAnswer {
  if (isEmpty(raw)) {
    if (field.required) return { ok: false, error: `"${field.label}" is required.` };
    return { ok: true, skip: true };
  }

  switch (field.type as FieldType) {
    case "short_text": {
      if (typeof raw !== "string") return { ok: false, error: `"${field.label}" expects text.` };
      const text = raw.trim().slice(0, 500);
      return { ok: true, text, json: null };
    }
    case "long_text": {
      if (typeof raw !== "string") return { ok: false, error: `"${field.label}" expects text.` };
      const text = raw.trim().slice(0, 5000);
      return { ok: true, text, json: null };
    }
    case "single_choice": {
      const choices = field.config?.choices ?? [];
      if (typeof raw !== "string" || !choices.includes(raw))
        return { ok: false, error: `"${field.label}" got an invalid option.` };
      return { ok: true, text: raw, json: null };
    }
    case "multi_choice": {
      const choices = field.config?.choices ?? [];
      if (!Array.isArray(raw) || raw.some((v) => typeof v !== "string" || !choices.includes(v)))
        return { ok: false, error: `"${field.label}" got an invalid option.` };
      const picked = [...new Set(raw as string[])];
      return { ok: true, text: picked.join(", "), json: picked };
    }
    case "rating": {
      const { min, max } = ratingBounds(field.config);
      const n = typeof raw === "string" ? Number(raw) : raw;
      if (typeof n !== "number" || !Number.isInteger(n) || n < min || n > max)
        return { ok: false, error: `"${field.label}" expects a number between ${min} and ${max}.` };
      return { ok: true, text: String(n), json: n };
    }
    case "yes_no": {
      if (typeof raw !== "boolean") return { ok: false, error: `"${field.label}" expects yes or no.` };
      return { ok: true, text: raw ? "Yes" : "No", json: raw };
    }
    default:
      return { ok: false, error: `Unsupported question type "${field.type}".` };
  }
}

// Stored answer → typed value for aggregation. Pre-existing rows only ever set
// `value` (text), so fall back to coercing it.
export function parseStoredAnswer(
  field: SurveyFieldRow,
  row: { value: string | null; value_json: unknown },
): AnswerValue | null {
  if (row.value_json !== null && row.value_json !== undefined) return row.value_json as AnswerValue;
  if (row.value === null) return null;
  switch (field.type as FieldType) {
    case "rating": {
      const n = Number(row.value);
      return Number.isFinite(n) ? n : null;
    }
    case "yes_no":
      return row.value === "Yes";
    case "multi_choice":
      return row.value.split(", ").filter(Boolean);
    default:
      return row.value;
  }
}
