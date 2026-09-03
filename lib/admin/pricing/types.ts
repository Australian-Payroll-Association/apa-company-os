// E7 · Native Pricing Engine — shared types.
//
// The engine is PURE and AUD-native. Every money value is INTEGER CENTS
// (data-dictionary rule 4: never floats, never a bare amount). Member and
// Non-Member figures are computed IN PARALLEL from explicit config columns — the
// engine NEVER derives one figure from the other by a ratio.
//
// Source of truth for every rate/band/price/multiplier is
// docs/product/pricing-configs-full.md (cell-cited extraction of the workbook).
// No number is invented. A config that cannot yet be fully sourced is marked
// `verified: false` and the engine refuses to emit a price for it.
//
// GENERAL COMPONENT MODEL: each service is an ordered list of components. The
// workbook's %-modifier base is a DIFFERENT SUM() range per tab, so it is an
// explicit `modifierBaseGroups` list (not a universal subtotal). Components are
// tagged with a `group` (so a later factor/modifier can reference the running
// sum of named groups, exactly like an Excel SUM(range)) and a `column`
// ("fee" | "tech" — BOOT and Remediation total a separate Tech Costs column,
// and the deal value = fee + tech).

export type ServiceKey =
  | "payroll_360"
  | "pay_review"
  | "compliance_review"
  | "health_check"
  | "optimise"
  | "pay_compliance"
  | "boot"
  | "tech_procurement"
  | "stp2"
  | "award_interpretation"
  | "super_review"
  | "lsl_review"
  | "sys_imp"
  | "remediation";

// Day rates (AUD cents) — global constants (configs-full §"Global constants").
export const MEMBER_DAY_RATE_CENTS = 240_000; // A$2,400 / day
export const NON_MEMBER_DAY_RATE_CENTS = 260_000; // A$2,600 / day

// Bumped whenever the engine math or any verified config value changes.
export const ENGINE_VERSION = "e7-pricing@2.0.0";

export type Column = "fee" | "tech";

// A member/non-member price pair in cents. `nonMemberCents: null` means the
// figure is genuinely not in the source — the engine warns and drops the
// non-member total rather than guessing. (With configs-full both columns are
// populated for every service; the null path is a retained safety guard.)
export type PricePair = {
  memberCents: number;
  nonMemberCents: number | null;
};

// Banded per-employee: first band whose ceiling the headcount is under, then
// rate × headcount.
export type EmployeeBand = {
  maxEmployees: number | null; // headcount < maxEmployees; null = open-ended top
  rate: PricePair; // per-employee, in cents
};

// Stepped lookup step: first step whose `lt` the count is under wins.
export type Step = { lt: number | null; fee: PricePair };

// A factor resolver for `factor_of` components (Excel "factor × SUM(range)").
export type FactorSpec =
  // Factor from a headcount band (Optimise base).
  | { kind: "headcount_band"; steps: { maxEmployees: number | null; factor: number }[] }
  // Factor from a months lookup (Remediation / Super / BOOT recalc period).
  | { kind: "months_lookup"; monthsKey: "recalcMonths" | "wageSafeMonths"; steps: { maxMonths: number | null; factor: number }[]; warnOverMax?: boolean }
  // Factor from a named enum input (BOOT pay frequency).
  | { kind: "enum"; enumKey: string; map: Record<string, number> }
  // Factor stepped by a count (Remediation singular award-interpretation).
  | { kind: "count_step"; countKey: string; steps: { lt: number | null; factor: number }[]; warnOverMax?: boolean }
  // Factor = min(count × perCount, capFactor) (award effort multipliers; back-pay).
  | { kind: "count_linear"; countKey: string; perCount: number; capFactor?: number }
  // Factor applied only when a toggle is on (Rostering; STP2 scope toggles).
  | { kind: "toggle"; toggleKey: string; factor: number };

type ComponentBase = { key: string; label: string; group: string; column?: Column };

