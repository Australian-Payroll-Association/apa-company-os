import { requirePortalMember } from "@/lib/portal-auth";
import { getAssignedTimeOff, type PortalTimeOffEntry } from "@/lib/portal/time-off";
import { PageHead } from "@/components/admin/PageHead";
import { Badge, type BadgeTone } from "@/components/admin/Badge";
import { formatDate } from "@/lib/admin/format";
import { LEAVE_TYPE_LABEL, type LeaveType } from "@/lib/admin/time-off";

export const dynamic = "force-dynamic";

// Client-facing time off: who from the dedicated team is out, when. Read-only
// v1 — see docs/plans/2026-07-11-client-portal-design.md. Every field rendered
// here comes from lib/portal/time-off.ts's hard-restricted column list; there
// is no reason, manager note, balance, or policy data to accidentally leak.
function statusLabel(status: string): { text: string; tone: BadgeTone } {
  switch (status) {
    case "approved":
      return { text: "Approved", tone: "ok" };
    case "taken":
      return { text: "Taken", tone: "ok" };
    case "requested":
      return { text: "Pending", tone: "warn" };
    default:
      return { text: status, tone: "neutral" };
  }
}

function leaveTypeLabel(type: string): string {
  return LEAVE_TYPE_LABEL[type as LeaveType] ?? type;
}

function dateRange(e: PortalTimeOffEntry): string {
  if (e.startDate === e.endDate) return formatDate(e.startDate) + (e.isHalfDay ? " (half day)" : "");
  return `${formatDate(e.startDate)} → ${formatDate(e.endDate)}`;
}

export default async function PortalTimeOffPage() {
  const actor = await requirePortalMember();
  const entries = await getAssignedTimeOff(actor);

  const today = new Date().toISOString().slice(0, 10);
  const outNow = entries.filter(
    (e) => e.startDate <= today && e.endDate >= today && (e.status === "approved" || e.status === "taken"),
  );
  const upcoming = entries.filter((e) => e.startDate > today);
  const history = [...entries].sort((a, b) => b.startDate.localeCompare(a.startDate));

  return (
    <>
      <PageHead eyebrow="Client Portal" title="Time Off" sub="Who's out, and when, on your team." />

      <div className="admin-card admin-section-card">
        <h2 className="admin-card-title">Out now ({outNow.length})</h2>
        {outNow.length === 0 ? (
          <div className="admin-empty">No one is out right now.</div>
        ) : (
          <div className="admin-list">
            {outNow.map((e) => {
              const s = statusLabel(e.status);
              return (
                <div className="admin-list-row" key={e.id}>
                  <div className="admin-list-main">
                    <div className="admin-list-title">{e.fullName || "Team member"}</div>
                    <div className="admin-list-sub">{leaveTypeLabel(e.leaveType)} · {dateRange(e)}</div>
                  </div>
                  <div className="admin-list-aside">
                    <Badge tone={s.tone}>{s.text}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="admin-card admin-section-card">
        <h2 className="admin-card-title">Upcoming ({upcoming.length})</h2>
        {upcoming.length === 0 ? (
          <div className="admin-empty">Nothing scheduled.</div>
        ) : (
          <div className="admin-list">
            {upcoming.map((e) => {
              const s = statusLabel(e.status);
              return (
                <div className="admin-list-row" key={e.id}>
                  <div className="admin-list-main">
                    <div className="admin-list-title">{e.fullName || "Team member"}</div>
                    <div className="admin-list-sub">{leaveTypeLabel(e.leaveType)} · {dateRange(e)}</div>
                  </div>
                  <div className="admin-list-aside">
                    <Badge tone={s.tone}>{s.text}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="admin-card admin-section-card">
        <h2 className="admin-card-title">History ({history.length})</h2>
        {history.length === 0 ? (
          <div className="admin-empty">No time-off history in the last 90 days.</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Type</th>
                  <th>Dates</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((e) => {
                  const s = statusLabel(e.status);
                  return (
                    <tr key={e.id}>
                      <td>{e.fullName || "Team member"}</td>
                      <td>{leaveTypeLabel(e.leaveType)}</td>
                      <td>{dateRange(e)}</td>
                      <td>
                        <Badge tone={s.tone}>{s.text}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
