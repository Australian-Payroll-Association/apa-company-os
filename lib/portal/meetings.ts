// Client-visible meeting notes. A dedicated, reviewed helper — same discipline
// as lib/portal/invoices.ts.
//
// PRIVACY HARD LINE: the raw `transcript` is NEVER selected here (it is admin-
// only), and only PUBLISHED rows (published_at is not null) within the actor's
// companyScope are returned. The client sees date / attendees / title / summary.

import { companyOs } from "@/lib/supabase";
import type { PortalActor } from "@/lib/portal-auth";

export type PortalMeeting = {
  id: string;
  meetingDate: string | null;
  title: string | null;
  attendees: string[];
  summary: string | null;
};

type Row = {
  id: string;
  meeting_date: string | null;
  title: string | null;
  attendees: string[] | null;
  ai_summary: string | null;
};

export async function hasMeetings(actor: PortalActor): Promise<boolean> {
  if (actor.companyScope.length === 0) return false;
  const { data } = await companyOs
    .from("meeting_notes")
    .select("id")
    .in("company_id", actor.companyScope)
    .is("archived_at", null)
    .not("published_at", "is", null)
    .limit(1);
  return (data ?? []).length > 0;
}

export async function getMeetingsForActor(actor: PortalActor): Promise<PortalMeeting[]> {
  if (actor.companyScope.length === 0) return [];

  const { data } = await companyOs
    .from("meeting_notes")
    .select("id, meeting_date, title, attendees, ai_summary")
    .in("company_id", actor.companyScope)
    .is("archived_at", null)
    .not("published_at", "is", null)
    .order("meeting_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  return ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    meetingDate: r.meeting_date,
    title: r.title,
    attendees: r.attendees ?? [],
    summary: r.ai_summary,
  }));
}
