"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { logTime, updateTimeEntry, deleteTimeEntry } from "./actions";
import { formatDayLabel, formatHours, HOURS_STEP } from "@/lib/timesheet";

export type ProjectOption = { id: string; name: string; clientName: string | null };

export type EntryRow = {
  id: string;
  workDate: string;
  boardId: string | null;
  projectName: string;
  clientName: string | null;
  hours: number;
  billable: boolean;
  note: string | null;
};

type Props = {
  weekStart: string;
  days: string[];
  today: string;
  rows: EntryRow[];
  projects: ProjectOption[];
  prevWeekHref: string;
  nextWeekHref: string;
  thisWeekHref: string;
};

function projectLabel(p: ProjectOption): string {
  return p.clientName ? `${p.clientName} — ${p.name}` : p.name;
}

export function Timesheet({
  weekStart,
  days,
  today,
  rows,
  projects,
  prevWeekHref,
  nextWeekHref,
  thisWeekHref,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // The quick-entry form. Date defaults to today when the current week is in
  // view, otherwise the first day of the week being viewed.
  const defaultDate = days.includes(today) ? today : days[0];
  const [date, setDate] = useState(defaultDate);
  const [projectId, setProjectId] = useState("");
  const [hours, setHours] = useState("");
  const [billable, setBillable] = useState(true);
  const [note, setNote] = useState("");
  const hoursRef = useRef<HTMLInputElement>(null);

  const dayTotals = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.workDate, (m.get(r.workDate) ?? 0) + r.hours);
    return m;
  }, [rows]);

  function submitLog() {
    setError(null);
    if (!hours.trim()) {
      setError("Enter how many hours.");
      hoursRef.current?.focus();
      return;
    }
    startTransition(async () => {
      const res = await logTime({
        workDate: date,
        boardId: projectId || null,
        hours,
        billable,
        note: note.trim() || undefined,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // Keep date + project + billable for fast repeated logging; clear the
      // per-entry fields and return focus to hours.
      setHours("");
      setNote("");
      router.refresh();
      hoursRef.current?.focus();
    });
  }

  const hasProjects = projects.length > 0;

  return (
    <div className="tsheet">
      {/* Week navigation */}
      <div className="tsheet-weeknav">
        <Link className="admin-btn admin-btn--sm" href={prevWeekHref} aria-label="Previous week">
          ‹ Prev
        </Link>
        <Link className="admin-btn admin-btn--sm" href={thisWeekHref}>
          This week
        </Link>
        <Link className="admin-btn admin-btn--sm" href={nextWeekHref} aria-label="Next week">
          Next ›
        </Link>
      </div>

      {/* Day chips — click to target the quick-entry form at that day */}
      <div className="tsheet-daychips" role="group" aria-label="Pick a day">
        {days.map((d) => {
          const total = dayTotals.get(d) ?? 0;
          const isSel = d === date;
          const isToday = d === today;
          return (
            <button
              key={d}
              type="button"
              className={
                "tsheet-daychip" +
                (isSel ? " is-selected" : "") +
                (isToday ? " is-today" : "")
              }
              onClick={() => setDate(d)}
              aria-pressed={isSel}
            >
              <span className="tsheet-daychip-label">{formatDayLabel(d)}</span>
              <span className="tsheet-daychip-total">{total ? `${formatHours(total)}h` : "—"}</span>
            </button>
          );
        })}
      </div>

      {/* Quick-entry form — the under-10-second logging path */}
      <form
        className="tsheet-form"
        onSubmit={(e) => {
          e.preventDefault();
          submitLog();
        }}
      >
        <div className="tsheet-form-field tsheet-form-project">
          <label htmlFor="ts-project">Project</label>
          <select
            id="ts-project"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            disabled={!hasProjects}
          >
            <option value="">{hasProjects ? "Internal / non-billable" : "No projects assigned"}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {projectLabel(p)}
              </option>
            ))}
          </select>
        </div>

        <div className="tsheet-form-field tsheet-form-hours">
          <label htmlFor="ts-hours">Hours</label>
          <input
            id="ts-hours"
            ref={hoursRef}
            type="number"
            inputMode="decimal"
            step={HOURS_STEP}
            min={0}
            max={24}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder="0.0"
            autoComplete="off"
          />
        </div>

        <div className="tsheet-form-field tsheet-form-billable">
          <label htmlFor="ts-billable">Billable</label>
          <button
            id="ts-billable"
            type="button"
            className={"tsheet-toggle" + (billable ? " is-on" : "")}
            onClick={() => setBillable((b) => !b)}
            aria-pressed={billable}
          >
            {billable ? "Billable" : "Non-billable"}
          </button>
        </div>

        <div className="tsheet-form-field tsheet-form-note">
          <label htmlFor="ts-note">Note (optional)</label>
          <input
            id="ts-note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What did you work on?"
            autoComplete="off"
            maxLength={500}
          />
        </div>

        <div className="tsheet-form-field tsheet-form-submit">
          <button type="submit" className="admin-btn admin-btn--primary" disabled={pending}>
            {pending ? "Logging…" : "Log"}
          </button>
        </div>
      </form>

      {error && (
        <p className="tsheet-error" role="alert">
          {error}
        </p>
      )}

      {/* Entries, grouped by day */}
      <div className="tsheet-entries">
        {rows.length === 0 ? (
          <p className="tsheet-empty">No hours logged this week yet. Add your first entry above.</p>
        ) : (
          days
            .map((d) => ({ day: d, entries: rows.filter((r) => r.workDate === d) }))
            .filter((g) => g.entries.length > 0)
            .map((g) => (
              <div key={g.day} className="tsheet-daygroup">
                <div className="tsheet-daygroup-head">
                  <span>{formatDayLabel(g.day)}</span>
                  <span className="tsheet-daygroup-total">
                    {formatHours(g.entries.reduce((s, r) => s + r.hours, 0))}h
                  </span>
                </div>
                <div className="tsheet-rowlist">
                  {g.entries.map((r) => (
                    <EntryLine key={r.id} row={r} pending={pending} startTransition={startTransition} onDone={() => { setError(null); router.refresh(); }} onError={setError} />
                  ))}
                </div>
              </div>
            ))
        )}
      </div>
    </div>
  );
}

