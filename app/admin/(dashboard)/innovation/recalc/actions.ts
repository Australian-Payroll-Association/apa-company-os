"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, canViewSensitive } from "@/lib/admin-auth";
import { recordAudit } from "@/lib/admin/audit";
import { parseWorkbook } from "@/lib/recalc/parse-workbook";
import { runRecalculation } from "@/lib/recalc/engine";
import { getDefaultRuleSet, getRuleSet } from "@/lib/recalc/rule-sets";
import { createRun, completeRun, failRun } from "@/lib/recalc/runs";

export type RunFormResult = { ok: true } | { ok: false; error: string };

// Uploads APA's real "Pay Review data gathering template.xlsx" (one file, 9
// DATA# tabs — see docs/product/project-recalc-module.md), parses it, runs
// the recalculation engine, and stores the result — then redirects to the
// run's detail page. Gated by requireAdmin() + canViewSensitive(): payroll
// dollar data is sensitive, same posture as lib/admin/compensation.ts. The
// file is read directly in the action (typical engagement size is a few MB,
// nowhere near Vercel's body cap) rather than going through Supabase
// Storage's signed-upload flow used elsewhere for larger media.
export async function uploadAndRun(_prev: RunFormResult | null, formData: FormData): Promise<RunFormResult> {
  const admin = await requireAdmin();
  if (!(await canViewSensitive(admin.email))) {
    return { ok: false, error: "Not authorized to view payroll data." };
  }

  const label = ((formData.get("label") as string | null) ?? "").trim() || null;
  const workbookFile = formData.get("workbook_file");
  if (!(workbookFile instanceof File) || workbookFile.size === 0) {
    return { ok: false, error: "Choose the pay review data gathering workbook (.xlsx)." };
  }

  const ruleSetId = ((formData.get("rule_set_id") as string | null) ?? "").trim();
  const ruleSet = ruleSetId ? await getRuleSet(ruleSetId) : await getDefaultRuleSet();
  if (!ruleSet) {
    return { ok: false, error: "No interpretation rule set found — seed one in company_os.recalc_rule_sets first." };
  }

  const buffer = Buffer.from(await workbookFile.arrayBuffer());
  const parsed = await parseWorkbook(buffer);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const created = await createRun({
    label,
    ruleSetId: ruleSet.id,
    workbookFilename: workbookFile.name,
    createdBy: admin.email,
  });
  if (!created.ok) return { ok: false, error: created.error };

  const runId = created.id;
  try {
    const results = runRecalculation(parsed.data, ruleSet.rules);
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
