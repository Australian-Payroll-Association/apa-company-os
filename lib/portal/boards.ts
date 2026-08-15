// Client-visible board: the task board linked to the client's company, read-only.
// PRIVACY HARD LINE: only non-internal, non-archived cards within the actor's
// companyScope are returned, and the select lists explicit safe columns only.
// Same discipline as lib/portal/meetings.ts.

import { companyOs } from "@/lib/supabase";
import type { PortalActor } from "@/lib/portal-auth";
import { type TaskPriority } from "@/lib/boards/types";

export type PortalBoardColumn = { id: string; name: string; isDone: boolean };
export type PortalBoardCard = {
  id: string;
  title: string;
  priority: TaskPriority;
  dueDate: string | null;
  columnId: string | null;
  done: boolean;
  assigneeName: string | null;
  sprintName: string | null;
};
export type PortalBoardData = {
  boardName: string;
  columns: PortalBoardColumn[];
  cards: PortalBoardCard[];
};

export async function hasBoard(actor: PortalActor): Promise<boolean> {
  if (actor.companyScope.length === 0) return false;
  const { data } = await companyOs
    .from("boards")
    .select("id")
    .in("client_company_id", actor.companyScope)
    .eq("status", "active")
    .is("archived_at", null)
    .limit(1);
  return (data ?? []).length > 0;
}

export async function getBoardForClient(actor: PortalActor): Promise<PortalBoardData | null> {
  if (actor.companyScope.length === 0) return null;
  const { data: boardRow } = await companyOs
    .from("boards")
    .select("id, name")
    .in("client_company_id", actor.companyScope)
    .eq("status", "active")
    .is("archived_at", null)
    .order("sort_order")
    .limit(1)
    .maybeSingle();
  if (!boardRow) return null;
  const board = boardRow as { id: string; name: string };

  const [colsRes, tasksRes] = await Promise.all([
    companyOs.from("board_columns").select("id, name, is_done").eq("board_id", board.id).order("position"),
    companyOs
      .from("tasks")
      .select("id, title, priority, due_date, status, board_column_id, assignee_id, sprint_id")
      .eq("board_id", board.id)
      .eq("internal", false)
      .is("parent_task_id", null)
      .is("archived_at", null)
      .order("position"),
  ]);

  const columns = ((colsRes.data ?? []) as { id: string; name: string; is_done: boolean }[]).map((c) => ({
    id: c.id,
    name: c.name,
    isDone: c.is_done,
  }));
  const tasks = (tasksRes.data ?? []) as {
    id: string;
    title: string;
    priority: TaskPriority;
    due_date: string | null;
    status: string;
    board_column_id: string | null;
    assignee_id: string | null;
    sprint_id: string | null;
  }[];

  const personIds = [...new Set(tasks.map((t) => t.assignee_id).filter(Boolean) as string[])];
  const sprintIds = [...new Set(tasks.map((t) => t.sprint_id).filter(Boolean) as string[])];
  const [peopleRes, sprintsRes] = await Promise.all([
    personIds.length
      ? companyOs.from("people").select("id, display_name, full_name, email").in("id", personIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string | null; full_name: string | null; email: string }[] }),
    sprintIds.length
      ? companyOs.from("sprints").select("id, name").in("id", sprintIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const nameById = new Map(
    (peopleRes.data ?? []).map((p) => [p.id, p.display_name || p.full_name || p.email]),
  );
  const sprintById = new Map((sprintsRes.data ?? []).map((s) => [s.id, s.name]));

  const cards: PortalBoardCard[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    priority: t.priority,
    dueDate: t.due_date,
    columnId: t.board_column_id,
    done: t.status === "done",
    assigneeName: t.assignee_id ? nameById.get(t.assignee_id) ?? null : null,
    sprintName: t.sprint_id ? sprintById.get(t.sprint_id) ?? null : null,
  }));

  return { boardName: board.name, columns, cards };
}
