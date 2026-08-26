// Portal-facing AI Program hub loaders (Client Hub by AI Program, portal PR).
// Same discipline as the other lib/portal helpers: every read is scoped to the
// actor's own companyScope and cross-company ids resolve to null (IDOR guard).
//
// CLIENT-SAFE HARD LINE: these loaders return program name + counts + PR
// TITLES only. Repo org/name, author logins, PR URLs/numbers, and sync details
// never leave this module; the shapes below simply do not carry them.
//
// The aggregation itself (delivered hours, weekly buckets, roadmap rollups)
// lives in lib/hub/program.ts, shared with the admin Client Hub; this module
// only applies the portal scope and strips to client-safe fields.

import { companyOs, htt } from "@/lib/supabase";
import type { PortalActor } from "@/lib/portal-auth";
import { listProgramSummaries, type ProgramStatus } from "@/lib/hub/program";
import type { ClientBoardColumn, ClientBoardCard } from "@/lib/boards/client-view";

export type PortalProgramSummary = {
  id: string;
  companyId: string;
  name: string;
  status: ProgramStatus;
  // One line derived from the program plan's 5Ds brief; null when no plan
  // brief exists yet.
  description: string | null;
  // True when delivery tracking is connected. The repo itself is internal;
  // only this boolean crosses to the portal.
  hasRepo: boolean;
  deliveredHours: number;
  prsMergedLast7d: number;
  roadmapDone: number;
  roadmapTotal: number;
  boardCount: number;
};

