// Client-visible meeting notes. A dedicated, reviewed helper — same discipline
// as lib/portal/invoices.ts.
//
// These are client meetings in the central company_os.meetings table, scoped to
// the actor's company. The meeting date is stored in started_at and the
// client-facing summary in `summary`.
//
// PRIVACY HARD LINE: the raw transcript (call_transcripts) is NEVER joined here
// (it is admin-only), and only PUBLISHED rows (published_at is not null) within
// the actor's companyScope are returned. The client sees date / attendees /
// title / summary. Publishing is a deliberate per-meeting admin action, so an
// imported client call only reaches the portal once an admin publishes it.

import { companyOs } from "@/lib/supabase";
import type { PortalActor } from "@/lib/portal-auth";

const NOTES_SELECT = "id, started_at, title, attendees, summary";

export type PortalMeeting = {
  id: string;
  meetingDate: string | null;
  title: string | null;
  attendees: string[];
  summary: string | null;
};

type Row = {
  id: string;
  started_at: string | null;
  title: string | null;
  attendees: string[] | null;
  summary: string | null;
};

const toMeeting = (r: Row): PortalMeeting => ({
  id: r.id,
  meetingDate: r.started_at ? r.started_at.slice(0, 10) : null,
  title: r.title,
  attendees: r.attendees ?? [],
  summary: r.summary,
});

export async function hasMeetings(actor: PortalActor): Promise<boolean> {
  if (actor.companyScope.length === 0) return false;
  const { data } = await companyOs
    .from("meetings")
    .select("id")
    .in("company_id", actor.companyScope)
    .is("archived_at", null)
    .not("published_at", "is", null)
    .limit(1);
  return (data ?? []).length > 0;
}

// One meeting for the portal Details page. Same hard line as the list: no
// transcript in the select, published only, and the companyScope filter is part
// of the query rather than a check afterwards, so an id from another client
// simply does not resolve.
export async function getMeetingForActor(
  actor: PortalActor,
  id: string,
): Promise<PortalMeeting | null> {
  if (actor.companyScope.length === 0) return null;

  const { data } = await companyOs
    .from("meetings")
    .select(NOTES_SELECT)
    .eq("id", id)
    .in("company_id", actor.companyScope)
    .is("archived_at", null)
    .not("published_at", "is", null)
    .maybeSingle();

  if (!data) return null;
  return toMeeting(data as Row);
}

export async function getMeetingsForActor(actor: PortalActor): Promise<PortalMeeting[]> {
  if (actor.companyScope.length === 0) return [];

  const { data } = await companyOs
    .from("meetings")
    .select(NOTES_SELECT)
    .in("company_id", actor.companyScope)
    .is("archived_at", null)
    .not("published_at", "is", null)
    .order("started_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  return ((data ?? []) as Row[]).map(toMeeting);
}
