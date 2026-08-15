"use server";

import { revalidatePath } from "next/cache";
import { companyOs } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";
import { recordAudit } from "@/lib/admin/audit";
import { type Result } from "@/lib/admin/mutations";
import { TASK_PRIORITIES, type TaskPriority } from "@/lib/boards/types";

// Next position at the end of a column (cards order by position asc).
async function endPosition(boardId: string, columnId: string): Promise<number> {
  const { data } = await companyOs
    .from("tasks")
    .select("position")
    .eq("board_id", boardId)
    .eq("board_column_id", columnId)
    .is("archived_at", null)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const top = (data as { position: number } | null)?.position;
  return (typeof top === "number" ? top : 0) + 1;
}

function cleanPriority(p: string | undefined): TaskPriority {
  return TASK_PRIORITIES.includes(p as TaskPriority) ? (p as TaskPriority) : "p3";
}

export async function createCard(input: {
  boardId: string;
  columnId: string;
  title: string;
  priority?: string;
  assigneeId?: string;
  dueDate?: string;
  description?: string;
}): Promise<Result & { id?: string }> {
  const admin = await requireAdmin();
  const title = input.title?.trim();
  if (!title) return { ok: false, error: "Give the card a title." };

  const { data: col } = await companyOs
    .from("board_columns")
    .select("id, is_done")
    .eq("id", input.columnId)
    .eq("board_id", input.boardId)
    .maybeSingle();
  if (!col) return { ok: false, error: "That column is not on this board." };
  const isDone = (col as { is_done: boolean }).is_done;

  const row = {
    board_id: input.boardId,
    board_column_id: input.columnId,
    title,
    description: input.description?.trim() || null,
    priority: cleanPriority(input.priority),
    assignee_id: input.assigneeId || null,
    due_date: input.dueDate || null,
    status: isDone ? "done" : "open",
    completed_at: isDone ? new Date().toISOString() : null,
    position: await endPosition(input.boardId, input.columnId),
  };
  const { data, error } = await companyOs.from("tasks").insert(row).select("id").single();
  if (error) return { ok: false, error: error.message };
  await recordAudit({ table: "tasks", recordId: data.id, operation: "insert", actor: admin.email, newData: row });
  revalidatePath("/admin/boards", "layout");
  return { ok: true, id: data.id };
}

export async function moveCard(taskId: string, toColumnId: string, boardSlug: string): Promise<Result> {
  const admin = await requireAdmin();

  const { data: task } = await companyOs
    .from("tasks")
    .select("id, board_id, board_column_id")
    .eq("id", taskId)
    .maybeSingle();
  if (!task) return { ok: false, error: "Card not found." };
  const t = task as { id: string; board_id: string; board_column_id: string | null };

  const { data: col } = await companyOs
    .from("board_columns")
    .select("id, is_done")
    .eq("id", toColumnId)
    .eq("board_id", t.board_id)
    .maybeSingle();
  if (!col) return { ok: false, error: "That column is not on this board." };
  const isDone = (col as { is_done: boolean }).is_done;
  if (t.board_column_id === toColumnId) return { ok: true };

  const updates = {
    board_column_id: toColumnId,
    position: await endPosition(t.board_id, toColumnId),
    status: isDone ? "done" : "open",
    completed_at: isDone ? new Date().toISOString() : null,
  };
  const { error } = await companyOs.from("tasks").update(updates).eq("id", taskId);
  if (error) return { ok: false, error: error.message };

  await companyOs.from("task_stage_log").insert({
    task_id: taskId,
    from_column_id: t.board_column_id,
    to_column_id: toColumnId,
    kind: "move",
    note: null,
  });
  await recordAudit({ table: "tasks", recordId: taskId, operation: "update", actor: admin.email, newData: updates });
  revalidatePath(`/admin/boards/${boardSlug}`);
  return { ok: true };
}

