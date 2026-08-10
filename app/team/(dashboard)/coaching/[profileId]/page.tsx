import { notFound } from "next/navigation";
import { requireTeamMember } from "@/lib/team-auth";
import { PageHead } from "@/components/admin/PageHead";
import { getCoachProfileDetail } from "@/lib/coaching/data";
import { coachingMarkdownToHtml } from "@/lib/coaching/markdown";
import { CoachProfileView, type RenderedHtml } from "@/components/coaching/CoachProfileView";

export const dynamic = "force-dynamic";

export const metadata = { title: "Coaching" };

// /team/coaching/[profileId] — one person's coaching page: goal, cadence,
// commitments, every 1-1 (prep -> transcript -> two-tier summaries), private
// coaching reads, OKRs, and monthly trends. getCoachProfileDetail returns null
// unless the actor is this profile's coach — that IS the authorization.
export default async function CoachProfilePage({ params }: { params: { profileId: string } }) {
  const actor = await requireTeamMember();
  const detail = await getCoachProfileDetail(actor, params.profileId);
  if (!detail) notFound();

  // Render every markdown field server-side once; the client edits raw
  // markdown and displays these.
  const html: RenderedHtml = { meetings: {}, trends: {}, privateProfile: null };
  await Promise.all([
    ...detail.meetings.map(async (m) => {
      html.meetings[m.id] = {
        prep: m.prepMarkdown ? await coachingMarkdownToHtml(m.prepMarkdown) : null,
        summary: m.summaryMarkdown ? await coachingMarkdownToHtml(m.summaryMarkdown) : null,
        shared: m.sharedSummaryMarkdown ? await coachingMarkdownToHtml(m.sharedSummaryMarkdown) : null,
      };
    }),
    ...detail.trends.map(async (t) => {
      html.trends[t.id] = t.reportMarkdown ? await coachingMarkdownToHtml(t.reportMarkdown) : null;
    }),
    (async () => {
      html.privateProfile = detail.privateProfileMarkdown
        ? await coachingMarkdownToHtml(detail.privateProfileMarkdown)
        : null;
    })(),
  ]);

  return (
    <>
      <PageHead
        eyebrow="Coaching"
        title={detail.member.name}
        sub={`${detail.member.positionTitle ?? "—"} · 1-1 every ${detail.cadenceDays} days`}
      />
      <CoachProfileView detail={detail} html={html} />
    </>
  );
}
