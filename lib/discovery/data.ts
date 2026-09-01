import { createClient } from "@supabase/supabase-js";

// Shared server-only data access for the public /discovery/[token] page and
// its actions. The opaque access_token IS the credential (same bearer-link
// model as /work/[token] and event tickets) — every caller re-validates the
// token fresh rather than trusting a client-supplied engagement id, so a
// tampered request can never touch another engagement's rows.
//
// Uses its own Supabase client rather than the shared one from lib/supabase
// (companyOs): that client's queries were found to be served from Next.js's
// fetch Data Cache even on force-dynamic routes (confirmed by comparing
// against a direct REST call to the same row — the shared client kept
// returning a frozen snapshot from the first request of the process).
// Passing an explicit `cache: "no-store"` fetch fixes it. Scoped to this
// module rather than changed in lib/supabase.ts, since that file backs every
// admin/portal/team page in the app and is out of scope for this feature —
// worth a wider look separately.
export const discoveryDb = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SECRET_KEY || "",
  {
    auth: { persistSession: false },
    global: { fetch: (url, opts) => fetch(url, { ...opts, cache: "no-store" }) },
  },
).schema("company_os");

export type EngagementOverview = {
  systems: { payroll: string; ta: string; hris: string; finance: string };
  entities: { name: string; employees: string; payCycle: string; awards: string }[];
};

export type TeamMember = {
  name: string;
  position: string;
  yearsAtOrg: string;
  yearsPayroll: string;
  qualifications: string;
};

export type EngagementRow = {
  id: string;
  client_name: string;
  status: string;
  overview: EngagementOverview;
  team_members: TeamMember[];
  consultant_email: string | null;
  consultant: { full_name: string | null; email: string } | null;
};

export type ResponseValue = { options: string[]; text: string };

const one = <T,>(e: T | T[] | null): T | null => (Array.isArray(e) ? (e[0] ?? null) : e);

// A freshly-created engagement stores overview as '{}' (the column default) —
// normalize to the full shape the form expects rather than making every
// caller (and every field access in the client component) null-check.
export function normalizeOverview(raw: Partial<EngagementOverview> | null | undefined): EngagementOverview {
  return {
    systems: { payroll: "", ta: "", hris: "", finance: "", ...(raw?.systems ?? {}) },
    entities: raw?.entities?.length ? raw.entities : [{ name: "", employees: "", payCycle: "", awards: "" }],
  };
}

export async function loadEngagementByToken(token: string | undefined | null): Promise<EngagementRow | null> {
  if (!token || token.length < 8) return null;
  const { data, error } = await discoveryDb
    .from("discovery_engagements")
    .select("id, client_name, status, overview, team_members, consultant_email, consultant:people!consultant_person_id(full_name, email)")
    .eq("access_token", token)
    .maybeSingle();
  if (error || !data) return null;
  type ConsultantRow = { full_name: string | null; email: string };
  const consultant = one(data.consultant as ConsultantRow | ConsultantRow[] | null);
  return { ...data, overview: normalizeOverview(data.overview), consultant } as EngagementRow;
}

export async function loadResponses(engagementId: string): Promise<Record<string, ResponseValue>> {
  const { data } = await discoveryDb
    .from("discovery_responses")
    .select("question_id, options, text")
    .eq("engagement_id", engagementId);
  const map: Record<string, ResponseValue> = {};
  (data ?? []).forEach((r) => {
    map[r.question_id as string] = { options: (r.options as string[]) ?? [], text: (r.text as string) ?? "" };
  });
  return map;
}
