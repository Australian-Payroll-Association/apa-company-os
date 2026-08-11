import { requirePortalMember } from "@/lib/portal-auth";
import { getMeetingsForActor } from "@/lib/portal/meetings";
import { renderPlanMarkdown } from "@/lib/admin/plan-markdown";
import { PageHead } from "@/components/admin/PageHead";
import { formatDate } from "@/lib/admin/format";

export const dynamic = "force-dynamic";

// Client-facing meeting notes. Only published meetings within the actor's
// companyScope reach here (lib/portal/meetings.ts), and the raw transcript is
// never selected — clients see date / attendees / title / summary only.
export default async function PortalMeetingsPage() {
  const actor = await requirePortalMember();
  const meetings = await getMeetingsForActor(actor);
  const summaries = await Promise.all(
    meetings.map((m) => (m.summary ? renderPlanMarkdown(m.summary) : Promise.resolve(null))),
  );

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
        meetings.map((m, i) => (
          <div className="admin-card admin-section-card" key={m.id}>
            <h2 className="admin-card-title" style={{ marginBottom: 2 }}>
              {m.title || "Meeting"}
            </h2>
            <div className="admin-cell-muted">
              {m.meetingDate ? formatDate(m.meetingDate) : "Date not set"}
              {m.attendees.length > 0 && ` · ${m.attendees.join(", ")}`}
            </div>
            {summaries[i] && (
              <div className="idea-plan" style={{ marginTop: 12 }} dangerouslySetInnerHTML={{ __html: summaries[i] as string }} />
            )}
          </div>
        ))
      )}
    </>
  );
}
