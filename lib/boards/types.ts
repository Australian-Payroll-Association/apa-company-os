// Shared, framework-agnostic constants + types for Task Boards.
// Safe to import from server and client components (no server-only deps).
// Data lives in company_os.boards / board_columns / board_members / sprints /
// tasks / task_stage_log. Admin manages boards; team members see boards they
// belong to; a client sees the board linked to their company (read-only).

export const TASK_PRIORITIES = ["p1", "p2", "p3"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  p1: "P1",
  p2: "P2",
  p3: "P3",
};

// Tone maps onto the shared <Badge> component (ok/warn/err/info/neutral).
export const PRIORITY_TONE: Record<TaskPriority, "err" | "warn" | "neutral"> = {
  p1: "err",
  p2: "warn",
  p3: "neutral",
};

export const TASK_STATUSES = ["open", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const BOARD_STATUSES = ["active", "archived"] as const;
export type BoardStatus = (typeof BOARD_STATUSES)[number];

export const SPRINT_STATUSES = ["active", "closed"] as const;
export type SprintStatus = (typeof SPRINT_STATUSES)[number];

// The link slot (tasks.subject_type). One link per card: a coaching commitment
// OR a client roadmap item, never both.
export const SUBJECT_COMMITMENT = "coaching_commitment";
export const SUBJECT_BACKLOG_ITEM = "client_backlog_item";

// A card sitting in one column longer than this shows an amber "aging" clock.
export const AGING_DAYS = 7;

// Every board seeds with these four columns; they can be renamed/reordered later.
export const DEFAULT_COLUMNS: Array<{ name: string; is_done: boolean }> = [
  { name: "To do", is_done: false },
  { name: "Doing", is_done: false },
  { name: "Waiting", is_done: false },
  { name: "Done", is_done: true },
];

export type BoardRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  client_company_id: string | null;
  owner_id: string | null;
  status: BoardStatus;
  sort_order: number;
};

export const BOARD_SELECT =
  "id, name, slug, description, client_company_id, owner_id, status, sort_order";

export type BoardColumnRow = {
  id: string;
  board_id: string;
  name: string;
  position: number;
  is_done: boolean;
};

export const BOARD_COLUMN_SELECT = "id, board_id, name, position, is_done";

export type BoardMemberRow = {
  id: string;
  board_id: string;
  person_id: string;
  role: string;
};

export const BOARD_MEMBER_SELECT = "id, board_id, person_id, role";

export type SprintRow = {
  id: string;
  board_id: string;
  name: string;
  goal: string | null;
  starts_on: string | null;
  ends_on: string | null;
  status: SprintStatus;
  sort_order: number;
};

export const SPRINT_SELECT =
  "id, board_id, name, goal, starts_on, ends_on, status, sort_order";

export type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  board_id: string | null;
  board_column_id: string | null;
  sprint_id: string | null;
  position: number;
  assignee_id: string | null;
  created_by: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  completed_at: string | null;
  internal: boolean;
  subject_type: string | null;
  subject_id: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export const TASK_SELECT =
  "id, title, description, board_id, board_column_id, sprint_id, position, assignee_id, created_by, status, priority, due_date, completed_at, internal, subject_type, subject_id, archived_at, created_at, updated_at";

// Whole days a card has sat in its current column, given the last move time.
export function daysInColumn(since: string | null | undefined, now: Date = new Date()): number {
  if (!since) return 0;
  const then = new Date(since).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((now.getTime() - then) / 86_400_000));
}
