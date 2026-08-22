"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/admin/Badge";
import { formatDate } from "@/lib/admin/format";

type PublishResult = { ok: boolean; error?: string };

// Only these fields are rendered, so any meeting row shape works (the admin
// AdminMeetingRow, or the portal's PortalMeeting).
type MeetingRowLike = {
  id: string;
  title: string | null;
  meetingDate: string | null;
  publishedAt: string | null;
};

// Client Hub meetings tab. Read-only list of meetings with their publish state.
// When `publishAction` is supplied (Edge8 surfaces), each row gets a Publish /
// Unpublish control; on client-facing surfaces it is omitted and the caller
// passes only already-published meetings.
export function MeetingsPanel({
  meetings,
  publishAction,
  detailBasePath,
}: {
  meetings: MeetingRowLike[];
  publishAction?: (id: string, published: boolean) => Promise<PublishResult>;
  // When set, the meeting title links to `${detailBasePath}/${id}`.
  detailBasePath?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function toggle(id: string, next: boolean) {
    if (!publishAction) return;
    setErr(null);
    setBusyId(id);
    start(async () => {
      const res = await publishAction(id, next);
      setBusyId(null);
      if (res.ok) router.refresh();
      else setErr(res.error ?? "Failed.");
    });
  }

  if (meetings.length === 0) {
    return <div className="admin-empty">No meetings yet.</div>;
  }

  return (
    <>
      {err && <div className="admin-alert admin-alert--err" style={{ marginBottom: 10 }}>{err}</div>}
      <div className="admin-list">
        {meetings.map((m) => {
          const published = !!m.publishedAt;
          return (
            <div className="admin-list-row" key={m.id}>
              <div className="admin-list-main">
                <div className="admin-list-title">
                  {detailBasePath ? (
                    <Link href={`${detailBasePath}/${m.id}`}>{m.title || "Untitled meeting"}</Link>
                  ) : (
                    m.title || "Untitled meeting"
                  )}
                </div>
                {m.meetingDate && <div className="admin-list-sub">{formatDate(m.meetingDate)}</div>}
              </div>
              <div className="admin-list-aside" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Badge tone={published ? "ok" : "neutral"}>{published ? "Published" : "Draft"}</Badge>
                {publishAction && (
                  <button
                    className="admin-btn admin-btn--sm"
                    disabled={pending && busyId === m.id}
                    onClick={() => toggle(m.id, !published)}
                  >
                    {published ? "Unpublish" : "Publish"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
