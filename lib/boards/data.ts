// Server-only reads for Task Boards. All access is via the service-role
// companyOs client (company_os has RLS on with no policies), so callers that
// need scoping (team/portal) must filter themselves; these admin reads are
// unscoped by design.

import { companyOs } from "@/lib/supabase";
import {
  BOARD_SELECT,
  BOARD_COLUMN_SELECT,
  SPRINT_SELECT,
  TASK_SELECT,
  SUBJECT_COMMITMENT,
  SUBJECT_BACKLOG_ITEM,
  SOURCE_AGENT,
  type BoardRow,
  type BoardColumnRow,
  type SprintRow,
  type TaskRow,
} from "./types";

export type BoardListItem = BoardRow & {
  client_name: string | null;
  member_count: number;
  open_count: number;
};

export type BoardPerson = { id: string; name: string };
export type BacklogRef = { id: string; title: string };

export type BoardCard = TaskRow & {
  assignee_name: string | null;
  subject_label: string | null; // commitment title or roadmap item title
  agent: boolean; // filed by a scheduled routine (metadata.source === 'agent')
  last_moved_at: string; // latest column-move, else created_at (drives aging)
};

export type BoardDetail = {
  board: BoardRow & { client_name: string | null };
  columns: BoardColumnRow[];
  members: BoardPerson[];
  sprints: SprintRow[];
  cards: BoardCard[];
  backlogItems: BacklogRef[]; // client board's roadmap items, for the link picker
};

function personName(p: { display_name: string | null; full_name: string | null; email: string }): string {
  return p.display_name || p.full_name || p.email;
}

