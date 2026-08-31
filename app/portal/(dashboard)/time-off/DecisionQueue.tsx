"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/admin/format";
import { LEAVE_TYPE_LABEL, type LeaveType } from "@/lib/admin/time-off";
import type { PortalDecisionRequest } from "@/lib/portal/time-off";
import { decideMyTeamTimeOff } from "./actions";

// "Needs your decision" — rendered only when the signed-in person is named as
// client manager on at least one active placement, and listing only the people
// those placements cover. Everyone else on the client side never sees this
// section, and never sees a reason.
export function DecisionQueue({ requests }: { requests: PortalDecisionRequest[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [banner, setBanner] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  function decide(id: string, decision: "approved" | "rejected", name: string) {
    if (decision === "rejected" && !window.confirm(`Decline ${name}'s request?`)) return;
    setBanner(null);
    startTransition(async () => {
      const res = await decideMyTeamTimeOff(id, decision);
      if (res.ok) {
        setBanner({
          tone: "ok",
          text: decision === "approved" ? `Approved ${name}'s leave.` : `Declined ${name}'s request.`,
        });
        router.refresh();
      } else {
        setBanner({ tone: "err", text: res.error });
      }
    });
  }

  return (
    <div className="admin-card admin-section-card admin-card--attention">
      <h2 className="admin-card-title">Needs your decision ({requests.length})</h2>
      {banner && (
        <div className={`admin-alert admin-alert--${banner.tone === "ok" ? "ok" : "err"}`}>{banner.text}</div>
      )}
      {requests.length === 0 ? (
        <div className="admin-empty">Nothing waiting on you.</div>
      ) : (
        <div className="admin-list">
          {requests.map((r) => {
            const name = r.fullName || "Team member";
            const range =
              r.startDate === r.endDate
                ? formatDate(r.startDate) + (r.isHalfDay ? " (half day)" : "")
                : `${formatDate(r.startDate)} → ${formatDate(r.endDate)}`;
            return (
              <div className="admin-list-row" key={r.id}>
                <div className="admin-list-main">
                  <div className="admin-list-title">{name}</div>
                  <div className="admin-list-sub">
                    {LEAVE_TYPE_LABEL[r.leaveType as LeaveType] ?? r.leaveType} · {range}
                  </div>
                  {r.reason && <div className="admin-list-sub">Reason: {r.reason}</div>}
                </div>
                <div className="admin-list-aside">
                  {/* No "pending" badge: the section title already says these
                      are undecided, and the row reads cleaner with the two
                      buttons as the only thing on the right. */}
                  <div className="admin-timeoff-actions">
                    <button
                      className="admin-btn admin-btn--sm admin-btn--primary"
                      disabled={pending}
                      onClick={() => decide(r.id, "approved", name)}
                    >
                      Approve
                    </button>
                    <button
                      className="admin-btn admin-btn--sm admin-btn--danger"
                      disabled={pending}
                      onClick={() => decide(r.id, "rejected", name)}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
