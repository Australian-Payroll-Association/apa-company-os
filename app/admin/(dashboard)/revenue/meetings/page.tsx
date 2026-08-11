import { requireAdmin } from "@/lib/admin-auth";
import { getAllMeetings, listCompanyOptions } from "@/lib/admin/meetings";
import { PageHead } from "@/components/admin/PageHead";
import { MeetingUploadForm } from "@/components/admin/MeetingUploadForm";
import { MeetingsList } from "@/components/admin/MeetingsList";

export const dynamic = "force-dynamic";

// Global, cross-client meeting notes: upload for any client (picker) plus every
// meeting on record. Per-company uploads live on the company 360 Meeting Notes
// tab; this is the same data without the company filter.
export default async function MeetingsPage() {
  await requireAdmin();
  const [meetings, companies] = await Promise.all([getAllMeetings(), listCompanyOptions()]);
  const published = meetings.filter((m) => m.publishedAt).length;
  const meetingsListNode = await MeetingsList({ meetings, showCompany: true });

  return (
    <div style={{ maxWidth: 900 }}>
      <PageHead
        eyebrow="Revenue"
        title="Meeting Notes"
        sub={`${meetings.length} meeting${meetings.length === 1 ? "" : "s"} · ${published} published to clients`}
      />

      <div className="admin-card admin-section-card" style={{ marginBottom: 16 }}>
        <div className="admin-shelf-heading" style={{ marginBottom: 8 }}>Upload a transcript</div>
        <MeetingUploadForm companies={companies} />
      </div>

      {meetingsListNode}
    </div>
  );
}
