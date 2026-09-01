// Shared constants and helpers for Improved Scheduling & Tracking (Phase 2+).
// Framework-free — safe from server components, actions, and client components.

// Provisional work-type vocabulary for the capability matrix. DECISION (1 Sep
// 2026): seed from the real Kantata project-type list once exported; keep under
// ~12 — this is an assignment aid, not a competency framework. Until that export
// lands, this starter set (drawn from the charter's examples) stands in.
export const WORK_TYPES = [
  "Payroll compliance review",
  "Award interpretation",
  "System implementation",
  "Tech procurement",
  "Process optimisation",
  "Data migration",
  "Audit & assurance",
  "Health check",
  "Training & enablement",
] as const;

export type CapabilityLevel = "fast" | "capable" | "learning" | "no";
export type CapabilityPreference = "likes" | "neutral" | "dislikes";

export const CAPABILITY_LEVELS: CapabilityLevel[] = ["fast", "capable", "learning", "no"];

export const LEVEL_META: Record<CapabilityLevel, { label: string; short: string; tone: "ok" | "info" | "warn" | "muted" }> = {
  fast: { label: "Fast", short: "F", tone: "ok" },
  capable: { label: "Capable", short: "C", tone: "info" },
  learning: { label: "Learning", short: "L", tone: "warn" },
  no: { label: "Can't do", short: "—", tone: "muted" },
};

export const PREFERENCES: CapabilityPreference[] = ["likes", "neutral", "dislikes"];

export function isCapabilityLevel(v: unknown): v is CapabilityLevel {
  return typeof v === "string" && (CAPABILITY_LEVELS as string[]).includes(v);
}

export function isPreference(v: unknown): v is CapabilityPreference {
  return typeof v === "string" && (PREFERENCES as string[]).includes(v);
}
