import { companyOs } from "@/lib/supabase";
import { PageHead } from "@/components/admin/PageHead";
import { ROLE_FAMILIES, type FamilyScreen } from "@/lib/role-families";
import { RankTable, type RankRow } from "./RankTable";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Rank",
  description: "Candidates stack-ranked by AI screen within each role family.",
};

// Rank: every application whose req is tagged with a role_family, rated by
// the family AI screen (applications.metadata.family_screen) against one
// ideal profile per family so scores compare across reqs. A person who
// applied to several reqs in a family appears once with their best screen.
type P = { id: string; full_name: string | null; email: string; phone: string | null; linkedin_url: string | null };
type Jr = { title: string | null; metadata: { role_family?: string } | null };
type RawApp = {
  id: string;
  status: string | null;
  rating: number | null;
  applied_at: string | null;
  resume_document_id: string | null;
  person_id: string | null;
  metadata: { family_screen?: FamilyScreen; recruiter_note?: string } | null;
  people: P | P[] | null;
  job_requisitions: Jr | Jr[] | null;
};

const one = <T,>(e: T | T[] | null): T | null => (Array.isArray(e) ? e[0] ?? null : e);

// Recruiter notes from the ATS import often carry "Rating: 8.5/10" or "4/5".
function recruiterRating(note: string | undefined): string | null {
  const m = note?.match(/Rating:\s*([\d.]+)\s*\/\s*(5|10)/i);
  if (!m) return null;
  return `${m[1]}/${m[2]}`;
}

export default async function RankPage() {
  const { data, error } = await companyOs
    .from("applications")
    .select(
      "id, status, rating, applied_at, resume_document_id, person_id, metadata, people!person_id(id, full_name, email, phone, linkedin_url), job_requisitions(title, metadata)",
    )
    .not("job_requisitions.metadata->>role_family", "is", null)
    .limit(2000);

  const raw = ((data ?? []) as unknown as RawApp[]).filter((r) => one(r.job_requisitions)?.metadata?.role_family);

  // Best-screened application per (family, person).
  const best = new Map<string, RankRow>();
  for (const r of raw) {
    const p = one(r.people);
    const req = one(r.job_requisitions);
    const family = req?.metadata?.role_family;
    if (!p || !family) continue;
    const screen = r.metadata?.family_screen;
    const row: RankRow = {
      applicationId: r.id,
      personId: p.id,
      family,
      name: p.full_name || p.email,
      email: p.email.startsWith("no-email+") ? null : p.email,
      phone: p.phone,
      linkedinUrl: p.linkedin_url,
      reqTitle: req?.title?.trim() ?? null,
      reqTitles: [req?.title?.trim() ?? ""].filter(Boolean),
      status: r.status,
      appliedAt: r.applied_at,
      resumeDocumentId: r.resume_document_id,
      recruiterStars: r.rating,
      rating: screen?.family === family ? screen.rating : null,
      overview: screen?.family === family ? screen.overview : null,
      strengths: screen?.family === family ? screen.strengths : [],
      gaps: screen?.family === family ? screen.gaps : [],
      recruiterRating: recruiterRating(r.metadata?.recruiter_note),
    };
    const key = `${family}:${p.id}`;
    const prev = best.get(key);
    if (!prev) {
      best.set(key, row);
      continue;
    }
    const keep = (row.rating ?? -1) > (prev.rating ?? -1) ? row : prev;
    keep.reqTitles = [...new Set([...prev.reqTitles, ...row.reqTitles])];
    // A hire anywhere in the family wins the status badge.
    if (prev.status === "hired" || row.status === "hired") keep.status = "hired";
    best.set(key, keep);
  }

  const rows = [...best.values()].sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
  const screened = rows.filter((r) => r.rating != null).length;

  return (
    <>
      <PageHead
        eyebrow="Talent"
        title="Rank"
        sub={`${rows.length} candidates across ${ROLE_FAMILIES.length} role families · ${screened} AI-screened`}
      />
      {error && (
        <div className="admin-alert admin-alert--err" style={{ marginBottom: 14 }}>
          {error.message}
        </div>
      )}
      <RankTable rows={rows} families={ROLE_FAMILIES.map((f) => ({ key: f.key, label: f.label }))} />
    </>
  );
}
