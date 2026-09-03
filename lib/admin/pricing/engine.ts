// E7 · Native Pricing Engine — pure, AUD-native (integer cents), config-driven.
//
// priceService() evaluates a service config's ordered components (Member and
// Non-Member IN PARALLEL), then applies the tab's %-modifier stack over its
// OWN modifier-base groups, then the fee floor, and returns the deal value =
// floored fee + separate Tech Costs. See types.ts for the component model.
//
// DATA-INTEGRITY GUARANTEES:
//  • An unverified config emits NO number — only a warning.
//  • A non-member price that is genuinely unknown (null) drops the non-member
//    total + warns; it is never derived from the member figure by a ratio.
//  • Out-of-range inputs WARN (never throw, never write "CHECK"/"CUSTOM").

import {
  ENGINE_VERSION,
  type Column,
  type Component,
  type FactorSpec,
  type LineItem,
  type Modifier,
  type PricingInputs,
  type PricingResult,
  type ServiceConfig,
  type ServiceKey,
} from "./types";
import { getServiceConfig } from "./config";

type Pair = { member: number; nonMember: number | null };

type State = {
  inputs: PricingInputs;
  // Running per-group sums (fee + tech combined for reference purposes; factor
  // bases reference these). nonMember null = poisoned (unknown) for that group.
  groups: Record<string, Pair>;
  feeMember: number;
  feeNonMember: number;
  feeNonMemberKnown: boolean;
  techMember: number;
  techNonMember: number;
  techNonMemberKnown: boolean;
  breakdown: LineItem[];
  warnings: string[];
  // A REQUIRED base/major-line driver input was absent, so the quote is not
  // computable. Mirrors the unverified path: totals drop to null + a warning,
  // rather than silently pricing the missing base as $0.
  nonComputable: boolean;
};

function addGroup(state: State, group: string, member: number, nonMember: number | null): void {
  const cur = state.groups[group] ?? { member: 0, nonMember: 0 };
  cur.member += member;
  if (nonMember === null) cur.nonMember = null;
  else if (cur.nonMember !== null) cur.nonMember += nonMember;
  state.groups[group] = cur;
}

function sumGroups(state: State, groups: string[]): Pair {
  let member = 0;
  let nonMember: number | null = 0;
  for (const g of groups) {
    const p = state.groups[g];
    if (!p) continue;
    member += p.member;
    if (p.nonMember === null) nonMember = null;
    else if (nonMember !== null) nonMember += p.nonMember;
  }
  return { member, nonMember };
}

function emit(state: State, c: Component, member: number, nonMember: number | null): void {
  const column: Column = c.column ?? "fee";
  state.breakdown.push({ key: c.key, label: c.label, group: c.group, column, memberCents: member, nonMemberCents: nonMember });
  addGroup(state, c.group, member, nonMember);
  if (column === "tech") {
    state.techMember += member;
    if (nonMember === null) state.techNonMemberKnown = false;
    else state.techNonMember += nonMember;
  } else {
    state.feeMember += member;
    if (nonMember === null) state.feeNonMemberKnown = false;
    else state.feeNonMember += nonMember;
  }
}

// Unified count lookup across the three count maps.
function countOf(inputs: PricingInputs, key: string): number {
  return inputs.units?.[key] ?? inputs.stepped?.[key] ?? inputs.tiers?.[key] ?? 0;
}