export async function updateCard(
  taskId: string,
  patch: {
    title?: string;
    description?: string | null;
    priority?: string;
    assigneeId?: string | null;
    dueDate?: string | null;
  },
  boardSlug: string,
): Promise<Result> {
  const admin = await requireAdmin();
  const updates: Record<string, unknown> = {};
  if (patch.title !== undefined) {
    const t = patch.title.trim();
    if (!t) return { ok: false, error: "The card needs a title." };
    updates.title = t;
  }
  if (patch.description !== undefined) updates.description = patch.description?.trim() || null;
  if (patch.priority !== undefined) updates.priority = cleanPriority(patch.priority);
  if (patch.assigneeId !== undefined) updates.assignee_id = patch.assigneeId || null;
  if (patch.dueDate !== undefined) updates.due_date = patch.dueDate || null;
  if (Object.keys(updates).length === 0) return { ok: true };

  const { error } = await companyOs.from("tasks").update(updates).eq("id", taskId);
  if (error) return { ok: false, error: error.message };
  await recordAudit({ table: "tasks", recordId: taskId, operation: "update", actor: admin.email, newData: updates });
  revalidatePath(`/admin/boards/${boardSlug}`);
  return { ok: true };
}

export async function archiveCard(taskId: string, boardSlug: string): Promise<Result> {
  const admin = await requireAdmin();
  const updates = { archived_at: new Date().toISOString(), archived_by: admin.email };
  const { error } = await companyOs.from("tasks").update(updates).eq("id", taskId).is("archived_at", null);
  if (error) return { ok: false, error: error.message };
  await recordAudit({ table: "tasks", recordId: taskId, operation: "archive", actor: admin.email });
  revalidatePath(`/admin/boards/${boardSlug}`);
  return { ok: true };
}

export async function createSprint(
  boardId: string,
  input: { name: string; startsOn?: string; endsOn?: string; goal?: string },
  boardSlug: string,
): Promise<Result & { id?: string }> {
  const admin = await requireAdmin();
  const name = input.name?.trim();
  if (!name) return { ok: false, error: "Name the sprint." };
  const row = {
    board_id: boardId,
    name,
    starts_on: input.startsOn || null,
    ends_on: input.endsOn || null,
    goal: input.goal?.trim() || null,
    status: "active",
  };
  const { data, error } = await companyOs.from("sprints").insert(row).select("id").single();
  if (error) return { ok: false, error: error.message };
  await recordAudit({ table: "sprints", recordId: data.id, operation: "insert", actor: admin.email, newData: row });
  revalidatePath(`/admin/boards/${boardSlug}`);
  return { ok: true, id: data.id };
}

export async function setCardSprint(
  taskId: string,
  sprintId: string | null,
  boardSlug: string,
): Promise<Result> {
  const admin = await requireAdmin();
  const { data: task } = await companyOs.from("tasks").select("sprint_id").eq("id", taskId).maybeSingle();
  const from = (task as { sprint_id: string | null } | null)?.sprint_id ?? null;
  if (from === sprintId) return { ok: true };
  const { error } = await companyOs.from("tasks").update({ sprint_id: sprintId }).eq("id", taskId);
  if (error) return { ok: false, error: error.message };
  await companyOs
    .from("task_stage_log")
    .insert({ task_id: taskId, from_sprint_id: from, to_sprint_id: sprintId, kind: "sprint_move" });
  await recordAudit({ table: "tasks", recordId: taskId, operation: "update", actor: admin.email, newData: { sprint_id: sprintId } });
  revalidatePath(`/admin/boards/${boardSlug}`);
  return { ok: true };
}

// Close a sprint: roll its unfinished (not done, not archived) cards to the
// chosen next sprint or back to backlog (null), logging each rollover.
export async function closeSprint(
  sprintId: string,
  rolloverToSprintId: string | null,
  boardSlug: string,
): Promise<Result> {
  const admin = await requireAdmin();
  const { data: openCards } = await companyOs
    .from("tasks")
    .select("id")
    .eq("sprint_id", sprintId)
    .neq("status", "done")
    .is("archived_at", null);
  const ids = ((openCards ?? []) as { id: string }[]).map((c) => c.id);
  if (ids.length) {
    const { error: upErr } = await companyOs.from("tasks").update({ sprint_id: rolloverToSprintId }).in("id", ids);
    if (upErr) return { ok: false, error: upErr.message };
    await companyOs
      .from("task_stage_log")
      .insert(
        ids.map((id) => ({
          task_id: id,
          from_sprint_id: sprintId,
          to_sprint_id: rolloverToSprintId,
          kind: "sprint_rollover",
        })),
      );
  }
  const { error } = await companyOs
    .from("sprints")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", sprintId);
  if (error) return { ok: false, error: error.message };
  await recordAudit({
    table: "sprints",
    recordId: sprintId,
    operation: "update",
    actor: admin.email,
    newData: { status: "closed", rolled: ids.length, to: rolloverToSprintId },
  });
  revalidatePath(`/admin/boards/${boardSlug}`);
  return { ok: true };
}
