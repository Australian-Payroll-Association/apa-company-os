import { requireTeamMember } from "@/lib/team-auth";
import { teamRead } from "@/lib/team/data";
import { getMyBoardSummaries } from "@/lib/team/boards";
import { PageHead } from "@/components/admin/PageHead";
import { MetricCard } from "@/components/admin/MetricCard";
import {
  STANDARD_WEEK_HOURS,
  todayISO,
  weekStartISO,
  weekDays,
  shiftWeek,
  isValidISODate,
  formatWeekRange,
  formatHours,
} from "@/lib/timesheet";
import { Timesheet, type EntryRow, type ProjectOption } from "./Timesheet";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Timesheet",
  description: "Log your hours in seconds, by project.",
};

type RawEntry = {
  id: string;
  work_date: string;
  board_id: string | null;
  hours: number;
  billable: boolean;
  note: string | null;
};

// /team/timesheet — own-service only. Every read is scoped to the actor's own
// person_id by teamRead; board_id references are resolved to names from the
// actor's own board list (getMyBoardSummaries), never a broad boards read.
export default async function TimesheetPage({
  searchParams,
}: {
  searchParams?: { week?: string };
}) {
  const actor = await requireTeamMember();

  const weekParam = searchParams?.week;
  const weekStart =
    weekParam && isValidISODate(weekParam) ? weekStartISO(weekParam) : weekStartISO(todayISO());
  const days = weekDays(weekStart);

  const [boards, entriesRes] = await Promise.all([
    getMyBoardSummaries(actor),
    teamRead(actor, "time_entry", "id, work_date, board_id, hours, billable, note")
      .gte("work_date", days[0])
      .lte("work_date", days[6])
      .order("work_date", { ascending: true }),
  ]);

  const projects: ProjectOption[] = boards.map((b) => ({
    id: b.id,
    name: b.name,
    clientName: b.clientName,
  }));
  const projectById = new Map(projects.map((p) => [p.id, p]));

  const raw = (entriesRes.data ?? []) as unknown as RawEntry[];
  const rows: EntryRow[] = raw.map((r) => {
    const p = r.board_id ? projectById.get(r.board_id) : undefined;
    return {
      id: r.id,
      workDate: r.work_date,
      boardId: r.board_id,
      projectName: p ? p.name : r.board_id ? "Unknown project" : "Internal",
      clientName: p?.clientName ?? null,
      hours: Number(r.hours),
      billable: r.billable,
      note: r.note,
    };
  });

  const weekTotal = rows.reduce((s, r) => s + r.hours, 0);
  const billableTotal = rows.reduce((s, r) => s + (r.billable ? r.hours : 0), 0);
  const nonBillableTotal = weekTotal - billableTotal;
  const utilisationPct =
    STANDARD_WEEK_HOURS > 0 ? Math.round((billableTotal / STANDARD_WEEK_HOURS) * 100) : 0;

  return (
    <div>
      <PageHead
        eyebrow="My Work"
        title="Timesheet"
        sub={`Week of ${formatWeekRange(weekStart)}`}
      />

      <div className="mp-kpi-grid">
        <MetricCard
          label="Logged this week"
          value={`${formatHours(weekTotal)}h`}
          sub={`of ${STANDARD_WEEK_HOURS}h standard week`}
        />
        <MetricCard
          label="Billable"
          value={`${formatHours(billableTotal)}h`}
          sub={`${utilisationPct}% utilisation`}
        />
        <MetricCard
          label="Non-billable"
          value={`${formatHours(nonBillableTotal)}h`}
          sub="Internal, meetings, dev"
        />
      </div>

      <Timesheet
        weekStart={weekStart}
        days={days}
        today={todayISO()}
        rows={rows}
        projects={projects}
        prevWeekHref={`/team/timesheet?week=${shiftWeek(weekStart, -1)}`}
        nextWeekHref={`/team/timesheet?week=${shiftWeek(weekStart, 1)}`}
        thisWeekHref="/team/timesheet"
      />
    </div>
  );
}