function EntryLine({
  row,
  pending,
  startTransition,
  onDone,
  onError,
}: {
  row: EntryRow;
  pending: boolean;
  startTransition: (cb: () => void) => void;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [hours, setHours] = useState(String(row.hours));
  const [billable, setBillable] = useState(row.billable);
  const [note, setNote] = useState(row.note ?? "");

  function save() {
    startTransition(async () => {
      const res = await updateTimeEntry({ id: row.id, hours, billable, note: note.trim() || undefined });
      if (!res.ok) {
        onError(res.error);
        return;
      }
      setEditing(false);
      onDone();
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteTimeEntry({ id: row.id });
      if (!res.ok) {
        onError(res.error);
        return;
      }
      onDone();
    });
  }

  if (editing) {
    return (
      <div className="tsheet-row tsheet-row--editing">
        <div className="tsheet-row-main">
          <span className="tsheet-row-project">{row.projectName}</span>
          {row.clientName && <span className="tsheet-row-client">{row.clientName}</span>}
        </div>
        <input
          className="tsheet-row-hoursinput"
          type="number"
          step={HOURS_STEP}
          min={0}
          max={24}
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          aria-label="Hours"
        />
        <button
          type="button"
          className={"tsheet-toggle tsheet-toggle--sm" + (billable ? " is-on" : "")}
          onClick={() => setBillable((b) => !b)}
          aria-pressed={billable}
        >
          {billable ? "Billable" : "Non-bill."}
        </button>
        <input
          className="tsheet-row-noteinput"
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note"
          maxLength={500}
          aria-label="Note"
        />
        <div className="tsheet-row-actions">
          <button type="button" className="admin-btn admin-btn--sm admin-btn--primary" onClick={save} disabled={pending}>
            Save
          </button>
          <button type="button" className="admin-btn admin-btn--sm" onClick={() => setEditing(false)} disabled={pending}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="tsheet-row">
      <div className="tsheet-row-main">
        <span className="tsheet-row-project">{row.projectName}</span>
        {row.clientName && <span className="tsheet-row-client">{row.clientName}</span>}
        {row.note && <span className="tsheet-row-note">{row.note}</span>}
      </div>
      <span className={"tsheet-pill" + (row.billable ? " is-billable" : "")}>
        {row.billable ? "Billable" : "Internal"}
      </span>
      <span className="tsheet-row-hours">{formatHours(row.hours)}h</span>
      <div className="tsheet-row-actions">
        <button type="button" className="admin-btn admin-btn--sm" onClick={() => setEditing(true)} disabled={pending}>
          Edit
        </button>
        <button type="button" className="admin-btn admin-btn--sm admin-btn--danger" onClick={remove} disabled={pending}>
          Delete
        </button>
      </div>
    </div>
  );
}
