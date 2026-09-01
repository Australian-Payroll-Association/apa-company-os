"use server";

import { revalidatePath } from "next/cache";
import { requireTeamMember } from "@/lib/team-auth";
import { teamInsertOwn, teamRead, teamDeleteInScope } from "@/lib/team/data";
import { getMyBoardSummaries } from "@/lib/team/boards";
import { parseHours, isValidISODate, weekDays } from "@/lib/timesheet";

// Grid timesheet actions for /team. A "cell" is one (project, task, billable,
// day). Writing a cell replaces whatever was there with a single entry, so the
// grid stays the source of truth for that day's hours on that row. Every write
// funnels through the scoped helpers, which force person_id = actor.personId.

type Result = { ok: true } | { ok: false; error: string };

function refresh() {
  revalidatePath("/team/timesheet");
}

async function allowedBoardIds(
  actor: Awaited<ReturnType<typeof requireTeamMember>>,
): Promise<Set<string>> {
  const boards = await getMyBoardSummaries(actor);
  return new Set(boards.map((b) => b.id));
}

// Scope a time_entry query to one row's (board, task, billable) identity.
function rowFilter<T extends { eq: (c: string, v: unknown) => T; is: (c: string, v: null) => T }>(
  q: T,
  boardId: string | null,
  taskId: string | null,
  billable: boolean,
): T {
  let out = boardId ? q.eq("board_id", boardId) : q.is("board_id", null);
  out = taskId ? out.eq("task_id", taskId) : out.is("task_id", null);
  return out.eq("billable", billable);
}

export async function setCell(input: {
  boardId: string | null;
  taskId: string | null;
  billable: boolean;
  workDate: string;
  hours: number | string;
}): Promise<Result> {
  const actor = await requireTeamMember();

  if (!isValidISODate(input.workDate)) return { ok: false, error: "Bad date." };
  const boardId = input.boardId || null;
  const taskId = input.taskId || null;
  if (boardId) {
    const allowed = await allowedBoardIds(actor);
    if (!allowed.has(boardId)) return { ok: false, error: "That project isn't one of yours." };
  }
  if (input.billable && !boardId) {
    return { ok: false, error: "Billable time needs a project." };
  }

  // Empty / zero clears the cell.
  const raw = typeof input.hours === "string" ? input.hours.trim() : input.hours;
  const clearing = raw === "" || Number(raw) === 0;
  let hours = 0;
  if (!clearing) {
    const parsed = parseHours(raw);
    if ("error" in parsed) return { ok: false, error: parsed.error };
    hours = parsed.hours;
  }

  // Replace the cell: delete existing entries for this (board, task, billable, day),
  // preserving any note, then insert one if hours > 0.
  const existing = await rowFilter(
    teamRead(actor, "time_entry", "id, note"),
    boardId,
    taskId,
    input.billable,
  ).eq("work_date", input.workDate);
  const rows = (existing.data ?? []) as unknown as { id: string; note: string | null }[];
  const keptNote = rows.find((r) => r.note)?.note ?? null;

  for (const r of rows) {
    const del = await teamDeleteInScope(actor, "time_entry", r.id);
    if (!del.ok) return { ok: false, error: del.error ?? "Could not update the cell." };
  }

  if (hours > 0) {
    const { error } = await teamInsertOwn(actor, "time_entry", {
      board_id: boardId,
      task_id: taskId,
      billable: !!input.billable,
      hours,
      work_date: input.workDate,
      note: keptNote,
    });
    if (error) return { ok: false, error };
  }

  refresh();
  return { ok: true };
}

export async function deleteRow(input: {
  boardId: string | null;
  taskId: string | null;
  billable: boolean;
  weekStart: string;
}): Promise<Result> {
  const actor = await requireTeamMember();
  if (!isValidISODate(input.weekStart)) return { ok: false, error: "Bad week." };
  const days = weekDays(input.weekStart);

  const existing = await rowFilter(
    teamRead(actor, "time_entry", "id"),
    input.boardId || null,
    input.taskId || null,
    input.billable,
  )
    .gte("work_date", days[0])
    .lte("work_date", days[6]);

  for (const r of (existing.data ?? []) as unknown as { id: string }[]) {
    const del = await teamDeleteInScope(actor, "time_entry", r.id);
    if (!del.ok) return { ok: false, error: del.error ?? "Could not remove the row." };
  }

  refresh();
  return { ok: true };
}
