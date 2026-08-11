import Link from "next/link";
import { Badge } from "@/components/admin/Badge";
import { formatDate } from "@/lib/admin/format";
import { renderPlanMarkdown } from "@/lib/admin/plan-markdown";
import type { AdminMeeting } from "@/lib/admin/meetings";
import { MeetingControls } from "@/components/admin/MeetingControls";

// Admin meeting list — async server component (renders the AI summary Markdown to
// sanitized HTML). Used as the company-360 tab content and on the global page.
// `showCompany` adds a company column/link for the cross-client view. Interactive
// bits (publish/edit/archive/retry) live in the client MeetingControls.
export async function MeetingsList({
  meetings,
  showCompany = false,
}: {
  meetings: AdminMeeting[];
  showCompany?: boolean;
}) {
  if (meetings.length === 0) {
    return <div className="admin-empty">No meetings yet. Upload a transcript above.</div>;
  }

  const summaries = await Promise.all(
    meetings.map((m) => (m.aiSummary ? renderPlanMarkdown(m.aiSummary) : Promise.resolve(null))),
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {meetings.map((m, i) => (
        <div className="admin-card admin-section-card" key={m.id}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h3 className="admin-card-title" style={{ marginBottom: 2 }}>
                {m.title || "Untitled meeting"}
              </h3>
              <div className="admin-cell-muted">
                {m.meetingDate ? formatDate(m.meetingDate) : "Date not set"}
                {showCompany && m.companyName && (
                  <>
                    {" · "}
                    <Link href={`/admin/revenue/companies/${m.companyId}`}>{m.companyName}</Link>
                  </>
                )}
              </div>
            </div>
            <div style={{ display: "inline-flex", gap: 6, alignItems: "flex-start", flexWrap: "wrap" }}>
              {m.publishedAt ? <Badge tone="ok">Published</Badge> : <Badge tone="neutral">Draft</Badge>}
              {m.aiStatus === "pending" && <Badge tone="warn">Summarizing…</Badge>}
              {m.aiStatus === "failed" && <Badge tone="warn">AI failed</Badge>}
            </div>
          </div>

          <div className="admin-cell-muted" style={{ marginTop: 8, fontSize: 13 }}>
            <strong>Attendees:</strong>{" "}
            {m.attendees.length > 0 ? m.attendees.join(", ") : "—"}
          </div>

          <div style={{ marginTop: 12 }}>
            {m.aiStatus === "pending" ? (
              <div className="admin-cell-muted">Generating the summary…</div>
            ) : m.aiStatus === "failed" ? (
              <div className="admin-cell-muted">
                Summary failed{m.aiError ? `: ${m.aiError}` : "."} Use “Retry summary” below.
              </div>
            ) : summaries[i] ? (
              <div className="idea-plan" dangerouslySetInnerHTML={{ __html: summaries[i] as string }} />
            ) : (
              <div className="admin-cell-muted">No summary.</div>
            )}
          </div>

          <details style={{ marginTop: 12 }}>
            <summary className="admin-cell-muted" style={{ cursor: "pointer" }}>
              Full transcript{m.sourceFileName ? ` · ${m.sourceFileName}` : ""}
            </summary>
            <pre
              style={{
                marginTop: 8,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontFamily: "inherit",
                fontSize: 13,
                maxHeight: 400,
                overflow: "auto",
              }}
            >
              {m.transcript}
            </pre>
          </details>

          <MeetingControls
            id={m.id}
            published={!!m.publishedAt}
            aiStatus={m.aiStatus}
            initial={{
              title: m.title ?? "",
              meetingDate: m.meetingDate ?? "",
              attendees: m.attendees.join(", "),
              summary: m.aiSummary ?? "",
            }}
          />
        </div>
      ))}
    </div>
  );
}
