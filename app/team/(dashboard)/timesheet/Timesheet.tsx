"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { setCell, deleteRow } from "./actions";
import {
  formatHoursMinutes,
  formatWeekRange,
  isWeekday,
  fromISODate,
  parseHours,
} from "@/lib/timesheet";

export type ProjectOption = { id: string; name: string; clientName: string | null };
export type TaskOption = { id: string; title: string; boardId: string };
export type GridRow = {
  key: string;
  boardId: string | null;
  taskId: string | null;
  billable: boolean;
  projectLabel: string;
  clientName: string | null;
  taskLabel: string;
  hours: Record<string, number>;
};

type Props = {
  weekStart: string;
  days: string[];
  today: string;
  dailyCapacity: number;
  rows: GridRow[];
  projects: ProjectOption[];
  tasks: TaskOption[];
  prevWeekHref: string;
  nextWeekHref: string;
  thisWeekHref: string;
};

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function dayHeader(iso: string): string {
  const d = fromISODate(iso);
  return `${WD[d.getDay()]} ${d.getDate()}`;
}
const cellKey = (rowKey: string, date: string) => `${rowKey}|${date}`;

export function Timesheet({
  weekStart,
  days,
  today,
  dailyCapacity,
  rows,
  projects,
  tasks,
  prevWeekHref,
  nextWeekHref,
  thisWeekHref,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Hours held locally (source of truth for the session), seeded from server.
  const [hours, setHours] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    for (const r of rows) for (const [d, h] of Object.entries(r.hours)) m[cellKey(r.key, d)] = h;
    return m;
  });
  // Draft rows added this session (project/task chosen, not yet persisted).
  const [extraRows, setExtraRows] = useState<GridRow[]>([]);
  const [editing, setEditing] = useState<{ key: string; date: string; value: string } | null>(null);

  // Add-row controls
  const [addProject, setAddProject] = useState<string>("");
  const [addTask, setAddTask] = useState<string>("");
  const [addBillable, setAddBillable] = useState(true);

  const allRows = useMemo(() => {
    const seen = new Set(rows.map((r) => r.key));
    return [...rows, ...extraRows.filter((r) => !seen.has(r.key))];
  }, [rows, extraRows]);

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const hoursFor = (rowKey: string, date: string) => hours[cellKey(rowKey, date)] ?? 0;

  // ── Totals ─────────────────────────────────────────────────────────────
  const perDay = useMemo(() => {
    const bill: Record<string, number> = {};
    const non: Record<string, number> = {};
    for (const d of days) {
      bill[d] = 0;
      non[d] = 0;
    }
    for (const r of allRows) {
      for (const d of days) {
        const h = hoursFor(r.key, d);
        if (!h) continue;
        if (r.billable) bill[d] += h;
        else non[d] += h;
      }
    }
    return { bill, non };
  }, [allRows, days, hours]);

  const capacity = days.reduce((s, d) => s + (isWeekday(d) ? dailyCapacity : 0), 0);
  const billableTotal = days.reduce((s, d) => s + perDay.bill[d], 0);
  const nonBillableTotal = days.reduce((s, d) => s + perDay.non[d], 0);
  const logged = billableTotal + nonBillableTotal;
  const pct = (n: number) => (capacity > 0 ? Math.round((n / capacity) * 1000) / 10 : 0);

  // ── Cell editing ───────────────────────────────────────────────────────
  function openCell(rowKey: string, date: string) {
    const h = hoursFor(rowKey, date);
    setEditing({ key: rowKey, date, value: h ? String(h) : "" });
  }

  function commitCell(row: GridRow) {
    if (!editing) return;
    const { date, value } = editing;
    const prev = hoursFor(row.key, date);
    const parsed = value.trim() === "" ? { hours: 0 } : parseHours(value);
    if ("error" in parsed) {
      setError(parsed.error);
      return;
    }
    const next = parsed.hours;
    setEditing(null);
    if (next === prev) return;
    setHours((m) => ({ ...m, [cellKey(row.key, date)]: next }));
    setError(null);
    startTransition(async () => {
      const res = await setCell({
        boardId: row.boardId,
        taskId: row.taskId,
        billable: row.billable,
        workDate: date,
        hours: next,
      });
      if (!res.ok) {
        setError(res.error);
        setHours((m) => ({ ...m, [cellKey(row.key, date)]: prev })); // revert
      }
    });
  }

  function removeRow(row: GridRow) {
    setError(null);
    setExtraRows((rs) => rs.filter((r) => r.key !== row.key));
    setHours((m) => {
      const copy = { ...m };
      for (const d of days) delete copy[cellKey(row.key, d)];
      return copy;
    });
    startTransition(async () => {
      const res = await deleteRow({
        boardId: row.boardId,
        taskId: row.taskId,
        billable: row.billable,
        weekStart,
      });
      if (!res.ok) setError(res.error);
    });
  }

  function addRow() {
    setError(null);
    const boardId = addProject || null;
    const taskId = addTask || null;
    if (addBillable && !boardId) {
      setError("Billable time needs a project. Pick one, or switch to non-billable.");
      return;
    }
    const key = `${boardId ?? ""}::${taskId ?? ""}::${addBillable ? "1" : "0"}`;
    if (allRows.some((r) => r.key === key)) {
      setAddProject("");
      setAddTask("");
      return; // already present
    }
    const proj = boardId ? projectById.get(boardId) : undefined;
    const task = taskId ? tasks.find((t) => t.id === taskId) : undefined;
    setExtraRows((rs) => [
      ...rs,
      {
        key,
        boardId,
        taskId,
        billable: addBillable,
        projectLabel: proj ? proj.name : "Administration",
        clientName: proj?.clientName ?? null,
        taskLabel: task ? task.title : "General time",
        hours: {},
      },
    ]);
    setAddProject("");
    setAddTask("");
  }

  const addTaskOptions = tasks.filter((t) => t.boardId === addProject);

  return (
    <div className="tg">
      {/* Header */}
      <div className="tg-top">
        <div className="tg-title">
          <h1>Timesheets</h1>
          <div className="tg-weeknav">
            <Link className="tg-navbtn" href={prevWeekHref} aria-label="Previous week">‹</Link>
            <Link className="tg-navbtn" href={nextWeekHref} aria-label="Next week">›</Link>
            <Link className="tg-navbtn tg-today" href={thisWeekHref}>Today</Link>
            <span className="tg-range">{formatWeekRange(weekStart)}</span>
          </div>
        </div>
        <div className="tg-you">You</div>
      </div>

      {/* Summary stats */}
      <div className="tg-stats">
        <div><span className="tg-stat-k">Logged</span><span className="tg-stat-v">{formatHoursMinutes(logged)}</span></div>
        <div><span className="tg-stat-k">Workweek</span><span className="tg-stat-v">{formatHoursMinutes(capacity)}</span></div>
        <div><span className="tg-stat-k">Weekly Utilisation (Net)</span><span className="tg-stat-v">{pct(logged)}%</span></div>
      </div>

      {error && <p className="tsheet-error" role="alert">{error}</p>}

      <div className="tg-wrap">
        <table className="tg-table">
          <colgroup>
            <col className="tg-c-proj" />
            <col className="tg-c-task" />
            {days.map((d) => <col key={d} className="tg-c-day" />)}
            <col className="tg-c-total" />
          </colgroup>
          <thead>
            <tr className="tg-cap">
              <th colSpan={2} className="tg-cap-label">Capacity Breakdown</th>
              {days.map((d) => (
                <th key={d} className="tg-cap-cell">{isWeekday(d) ? formatHoursMinutes(dailyCapacity) : "--"}</th>
              ))}
              <th className="tg-cap-cell">{formatHoursMinutes(capacity)}</th>
            </tr>
            <tr className="tg-cap tg-cap-bill">
              <th colSpan={2} className="tg-cap-label">Billable Utilisation/Wk <b>{pct(billableTotal)}%</b></th>
              {days.map((d) => (
                <th key={d} className="tg-cap-cell">{perDay.bill[d] ? formatHoursMinutes(perDay.bill[d]) : "--"}</th>
              ))}
              <th className="tg-cap-cell">{formatHoursMinutes(billableTotal)}</th>
            </tr>
            <tr className="tg-cap tg-cap-non">
              <th colSpan={2} className="tg-cap-label">Non-Billable Utilisation <b>{pct(nonBillableTotal)}%</b></th>
              {days.map((d) => (
                <th key={d} className="tg-cap-cell">{perDay.non[d] ? formatHoursMinutes(perDay.non[d]) : "--"}</th>
              ))}
              <th className="tg-cap-cell">{formatHoursMinutes(nonBillableTotal)}</th>
            </tr>
            <tr className="tg-colhead">
              <th>Project</th>
              <th>Task</th>
              {days.map((d) => (
                <th key={d} className={d === today ? "is-today" : ""}>{dayHeader(d)}</th>
              ))}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {allRows.length === 0 && (
              <tr>
                <td colSpan={days.length + 3} className="tg-empty">
                  No time logged this week. Add a project below to start.
                </td>
              </tr>
            )}
            {allRows.map((row) => {
              const rowBill = days.reduce((s, d) => s + (row.billable ? hoursFor(row.key, d) : 0), 0);
              const rowNon = days.reduce((s, d) => s + (!row.billable ? hoursFor(row.key, d) : 0), 0);
              return (
                <tr key={row.key}>
                  <td className="tg-proj">
                    <button className="tg-del" onClick={() => removeRow(row)} disabled={pending} aria-label="Remove row">×</button>
                    <span className="tg-proj-name" title={row.clientName ? `${row.clientName} — ${row.projectLabel}` : row.projectLabel}>
                      {row.clientName ? `${row.clientName} — ` : ""}{row.projectLabel}
                    </span>
                  </td>
                  <td className="tg-task">
                    <span className={`tg-dot ${row.billable ? "is-bill" : "is-non"}`} />
                    <span className="tg-task-name">{row.taskLabel}</span>
                  </td>
                  {days.map((d) => {
                    const isEd = editing && editing.key === row.key && editing.date === d;
                    const h = hoursFor(row.key, d);
                    return (
                      <td key={d} className={`tg-cell${d === today ? " is-today" : ""}`}>
                        {isEd ? (
                          <input
                            autoFocus
                            className="tg-cell-input"
                            inputMode="decimal"
                            value={editing!.value}
                            onChange={(e) => setEditing({ key: row.key, date: d, value: e.target.value })}
                            onBlur={() => commitCell(row)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitCell(row);
                              if (e.key === "Escape") setEditing(null);
                            }}
                          />
                        ) : (
                          <button
                            className={`tg-cell-btn${h ? (row.billable ? " is-bill" : " is-non") : ""}`}
                            onClick={() => openCell(row.key, d)}
                            disabled={pending}
                          >
                            {h ? formatHoursMinutes(h) : ""}
                          </button>
                        )}
                      </td>
                    );
                  })}
                  <td className="tg-rowtotal">
                    <span className="is-bill">{formatHoursMinutes(rowBill)}</span>
                    <span className="is-non">{formatHoursMinutes(rowNon)}</span>
                  </td>
                </tr>
              );
            })}

            {/* Add-row control */}
            <tr className="tg-addrow">
              <td className="tg-proj">
                <select value={addProject} onChange={(e) => { setAddProject(e.target.value); setAddTask(""); }} aria-label="Add project">
                  <option value="">Administration (internal)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.clientName ? `${p.clientName} — ${p.name}` : p.name}</option>
                  ))}
                </select>
              </td>
              <td className="tg-task">
                <select value={addTask} onChange={(e) => setAddTask(e.target.value)} disabled={!addProject || addTaskOptions.length === 0} aria-label="Add task">
                  <option value="">General time</option>
                  {addTaskOptions.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
              </td>
              <td colSpan={days.length} className="tg-add-billable">
                <button
                  type="button"
                  className={`tg-toggle${addBillable ? " is-on" : ""}`}
                  onClick={() => setAddBillable((b) => !b)}
                  aria-pressed={addBillable}
                >
                  {addBillable ? "Billable" : "Non-billable"}
                </button>
              </td>
              <td className="tg-rowtotal">
                <button type="button" className="admin-btn admin-btn--sm admin-btn--primary" onClick={addRow} disabled={pending}>
                  + Add
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="tg-foot">
        Click a cell to log hours (decimal — <code>1.5</code> = 1h 30m). Billable time books to a project;
        internal time goes under Administration. Capacity is a flat {formatHoursMinutes(dailyCapacity)}/weekday.
      </p>
    </div>
  );
}
