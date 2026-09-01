"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAllocation, updateAllocation, removeAllocation } from "./actions";

export type PersonOption = { teamMemberId: string; name: string };
export type ProjectOption = { boardId: string; name: string; clientName: string | null };
export type DealOption = { id: string; title: string };
export type AllocationRow = {
  id: string;
  personName: string;
  projectName: string;
  clientName: string | null;
  hours: number;
  scheduleStatus: "confirmed" | "tentative";
  startDate: string | null;
  endDate: string | null;
  dealTitle: string | null;
  sourceDealId: string | null;
};

type Props = {
  allocations: AllocationRow[];
  people: PersonOption[];
  projects: ProjectOption[];
  deals: DealOption[];
};

function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function isoPlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  const mn = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1];
  return `${d} ${mn} ${String(y).slice(2)}`;
}
const fmtHours = (h: number) => `${Number(h.toFixed(2))}h/wk`;

export function Allocations({ allocations, people, projects, deals }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Add form
  const [person, setPerson] = useState("");
  const [project, setProject] = useState("");
  const [hours, setHours] = useState("");
  const [status, setStatus] = useState<"confirmed" | "tentative">("confirmed");
  const [start, setStart] = useState(isoToday());
  const [end, setEnd] = useState(isoPlusDays(42));
  const [deal, setDeal] = useState("");

  // Editing
  const [editId, setEditId] = useState<string | null>(null);
  const [eHours, setEHours] = useState("");
  const [eStatus, setEStatus] = useState<"confirmed" | "tentative">("confirmed");
  const [eStart, setEStart] = useState("");
  const [eEnd, setEEnd] = useState("");
  const [eDeal, setEDeal] = useState("");

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      after?.();
      router.refresh();
    });
  }

  function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!person) return setError("Pick a person.");
    if (!project) return setError("Pick a project.");
    if (!hours.trim()) return setError("Enter weekly hours.");
    run(
      () =>
        createAllocation({
          teamMemberId: person,
          boardId: project,
          allocationHours: hours,
          scheduleStatus: status,
          startDate: start,
          endDate: end,
          sourceDealId: status === "tentative" ? deal || null : null,
        }),
      () => {
        setPerson("");
        setProject("");
        setHours("");
        setDeal("");
        setStatus("confirmed");
      },
    );
  }

  function beginEdit(a: AllocationRow) {
    setEditId(a.id);
    setEHours(String(a.hours));
    setEStatus(a.scheduleStatus);
    setEStart(a.startDate ?? isoToday());
    setEEnd(a.endDate ?? isoPlusDays(42));
    setEDeal(a.sourceDealId ?? "");
    setError(null);
  }

  function saveEdit() {
    if (!editId) return;
    run(
      () =>
        updateAllocation({
          id: editId,
          allocationHours: eHours,
          scheduleStatus: eStatus,
          startDate: eStart,
          endDate: eEnd,
          sourceDealId: eStatus === "tentative" ? eDeal || null : null,
        }),
      () => setEditId(null),
    );
  }

  return (
    <>
      {error && <p className="tsheet-error" role="alert">{error}</p>}

      {/* Add allocation */}
      <form className="alloc-add" onSubmit={submitAdd}>
        <div className="alloc-field alloc-grow">
          <label htmlFor="al-person">Person</label>
          <select id="al-person" value={person} onChange={(e) => setPerson(e.target.value)}>
            <option value="">Select…</option>
            {people.map((p) => <option key={p.teamMemberId} value={p.teamMemberId}>{p.name}</option>)}
          </select>
        </div>
        <div className="alloc-field alloc-grow">
          <label htmlFor="al-project">Project</label>
          <select id="al-project" value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="">Select…</option>
            {projects.map((p) => (
              <option key={p.boardId} value={p.boardId}>{p.clientName ? `${p.clientName} — ${p.name}` : p.name}</option>
            ))}
          </select>
        </div>
        <div className="alloc-field alloc-hours">
          <label htmlFor="al-hours">Hours/wk</label>
          <input id="al-hours" type="number" step={0.25} min={0} max={60} value={hours} onChange={(e) => setHours(e.target.value)} placeholder="20" />
        </div>
        <div className="alloc-field">
          <label htmlFor="al-status">Status</label>
          <button
            id="al-status"
            type="button"
            className={`alloc-statustoggle is-${status}`}
            onClick={() => setStatus((s) => (s === "confirmed" ? "tentative" : "confirmed"))}
            aria-pressed={status === "tentative"}
          >
            {status === "confirmed" ? "Confirmed" : "Tentative"}
          </button>
        </div>
        <div className="alloc-field">
          <label htmlFor="al-start">Start</label>
          <input id="al-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="alloc-field">
          <label htmlFor="al-end">End</label>
          <input id="al-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        {status === "tentative" && (
          <div className="alloc-field alloc-grow">
            <label htmlFor="al-deal">From deal (forecast)</label>
            <select id="al-deal" value={deal} onChange={(e) => setDeal(e.target.value)}>
              <option value="">None</option>
              {deals.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
            </select>
          </div>
        )}
        <div className="alloc-field alloc-submit">
          <label>&nbsp;</label>
          <button type="submit" className="admin-btn admin-btn--primary admin-btn--sm" disabled={pending}>+ Allocate</button>
        </div>
      </form>

      {/* Existing allocations */}
      <div className="sched-tablewrap" style={{ marginTop: 20 }}>
        <table className="sched-table alloc-table">
          <thead>
            <tr>
              <th className="sched-name-h">Person</th>
              <th>Project</th>
              <th>Hours/wk</th>
              <th>Status</th>
              <th>Period</th>
              <th>Forecast deal</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {allocations.length === 0 ? (
              <tr><td colSpan={7} className="tg-empty">No allocations yet. Book someone onto a project above.</td></tr>
            ) : (
              allocations.map((a) =>
                editId === a.id ? (
                  <tr key={a.id} className="alloc-editing">
                    <td className="sched-name">{a.personName}</td>
                    <td>{a.clientName ? `${a.clientName} — ` : ""}{a.projectName}</td>
                    <td><input className="alloc-inline-num" type="number" step={0.25} min={0} max={60} value={eHours} onChange={(e) => setEHours(e.target.value)} /></td>
                    <td>
                      <button type="button" className={`alloc-statustoggle alloc-statustoggle--sm is-${eStatus}`} onClick={() => setEStatus((s) => (s === "confirmed" ? "tentative" : "confirmed"))}>
                        {eStatus === "confirmed" ? "Confirmed" : "Tentative"}
                      </button>
                    </td>
                    <td className="alloc-period-edit">
                      <input type="date" value={eStart} onChange={(e) => setEStart(e.target.value)} />
                      <input type="date" value={eEnd} onChange={(e) => setEEnd(e.target.value)} />
                    </td>
                    <td>
                      {eStatus === "tentative" ? (
                        <select value={eDeal} onChange={(e) => setEDeal(e.target.value)} className="alloc-inline-deal">
                          <option value="">None</option>
                          {deals.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
                        </select>
                      ) : "—"}
                    </td>
                    <td className="alloc-actions">
                      <button className="admin-btn admin-btn--sm admin-btn--primary" onClick={saveEdit} disabled={pending}>Save</button>
                      <button className="admin-btn admin-btn--sm" onClick={() => setEditId(null)} disabled={pending}>Cancel</button>
                    </td>
                  </tr>
                ) : (
                  <tr key={a.id}>
                    <td className="sched-name">{a.personName}</td>
                    <td>{a.clientName ? <span className="alloc-client">{a.clientName}</span> : null}{a.projectName}</td>
                    <td className="alloc-num">{fmtHours(a.hours)}</td>
                    <td><span className={`alloc-badge is-${a.scheduleStatus}`}>{a.scheduleStatus === "confirmed" ? "Confirmed" : "Tentative"}</span></td>
                    <td className="alloc-num">{fmtDate(a.startDate)} – {fmtDate(a.endDate)}</td>
                    <td>{a.dealTitle ?? "—"}</td>
                    <td className="alloc-actions">
                      <button className="admin-btn admin-btn--sm" onClick={() => beginEdit(a)} disabled={pending}>Edit</button>
                      <button className="admin-btn admin-btn--sm admin-btn--danger" onClick={() => run(() => removeAllocation({ id: a.id }))} disabled={pending}>Remove</button>
                    </td>
                  </tr>
                ),
              )
            )}
          </tbody>
        </table>
      </div>

      <p className="sched-foot" style={{ marginTop: 14 }}>
        One allocation per person per client (the schema's rule). Hours are weekly; the schedule spreads them
        across the allocation's date range. Tentative allocations don't show to clients and, when linked to a deal,
        drive the probability-weighted forecast line.
      </p>
    </>
  );
}
