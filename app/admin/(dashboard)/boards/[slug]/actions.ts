"use server";

import { revalidatePath } from "next/cache";
import { companyOs } from "@/lib/supabase";
import { recordAudit } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin-auth";
import { type Result } from "@/lib/admin/mutations";
import { boardActorFor } from "@/lib/boards/access";
import { notifyBoardAssignee } from "@/lib/boards/notify";
import { TASK_PRIORITIES, SUBJECT_COMMITMENT, SUBJECT_BACKLOG_ITEM, type TaskPriority } from "@/lib/boards/types";

const DENIED = "You do not have access to this board.";

// These actions serve both /admin/boards and /team/boards, so refresh both.
function refresh(slug?: string) {
  if (slug) {
    revalidatePath(`/admin/boards/${slug}`);
    revalidatePath(`/team/boards/${slug}`);
  } else {
    revalidatePath("/admin/boards", "layout");
    revalidatePath("/team/boards", "layout");
  }
  revalidatePath("/team/my-work-boards");
}

async function boardIdForTask(taskId: string): Promise<string | null> {
  const { data } = await companyOs.from("tasks").select("board_id").eq("id", taskId).maybeSingle();
  return (data as { board_id: string | null } | null)?.board_id ?? null;
}

// Assigning a card to someone makes them a board member (they need to see it).
async function ensureMember(boardId: string, personId: string): Promise<void> {
  await companyOs
    .from("board_members")
    .upsert({ board_id: boardId, person_id: personId, role: "member" }, { onConflict: "board_id,person_id", ignoreDuplicates: true });
}

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
  internal?: boolean;
}): Promise<Result & { id?: string }> {
  const actor = await boardActorFor(input.boardId);
  if (!actor) return { ok: false, error: DENIED };
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
    created_by: actor.personId,
    due_date: input.dueDate || null,
    internal: input.internal ?? false,
    status: isDone ? "done" : "open",
    completed_at: isDone ? new Date().toISOString() : null,
    position: await endPosition(input.boardId, input.columnId),
  };
  const { data, error } = await companyOs.from("tasks").insert(row).select("id").single();
  if (error) return { ok: false, error: error.message };
  if (input.assigneeId) {
    await ensureMember(input.boardId, input.assigneeId);
    await notifyBoardAssignee(input.boardId, input.assigneeId, title, actor.personId);
  }
  await recordAudit({ table: "tasks", recordId: data.id, operation: "insert", actor: actor.label, newData: row });
  refresh();
  return { ok: true, id: data.id };
}

export async function moveCard(taskId: string, toColumnId: string, boardSlug: string): Promise<Result> {
  const { data: task } = await companyOs
    .from("tasks")
    .select("id, board_id, board_column_id, subject_type, subject_id")
    .eq("id", taskId)
    .maybeSingle();
  if (!task) return { ok: false, error: "Card not found." };
  const t = task as {
    id: string;
    board_id: string;
    board_column_id: string | null;
    subject_type: string | null;
    subject_id: string | null;
  };
  const actor = await boardActorFor(t.board_id);
  if (!actor) return { ok: false, error: DENIED };

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
    moved_by: actor.personId,
    note: null,
  });

  // One-way sync: moving a commitment-linked card into a done column marks the
  // coaching commitment kept. Never the reverse.
  if (isDone && t.subject_type === SUBJECT_COMMITMENT && t.subject_id) {
    await companyOs
      .from("coaching_commitments")
      .update({ status: "completed", closed_at: new Date().toISOString() })
      .eq("id", t.subject_id)
      .neq("status", "completed");
  }

  await recordAudit({ table: "tasks", recordId: taskId, operation: "update", actor: actor.label, newData: updates });
  refresh(boardSlug);
  return { ok: true };
}

