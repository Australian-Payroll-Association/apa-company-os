import { companyOs } from "@/lib/supabase";

// Reads for company_os.meeting_notes on the admin surface: the company 360 tab
// and the global Meetings list. Admin sees everything, including the raw
// transcript and AI status. The client-facing /portal reads through
// lib/portal/meetings.ts instead (summary only, published only).

export type AdminMeeting = {
  id: string;
  companyId: string;
  companyName: string | null;
  meetingDate: string | null;
  title: string | null;
  attendees: string[];
  transcript: string;
  aiSummary: string | null;
  aiStatus: "pending" | "ready" | "failed";
  aiError: string | null;
  sourceFileName: string | null;
  publishedAt: string | null;
  createdAt: string;
};

type Row = {
  id: string;
  company_id: string;
  meeting_date: string | null;
  title: string | null;
  attendees: string[] | null;
  transcript: string;
  ai_summary: string | null;
  ai_status: AdminMeeting["aiStatus"];
  ai_error: string | null;
  source_file_name: string | null;
  published_at: string | null;
  created_at: string;
  company?: { name: string | null } | { name: string | null }[] | null;
};

const one = <T,>(e: T | T[] | null | undefined): T | null =>
  Array.isArray(e) ? e[0] ?? null : e ?? null;

// Newest first. Ordered by meeting date when known, else by created time — the
// partial index (company_id, meeting_date desc nulls last, created_at desc)
// backs the company-scoped case.
const ORDER = (q: ReturnType<typeof baseSelect>) =>
  q
    .order("meeting_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

function baseSelect() {
  return companyOs
    .from("meeting_notes")
    .select(
      "id, company_id, meeting_date, title, attendees, transcript, ai_summary, ai_status, ai_error, source_file_name, published_at, created_at, company:companies!company_id(name)",
    )
    .is("archived_at", null);
}

function mapRow(r: Row): AdminMeeting {
  return {
    id: r.id,
    companyId: r.company_id,
    companyName: one(r.company)?.name ?? null,
    meetingDate: r.meeting_date,
    title: r.title,
    attendees: r.attendees ?? [],
    transcript: r.transcript,
    aiSummary: r.ai_summary,
    aiStatus: r.ai_status,
    aiError: r.ai_error,
    sourceFileName: r.source_file_name,
    publishedAt: r.published_at,
    createdAt: r.created_at,
  };
}

export async function getMeetingsForCompany(companyId: string): Promise<AdminMeeting[]> {
  const { data } = await ORDER(baseSelect().eq("company_id", companyId));
  return ((data ?? []) as Row[]).map(mapRow);
}

export async function getAllMeetings(): Promise<AdminMeeting[]> {
  const { data } = await ORDER(baseSelect());
  return ((data ?? []) as Row[]).map(mapRow);
}

export type CompanyOption = { id: string; name: string };

// Companies for the global upload picker. Active companies only, alphabetical.
export async function listCompanyOptions(): Promise<CompanyOption[]> {
  const { data } = await companyOs
    .from("companies")
    .select("id, name")
    .is("archived_at", null)
    .order("name", { ascending: true });
  return ((data ?? []) as { id: string; name: string | null }[])
    .filter((c) => c.name)
    .map((c) => ({ id: c.id, name: c.name as string }));
}
