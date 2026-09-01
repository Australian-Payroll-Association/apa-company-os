"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, canViewSensitive } from "@/lib/admin-auth";
import { recordAudit } from "@/lib/admin/audit";
import { parsePayDataCsv, parseTimesheetCsv } from "@/lib/recalc/parse-csv";
import { runRecalculation } from "@/lib/recalc/engine";
import { getDefaultRuleSet } from "@/lib/recalc/rule-sets";
import { createRun, completeRun, failRun } from "@/lib/recalc/runs";

export type RunFormResult = { ok: true } | { ok: false; error: string };

// Uploads both CSVs, parses them, runs the recalculation engine, and stores
// the result — then redirects to the run's detail page. Gated by
// requireAdmin() + canViewSensitive(): payroll dollar data is sensitive, same
// posture as lib/admin/compensation.ts. Files are read directly in the action
// (small CSVs, nowhere near Vercel's body-size cap) rather than going through
// Supabase Storage's signed-upload flow used elsewhere for larger media —
// there's no need for that extra hop here, and it saves the operator a manual
// bucket-creation step for a v1 proof of concept.
export async function uploadAndRun(_prev: RunFormResult | null, formData: FormData): Promise<RunFormResult> {
  const admin = await requireAdmin();
  if (!(await canViewSensitive(admin.email))) {
    return { ok: false, error: "Not authorized to view payroll data." };
  }

  const label = ((formData.get("label") as string | null) ?? "").trim() || null;
  const timesheetFile = formData.get("timesheet_file");
  const payDataFile = formData.get("pay_data_file");
  if (!(timesheetFile instanceof File) || timesheetFile.size === 0) {
    return { ok: false, error: "Choose a timesheet CSV file." };
  }
  if (!(payDataFile instanceof File) || payDataFile.size === 0) {
    return { ok: false, error: "Choose a pay data CSV file." };
  }

  const ruleSet = await getDefaultRuleSet();
  if (!ruleSet) {
    return { ok: false, error: "No interpretation rule set found — seed one in company_os.recalc_rule_sets first." };
  }

  const [timesheetText, payDataText] = await Promise.all([timesheetFile.text(), payDataFile.text()]);
  const timesheetParsed = parseTimesheetCsv(timesheetText);
  if (!timesheetParsed.ok) return { ok: false, error: `Timesheet CSV: ${timesheetParsed.error}` };
  const payDataParsed = parsePayDataCsv(payDataText);
  if (!payDataParsed.ok) return { ok: false, error: `Pay data CSV: ${payDataParsed.error}` };

  const created = await createRun({
    label,
    ruleSetId: ruleSet.id,
    payDataFilename: payDataFile.name,
    timesheetFilename: timesheetFile.name,
    createdBy: admin.email,
  });
  if (!created.ok) return { ok: false, error: created.error };

  let runId = created.id;
  try {
    const results = runRecalculation(timesheetParsed.rows, payDataParsed.rows, ruleSet.rules);
    await completeRun(runId, results);
    await recordAudit({
      table: "recalc_runs",
      recordId: runId,
      operation: "insert",
      actor: admin.email,
      context: { label, rule_set_id: ruleSet.id, flagged_count: results.totals.flaggedCount },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Calculation failed.";
    await failRun(runId, message);
    return { ok: false, error: message };
  }

  revalidatePath("/admin/innovation/recalc");
  redirect(`/admin/innovation/recalc/${runId}`);
}
