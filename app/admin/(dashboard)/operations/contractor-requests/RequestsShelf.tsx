"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useTransition,
  type MouseEvent,
  type ReactNode,
} from "react";
import { DetailDrawer } from "@/components/admin/DetailDrawer";
import { Badge } from "@/components/admin/Badge";
import { formatDate, humanize, timeAgo } from "@/lib/admin/format";
import {
  WORK_REQUEST_STATUS_LABEL,
  workRequestTone,
  workRequestPath,
  formatHours,
  type WorkRequestStatus,
} from "@/lib/admin/contractors";
import { onePerson, type RequestEventRow, type RequestRow } from "./request-shared";
import { cancelWorkRequest, decideEstimate, decideWork, listRequestEvents, sendWorkRequest } from "./actions";

const ShelfContext = createContext<{ open: (row: RequestRow) => void } | null>(null);

export function RequestsShelfProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<RequestRow | null>(null);

  return (
    <ShelfContext.Provider value={{ open: setSelected }}>
      {children}
      <DetailDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        eyebrow="Work request"
        title={selected?.title ?? ""}
      >
        {selected && <RequestShelfBody row={selected} onClose={() => setSelected(null)} />}
      </DetailDrawer>
    </ShelfContext.Provider>
  );
}

export function RequestShelfRow({ row, children }: { row: RequestRow; children: ReactNode }) {
  const ctx = useContext(ShelfContext);

  function hitsInnerInteractive(e: { target: EventTarget; currentTarget: HTMLTableRowElement }) {
    const hit = (e.target as HTMLElement).closest("a,button,input,select,label,[role=button]");
    return !!hit && hit !== e.currentTarget;
  }

  function onClick(e: MouseEvent<HTMLTableRowElement>) {
    if (hitsInnerInteractive(e)) return;
    ctx?.open(row);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTableRowElement>) {
    if (e.key === "Enter" || e.key === " ") {
      if (hitsInnerInteractive(e)) return;
      e.preventDefault();
      ctx?.open(row);
    }
  }

  return (
    <tr className="is-clickable" onClick={onClick} onKeyDown={onKeyDown} tabIndex={0} role="button" aria-haspopup="dialog">
      {children}
    </tr>
  );
}

function kv(label: string, value: ReactNode) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