// Link (or clear) a card's roadmap item. Scoped to the board's client, and only
// when the card isn't already linked to a commitment (one link per card).
export async function setCardRoadmapItem(
  taskId: string,
  backlogItemId: string | null,
  boardSlug: string,
): Promise<Result> {
  const { data: task } = await companyOs
    .from("tasks")
    .select("id, board_id, subject_type")
    .eq("id", taskId)
    .maybeSingle();
  if (!task) return { ok: false, error: "Card not found." };
  const t = task as { id: string; board_id: string; subject_type: string | null };
  const actor = await boardActorFor(t.board_id);
  if (!actor) return { ok: false, error: DENIED };
  if (t.subject_type === SUBJECT_COMMITMENT) {
    return { ok: false, error: "This card is linked to a commitment. A card links to one thing." };
  }

  if (backlogItemId) {
    const { data: board } = await companyOs
      .from("boards")
      .select("client_company_id")
      .eq("id", t.board_id)
      .maybeSingle();
    const clientId = (board as { client_company_id: string | null } | null)?.client_company_id;
    if (!clientId) return { ok: false, error: "This board has no linked client." };
    const { data: item } = await companyOs
      .from("client_backlog_items")
      .select("id")
      .eq("id", backlogItemId)
      .eq("company_id", clientId)
      .maybeSingle();
    if (!item) return { ok: false, error: "That roadmap item is not on this client's roadmap." };
  }

  const updates = backlogItemId
    ? { subject_type: SUBJECT_BACKLOG_ITEM, subject_id: backlogItemId }
    : { subject_type: null, subject_id: null };
  const { error } = await companyOs.from("tasks").update(updates).eq("id", taskId);
  if (error) return { ok: false, error: error.message };
  await recordAudit({ table: "tasks", recordId: taskId, operation: "update", actor: actor.label, newData: updates });
  refresh(boardSlug);
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
  const { data: current } = await companyOs
    .from("tasks")
    .select("board_id, assignee_id, title")
    .eq("id", taskId)
    .maybeSingle();
  if (!current) return { ok: false, error: "Card not found." };
  const c = current as { board_id: string; assignee_id: string | null; title: string };
  const boardId = c.board_id;
  const actor = await boardActorFor(boardId);
  if (!actor) return { ok: false, error: DENIED };

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
  if (patch.assigneeId) {
    await ensureMember(boardId, patch.assigneeId);
    if (patch.assigneeId !== c.assignee_id) {
      await notifyBoardAssignee(boardId, patch.assigneeId, (updates.title as string) ?? c.title, actor.personId);
    }
  }
  await recordAudit({ table: "tasks", recordId: taskId, operation: "update", actor: actor.label, newData: updates });
  refresh(boardSlug);
  return { ok: true };
}

export async function archiveCard(taskId: string, boardSlug: string): Promise<Result> {
  const boardId = await boardIdForTask(taskId);
  if (!boardId) return { ok: false, error: "Card not found." };
  const actor = await boardActorFor(boardId);
  if (!actor) return { ok: false, error: DENIED };
  const updates = { archived_at: new Date().toISOString(), archived_by: actor.label };
  const { error } = await companyOs.from("tasks").update(updates).eq("id", taskId).is("archived_at", null);
  if (error) return { ok: false, error: error.message };
  await recordAudit({ table: "tasks", recordId: taskId, operation: "archive", actor: actor.label });
  refresh(boardSlug);
  return { ok: true };
}

// Hide/show a card in the linked client's portal (client boards only in the UI).
export async function setCardInternal(taskId: string, internal: boolean, boardSlug: string): Promise<Result> {
  const boardId = await boardIdForTask(taskId);
  if (!boardId) return { ok: false, error: "Card not found." };
  const actor = await boardActorFor(boardId);
  if (!actor) return { ok: false, error: DENIED };
  const { error } = await companyOs.from("tasks").update({ internal }).eq("id", taskId);
  if (error) return { ok: false, error: error.message };
  await recordAudit({ table: "tasks", recordId: taskId, operation: "update", actor: actor.label, newData: { internal } });
  refresh(boardSlug);
  return { ok: true };
}

export async function createSprint(
  boardId: string,
  input: { name: string; startsOn?: string; endsOn?: string; goal?: string },
  boardSlug: string,
): Promise<Result & { id?: string }> {
  const actor = await boardActorFor(boardId);
  if (!actor) return { ok: false, error: DENIED };
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
  await recordAudit({ table: "sprints", recordId: data.id, operation: "insert", actor: actor.label, newData: row });
  refresh(boardSlug);
  return { ok: true, id: data.id };
}

