import Link from "next/link";
import { requirePortalMember } from "@/lib/portal-auth";
import { getMeetingsForActor } from "@/lib/portal/meetings";
import { PageHead } from "@/components/admin/PageHead";
import { formatDate } from "@/lib/admin/format";

export const dynamic = "force-dynamic";

// Client-facing meeting notes, List page. Only published meetings within the
// actor's companyScope reach here (lib/portal/meetings.ts), and the raw
// transcript is never selected. The summary opens on the Details page.
export default async function PortalMeetingsPage() {
  const actor = await requirePortalMember();
  const meetings = await getMeetingsForActor(actor);

  return (
    <>
      <PageHead
        eyebrow="Client Portal"
        title="Meetings"
        sub={meetings.length > 0 ? `${meetings.length} meeting${meetings.length === 1 ? "" : "s"} on record` : undefined}
      />

      {meetings.length === 0 ? (
        <div className="admin-card admin-section-card">
          <div className="admin-empty">No meeting notes yet.</div>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Meeting</th>
                  <th>Attendees</th>
                </tr>
              </thead>
              <tbody>
                {meetings.map((m) => (
                  <tr key={m.id}>
                    <td>{m.meetingDate ? formatDate(m.meetingDate) : <span className="admin-cell-muted">—</span>}</td>
                    <td>
                      <Link className="admin-cell-strong" href={`/portal/meetings/${m.id}`}>
                        {m.title || "Meeting"}
                      </Link>
                    </td>
                    <td className="admin-cell-muted">{m.attendees.length > 0 ? m.attendees.join(", ") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