function computeFactor(spec: FactorSpec, state: State): number {
  const inputs = state.inputs;
  switch (spec.kind) {
    case "headcount_band": {
      const head = inputs.headcount ?? 0;
      const step = spec.steps.find((s) => s.maxEmployees === null || head < s.maxEmployees);
      return step?.factor ?? 0;
    }
    case "months_lookup": {
      const months = inputs[spec.monthsKey] ?? 0;
      if (months <= 0) return 0; // no recalc period set → no multiplier
      const step = spec.steps.find((s) => s.maxMonths === null || months <= s.maxMonths);
      if (!step) {
        if (spec.warnOverMax) state.warnings.push(`Recalculation period ${months}mo is out of the supported range — needs review (no multiplier applied).`);
        return 0;
      }
      return step.factor;
    }
    case "enum": {
      const v = inputs.enums?.[spec.enumKey];
      if (v == null || !(v in spec.map)) return 0;
      return spec.map[v];
    }
    case "count_step": {
      const count = countOf(inputs, spec.countKey);
      if (count <= 0) return 0; // no items → no multiplier
      const step = spec.steps.find((s) => s.lt === null || count < s.lt);
      if (!step) {
        if (spec.warnOverMax) state.warnings.push(`"${spec.countKey}" count ${count} is out of range — needs review.`);
        return 0;
      }
      return step.factor;
    }
    case "count_linear": {
      const count = countOf(inputs, spec.countKey);
      const raw = count * spec.perCount;
      return spec.capFactor != null ? Math.min(raw, spec.capFactor) : raw;
    }
    case "toggle":
      return inputs.scope?.[spec.toggleKey] ? spec.factor : 0;
  }
}

