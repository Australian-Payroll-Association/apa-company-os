import { notFound } from "next/navigation";
import { requireTeamMember } from "@/lib/team-auth";
import { getClientMeetingsForActor } from "@/lib/team/clients";
import { MeetingsPanel } from "@/components/hub/MeetingsPanel";
import { publishMeeting } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Client Meetings" };

// The Meetings tab: every meeting for this client. Team members are internal
// Edge8 staff, so they see drafts and published alike and can publish a meeting
// to the client (setMeetingPublished, actor-scoped). Clients only ever see the
// published ones on /portal.
export default async function TeamClientMeetingsTab({ params }: { params: { companyId: string } }) {
  const actor = await requireTeamMember();
  const meetings = await getClientMeetingsForActor(actor, params.companyId);
  if (meetings === null) notFound();

  return (
    <section className="admin-card admin-section-card">
      <h2 className="admin-card-title" style={{ marginBottom: 10 }}>Meetings</h2>
      <MeetingsPanel meetings={meetings} publishAction={publishMeeting} />
    </section>
  );
}
