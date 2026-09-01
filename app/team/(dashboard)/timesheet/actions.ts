"use server";

import { revalidatePath } from "next/cache";
import { requireTeamMember } from "@/lib/team-auth";
import { teamInsertOwn, teamUpdateInScope, teamDeleteInScope } from "@/lib/team/data";
import { getMyBoardSummaries } from "@/lib/team/boards";
import { parseHours, isValidISODate } from "@/lib/timesheet";

// Own-service timesheet actions for /team. Every write goes through the scoped
// helpers in lib/team/data.ts, which force person_id = actor.personId — a member
// can only ever log, edit, or delete their OWN entries. board_id is the one
// client-supplied reference, so it is validated against the actor's own boards
// before use (never trust a passed id as authorization).

type Result = { ok: true } | { ok: false; error: string };
type LogResult = { ok: true; id: string } | { ok: false; error: string };

function refresh() {
  revalidatePath("/team/timesheet");
}

const MAX_NOTE = 500;

function cleanNote(raw: unknown): string | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return null;
  return s.slice(0, MAX_NOTE);
}

// The boards this actor may log against — their board memberships plus their
// client-company assignments. Returns the id set for validation.
async function allowedBoardIds(
  actor: Awaited<ReturnType<typeof requireTeamMember>>,
): Promise<Set<string>> {
  const boards = await getMyBoardSummaries(actor);
  return new Set(boards.map((b) => b.id));
}

export async function logTime(input: {
  workDate: string;
  boardId: string | null;
  hours: number | string;
  billable: boolean;
  note?: string;
}): Promise<LogResult> {
  const actor = await requireTeamMember();

  if (!isValidISODate(input.workDate)) return { ok: false, error: "Pick a valid date." };

  const parsed = parseHours(input.hours);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  // Billable time books against a client project; internal time need not.
  let boardId = input.boardId || null;
  if (boardId) {
    const allowed = await allowedBoardIds(actor);
    if (!allowed.has(boardId)) return { ok: false, error: "That project isn't one of yours." };
  }
  if (input.billable && !boardId) {
    return { ok: false, error: "Billable time needs a project. Pick one, or mark it non-billable." };
  }

  const { data, error } = await teamInsertOwn(actor, "time_entry", {
    work_date: input.workDate,
    board_id: boardId,
    hours: parsed.hours,
    billable: !!input.billable,
    note: cleanNote(input.note),
  });
  if (error || !data) return { ok: false, error: error ?? "Could not save that entry." };

  refresh();
  return { ok: true, id: data.id };
}

export async function updateTimeEntry(input: {
  id: string;
  hours: number | string;
  billable: boolean;
  note?: string;
}): Promise<Result> {
  const actor = await requireTeamMember();
  if (!input.id) return { ok: false, error: "Missing entry." };

  const parsed = parseHours(input.hours);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  // teamUpdateInScope re-derives ownership from the id before writing; a member
  // can only ever patch a row whose person_id is their own.
  const res = await teamUpdateInScope(actor, "time_entry", input.id, {
    hours: parsed.hours,
    billable: !!input.billable,
    note: cleanNote(input.note),
  });
  if (!res.ok) return { ok: false, error: res.error ?? "Could not update that entry." };

  refresh();
  return { ok: true };
}

export async function deleteTimeEntry(input: { id: string }): Promise<Result> {
  const actor = await requireTeamMember();
  if (!input.id) return { ok: false, error: "Missing entry." };

  const res = await teamDeleteInScope(actor, "time_entry", input.id);
  if (!res.ok) return { ok: false, error: res.error ?? "Could not delete that entry." };

  refresh();
  return { ok: true };
}
