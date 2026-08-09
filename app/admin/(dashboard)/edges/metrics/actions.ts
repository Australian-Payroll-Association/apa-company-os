"use server";

import { revalidatePath } from "next/cache";
import { companyOs } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";
import { recordAudit } from "@/lib/admin/audit";
import { type Result } from "@/lib/admin/mutations";
import { OFFICES, weekStartISO } from "../edges-shared";

function refresh() {
  revalidatePath("/admin/edges/metrics");
  revalidatePath("/admin/edges/goals");
}

export type MetricInput = {
  name: string;
  office: string;
  formula?: string;
  target?: number | null;
  direction?: "up" | "down";
  source: "agent" | "manual";
  source_detail?: string;
  owner_agent?: string;
  key_result_id?: string;
};

function clean(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue;
    out[k] = typeof v === "string" && v.trim() === "" ? null : v;
  }
  return out;
}

export async function createMetric(input: MetricInput): Promise<Result & { id?: string }> {
  const admin = await requireAdmin();
  const name = input.name?.trim();
  if (!name) return { ok: false, error: "Metric name is required." };
  if (!OFFICES.includes(input.office as (typeof OFFICES)[number])) return { ok: false, error: "Pick an office." };
  if (input.source !== "agent" && input.source !== "manual") return { ok: false, error: "Invalid source." };

  const row = { ...clean({ ...input }), name };
  const { data, error } = await companyOs.from("metrics").insert(row).select("id").single();
  if (error) return { ok: false, error: error.message };
  await recordAudit({ table: "metrics", recordId: data.id, operation: "insert", actor: admin.email, newData: row });
  refresh();
  return { ok: true, id: data.id };
}

export async function updateMetric(id: string, patch: Partial<MetricInput>): Promise<Result> {
  const admin = await requireAdmin();
  if (patch.name !== undefined && !patch.name.trim()) return { ok: false, error: "Metric name can't be empty." };
  const updates = { ...clean(patch), updated_at: new Date().toISOString() };
  const { error } = await companyOs.from("metrics").update(updates).eq("id", id);
  if (error) return { ok: false, error: error.message };
  await recordAudit({ table: "metrics", recordId: id, operation: "update", actor: admin.email, newData: patch });
  refresh();
  return { ok: true };
}

// The Monday check-in for numbers with no automatic source: upsert this week's
// reading, labeled with who typed it.
export async function saveManualReading(metricId: string, value: number): Promise<Result> {
  const admin = await requireAdmin();
  if (!Number.isFinite(value)) return { ok: false, error: "Enter a number." };

  const week = weekStartISO();
  const { error } = await companyOs
    .from("metric_readings")
    .upsert(
      { metric_id: metricId, week_start: week, value, collected_by: `manual:${admin.email}` },
      { onConflict: "metric_id,week_start" },
    );
  if (error) return { ok: false, error: error.message };
  await recordAudit({
    table: "metric_readings",
    recordId: metricId,
    operation: "update",
    actor: admin.email,
    newData: { week_start: week, value },
  });
  refresh();
  return { ok: true };
}