function applyComponent(state: State, c: Component): void {
  const inputs = state.inputs;
  switch (c.type) {
    case "banded_per_emp": {
      const head = inputs.headcount;
      if (head == null || !Number.isFinite(head) || head < 0) {
        state.warnings.push(`Valid headcount required for "${c.label}".`);
        return;
      }
      const band = c.bands.find((b) => b.maxEmployees === null || head < b.maxEmployees);
      if (!band) {
        state.warnings.push(`Headcount ${head} matched no band for "${c.label}".`);
        return;
      }
      const nm = band.rate.nonMemberCents === null ? null : band.rate.nonMemberCents * head;
      emit(state, c, band.rate.memberCents * head, nm);
      return;
    }
    case "flat":
      emit(state, c, c.fee.memberCents, c.fee.nonMemberCents);
      return;
    case "complexity": {
      const cx = inputs.complexity;
      if (cx == null) {
        state.warnings.push(`Award complexity (1–4) required for "${c.label}".`);
        return;
      }
      const tier = c.tiers.find((t) => t.complexity === cx);
      if (!tier) {
        state.warnings.push(`Award complexity ${cx} out of range for "${c.label}".`);
        return;
      }
      emit(state, c, tier.fee.memberCents, tier.fee.nonMemberCents);
      return;
    }
    case "scope":
      if (inputs.scope?.[c.toggleKey]) emit(state, c, c.fee.memberCents, c.fee.nonMemberCents);
      return;
    case "unit": {
      const raw = inputs.units?.[c.countKey] ?? 0;
      if (!Number.isFinite(raw) || raw <= 0) return;
      const count = c.firstFree ? Math.max(raw - 1, 0) : raw;
      if (count <= 0) return;
      const nm = c.price.nonMemberCents === null ? null : c.price.nonMemberCents * count;
      emit(state, { ...c, label: `${c.label} × ${count}` }, c.price.memberCents * count, nm);
      return;
    }
    case "award_levels": {
      const levels = (inputs.awardLevels ?? []).slice(0, c.slots).filter((l) => l >= 1 && l <= 4);
      if (levels.length === 0) return;
      let member = 0;
      let nonMember: number | null = 0;
      for (const lvl of levels) {
        const row = c.table.find((t) => t.level === lvl);
        if (!row) continue;
        member += row.fee.memberCents;
        if (row.fee.nonMemberCents === null) nonMember = null;
        else if (nonMember !== null) nonMember += row.fee.nonMemberCents;
      }
      emit(state, { ...c, label: `${c.label} (${levels.length})` }, member, nonMember);
      return;
    }
    case "stepped": {
      const count = inputs.stepped?.[c.countKey];
      if (count == null || !Number.isFinite(count)) {
        // A required base/major-line driver is absent → NOT computable. Warn and
        // poison the whole quote so the missing base is never priced as $0.
        // (An OPTIONAL stepped add-on legitimately skips in silence, as before.)
        if (c.required) {
          state.warnings.push(c.requiredMessage ?? `"${c.label}" is required to price this service.`);
          state.nonComputable = true;
        }
        return;
      }
      if (c.minCount != null && count < c.minCount) {
        state.warnings.push(`"${c.label}" count ${count} is below the supported minimum (${c.minCount}) — needs review.`);
        return;
      }
      const step = c.steps.find((s) => s.lt === null || count < s.lt);
      if (!step) {
        if (c.warnOverMax) state.warnings.push(`"${c.label}" count ${count} is out of the supported range — needs review (no fee added).`);
        return;
      }
      if (step.fee.memberCents === 0 && step.fee.nonMemberCents === 0) return;
      emit(state, { ...c, label: `${c.label} (${count})` }, step.fee.memberCents, step.fee.nonMemberCents);
      return;
    }
    case "tiered_cumulative": {
      const count = inputs.tiers?.[c.countKey];
      if (count == null || !Number.isFinite(count) || count <= 0) return;
      const maxTier = c.tiers[c.tiers.length - 1];
      let member: number;
      let nonMember: number | null;
      const exact = c.tiers.find((t) => t.count === count);
      if (exact) {
        member = exact.fee.memberCents;
        nonMember = exact.fee.nonMemberCents;
      } else if (count > maxTier.count) {
        const extra = count - maxTier.count;
        member = maxTier.fee.memberCents + c.eachAdditional.memberCents * extra;
        nonMember =
          maxTier.fee.nonMemberCents === null || c.eachAdditional.nonMemberCents === null
            ? null
            : maxTier.fee.nonMemberCents + c.eachAdditional.nonMemberCents * extra;
      } else {
        const lower = [...c.tiers].reverse().find((t) => t.count <= count) ?? c.tiers[0];
        member = lower.fee.memberCents;
        nonMember = lower.fee.nonMemberCents;
      }
      emit(state, { ...c, label: `${c.label} (${count})` }, member, nonMember);
      return;
    }
    case "enum_flat": {
      const v = inputs.enums?.[c.enumKey];
      if (v == null || !(v in c.options)) return;
      const fee = c.options[v];
      emit(state, c, fee.memberCents, fee.nonMemberCents);
      return;
    }
    case "factor_of": {
      const factor = computeFactor(c.factor, state);
      if (factor === 0) return;
      const base = sumGroups(state, c.baseGroups);
      const member = Math.round(base.member * factor);
      const nonMember = base.nonMember === null ? null : Math.round(base.nonMember * factor);
      emit(state, c, member, nonMember);
      return;
    }
    case "wagesafe_per_emp": {
      const months = inputs[c.monthsKey] ?? 0;
      const head = inputs.headcount ?? 0;
      if (months <= 0 || head <= 0) return;
      const member = c.perEmpPerMonthCents.memberCents * months * head;
      const nonMember = c.perEmpPerMonthCents.nonMemberCents === null ? null : c.perEmpPerMonthCents.nonMemberCents * months * head;
      emit(state, c, member, nonMember);
      return;
    }
    case "wagesafe_monthly": {
      const months = inputs[c.monthsKey] ?? 0;
      if (months <= 0) return;
      const member = c.perMonthCents.memberCents * months;
      const nonMember = c.perMonthCents.nonMemberCents === null ? null : c.perMonthCents.nonMemberCents * months;
      emit(state, c, member, nonMember);
      return;
    }
  }
}

function modifierRate(mod: Modifier, value: boolean | "yes" | "partial" | "no" | undefined): number {
  if (mod.kind === "binary") {
    const isYes = value === true || value === "yes";
    const isNo = value === false || value === "no";
    if (mod.when === "yes" && isYes) return mod.rate;
    if (mod.when === "no" && isNo) return mod.rate;
    return 0;
  }
  if (value === "yes") return mod.rates.yes;
  if (value === "partial") return mod.rates.partial;
  if (value === "no") return mod.rates.no;
  return 0;
}

