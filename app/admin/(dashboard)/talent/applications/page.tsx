import { countEntity } from "@/lib/admin/query";
import { companyOs } from "@/lib/supabase";
import { PageHead } from "@/components/admin/PageHead";
import { MetricCard } from "@/components/admin/MetricCard";
import { ApplicationsTable, type AppRow } from "./ApplicationsTable";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Applications",
  description: "Job applications moving through the hiring pipeline.",
};

// Talent office: every application across all reqs, joined straight to the
// person (the candidates table is retired). Rows load once and the client
// table handles search, the job-req filter, paging, and the manage shelf.
type P = {
  full_name: string | null;
  email: string;
  phone: string | null;
  headline: string | null;
  current_title: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  do_not_hire: boolean;
};
type Jr = { title: string | null };
type St = { name: string | null };
type RawApp = {
  id: string;
  status: string | null;
  rating: number | null;
  applied_at: string | null;
  decided_at: string | null;
  rejection_reason: string | null;
  current_stage_id: string | null;
  cover_letter: string | null;
  answers: { q: string; a: string }[] | null;
  resume_document_id: string | null;
  job_requisition_id: string | null;
  person_id: string | null;
  people: P | P[] | null;
  job_requisitions: Jr | Jr[] | null;
  application_stages: St | St[] | null;
};

const one = <T,>(e: T | T[] | null): T | null => (Array.isArray(e) ? e[0] ?? null : e);

export default async function ApplicationsPage() {
  const [appsRes, activeCount, onHoldCount, hiredCount] = await Promise.all([
    companyOs
      .from("applications")
      .select(
        "id, status, rating, applied_at, decided_at, rejection_reason, current_stage_id, cover_letter, answers, resume_document_id, job_requisition_id, person_id, people!person_id(full_name, email, phone, headline, current_title, linkedin_url, portfolio_url, do_not_hire), job_requisitions(title), application_stages(name)",
      )
      .order("created_at", { ascending: false })
      .limit(2000),
    countEntity("applications", { status: "active" }),
    countEntity("applications", { status: "on_hold" }),
    countEntity("applications", { status: "hired" }),
  ]);

  const error = appsRes.error?.message ?? null;
  const raw = (appsRes.data ?? []) as unknown as RawApp[];
  const rows: AppRow[] = raw.map((r) => {
    const p = one(r.people);
    return {
      id: r.id,
      candidateName: p?.full_name || p?.email || null,
      email: p?.email ?? null,
      phone: p?.phone ?? null,
      headline: p?.headline ?? null,
      currentTitle: p?.current_title ?? null,
      linkedinUrl: p?.linkedin_url ?? null,
      portfolioUrl: p?.portfolio_url ?? null,
      doNotHire: Boolean(p?.do_not_hire),
      personId: r.person_id,
      jobReqId: r.job_requisition_id,
      jobReqTitle: one(r.job_requisitions)?.title ?? null,
      stageName: one(r.application_stages)?.name ?? null,
      currentStageId: r.current_stage_id,
      status: r.status,
      rating: r.rating,
      rejectionReason: r.rejection_reason,
      appliedAt: r.applied_at,
      decidedAt: r.decided_at,
      coverLetter: r.cover_letter,
      answers: Array.isArray(r.answers) ? r.answers : [],
      resumeDocumentId: r.resume_document_id,
    };
  });

  return (
    <>
      <PageHead
        eyebrow="Talent"
        title="Applications"
        sub={`${rows.length.toLocaleString()} ${rows.length === 1 ? "application" : "applications"}`}
      />
      {error && (
        <div className="admin-alert admin-alert--err" style={{ marginBottom: 14 }}>
          {error}
        </div>
      )}

      <div className="mp-kpi-grid" style={{ marginBottom: 20 }}>
        <MetricCard label="Active" value={activeCount} sub="in pipeline" />
        <MetricCard label="On hold" value={onHoldCount} sub="parked" />
        <MetricCard label="Hired" value={hiredCount} sub="closed won" />
      </div>

      <ApplicationsTable rows={rows} />
    </>
  );
}