export async function setCardSprint(taskId: string, sprintId: string | null, boardSlug: string): Promise<Result> {
  const { data: task } = await companyOs.from("tasks").select("board_id, sprint_id").eq("id", taskId).maybeSingle();
  if (!task) return { ok: false, error: "Card not found." };
  const t = task as { board_id: string; sprint_id: string | null };
  const actor = await boardActorFor(t.board_id);
  if (!actor) return { ok: false, error: DENIED };
  if (sprintId) {
    const { data: sprint } = await companyOs
      .from("sprints")
      .select("id")
      .eq("id", sprintId)
      .eq("board_id", t.board_id)
      .maybeSingle();
    if (!sprint) return { ok: false, error: "That sprint is not on this board." };
  }
  if (t.sprint_id === sprintId) return { ok: true };
  const { error } = await companyOs.from("tasks").update({ sprint_id: sprintId }).eq("id", taskId);
  if (error) return { ok: false, error: error.message };
  await companyOs
    .from("task_stage_log")
    .insert({ task_id: taskId, from_sprint_id: t.sprint_id, to_sprint_id: sprintId, kind: "sprint_move", moved_by: actor.personId });
  await recordAudit({ table: "tasks", recordId: taskId, operation: "update", actor: actor.label, newData: { sprint_id: sprintId } });
  refresh(boardSlug);
  return { ok: true };
}

