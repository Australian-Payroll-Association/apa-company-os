// Static rate-card data for the "full-time hire in Vietnam" request flow.
// Pure data — safe to import from both the server action and the client form.

export type HirePositionId = "ai_engineer" | "ai_officer" | "data_engineer";
export type HireBracketId = "1-3" | "3-5" | "5+";

export type HireBracket = {
  id: HireBracketId;
  label: string;
  minUsd: number;
  maxUsd: number;
};

export type HirePosition = {
  id: HirePositionId;
  label: string;
  brackets: HireBracket[];
};

export const HIRE_POSITIONS: HirePosition[] = [
  {
    id: "ai_engineer",
    label: "AI Engineer",
    brackets: [
      { id: "1-3", label: "1–3 years", minUsd: 3000, maxUsd: 4000 },
      { id: "3-5", label: "3–5 years", minUsd: 4000, maxUsd: 6000 },
      { id: "5+", label: "5+ years", minUsd: 6000, maxUsd: 8000 },
    ],
  },
  {
    id: "ai_officer",
    label: "AI Officer",
    brackets: [
      { id: "1-3", label: "1–3 years", minUsd: 2500, maxUsd: 4000 },
      { id: "3-5", label: "3–5 years", minUsd: 4000, maxUsd: 5000 },
      { id: "5+", label: "5+ years", minUsd: 5000, maxUsd: 8000 },
    ],
  },
  {
    id: "data_engineer",
    label: "Data Engineer",
    brackets: [
      { id: "1-3", label: "1–3 years", minUsd: 3000, maxUsd: 4000 },
      { id: "3-5", label: "3–5 years", minUsd: 4000, maxUsd: 5000 },
      { id: "5+", label: "5+ years", minUsd: 5000, maxUsd: 8000 },
    ],
  },
];

export function findBracket(
  positionId: string,
  bracketId: string,
): { position: HirePosition; bracket: HireBracket } | null {
  const position = HIRE_POSITIONS.find((p) => p.id === positionId);
  const bracket = position?.brackets.find((b) => b.id === bracketId);
  if (!position || !bracket) return null;
  return { position, bracket };
}

// Placeholder set — swap any of these for what you actually want offered.
export const HIRE_TECH_STACK = [
  "Python",
  "PyTorch / TensorFlow",
  "LLM APIs (OpenAI, Anthropic, etc.)",
  "SQL & data warehousing",
  "Cloud (AWS / Azure / GCP)",
  "Docker / Kubernetes",
  "React / Next.js",
  "Workflow automation (n8n, Zapier)",
] as const;

export const HIRE_TERMS = [
  "1-year contract.",
  "1-month deposit due at signing.",
  "Cancel any time in the first 2 months at no charge.",
  "After 2 months, cancelling forfeits the 1-month deposit.",
  "Performance-related termination: 3 documented incidents, and we'll find a replacement within 30 days.",
];
