// A team member's boards and cross-board task list. Scope source:
// company_os.board_members for THIS actor's person id. Admins see every board.
// Every read is filtered to the actor server-side, never from a passed id —
// getBoardForActor returning null IS the authorization for /team/boards/[slug].

import { companyOs } from "@/lib/supabase";
import type { TeamActor } from "@/lib/team-auth";
import { getBoardBySlug, type BoardDetail } from "@/lib/boards/data";
import { type TaskPriority } from "@/lib/boards/types";
import { OPEN_COMMITMENT_STATUSES, type CommitmentStatus } from "@/lib/coaching/data";

export type ActorBoard = { id: string; slug: string; name: string };

// Boards this actor may open: their memberships, or all active boards for admins.
export async function getActorBoards(actor: TeamActor): Promise<ActorBoard[]> {
  if (actor.isAdmin) {
    const { data } = await companyOs
      .from("boards")
      .select("id, slug, name")
      .eq("status", "active")
      .is("archived_at", null)
      .order("sort_order");
    return (data ?? []) as ActorBoard[];
  }
  const { data: mem } = await companyOs
    .from("board_members")
    .select("board_id")
    .eq("person_id", actor.personId);
  const ids = ((mem ?? []) as { board_id: string }[]).map((m) => m.board_id);
  if (ids.length === 0) return [];
  const { data } = await companyOs
    .from("boards")
    .select("id, slug, name")
    .in("id", ids)
    .eq("status", "active")
    .is("archived_at", null)
    .order("sort_order");
  return (data ?? []) as ActorBoard[];
}

// Full board detail iff the actor is a member (or admin). Null otherwise.
export async function getBoardForActor(actor: TeamActor, slug: string): Promise<BoardDetail | null> {
  const detail = await getBoardBySlug(slug);
  if (!detail) return null;
  if (actor.isAdmin) return detail;
  const { data } = await companyOs
    .from("board_members")
    .select("id")
    .eq("board_id", detail.board.id)
    .eq("person_id", actor.personId)
    .maybeSingle();
  return data ? detail : null;
}

export type MyTask = {
  id: string;
  title: string;
  priority: TaskPriority;
  dueDate: string | null;
  boardSlug: string;
  boardName: string;
  columnName: string;
  doneColumnId: string | null;
};

export type MyCommitmentLine = {
  id: string;
  title: string;
  status: CommitmentStatus;
  dueOn: string | null;
};

export type MyWork = { tasks: MyTask[]; commitments: MyCommitmentLine[] };

export async function getMyWork(actor: TeamActor): Promise<MyWork> {
  const { data: taskData } = await companyOs
    .from("tasks")
    .select("id, title, priority, due_date, board_id, board_column_id")
    .eq("assignee_id", actor.personId)
    .neq("status", "done")
    .is("archived_at", null);
  const rows = (taskData ?? []) as {
    id: string;
    title: string;
    priority: TaskPriority;
    due_date: string | null;
    board_id: string | null;
    board_column_id: string | null;
  }[];

  let tasks: MyTask[] = [];
  if (rows.length) {
    const boardIds = [...new Set(rows.map((r) => r.board_id).filter(Boolean) as string[])];
    const [boardsRes, colsRes] = await Promise.all([
      companyOs.from("boards").select("id, slug, name").in("id", boardIds),
      companyOs.from("board_columns").select("id, board_id, name, is_done").in("board_id", boardIds),
    ]);
    const bmap = new Map(
      (boardsRes.data ?? []).map((b) => [b.id, b as { id: string; slug: string; name: string }]),
    );
    const colName = new Map<string, string>();
    const doneCol = new Map<string, string>();
    for (const c of (colsRes.data ?? []) as { id: string; board_id: string; name: string; is_done: boolean }[]) {
      colName.set(c.id, c.name);
      if (c.is_done && !doneCol.has(c.board_id)) doneCol.set(c.board_id, c.id);
    }
    tasks = rows
      .filter((r) => r.board_id && bmap.has(r.board_id))
      .map((r) => {
        const b = bmap.get(r.board_id as string)!;
        return {
          id: r.id,
          title: r.title,
          priority: r.priority,
          dueDate: r.due_date,
          boardSlug: b.slug,
          boardName: b.name,
          columnName: r.board_column_id ? colName.get(r.board_column_id) ?? "" : "",
          doneColumnId: doneCol.get(r.board_id as string) ?? null,
        };
      })
      .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
  }

  // The member's own open coaching commitments (member tier: their profile).
  let commitments: MyCommitmentLine[] = [];
  const { data: prof } = await companyOs
    .from("coaching_profiles")
    .select("id")
    .eq("team_member_id", actor.teamMemberId)
    .maybeSingle();
  const profileId = (prof as { id: string } | null)?.id;
  if (profileId) {
    const { data: cs } = await companyOs
      .from("coaching_commitments")
      .select("id, title, status, due_on")
      .eq("coaching_profile_id", profileId)
      .in("status", OPEN_COMMITMENT_STATUSES as unknown as string[])
      .order("sort_order");
    commitments = ((cs ?? []) as { id: string; title: string; status: CommitmentStatus; due_on: string | null }[]).map(
      (c) => ({ id: c.id, title: c.title, status: c.status, dueOn: c.due_on }),
    );
  }

  return { tasks, commitments };
}
