"use server";

import { revalidatePath } from "next/cache";
import { companyOs } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";
import { recordAudit } from "@/lib/admin/audit";

// Edits the QBO-customer -> company mapping (companies.metadata.qbo_customer_ids).
// This is local data only — there is no live QuickBooks API integration wired
// into the app (v1 invoice sync is an operator-run backfill via the Supabase
// MCP + QBO MCP, not an in-app action). Fixing/extending the mapping here is
// still useful ahead of that automation and for documenting the linkage.
type Result = { ok: true } | { ok: false; error: string };

export async function updateQboCustomerIds(companyId: string, rawIds: string): Promise<Result> {
  const admin = await requireAdmin();
  const ids = rawIds
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const { data: row, error: rErr } = await companyOs
    .from("companies")
    .select("metadata")
    .eq("id", companyId)
    .maybeSingle();
  if (rErr || !row) return { ok: false, error: rErr?.message ?? "Company not found." };

  const metadata = { ...(row.metadata as Record<string, unknown>), qbo_customer_ids: ids };
  const { error } = await companyOs.from("companies").update({ metadata }).eq("id", companyId);
  if (error) return { ok: false, error: error.message };

  await recordAudit({
    table: "companies",
    recordId: companyId,
    operation: "update",
    actor: admin.email,
    context: { action: "update_qbo_customer_ids", ids },
  });

  revalidatePath(`/admin/revenue/companies/${companyId}`);
  return { ok: true };
}
