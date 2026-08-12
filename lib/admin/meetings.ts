import { companyOs } from "@/lib/supabase";

// Reads for company_os.meeting_notes on the admin surface. Two shapes, because
// the surface is split across three pages:
//   - AdminMeetingRow: the List page and the company 360 tab. No transcript and
//     no summary, so a 350-row table never drags full transcripts through.
//   - AdminMeeting: the Details page. Everything, transcript included.
// The client-facing /portal reads through lib/portal/meetings.ts instead
// (summary only, published only).

export type AiStatus = "pending" | "ready" | "failed";

export type AdminMeetingRow = {
  id: string;
  companyId: string;
  companyName: string | null;
  meetingDate: string | null;
  title: string | null;
  attendees: string[];
  aiStatus: AiStatus;
  publishedAt: string | null;
  createdAt: string;
};

export type AdminMeeting = AdminMeetingRow & {
  transcript: string;
  aiSummary: string | null;
  aiError: string | null;
  sourceFileName: string | null;
};

const ROW_SELECT =
  "id, company_id, meeting_date, title, attendees, ai_status, published_at, created_at, company:companies!company_id(name)";
const FULL_SELECT = `${ROW_SELECT}, transcript, ai_summary, ai_error, source_file_name`;

type Row = {
  id: string;
  company_id: string;
  meeting_date: string | null;
  title: string | null;
  attendees: string[] | null;
  ai_status: AiStatus;
  published_at: string | null;
  created_at: string;
  company?: { name: string | null } | { name: string | null }[] | null;
};

type FullRow = Row & {
  transcript: string;
  ai_summary: string | null;
  ai_error: string | null;
  source_file_name: string | null;
};

const one = <T,>(e: T | T[] | null | undefined): T | null =>
  Array.isArray(e) ? e[0] ?? null : e ?? null;

function mapRow(r: Row): AdminMeetingRow {
  return {
    id: r.id,
    companyId: r.company_id,
    companyName: one(r.company)?.name ?? null,
    meetingDate: r.meeting_date,
    title: r.title,
    attendees: r.attendees ?? [],
    aiStatus: r.ai_status,
    publishedAt: r.published_at,
    createdAt: r.created_at,
  };
}

export async function getMeetingsForCompany(companyId: string): Promise<AdminMeetingRow[]> {
  const { data } = await companyOs
    .from("meeting_notes")
    .select(ROW_SELECT)
    .is("archived_at", null)
    .eq("company_id", companyId)
    .order("meeting_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  return ((data ?? []) as Row[]).map(mapRow);
}

export async function getMeeting(id: string): Promise<AdminMeeting | null> {
  const { data } = await companyOs
    .from("meeting_notes")
    .select(FULL_SELECT)
    .is("archived_at", null)
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const r = data as FullRow;
  return {
    ...mapRow(r),
    transcript: r.transcript,
    aiSummary: r.ai_summary,
    aiError: r.ai_error,
    sourceFileName: r.source_file_name,
  };
}

export type MeetingListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: "published" | "draft";
};

export type MeetingListResult = {
  rows: AdminMeetingRow[];
  total: number;
  page: number;
  pageSize: number;
  error: string | null;
};

// Paginated List-page reader. Search covers the meeting title AND the client
// name: PostgREST cannot OR across an embedded table, so client names resolve
// to ids first (companies is small) and both go into one .or() on the base
// table. A search that matches no company still matches on title alone.
export async function listMeetings(params: MeetingListParams = {}): Promise<MeetingListResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 25));
  const from = (page - 1) * pageSize;

  let q = companyOs
    .from("meeting_notes")
    .select(ROW_SELECT, { count: "exact" })
    .is("archived_at", null)
    .range(from, from + pageSize - 1)
    .order("meeting_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (params.status === "published") q = q.not("published_at", "is", null);
  if (params.status === "draft") q = q.is("published_at", null);

  const search = (params.search ?? "").replace(/[%,()]/g, " ").trim();
  if (search) {
    const { data: matched } = await companyOs
      .from("companies")
      .select("id")
      .ilike("name", `%${search}%`);
    const ids = ((matched ?? []) as { id: string }[]).map((c) => c.id);
    const clauses = [`title.ilike.%${search}%`];
    if (ids.length > 0) clauses.push(`company_id.in.(${ids.join(",")})`);
    q = q.or(clauses.join(","));
  }

  const { data, count, error } = await q;
  return {
    rows: ((data ?? []) as Row[]).map(mapRow),
    total: count ?? 0,
    page,
    pageSize,
    error: error ? error.message : null,
  };
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