// All boards for the admin index, ordered, with client name + light counts.
export async function listBoards(): Promise<BoardListItem[]> {
  const { data: boards } = await companyOs
    .from("boards")
    .select(BOARD_SELECT)
    .is("archived_at", null)
    .order("sort_order");
  const rows = (boards ?? []) as BoardRow[];
  if (rows.length === 0) return [];

  const companyIds = [...new Set(rows.map((b) => b.client_company_id).filter(Boolean))] as string[];
  const boardIds = rows.map((b) => b.id);

  const [companiesRes, membersRes, tasksRes] = await Promise.all([
    companyIds.length
      ? companyOs.from("companies").select("id, name").in("id", companyIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    companyOs.from("board_members").select("board_id, person_id").in("board_id", boardIds),
    companyOs.from("tasks").select("board_id, status").in("board_id", boardIds).is("archived_at", null),
  ]);

  const companyName = new Map((companiesRes.data ?? []).map((c) => [c.id, c.name]));
  const memberCount = new Map<string, number>();
  for (const m of (membersRes.data ?? []) as { board_id: string }[]) {
    memberCount.set(m.board_id, (memberCount.get(m.board_id) ?? 0) + 1);
  }
  const openCount = new Map<string, number>();
  for (const t of (tasksRes.data ?? []) as { board_id: string; status: string }[]) {
    if (t.status !== "done") openCount.set(t.board_id, (openCount.get(t.board_id) ?? 0) + 1);
  }

  return rows.map((b) => ({
    ...b,
    client_name: b.client_company_id ? companyName.get(b.client_company_id) ?? null : null,
    member_count: memberCount.get(b.id) ?? 0,
    open_count: openCount.get(b.id) ?? 0,
  }));
}

// Light list for pickers (e.g. push a commitment to a board).
export async function listActiveBoards(): Promise<{ id: string; slug: string; name: string }[]> {
  const { data } = await companyOs
    .from("boards")
    .select("id, slug, name")
    .eq("status", "active")
    .is("archived_at", null)
    .order("sort_order");
  return (data ?? []) as { id: string; slug: string; name: string }[];
}

// Full board for /admin/boards/[slug] and (reused, scoped) team/portal views.
export async function getBoardBySlug(slug: string): Promise<BoardDetail | null> {
  const { data: boardData } = await companyOs
    .from("boards")
    .select(BOARD_SELECT)
    .eq("slug", slug)
    .is("archived_at", null)
    .maybeSingle();
  if (!boardData) return null;
  const board = boardData as BoardRow;

  const [columnsRes, membersRes, sprintsRes, tasksRes] = await Promise.all([
    companyOs.from("board_columns").select(BOARD_COLUMN_SELECT).eq("board_id", board.id).order("position"),
    companyOs.from("board_members").select("person_id, role").eq("board_id", board.id),
    companyOs
      .from("sprints")
      .select(SPRINT_SELECT)
      .eq("board_id", board.id)
      .order("sort_order")
      .order("starts_on", { ascending: false }),
    companyOs
      .from("tasks")
      .select(TASK_SELECT)
      .eq("board_id", board.id)
      .is("archived_at", null)
      .order("position"),
  ]);

  const columns = (columnsRes.data ?? []) as BoardColumnRow[];
  const memberRows = (membersRes.data ?? []) as { person_id: string; role: string }[];
  const sprints = (sprintsRes.data ?? []) as SprintRow[];
  const tasks = (tasksRes.data ?? []) as TaskRow[];

  // People: board members plus any assignee (an assignee might not be a member yet).
  const personIds = [
    ...new Set([
      ...memberRows.map((m) => m.person_id),
      ...(tasks.map((t) => t.assignee_id).filter(Boolean) as string[]),
    ]),
  ];
  const peopleRes = personIds.length
    ? await companyOs.from("people").select("id, display_name, full_name, email").in("id", personIds)
    : { data: [] as { id: string; display_name: string | null; full_name: string | null; email: string }[] };
  const nameById = new Map((peopleRes.data ?? []).map((p) => [p.id, personName(p)]));

  // Subject labels: coaching commitments and client roadmap items linked to cards.
  const commitmentIds = tasks
    .filter((t) => t.subject_type === SUBJECT_COMMITMENT && t.subject_id)
    .map((t) => t.subject_id as string);
  const backlogIds = tasks
    .filter((t) => t.subject_type === SUBJECT_BACKLOG_ITEM && t.subject_id)
    .map((t) => t.subject_id as string);
  const subjectLabel = new Map<string, string>();
  if (commitmentIds.length) {
    const { data } = await companyOs.from("coaching_commitments").select("id, title").in("id", commitmentIds);
    for (const r of (data ?? []) as { id: string; title: string }[]) subjectLabel.set(r.id, r.title);
  }
  if (backlogIds.length) {
    const { data } = await companyOs.from("client_backlog_items").select("id, title").in("id", backlogIds);
    for (const r of (data ?? []) as { id: string; title: string }[]) subjectLabel.set(r.id, r.title);
  }

  // Client name + roadmap items (for the link picker) on a client-linked board.
  let client_name: string | null = null;
  let backlogItems: BacklogRef[] = [];
  if (board.client_company_id) {
    const [{ data: co }, { data: bl }] = await Promise.all([
      companyOs.from("companies").select("name").eq("id", board.client_company_id).maybeSingle(),
      companyOs
        .from("client_backlog_items")
        .select("id, title")
        .eq("company_id", board.client_company_id)
        .is("archived_at", null)
        .order("sort_order"),
    ]);
    client_name = (co as { name: string } | null)?.name ?? null;
    backlogItems = (bl ?? []) as BacklogRef[];
  }

  // Latest column-move per card, for the days-in-column clock.
  const taskIds = tasks.map((t) => t.id);
  const lastMove = new Map<string, string>();
  if (taskIds.length) {
    const { data: logs } = await companyOs
      .from("task_stage_log")
      .select("task_id, moved_at, kind")
      .in("task_id", taskIds)
      .eq("kind", "move")
      .order("moved_at", { ascending: false });
    for (const l of (logs ?? []) as { task_id: string; moved_at: string }[]) {
      if (!lastMove.has(l.task_id)) lastMove.set(l.task_id, l.moved_at);
    }
  }

  const cards: BoardCard[] = tasks.map((t) => ({
    ...t,
    assignee_name: t.assignee_id ? nameById.get(t.assignee_id) ?? null : null,
    subject_label: t.subject_id ? subjectLabel.get(t.subject_id) ?? null : null,
    agent: (t.metadata as { source?: string } | null)?.source === SOURCE_AGENT,
    last_moved_at: lastMove.get(t.id) ?? t.created_at,
  }));

  const members: BoardPerson[] = memberRows
    .map((m) => ({ id: m.person_id, name: nameById.get(m.person_id) ?? "Unknown" }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { board: { ...board, client_name }, columns, members, sprints, cards, backlogItems };
}