// Strip a brief's HTML down to one readable line. Headings and short label
// lines ("Dream", "AI Program Brief") are skipped; the first substantial text
// run wins, capped at a word boundary.
const MAX_DESCRIPTION = 160;
export function briefToOneLine(html: string): string | null {
  const text = html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(h1|h2|h3|h4)[\s\S]*?<\/\1>/gi, "\n")
    .replace(/<(p|div|li|br|tr)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"');
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (line.length < 30) continue; // heading or label, not a description
    if (line.length <= MAX_DESCRIPTION) return line;
    const cut = line.slice(0, MAX_DESCRIPTION);
    return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 100))}…`;
  }
  return null;
}

export async function listPortalProgramSummaries(actor: PortalActor): Promise<PortalProgramSummary[]> {
  if (actor.companyScope.length === 0) return [];
  const perCompany = await Promise.all(
    actor.companyScope.map(async (companyId) => ({
      companyId,
      summaries: await listProgramSummaries(companyId),
    })),
  );
  const rows = perCompany.flatMap(({ companyId, summaries }) =>
    summaries.map((s) => ({ companyId, s })),
  );
  if (rows.length === 0) return [];

  // First chat-plan brief per program feeds the one-line description.
  const { data: planData } = await companyOs
    .from("program_plans")
    .select("ai_program_id, brief_html")
    .in("ai_program_id", rows.map((r) => r.s.id))
    .eq("method", "chat")
    .not("brief_html", "is", null)
    .order("created_at", { ascending: true });
  const briefByProgram = new Map<string, string>();
  for (const p of (planData ?? []) as Array<{ ai_program_id: string; brief_html: string }>) {
    if (!briefByProgram.has(p.ai_program_id)) briefByProgram.set(p.ai_program_id, p.brief_html);
  }

  return rows.map(({ companyId, s }) => ({
    id: s.id,
    companyId,
    name: s.name,
    status: s.status,
    description: briefByProgram.has(s.id) ? briefToOneLine(briefByProgram.get(s.id) as string) : null,
    hasRepo: !!s.repoId,
    deliveredHours: s.deliveredHours,
    prsMergedLast7d: s.prsMergedLast7d,
    roadmapDone: s.roadmapDone,
    roadmapTotal: s.roadmapTotal,
    boardCount: s.boardCount,
  }));
}

// ── Boards ───────────────────────────────────────────────────────────────

export type PortalHubBoard = {
  id: string;
  name: string;
  slug: string;
  aiProgramId: string | null;
};

// Every active board for the actor's companies, with its program tag, so the
// hub can pick the first UNTAGGED one and the program page its own boards.
export async function listHubBoardsForActor(actor: PortalActor): Promise<PortalHubBoard[]> {
  if (actor.companyScope.length === 0) return [];
  const { data } = await companyOs
    .from("boards")
    .select("id, name, slug, ai_program_id")
    .in("client_company_id", actor.companyScope)
    .eq("status", "active")
    .is("archived_at", null)
    .order("sort_order", { ascending: true });
  return ((data ?? []) as Array<{ id: string; name: string; slug: string; ai_program_id: string | null }>).map(
    (b) => ({ id: b.id, name: b.name, slug: b.slug, aiProgramId: b.ai_program_id }),
  );
}

export type PortalBoardView = {
  boardName: string;
  columns: ClientBoardColumn[];
  cards: ClientBoardCard[];
};

// One specific board's client-visible slice, by id. Mirrors the queries and
// PRIVACY HARD LINE of lib/boards/client-view.ts getClientBoardView (only
// non-internal, non-archived, top-level cards; explicit safe columns), which
// only supports "first board of the company" and so cannot serve a chosen
// board. Keep the two in lockstep; folding this into client-view.ts is a
// follow-up once the parallel team-mirror branch lands.
export async function getBoardViewForActor(actor: PortalActor, boardId: string): Promise<PortalBoardView | null> {
  if (actor.companyScope.length === 0) return null;
  const { data: boardRow } = await companyOs
    .from("boards")
    .select("id, name")
    .eq("id", boardId)
    .in("client_company_id", actor.companyScope)
    .eq("status", "active")
    .is("archived_at", null)
    .maybeSingle();
  if (!boardRow) return null;
  const board = boardRow as { id: string; name: string };

  const [colsRes, tasksRes] = await Promise.all([
    companyOs.from("board_columns").select("id, name, is_done").eq("board_id", board.id).order("position"),
    companyOs
      .from("tasks")
      .select("id, title, priority, due_date, status, board_column_id, assignee_id, sprint_id, created_at")
      .eq("board_id", board.id)
      .eq("internal", false)
      .is("parent_task_id", null)
      .is("archived_at", null)
      .order("position"),
  ]);

  const columns: ClientBoardColumn[] = ((colsRes.data ?? []) as { id: string; name: string; is_done: boolean }[]).map(
    (c) => ({ id: c.id, name: c.name, isDone: c.is_done }),
  );
  const tasks = (tasksRes.data ?? []) as {
    id: string;
    title: string;
    priority: ClientBoardCard["priority"];
    due_date: string | null;
    status: string;
    board_column_id: string | null;
    assignee_id: string | null;
    sprint_id: string | null;
    created_at: string;
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

  const cards: ClientBoardCard[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    priority: t.priority,
    dueDate: t.due_date,
    columnId: t.board_column_id,
    done: t.status === "done",
    assigneeId: t.assignee_id,
    assigneeName: t.assignee_id ? nameById.get(t.assignee_id) ?? null : null,
    sprintName: t.sprint_id ? sprintById.get(t.sprint_id) ?? null : null,
    createdAt: t.created_at,
  }));

  return { boardName: board.name, columns, cards };
}

// ── Shipped highlights ───────────────────────────────────────────────────

export type ProgramHighlightWeek = {
  isoWeek: string; // "2026-W34"
  titles: string[];
};

// ISO week label, same convention as lib/hub/program.ts.
function isoWeekLabel(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

const HIGHLIGHT_WEEKS = 8;
const HIGHLIGHT_CAP = 300; // plenty for 8 weeks; keeps the query bounded

// The latest merged PR TITLES for a program's repo, grouped by ISO week,
// newest week first. Titles only: no numbers, URLs, or author logins. The
// caller passes a repoId it already resolved through a scope-checked program.
export async function getProgramHighlights(repoId: string): Promise<ProgramHighlightWeek[]> {
  const since = new Date(Date.now() - HIGHLIGHT_WEEKS * 7 * 86_400_000).toISOString();
  const { data } = await htt
    .from("pull_requests")
    .select("title, merged_at")
    .eq("repo_id", repoId)
    .eq("state", "merged")
    .gte("merged_at", since)
    .order("merged_at", { ascending: false })
    .limit(HIGHLIGHT_CAP);
  const rows = (data ?? []) as Array<{ title: string; merged_at: string }>;

  const weeks: ProgramHighlightWeek[] = [];
  const byWeek = new Map<string, string[]>();
  for (const r of rows) {
    const label = isoWeekLabel(new Date(r.merged_at));
    let bucket = byWeek.get(label);
    if (!bucket) {
      bucket = [];
      byWeek.set(label, bucket);
      weeks.push({ isoWeek: label, titles: bucket });
    }
    bucket.push(r.title);
  }
  return weeks;
}
