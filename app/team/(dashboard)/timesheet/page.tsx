import { requireTeamMember } from "@/lib/team-auth";
import { teamRead } from "@/lib/team/data";
import { getMyBoardSummaries } from "@/lib/team/boards";
import { getBoardTasks } from "@/lib/team/boards";
import {
  todayISO,
  weekStartISO,
  weekDays,
  shiftWeek,
  isValidISODate,
  DAILY_CAPACITY_HOURS,
} from "@/lib/timesheet";
import { Timesheet, type GridRow, type ProjectOption, type TaskOption } from "./Timesheet";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Timesheets",
  description: "Log your week by project and task.",
};

type RawEntry = {
  board_id: string | null;
  task_id: string | null;
  billable: boolean;
  work_date: string;
  hours: number;
};

// /team/timesheet — own-service weekly grid. Reads are scoped to the actor's
// own person_id; project/task labels come only from the actor's own boards.
export default async function TimesheetPage({
  searchParams,
}: {
  searchParams?: { week?: string };
}) {
  const actor = await requireTeamMember();

  const week = searchParams?.week;
  const weekStart = week && isValidISODate(week) ? weekStartISO(week) : weekStartISO(todayISO());
  const days = weekDays(weekStart);

  const boards = await getMyBoardSummaries(actor);
  const boardIds = boards.map((b) => b.id);
  const [tasks, entriesRes] = await Promise.all([
    getBoardTasks(boardIds),
    teamRead(actor, "time_entry", "board_id, task_id, billable, work_date, hours")
      .gte("work_date", days[0])
      .lte("work_date", days[6]),
  ]);

  const projects: ProjectOption[] = boards.map((b) => ({
    id: b.id,
    name: b.name,
    clientName: b.clientName,
  }));
  const projectById = new Map(projects.map((p) => [p.id, p]));

  const taskOptions: TaskOption[] = tasks.map((t) => ({ id: t.id, title: t.title, boardId: t.boardId }));
  const taskById = new Map(taskOptions.map((t) => [t.id, t]));

  // Group entries into rows keyed by (board, task, billable); sum per day.
  const rowMap = new Map<string, GridRow>();
  for (const e of (entriesRes.data ?? []) as unknown as RawEntry[]) {
    const boardId = e.board_id ?? null;
    const taskId = e.task_id ?? null;
    const key = `${boardId ?? ""}::${taskId ?? ""}::${e.billable ? "1" : "0"}`;
    let row = rowMap.get(key);
    if (!row) {
      const proj = boardId ? projectById.get(boardId) : undefined;
      const task = taskId ? taskById.get(taskId) : undefined;
      row = {
        key,
        boardId,
        taskId,
        billable: e.billable,
        projectLabel: proj ? proj.name : boardId ? "Unknown project" : "Administration",
        clientName: proj?.clientName ?? null,
        taskLabel: task ? task.title : "General time",
        hours: {},
      };
      rowMap.set(key, row);
    }
    row.hours[e.work_date] = (row.hours[e.work_date] ?? 0) + Number(e.hours);
  }

  // Stable row order: project label, then task label, billable first.
  const rows = Array.from(rowMap.values()).sort(
    (a, b) =>
      a.projectLabel.localeCompare(b.projectLabel) ||
      a.taskLabel.localeCompare(b.taskLabel) ||
      Number(b.billable) - Number(a.billable),
  );

  return (
    <Timesheet
      weekStart={weekStart}
      days={days}
      today={todayISO()}
      dailyCapacity={DAILY_CAPACITY_HOURS}
      rows={rows}
      projects={projects}
      tasks={taskOptions}
      prevWeekHref={`/team/timesheet?week=${shiftWeek(weekStart, -1)}`}
      nextWeekHref={`/team/timesheet?week=${shiftWeek(weekStart, 1)}`}
      thisWeekHref="/team/timesheet"
    />
  );
}
