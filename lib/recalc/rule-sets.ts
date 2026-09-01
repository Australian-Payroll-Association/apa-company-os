// Server-only data layer for company_os.recalc_rule_sets. Callers gate on
// requireAdmin() + canViewSensitive() before invoking any of this — payroll
// dollar data is sensitive, same posture as lib/admin/compensation.ts.

import { companyOs } from "@/lib/supabase";
import type { RuleSet } from "./types";

export type RuleSetRow = {
  id: string;
  name: string;
  description: string | null;
  rules: RuleSet;
  createdAt: string;
};

type Row = { id: string; name: string; description: string | null; rules: RuleSet; created_at: string };

function mapRow(r: Row): RuleSetRow {
  return { id: r.id, name: r.name, description: r.description, rules: r.rules, createdAt: r.created_at };
}

const COLS = "id, name, description, rules, created_at";

export async function listRuleSets(): Promise<RuleSetRow[]> {
  const { data, error } = await companyOs.from("recalc_rule_sets").select(COLS).order("created_at", { ascending: false });
  if (error) {
    console.error("listRuleSets failed:", error.message);
    return [];
  }
  return (data as Row[]).map(mapRow);
}

// v1 has exactly one seeded example rule set (see supabase/02-recalc.sql) and
// no rule-set editor UI yet — the recalc page just runs against the most
// recently created one. Revisit once real client rule sets exist to choose
// between (Phase 2).
export async function getDefaultRuleSet(): Promise<RuleSetRow | null> {
  const { data, error } = await companyOs
    .from("recalc_rule_sets")
    .select(COLS)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("getDefaultRuleSet failed:", error.message);
    return null;
  }
  return data ? mapRow(data as Row) : null;
}

export async function getRuleSet(id: string): Promise<RuleSetRow | null> {
  const { data, error } = await companyOs.from("recalc_rule_sets").select(COLS).eq("id", id).maybeSingle();
  if (error) {
    console.error("getRuleSet failed:", error.message);
    return null;
  }
  return data ? mapRow(data as Row) : null;
}
