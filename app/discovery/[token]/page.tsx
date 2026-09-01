import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadEngagementByToken, loadResponses } from "@/lib/discovery/data";
import { DiscoverySurvey } from "./DiscoverySurvey";

// Public client discovery page. Bearer link: the opaque access_token in the
// URL is the credential (same model as /work/[token]), so no login — this
// page shows only the one engagement the token resolves to. Never listed,
// never indexed.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "360 Payroll Review — Discovery",
  robots: { index: false },
};

export default async function DiscoveryPage({ params }: { params: { token: string } }) {
  const token = params.token?.trim();
  const engagement = await loadEngagementByToken(token);
  if (!engagement) notFound();

  const responses = await loadResponses(engagement.id);

  return (
    <DiscoverySurvey
      token={token}
      clientName={engagement.client_name}
      initialStatus={engagement.status}
      initialOverview={engagement.overview}
      initialTeamMembers={engagement.team_members}
      initialResponses={responses}
    />
  );
}