export type Component =
  | (ComponentBase & { type: "banded_per_emp"; bands: EmployeeBand[] })
  | (ComponentBase & { type: "flat"; fee: PricePair })
  | (ComponentBase & { type: "complexity"; tiers: { complexity: number; fee: PricePair }[] })
  // Flat fee toggled on via inputs.scope[toggleKey].
  | (ComponentBase & { type: "scope"; toggleKey: string; fee: PricePair })
  // count × price; firstFree → MAX(count-1,0). Count from inputs.units[countKey].
  | (ComponentBase & { type: "unit"; countKey: string; price: PricePair; firstFree?: boolean })
  // Up to `slots` award slots, each a Level 1–4 fee from `table`. Levels from
  // inputs.awardLevels (an array of 1–4 values).
  | (ComponentBase & { type: "award_levels"; slots: number; table: { level: number; fee: PricePair }[] })
  // Stepped discrete fee by a count. minCount → warn if below; warnOverMax →
  // warn if above the last finite step (the "CHECK"/"CUSTOM" sentinels).
  // required → this count DRIVES a base/major line: when its input is absent the
  // price is NOT computable (the engine must not treat the missing base as $0);
  // it warns with `requiredMessage` and drops the totals to null. This is
  // distinct from a legitimately-zero or out-of-range count (which only warns).
  | (ComponentBase & { type: "stepped"; countKey: string; steps: Step[]; minCount?: number; warnOverMax?: boolean; required?: boolean; requiredMessage?: string })
  // Cumulative tiers + each-additional (EBA core / state).
  | (ComponentBase & { type: "tiered_cumulative"; countKey: string; tiers: { count: number; fee: PricePair }[]; eachAdditional: PricePair })
  // Fixed fee selected by a named enum (Implementation process documentation).
  | (ComponentBase & { type: "enum_flat"; enumKey: string; options: Record<string, PricePair> })
  // factor × SUM(baseGroups) — the workbook's multiplier lines.
  | (ComponentBase & { type: "factor_of"; baseGroups: string[]; factor: FactorSpec })
  // WageSafe employee licence = months × perEmp × headcount (Tech column).
  | (ComponentBase & { type: "wagesafe_per_emp"; perEmpPerMonthCents: PricePair; monthsKey: "recalcMonths" | "wageSafeMonths" })
  // WageSafe licence cost = months × perMonth (Tech column).
  | (ComponentBase & { type: "wagesafe_monthly"; perMonthCents: PricePair; monthsKey: "recalcMonths" | "wageSafeMonths" });

// Percentage modifier applied to the modifier base (Σ active rates, then one
// multiply — not compounded). NFP is negative.
export type Modifier =
  | { key: string; label: string; kind: "binary"; when: "yes" | "no"; rate: number }
  | { key: string; label: string; kind: "tri"; rates: { yes: number; partial: number; no: number } };

export type ServiceConfig = {
  serviceKey: ServiceKey;
  label: string;
  verified: boolean;
  components: Component[]; // processed IN ORDER
  modifiers?: Modifier[];
  // The groups whose running sum forms the %-modifier base (the tab's SUM range).
  modifierBaseGroups?: string[];
  // Minimum engagement fee floor on the FEE column: MAX(fee, floor). Null = none.
  minimumCents: number | null;
  // Free-form provenance / modeling notes.
  notes?: string;
};

// ── Engine inputs & outputs ─────────────────────────────────────────────────

export type PricingInputs = {
  headcount?: number;
  complexity?: number; // award_interpretation
  scope?: Record<string, boolean>; // scope toggles + boolean modifier/scope toggles
  units?: Record<string, number>; // award / system counts
  awardLevels?: number[]; // PayCompliance / Health Check award slot levels (1–4)
  stepped?: Record<string, number>; // pay-code qty, entities, procurement / STP2 counts
  tiers?: Record<string, number>; // eba_core, eba_state counts
  modifiers?: Record<string, boolean | "yes" | "partial" | "no">;
  enums?: Record<string, string>; // pay_frequency, process_doc, …
  recalcMonths?: number; // remediation / super / boot recalc period
  wageSafeMonths?: number; // WageSafe licence own period
};

export type LineItem = {
  key: string;
  label: string;
  group: string;
  column: Column;
  memberCents: number | null;
  nonMemberCents: number | null;
};

export type PricingResult = {
  serviceKey: ServiceKey;
  verified: boolean;
  // Deal value = floored fee + tech. Null when not computable.
  memberCents: number | null;
  nonMemberCents: number | null;
  // Split columns (fee floored; tech separate) for the breakdown / proposal.
  feeMemberCents: number | null;
  feeNonMemberCents: number | null;
  techMemberCents: number | null;
  techNonMemberCents: number | null;
  breakdown: LineItem[];
  warnings: string[];
  currency: "aud";
  engineVersion: string;
};
