import { notFound } from "next/navigation";
import { requirePortalMember } from "@/lib/portal-auth";
import { isPortalAdmin } from "@/lib/portal/roles";
import { getWorkRequestForActor } from "@/lib/portal/work-requests";
import { PageHead } from "@/components/admin/PageHead";
import { Badge } from "@/components/admin/Badge";
import { formatDate, humanize, timeAgo } from "@/lib/admin/format";
import {
  WORK_REQUEST_STATUS_LABEL,
  workRequestTone,
  formatHours,
  type WorkRequestStatus,
} from "@/lib/admin/contractors";
import { DecisionPanel } from "./DecisionPanel";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Project Request",
  description: "Review your project request.",
};

// Client-friendly timeline labels (the raw event types are workflow-speak).
const EVENT_LABEL: Record<string, string> = {
  created: "Request sent",
  estimate_submitted: "Estimate received",
  estimate_resubmitted: "Updated estimate received",
  approved: "Estimate approved",
  rejected: "Request declined",
  info_requested: "Changes requested",
  scope_added: "You added scope",
  work_submitted: "Work delivered",
  accepted: "Work accepted",
  message: "Update",
  cancelled: "Cancelled",
};

export default async function PortalRequestDetailPage({ params }: { params: { id: string } }) {
  const actor = await requirePortalMember();
  const data = await getWorkRequestForActor(actor, params.id);
  if (!data) notFound();
  const { request: r, events } = data;
  const status = r.status as WorkRequestStatus;
  // Estimate/work decisions are admin-only (PR 2 roles); the server re-checks.
  const canDecide = r.clientCompanyId ? isPortalAdmin(actor, r.clientCompanyId) : false;

  return (
    <>
      <PageHead
        eyebrow="Client Portal · Requests"
        title={r.title}
        sub={`${r.contractorName ?? "Contractor"} · requested ${formatDate(r.createdAt)}`}
        action={<Badge tone={workRequestTone(status)}>{WORK_REQUEST_STATUS_LABEL[status] ?? humanize(status)}</Badge>}
      />

      <div className="admin-card admin-section-card" style={{ marginBottom: 16 }}>
        <h2 className="admin-card-title" style={{ marginBottom: 10 }}>Brief</h2>
        <div style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>{r.brief}</div>
      </div>

      {r.estimatedHours !== null && (
        <div className="admin-card admin-section-card" style={{ marginBottom: 16 }}>
          <h2 className="admin-card-title" style={{ marginBottom: 10 }}>
            Estimate — {formatHours(r.estimatedHours)}
          </h2>
          {r.planText && <div style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>{r.planText}</div>}
          {r.estimateSubmittedAt && (
            <div className="admin-cell-muted" style={{ marginTop: 8, fontSize: 12 }}>
              Submitted {timeAgo(r.estimateSubmittedAt)}
            </div>
          )}
        </div>
      )}

      {r.workSubmittedAt && (
        <div className="admin-card admin-section-card" style={{ marginBottom: 16 }}>
          <h2 className="admin-card-title" style={{ marginBottom: 10 }}>
            Delivered work — {formatHours(r.actualHours)}
            {Number(r.actualOvertimeHours) > 0 && ` (+ ${formatHours(r.actualOvertimeHours)} overtime)`}
          </h2>
          {r.workSummary && <div style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>{r.workSummary}</div>}
          {r.workLink && (
            <p style={{ marginTop: 8, marginBottom: 0, fontSize: 13 }}>
              <a href={r.workLink} target="_blank" rel="noreferrer">
                View the result
              </a>
            </p>
          )}
          <div className="admin-cell-muted" style={{ marginTop: 8, fontSize: 12 }}>
            Delivered {timeAgo(r.workSubmittedAt)}
          </div>
        </div>
      )}

      {canDecide && <DecisionPanel id={r.id} status={status} />}

      <div className="admin-card admin-section-card" style={{ marginTop: 16 }}>
        <h2 className="admin-card-title" style={{ marginBottom: 10 }}>Timeline</h2>
        {events.length === 0 ? (
          <div className="admin-empty">No activity yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {events.map((e) => (
              <div key={e.id} style={{ fontSize: 13 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                  <strong>{EVENT_LABEL[e.type] ?? humanize(e.type)}</strong>
                  <span className="admin-cell-muted">
                    {e.actorType === "client" ? "You" : e.actorType === "contractor" ? r.contractorName ?? "Contractor" : "Edge8"} ·{" "}
                    {timeAgo(e.createdAt)}
                  </span>
                </div>
                {e.body && <div style={{ whiteSpace: "pre-wrap", marginTop: 2 }}>{e.body}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
