"use server";

import { revalidatePath } from "next/cache";
import { companyOs } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";
import { recordAudit } from "@/lib/admin/audit";
import type { Result } from "@/lib/admin/mutations";
import {
  BACKLOG_GROUPS,
  BACKLOG_PRIORITIES,
  BACKLOG_STATUSES,
  type BacklogGroupKey,
  type BacklogPriority,
  type BacklogStatus,
} from "@/lib/client-backlog";

const TABLE = "client_backlog_items";
const BASE = "/admin/edges/client-roadmaps";

function refresh() {
  revalidatePath(BASE);
}

export type BacklogItemInput = {
  group_key: BacklogGroupKey;
  ref?: string;
  title: string;
  who?: string;
  today_state?: string;
  build_desc?: string;
  needs?: string[];
  token_low?: number | null;
  token_high?: number | null;
  edge8_priority?: BacklogPriority;
  status?: BacklogStatus;
};

function clean(input: Partial<BacklogItemInput>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      out[k] = v.map((s) => String(s).trim()).filter(Boolean);
    } else if (typeof v === "string") {
      out[k] = v.trim() === "" ? null : v.trim();
    } else {
      out[k] = v;
    }
  }
  return out;
}

function validGroup(g: string | undefined): g is BacklogGroupKey {
  return !!g && (BACKLOG_GROUPS as readonly string[]).includes(g);
}

export async function createBacklogItem(
  companyId: string,
  input: BacklogItemInput,
): Promise<Result & { id?: string }> {
  const admin = await requireAdmin();
  if (!companyId) return { ok: false, error: "Pick a client first." };
  if (!validGroup(input.group_key)) return { ok: false, error: "Invalid group." };
  const title = input.title?.trim();
  if (!title) return { ok: false, error: "Title is required." };
  if (input.edge8_priority && !BACKLOG_PRIORITIES.includes(input.edge8_priority)) {
    return { ok: false, error: "Invalid priority." };
  }
  if (input.status && !BACKLOG_STATUSES.includes(input.status)) {
    return { ok: false, error: "Invalid status." };
  }

  const row = {
    ...clean(input),
    company_id: companyId,
    title,
    source: "edge8" as const,
    status: input.status ?? "accepted",
    sort_order: 999,
  };
  const { data, error } = await companyOs.from(TABLE).insert(row).select("id").single();
  if (error) return { ok: false, error: error.message };
  await recordAudit({ table: TABLE, recordId: data.id, operation: "insert", actor: admin.email, newData: row });
  refresh();
  return { ok: true, id: data.id };
}

export async function updateBacklogItem(id: string, patch: Partial<BacklogItemInput>): Promise<Result> {
  const admin = await requireAdmin();
  if (patch.group_key !== undefined && !validGroup(patch.group_key)) {
    return { ok: false, error: "Invalid group." };
  }
  if (patch.edge8_priority && !BACKLOG_PRIORITIES.includes(patch.edge8_priority)) {
    return { ok: false, error: "Invalid priority." };
  }
  if (patch.status && !BACKLOG_STATUSES.includes(patch.status)) {
    return { ok: false, error: "Invalid status." };
  }
  const updates = { ...clean(patch), updated_at: new Date().toISOString() };
  if ("title" in updates && !updates.title) return { ok: false, error: "Title can't be empty." };

  const { error } = await companyOs.from(TABLE).update(updates).eq("id", id);
  if (error) return { ok: false, error: error.message };
  await recordAudit({ table: TABLE, recordId: id, operation: "update", actor: admin.email, newData: patch });
  refresh();
  return { ok: true };
}

// Set the Edge8-proposed priority — the most common single edit, kept separate
// so the board pills can call it directly.
export async function setEdge8Priority(id: string, priority: BacklogPriority): Promise<Result> {
  if (!BACKLOG_PRIORITIES.includes(priority)) return { ok: false, error: "Invalid priority." };
  return updateBacklogItem(id, { edge8_priority: priority });
}

// Accept a client-proposed item into the plan (proposed -> accepted).
export async function acceptProposedItem(id: string): Promise<Result> {
  const admin = await requireAdmin();
  const { error } = await companyOs
    .from(TABLE)
    .update({ status: "accepted", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "proposed");
  if (error) return { ok: false, error: error.message };
  await recordAudit({ table: TABLE, recordId: id, operation: "update", actor: admin.email, newData: { status: "accepted" } });
  refresh();
  return { ok: true };
}

export async function archiveBacklogItem(id: string): Promise<Result> {
  const admin = await requireAdmin();
  const { error } = await companyOs
    .from(TABLE)
    .update({ archived_at: new Date().toISOString(), archived_by: admin.email })
    .eq("id", id)
    .is("archived_at", null);
  if (error) return { ok: false, error: error.message };
  await recordAudit({ table: TABLE, recordId: id, operation: "archive", actor: admin.email });
  refresh();
  return { ok: true };
}

export async function restoreBacklogItem(id: string): Promise<Result> {
  const admin = await requireAdmin();
  const { error } = await companyOs
    .from(TABLE)
    .update({ archived_at: null, archived_by: null })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  await recordAudit({ table: TABLE, recordId: id, operation: "restore", actor: admin.email });
  refresh();
  return { ok: true };
}

// The client-facing overview shown at the top of the roadmap. One row per
// company; upsert on company_id.
export async function saveRoadmapOverview(companyId: string, body: string): Promise<Result> {
  const admin = await requireAdmin();
  if (!companyId) return { ok: false, error: "Pick a client first." };
  const { error } = await companyOs
    .from("client_roadmap_overview")
    .upsert(
      { company_id: companyId, body, updated_at: new Date().toISOString(), updated_by: admin.email },
      { onConflict: "company_id" },
    );
  if (error) return { ok: false, error: error.message };
  await recordAudit({ table: "client_roadmap_overview", recordId: companyId, operation: "update", actor: admin.email });
  refresh();
  return { ok: true };
}