// One decision button that reveals a note box before confirming. Used for
// approve/reject/request-changes and accept/revision so every decision can
// carry a note to the contractor.
function DecisionAction({
  label,
  primary,
  requireNote,
  placeholder,
  onConfirm,
  onDone,
}: {
  label: string;
  primary?: boolean;
  requireNote?: boolean;
  placeholder: string;
  onConfirm: (note: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  onDone: () => void;
}) {
  const [openNote, setOpenNote] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    setError(null);
    startTransition(async () => {
      const r = await onConfirm(note);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setOpenNote(false);
      setNote("");
      onDone();
    });
  }

  if (!openNote) {
    return (
      <button type="button" className={primary ? "admin-btn admin-btn--primary" : "admin-btn"} onClick={() => setOpenNote(true)}>
        {label}
      </button>
    );
  }

  return (
    <div style={{ display: "grid", gap: 8, width: "100%" }}>
      <textarea
        rows={3}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={placeholder}
        autoFocus
      />
      {error && <div className="admin-alert admin-alert--err">{error}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          className={primary ? "admin-btn admin-btn--primary" : "admin-btn"}
          onClick={run}
          disabled={pending || (requireNote && !note.trim())}
        >
          {pending ? "Working…" : `Confirm ${label.toLowerCase()}`}
        </button>
        <button type="button" className="admin-btn" onClick={() => setOpenNote(false)} disabled={pending}>
          Cancel
        </button>
      </div>
    </div>
  );
}

const EVENT_LABEL: Record<string, string> = {
  created: "Request created",
  estimate_submitted: "Estimate submitted",
  estimate_resubmitted: "Estimate resubmitted",
  approved: "Estimate approved",
  rejected: "Request rejected",
  info_requested: "Changes requested",
  work_submitted: "Work submitted",
  accepted: "Work accepted",
  message: "Note",
  cancelled: "Cancelled",
};

function RequestShelfBody({ row, onClose }: { row: RequestRow; onClose: () => void }) {
  const router = useRouter();
  const [events, setEvents] = useState<RequestEventRow[] | null>(null);
  const person = onePerson(row.people);

  useEffect(() => {
    setEvents(null);
    let live = true;
    listRequestEvents(row.id).then((e) => {
      if (live) setEvents(e);
    });
    return () => {
      live = false;
    };
  }, [row.id]);

  function done() {
    onClose();
    router.refresh();
  }

  const status = row.status as WorkRequestStatus;
  const open = !["rejected", "cancelled", "completed"].includes(status);

  return (
    <div className="admin-shelf-sections">
      <section>
        <div className="admin-shelf-heading">Details</div>
        <dl className="admin-kv">
          {kv("Contractor", person?.full_name || person?.email)}
          {kv("Status", <Badge tone={workRequestTone(status)}>{WORK_REQUEST_STATUS_LABEL[status] ?? status}</Badge>)}
          {kv("Created", `${formatDate(row.created_at)} by ${row.created_by}`)}
          {kv(
            "Contractor link",
            <a href={workRequestPath(row.access_token)} target="_blank" rel="noreferrer">
              {workRequestPath(row.access_token)}
            </a>,
          )}
          {kv("Paid in", row.payment_id ? "Linked to a monthly payment" : null)}
        </dl>
      </section>

      <section>
        <div className="admin-shelf-heading">Brief</div>
        <div style={{ whiteSpace: "pre-wrap", fontSize: 13.5 }}>{row.brief}</div>
      </section>

      {row.estimated_hours !== null && (
        <section>
          <div className="admin-shelf-heading">Estimate</div>
          <dl className="admin-kv">
            {kv("Estimated hours", formatHours(row.estimated_hours))}
            {kv("Submitted", timeAgo(row.estimate_submitted_at))}
          </dl>
          {row.plan_text && <div style={{ whiteSpace: "pre-wrap", fontSize: 13.5, marginTop: 8 }}>{row.plan_text}</div>}
        </section>
      )}

      {row.work_submitted_at && (
        <section>
          <div className="admin-shelf-heading">Submitted work</div>
          <dl className="admin-kv">
            {kv("Actual hours", formatHours(row.actual_hours))}
            {kv("Overtime hours", formatHours(row.actual_overtime_hours))}
            {kv(
              "Link",
              row.work_link && (
                <a href={row.work_link} target="_blank" rel="noreferrer">
                  {row.work_link}
                </a>
              ),
            )}
            {kv("Submitted", timeAgo(row.work_submitted_at))}
          </dl>
          {row.work_summary && (
            <div style={{ whiteSpace: "pre-wrap", fontSize: 13.5, marginTop: 8 }}>{row.work_summary}</div>
          )}
        </section>
      )}

      {(status === "estimate_submitted" || status === "work_submitted" || status === "draft" || open) && (
        <section>
          <div className="admin-shelf-heading">Actions</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {status === "draft" && (
              <DecisionAction
                label="Send to contractor"
                primary
                placeholder="Optional note (not emailed)"
                onConfirm={() => sendWorkRequest(row.id)}
                onDone={done}
              />
            )}
            {status === "awaiting_estimate" && (
              <DecisionAction
                label="Resend email"
                placeholder="Optional note (not emailed)"
                onConfirm={() => sendWorkRequest(row.id)}
                onDone={done}
              />
            )}
            {status === "estimate_submitted" && (
              <>
                <DecisionAction
                  label="Approve"
                  primary
                  placeholder="Optional note to the contractor"
                  onConfirm={(note) => decideEstimate(row.id, "approved", note)}
                  onDone={done}
                />
                <DecisionAction
                  label="Request changes"
                  requireNote
                  placeholder="What needs to change? (emailed to the contractor)"
                  onConfirm={(note) => decideEstimate(row.id, "changes_requested", note)}
                  onDone={done}
                />
                <DecisionAction
                  label="Reject"
                  requireNote
                  placeholder="Why is this not going ahead? (emailed to the contractor)"
                  onConfirm={(note) => decideEstimate(row.id, "rejected", note)}
                  onDone={done}
                />
              </>
            )}
            {status === "work_submitted" && (
              <>
                <DecisionAction
                  label="Accept work"
                  primary
                  placeholder="Optional note to the contractor"
                  onConfirm={(note) => decideWork(row.id, "accepted", note)}
                  onDone={done}
                />
                <DecisionAction
                  label="Request revision"
                  requireNote
                  placeholder="What needs revising? (emailed to the contractor)"
                  onConfirm={(note) => decideWork(row.id, "revision", note)}
                  onDone={done}
                />
              </>
            )}
            {open && (
              <DecisionAction
                label="Cancel request"
                placeholder="Optional reason (emailed to the contractor)"
                onConfirm={(note) => cancelWorkRequest(row.id, note)}
                onDone={done}
              />
            )}
          </div>
        </section>
      )}

      <section>
        <div className="admin-shelf-heading">Timeline</div>
        {events === null ? (
          <div className="admin-cell-muted">Loading…</div>
        ) : events.length === 0 ? (
          <div className="admin-cell-muted">No events.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {events.map((e) => (
              <div key={e.id} style={{ fontSize: 13 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                  <strong>{EVENT_LABEL[e.type] ?? humanize(e.type)}</strong>
                  <span className="admin-cell-muted">
                    {e.actor || humanize(e.actor_type)} · {timeAgo(e.created_at)}
                  </span>
                </div>
                {e.body && <div style={{ whiteSpace: "pre-wrap", marginTop: 2 }}>{e.body}</div>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
