"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addClientRequest, answerClientRequest, reopenClientRequest, setResponseSla } from "../actions";
import { formatDayLabel } from "@/lib/timesheet";

export type RequestRow = {
  id: string;
  askedOn: string;
  description: string;
  answeredOn: string | null;
  note: string | null;
  daysWaiting: number;
  breachedSla: boolean;
};

type Props = {
  boardId: string;
  requests: RequestRow[];
  slaDays: number | null;
  today: string;
};

export function ClientRequests({ boardId, requests, slaDays, today }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Add form
  const [desc, setDesc] = useState("");
  const [askedOn, setAskedOn] = useState(today);
  const [note, setNote] = useState("");

  // SLA
  const [sla, setSla] = useState(slaDays != null ? String(slaDays) : "");

  // Per-row answered-on drafts
  const [answerDate, setAnswerDate] = useState<Record<string, string>>({});

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

  return (
    <>
      {error && (
        <p className="tsheet-error" role="alert">
          {error}
        </p>
      )}

      {/* Kickoff SLA */}
      <div className="slip-sla">
        <label htmlFor="slip-sla-input">Client response SLA (days)</label>
        <input
          id="slip-sla-input"
          type="number"
          min={1}
          value={sla}
          onChange={(e) => setSla(e.target.value)}
          placeholder="e.g. 5"
        />
        <button
          type="button"
          className="admin-btn admin-btn--sm"
          disabled={pending}
          onClick={() =>
            run(() => setResponseSla({ boardId, slaDays: sla.trim() === "" ? null : Number(sla) }))
          }
        >
          Save SLA
        </button>
      </div>

      {/* Add a request */}
      <form
        className="slip-add"
        onSubmit={(e) => {
          e.preventDefault();
          if (!desc.trim()) {
            setError("Describe what was asked of the client.");
            return;
          }
          run(
            () => addClientRequest({ boardId, description: desc, askedOn, note: note.trim() || undefined }),
            () => {
              setDesc("");
              setNote("");
              setAskedOn(today);
            },
          );
        }}
      >
        <div className="slip-add-field slip-add-desc">
          <label htmlFor="slip-desc">Log a client request</label>
          <input
            id="slip-desc"
            type="text"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="e.g. Payroll extract for FY24 Q3"
            maxLength={500}
          />
        </div>
        <div className="slip-add-field">
          <label htmlFor="slip-asked">Asked on</label>
          <input id="slip-asked" type="date" value={askedOn} onChange={(e) => setAskedOn(e.target.value)} />
        </div>
        <div className="slip-add-field slip-add-note">
          <label htmlFor="slip-note">Note (optional)</label>
          <input
            id="slip-note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Context"
            maxLength={500}
          />
        </div>
        <div className="slip-add-field">
          <label>&nbsp;</label>
          <button type="submit" className="admin-btn admin-btn--primary admin-btn--sm" disabled={pending}>
            Add
          </button>
        </div>
      </form>

      {/* Requests list */}
      <div className="slip-reqs">
        {requests.length === 0 ? (
          <p className="sched-flags-clear">No requests logged yet.</p>
        ) : (
          requests.map((r) => {
            const open = r.answeredOn == null;
            return (
              <div key={r.id} className={`slip-req${open ? "" : " is-answered"}`}>
                <div className="slip-req-main">
                  <div className="slip-req-desc">{r.description}</div>
                  <div className="slip-req-meta">
                    Asked {formatDayLabel(r.askedOn)}
                    {open ? (
                      <span className={r.breachedSla ? "slip-badge is-breach" : "slip-badge is-open"}>
                        Open · {r.daysWaiting}d waiting{r.breachedSla ? " · over SLA" : ""}
                      </span>
                    ) : (
                      <span className="slip-badge is-done">
                        Answered {formatDayLabel(r.answeredOn as string)} · {r.daysWaiting}d
                      </span>
                    )}
                  </div>
                  {r.note && <div className="slip-req-note">{r.note}</div>}
                </div>
                <div className="slip-req-actions">
                  {open ? (
                    <>
                      <input
                        type="date"
                        value={answerDate[r.id] ?? today}
                        onChange={(e) => setAnswerDate((m) => ({ ...m, [r.id]: e.target.value }))}
                        aria-label="Answered on"
                      />
                      <button
                        type="button"
                        className="admin-btn admin-btn--sm admin-btn--primary"
                        disabled={pending}
                        onClick={() =>
                          run(() => answerClientRequest({ id: r.id, boardId, answeredOn: answerDate[r.id] ?? today }))
                        }
                      >
                        Mark answered
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="admin-btn admin-btn--sm"
                      disabled={pending}
                      onClick={() => run(() => reopenClientRequest({ id: r.id, boardId }))}
                    >
                      Reopen
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