// Close a sprint: roll its unfinished (not done, not archived) cards to the
// chosen next sprint or back to backlog (null), logging each rollover.
export async function closeSprint(
  sprintId: string,
  rolloverToSprintId: string | null,
  boardSlug: string,
): Promise<Result> {
  const { data: sprint } = await companyOs.from("sprints").select("board_id").eq("id", sprintId).maybeSingle();
  if (!sprint) return { ok: false, error: "Sprint not found." };
  const boardId = (sprint as { board_id: string }).board_id;
  const actor = await boardActorFor(boardId);
  if (!actor) return { ok: false, error: DENIED };
  if (rolloverToSprintId) {
    const { data: target } = await companyOs
      .from("sprints")
      .select("id")
      .eq("id", rolloverToSprintId)
      .eq("board_id", boardId)
      .maybeSingle();
    if (!target) return { ok: false, error: "That sprint is not on this board." };
  }

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
    await companyOs.from("task_stage_log").insert(
      ids.map((id) => ({
        task_id: id,
        from_sprint_id: sprintId,
        to_sprint_id: rolloverToSprintId,
        kind: "sprint_rollover",
        moved_by: actor.personId,
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
    actor: actor.label,
    newData: { status: "closed", rolled: ids.length, to: rolloverToSprintId },
  });
  refresh(boardSlug);
  return { ok: true };
}


// ── Board management (admin only) ─────────────────────────────────────────
export async function addBoardMember(boardId: string, personId: string, boardSlug: string): Promise<Result> {
  const admin = await requireAdmin();
  if (!personId) return { ok: false, error: "Pick a person." };
  const { error } = await companyOs
    .from("board_members")
    .upsert({ board_id: boardId, person_id: personId, role: "member" }, { onConflict: "board_id,person_id", ignoreDuplicates: true });
  if (error) return { ok: false, error: error.message };
  await recordAudit({ table: "board_members", recordId: boardId, operation: "insert", actor: admin.email, newData: { person_id: personId } });
  refresh(boardSlug);
  return { ok: true };
}

export async function removeBoardMember(boardId: string, personId: string, boardSlug: string): Promise<Result> {
  const admin = await requireAdmin();
  const { error } = await companyOs.from("board_members").delete().eq("board_id", boardId).eq("person_id", personId);
  if (error) return { ok: false, error: error.message };
  await recordAudit({ table: "board_members", recordId: boardId, operation: "delete", actor: admin.email, context: { person_id: personId } });
  refresh(boardSlug);
  return { ok: true };
}

export async function updateBoard(
  boardId: string,
  patch: { name?: string; description?: string | null; clientCompanyId?: string | null },
  boardSlug: string,
): Promise<Result> {
  const admin = await requireAdmin();
  const updates: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const n = patch.name.trim();
    if (!n) return { ok: false, error: "The board needs a name." };
    updates.name = n;
  }
  if (patch.description !== undefined) updates.description = patch.description?.trim() || null;
  if (patch.clientCompanyId !== undefined) updates.client_company_id = patch.clientCompanyId || null;
  if (Object.keys(updates).length === 0) return { ok: true };
  const { error } = await companyOs.from("boards").update(updates).eq("id", boardId);
  if (error) return { ok: false, error: error.message };
  await recordAudit({ table: "boards", recordId: boardId, operation: "update", actor: admin.email, newData: updates });
  refresh(boardSlug);
  return { ok: true };
}

export async function archiveBoard(boardId: string): Promise<Result> {
  const admin = await requireAdmin();
  const { error } = await companyOs
    .from("boards")
    .update({ archived_at: new Date().toISOString(), archived_by: admin.email })
    .eq("id", boardId)
    .is("archived_at", null);
  if (error) return { ok: false, error: error.message };
  await recordAudit({ table: "boards", recordId: boardId, operation: "archive", actor: admin.email });
  revalidatePath("/admin/boards", "layout");
  revalidatePath("/team/boards", "layout");
  return { ok: true };
}

// ── Subtasks (checklist under a card) ─────────────────────────────────────
export async function addSubtask(parentTaskId: string, title: string, boardSlug: string): Promise<Result> {
  const { data: parent } = await companyOs.from("tasks").select("board_id").eq("id", parentTaskId).maybeSingle();
  if (!parent) return { ok: false, error: "Card not found." };
  const boardId = (parent as { board_id: string }).board_id;
  const actor = await boardActorFor(boardId);
  if (!actor) return { ok: false, error: DENIED };
  const t = title?.trim();
  if (!t) return { ok: false, error: "Give the subtask a title." };
  const { data, error } = await companyOs
    .from("tasks")
    .insert({ board_id: boardId, parent_task_id: parentTaskId, title: t, status: "open", priority: "p3", position: 0 })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  await recordAudit({ table: "tasks", recordId: data.id, operation: "insert", actor: actor.label, newData: { parent_task_id: parentTaskId, title: t } });
  refresh(boardSlug);
  return { ok: true };
}

export async function toggleSubtask(subtaskId: string, done: boolean, boardSlug: string): Promise<Result> {
  const { data: st } = await companyOs.from("tasks").select("board_id").eq("id", subtaskId).maybeSingle();
  if (!st) return { ok: false, error: "Subtask not found." };
  const actor = await boardActorFor((st as { board_id: string }).board_id);
  if (!actor) return { ok: false, error: DENIED };
  const { error } = await companyOs
    .from("tasks")
    .update({ status: done ? "done" : "open", completed_at: done ? new Date().toISOString() : null })
    .eq("id", subtaskId);
  if (error) return { ok: false, error: error.message };
  await recordAudit({ table: "tasks", recordId: subtaskId, operation: "update", actor: actor.label, newData: { status: done ? "done" : "open" } });
  refresh(boardSlug);
  return { ok: true };
}

// ── Comments ──────────────────────────────────────────────────────────────
export async function addComment(taskId: string, body: string, boardSlug: string): Promise<Result> {
  const boardId = await boardIdForTask(taskId);
  if (!boardId) return { ok: false, error: "Card not found." };
  const actor = await boardActorFor(boardId);
  if (!actor) return { ok: false, error: DENIED };
  const text = body?.trim();
  if (!text) return { ok: false, error: "Write a comment first." };
  const { error } = await companyOs
    .from("task_comments")
    .insert({ task_id: taskId, author_person_id: actor.personId, author_label: actor.label, body: text });
  if (error) return { ok: false, error: error.message };
  refresh(boardSlug);
  return { ok: true };
}

// Restore an archived card (bring it back to its board/column).
export async function restoreCard(taskId: string, boardSlug: string): Promise<Result> {
  const boardId = await boardIdForTask(taskId);
  if (!boardId) return { ok: false, error: "Card not found." };
  const actor = await boardActorFor(boardId);
  if (!actor) return { ok: false, error: DENIED };
  const { error } = await companyOs.from("tasks").update({ archived_at: null, archived_by: null }).eq("id", taskId);
  if (error) return { ok: false, error: error.message };
  await recordAudit({ table: "tasks", recordId: taskId, operation: "restore", actor: actor.label });
  refresh(boardSlug);
  return { ok: true };
}
