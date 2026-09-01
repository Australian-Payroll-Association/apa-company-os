// Server-only data layer for company_os.recalc_runs. Callers gate on
// requireAdmin() + canViewSensitive() before invoking any of this.

import { companyOs } from "@/lib/supabase";
import type { RunResults } from "./types";

export type RunRow = {
  id: string;
  label: string | null;
  ruleSetId: string;
  ruleSetName: string | null;
  payDataFilename: string | null;
  timesheetFilename: string | null;
  status: "uploaded" | "calculating" | "done" | "error";
  results: RunResults | null;
  errorMessage: string | null;
  createdBy: string | null;
  createdAt: string;
};

type Row = {
  id: string;
  label: string | null;
  rule_set_id: string;
  recalc_rule_sets: { name: string } | { name: string }[] | null;
  pay_data_filename: string | null;
  timesheet_filename: string | null;
  status: RunRow["status"];
  results: RunResults | null;
  error_message: string | null;
  created_by: string | null;
  created_at: string;
};

function mapRow(r: Row): RunRow {
  const ruleSet = Array.isArray(r.recalc_rule_sets) ? r.recalc_rule_sets[0] : r.recalc_rule_sets;
  return {
    id: r.id,
    label: r.label,
    ruleSetId: r.rule_set_id,
    ruleSetName: ruleSet?.name ?? null,
    payDataFilename: r.pay_data_filename,
    timesheetFilename: r.timesheet_filename,
    status: r.status,
    results: r.results,
    errorMessage: r.error_message,
    createdBy: r.created_by,
    createdAt: r.created_at,
  };
}

const COLS =
  "id, label, rule_set_id, recalc_rule_sets(name), pay_data_filename, timesheet_filename, status, results, error_message, created_by, created_at";

export async function listRuns(): Promise<RunRow[]> {
  const { data, error } = await companyOs
    .from("recalc_runs")
    .select(COLS)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error("listRuns failed:", error.message);
    return [];
  }
  return (data as unknown as Row[]).map(mapRow);
}

export async function getRun(id: string): Promise<RunRow | null> {
  const { data, error } = await companyOs.from("recalc_runs").select(COLS).eq("id", id).maybeSingle();
  if (error) {
    console.error("getRun failed:", error.message);
    return null;
  }
  return data ? mapRow(data as unknown as Row) : null;
}

export async function createRun(input: {
  label: string | null;
  ruleSetId: string;
  payDataFilename: string;
  timesheetFilename: string;
  createdBy: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { data, error } = await companyOs
    .from("recalc_runs")
    .insert({
      label: input.label,
      rule_set_id: input.ruleSetId,
      pay_data_filename: input.payDataFilename,
      timesheet_filename: input.timesheetFilename,
      status: "calculating",
      created_by: input.createdBy,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: (data as { id: string }).id };
}

export async function completeRun(id: string, results: RunResults): Promise<void> {
  const { error } = await companyOs
    .from("recalc_runs")
    .update({ status: "done", results, error_message: null })
    .eq("id", id);
  if (error) console.error("completeRun failed:", error.message);
}

export async function failRun(id: string, errorMessage: string): Promise<void> {
  const { error } = await companyOs.from("recalc_runs").update({ status: "error", error_message: errorMessage }).eq("id", id);
  if (error) console.error("failRun failed:", error.message);
}