// The pure entry point. Never throws; range problems become warnings.
export function priceService(serviceKey: ServiceKey, inputs: PricingInputs): PricingResult {
  const config: ServiceConfig = getServiceConfig(serviceKey);

  const result: PricingResult = {
    serviceKey,
    verified: config.verified,
    memberCents: null,
    nonMemberCents: null,
    feeMemberCents: null,
    feeNonMemberCents: null,
    techMemberCents: null,
    techNonMemberCents: null,
    breakdown: [],
    warnings: [],
    currency: "aud",
    engineVersion: ENGINE_VERSION,
  };

  if (!config.verified) {
    result.warnings.push(`Pricing config not yet verified for "${config.label}" — no price emitted.`);
    return result;
  }

  const state: State = {
    inputs,
    groups: {},
    feeMember: 0,
    feeNonMember: 0,
    feeNonMemberKnown: true,
    techMember: 0,
    techNonMember: 0,
    techNonMemberKnown: true,
    breakdown: [],
    warnings: [],
    nonComputable: false,
  };

  // 1. Components, in order (base, scope, units, tiers, factor lines…).
  for (const c of config.components) applyComponent(state, c);

  // A required base/major-line driver was missing: the quote is NOT computable.
  // Emit the breakdown + warnings but NO totals (all null), exactly like an
  // unverified config — a $0/partial base must never be applied to a deal.
  if (state.nonComputable) {
    result.breakdown = state.breakdown;
    result.warnings = state.warnings;
    return result;
  }

  // 2. %-modifier stack over this tab's OWN modifier-base groups.
  if (config.modifiers?.length && config.modifierBaseGroups?.length) {
    let rateSum = 0;
    for (const mod of config.modifiers) rateSum += modifierRate(mod, inputs.modifiers?.[mod.key]);
    if (rateSum !== 0) {
      const base = sumGroups(state, config.modifierBaseGroups);
      const member = Math.round(base.member * rateSum);
      const nonMember = base.nonMember === null ? null : Math.round(base.nonMember * rateSum);
      const pct = `${rateSum > 0 ? "+" : ""}${(rateSum * 100).toFixed(1)}%`;
      emit(state, { key: "modifiers", label: `Modifiers (${pct})`, group: "modifiers", column: "fee" } as Component, member, nonMember);
    }
  }

  // 3. Fee floor: MAX(fee, minimum).
  let feeMember = state.feeMember;
  let feeNonMember: number | null = state.feeNonMemberKnown ? state.feeNonMember : null;
  if (config.minimumCents != null) {
    if (feeMember < config.minimumCents) {
      state.breakdown.push({
        key: "floor",
        label: `Minimum fee floor ($${(config.minimumCents / 100).toLocaleString("en-AU")})`,
        group: "floor",
        column: "fee",
        memberCents: config.minimumCents - feeMember,
        nonMemberCents: feeNonMember !== null && feeNonMember < config.minimumCents ? config.minimumCents - feeNonMember : 0,
      });
      feeMember = config.minimumCents;
    }
    if (feeNonMember !== null && feeNonMember < config.minimumCents) feeNonMember = config.minimumCents;
  }

  // 4. Tech Costs (BOOT / Remediation) — separate total, included in deal value.
  const techMember = state.techMember;
  const techNonMember: number | null = state.techNonMemberKnown ? state.techNonMember : null;

  result.feeMemberCents = feeMember;
  result.feeNonMemberCents = feeNonMember;
  result.techMemberCents = techMember;
  result.techNonMemberCents = techNonMember;
  result.memberCents = feeMember + techMember;
  result.nonMemberCents = feeNonMember === null || techNonMember === null ? null : feeNonMember + techNonMember;
  result.breakdown = state.breakdown;
  result.warnings = state.warnings;
  return result;
}
