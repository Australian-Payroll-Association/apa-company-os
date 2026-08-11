import Link from "next/link";
import { companyOs } from "@/lib/supabase";
import { PageHead } from "@/components/admin/PageHead";
import { MetricCard } from "@/components/admin/MetricCard";
import { ApplicationsTable, type AppRow } from "./ApplicationsTable";

export const dynamic = "force-dynamic";
// Vercel's data cache can freeze Supabase reads despite force-dynamic (see the
// time-off pages) — a stale list here hides freshly added candidates while the
// duplicate guard still sees them, so pin the data cache off.
export const fetchCache = "force-no-store";

export const metadata = {
  title: "Applications",
  description: "Job applications moving through the hiring pipeline.",
};

// Talent office: applications to OPEN job reqs only, joined straight to the
// person (the candidates table is retired). Recruiting-profile fields live on
// the candidate_profile satellite, embedded through the person. Rows load once
// and the client table handles search, the job-req filter, paging, and the
// manage shelf. Closed reqs' applications live on the Candidate Pool page.
type Cp = {
  headline: string | null;
  current_title: string | null;
  portfolio_url: string | null;
  do_not_hire: boolean;
};
type P = {
  full_name: string | null;
  email: string;
  phone: string | null;
  linkedin_url: string | null;
  candidate_profile: Cp | Cp[] | null;
};
type Jr = { title: string | null; status: string | null };
type St = { name: string | null };
type RawApp = {
  id: string;
  status: string | null;
  rating: number | null;
  ai_rating: number | null;
  applied_at: string | null;
  decided_at: string | null;
  rejection_reason: string | null;
  current_stage_id: string | null;
  resume_document_id: string | null;
  job_requisition_id: string | null;
  person_id: string | null;
  metadata: { family_screen?: { rating?: number } } | null;
  people: P | P[] | null;
  job_requisitions: Jr | Jr[] | null;
  application_stages: St | St[] | null;
};

const one = <T,>(e: T | T[] | null): T | null => (Array.isArray(e) ? e[0] ?? null : e);

export default async function ApplicationsPage() {
  // Only applications whose req is still open — the inner join makes the
  // status filter on the embedded req drop non-matching rows.
  const appsRes = await companyOs
    .from("applications")
    .select(
      "id, status, rating, ai_rating, applied_at, decided_at, rejection_reason, current_stage_id, resume_document_id, job_requisition_id, person_id, metadata, people!person_id(full_name, email, phone, linkedin_url, candidate_profile(headline, current_title, portfolio_url, do_not_hire)), job_requisitions!inner(title, status), application_stages(name)",
    )
    .eq("job_requisitions.status", "open")
    .order("created_at", { ascending: false })
    .limit(2000);

  const error = appsRes.error?.message ?? null;
  const raw = (appsRes.data ?? []) as unknown as RawApp[];
  const rows: AppRow[] = raw.map((r) => {
    const p = one(r.people);
    const cp = one(p?.candidate_profile ?? null);
    return {
      id: r.id,
      candidateName: p?.full_name || p?.email || null,
      email: p?.email ?? null,
      phone: p?.phone ?? null,
      headline: cp?.headline ?? null,
      currentTitle: cp?.current_title ?? null,
      linkedinUrl: p?.linkedin_url ?? null,
      portfolioUrl: cp?.portfolio_url ?? null,
      doNotHire: Boolean(cp?.do_not_hire),
      personId: r.person_id,
      jobReqId: r.job_requisition_id,
      jobReqTitle: one(r.job_requisitions)?.title ?? null,
      jobReqStatus: one(r.job_requisitions)?.status ?? null,
      stageName: one(r.application_stages)?.name ?? null,
      currentStageId: r.current_stage_id,
      status: r.status,
      rating: r.rating,
      // AI rating: family screen (Candidate Pool score) first, else the per-req screen.
      aiRating: r.metadata?.family_screen?.rating ?? r.ai_rating,
      rejectionReason: r.rejection_reason,
      appliedAt: r.applied_at,
      decidedAt: r.decided_at,
      resumeDocumentId: r.resume_document_id,
    };
  });

  return (
    <>
      <PageHead
        eyebrow="Talent"
        title="Applications"
        sub={`${rows.length.toLocaleString()} ${rows.length === 1 ? "application" : "applications"} to open job reqs`}
        action={
          <Link href="/admin/talent/applications/new" className="admin-btn admin-btn--primary admin-btn--sm">
            Add candidates
          </Link>
        }
      />
      {error && (
        <div className="admin-alert admin-alert--err" style={{ marginBottom: 14 }}>
          {error}
        </div>
      )}

      <div className="mp-kpi-grid" style={{ marginBottom: 20 }}>
        <MetricCard label="Active" value={rows.filter((r) => r.status === "active").length} sub="in pipeline" />
        <MetricCard label="On hold" value={rows.filter((r) => r.status === "on_hold").length} sub="parked" />
        <MetricCard label="Hired" value={rows.filter((r) => r.status === "hired").length} sub="closed won" />
      </div>

      <ApplicationsTable rows={rows} />
    </>
  );
}
