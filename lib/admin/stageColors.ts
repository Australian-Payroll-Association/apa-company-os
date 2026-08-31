/**
 * Canonical pipeline / stage accent colors, shared by the deals board, inquiries
 * board, revenue dashboard, and job-req pipeline.
 *
 * Kept in TS (not CSS custom properties) because these accents are consumed as
 * inline-style color strings by the kanban/board components. Values mirror the
 * data-layer palette in app/globals.css — see
 * docs/product/edge8-design-system-data.md.
 *
 * Previously these arrays were copy-pasted across four files with drifting values
 * (e.g. `#287BE8` vs the accent token, `#D1458B` vs `--data-chart-4`). This module
 * is the single source; the per-page duplicates now import from here.
 */

/** First / "new" stage — brand blue. CSS var so it tracks the accent token. */
export const STAGE_LEAD = "var(--admin-accent)";
/** Terminal outcome — won (data chart-3, green). */
export const STAGE_WON = "#1a9e74";
/** Terminal outcome — lost (neutral gray). */
export const STAGE_LOST = "#9ca3af";
/** Default / unclassified in-progress stage (slate). */
export const STAGE_NEUTRAL = "#6b7194";
/** Rotating in-progress accent — discovery (data chart-4, pink). */
export const STAGE_DISCOVERY = "#D1458B";
/** Rotating in-progress accent — proposal (amber). */
export const STAGE_PROPOSAL = "#f59e0b";
/** Late in-progress accent — contract sent, awaiting payment (teal, near-won). */
export const STAGE_CONTRACT = "#0ea5a4";
/** "New from SDR" handoff column (violet). */
export const STAGE_HANDOFF = "#8b5cf6";

/**
 * Full rotating cycle including terminal colors, for position-agnostic pipeline
 * views that index by column order (job-req pipeline).
 */
export const STAGE_ACCENT_CYCLE = [
  STAGE_LEAD,
  STAGE_NEUTRAL,
  STAGE_DISCOVERY,
  STAGE_PROPOSAL,
  STAGE_WON,
  STAGE_LOST,
] as const;
