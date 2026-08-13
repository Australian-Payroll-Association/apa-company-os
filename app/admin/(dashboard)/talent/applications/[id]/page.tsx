import Link from "next/link";
import { notFound } from "next/navigation";
import { companyOs } from "@/lib/supabase";
import { PageHead } from "@/components/admin/PageHead";
import { listAssignablePeople, listPeopleNames, type PersonOption } from "@/lib/admin/people-options";
import { ApplicationManage, type AppManageData } from "../ApplicationManage";
import { ApplicationLifecycle } from "./ApplicationLifecycle";

export const dynamic = "force-dynamic";
// Same data-cache pin as the list — a stale read here would show an old stage or
// a restored/archived state that no longer matches the DB.
export const fetchCache = "force-no-store";

// Full-page applicant profile. Unlike the list, this fetches one application by
// id with no open-req filter, so a shared link resolves even when the req has
// been closed or filled. Replaces the old side-drawer as the canonical,
// shareable place to manage an application.
type Cp = {
  headline: string | null;
  current_title: string | null;
  portfolio_url: string | null;
  do_not_hire: boolean;
  pool_status: string | null;
  english_proficiency: string | null;
  salary_expectation_cents: number | null;
  salary_expectation_currency: string | null;
  notice_period: string | null;
};
type P = {
  full_name: string | null;
  email: string;
  phone: string | null;
  city: string | null;
  country: string | null;
  linkedin_url: string | null;
  candidate_profile: Cp | Cp[] | null;
};
type Jr = { title: string | null };
type St = { name: string | null };
type RawApp = {
  id: string;
  status: string | null;
  rating: number | null;
  rejection_reason: string | null;
  applied_at: string | null;
  decided_at: string | null;
  source: string | null;
  source_detail: string | null;
  referrer_person_id: string | null;
  current_stage_id: string | null;
  resume_document_id: string | null;
  job_requisition_id: string | null;
  person_id: string | null;
  archived_at: string | null;
  hr_assessment: string | null;
  people: P | P[] | null;
  job_requisitions: Jr | Jr[] | null;
  application_stages: St | St[] | null;
};

const one = <T,>(e: T | T[] | null): T | null => (Array.isArray(e) ? e[0] ?? null : e);

export default async function ApplicationDetailPage({ params }: { params: { id: string } }) {
  const { data, error } = await companyOs
    .from("applications")
    .select(
      "id, status, rating, rejection_reason, applied_at, decided_at, source, source_detail, referrer_person_id, current_stage_id, resume_document_id, job_requisition_id, person_id, archived_at, hr_assessment, people!person_id(full_name, email, phone, city, country, linkedin_url, candidate_profile(headline, current_title, portfolio_url, do_not_hire, pool_status, english_proficiency, salary_expectation_cents, salary_expectation_currency, notice_period)), job_requisitions(title), application_stages(name)",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (error) {
    return (
      <>
        <PageHead eyebrow={<Link href="/admin/talent/applications">← Applications</Link>} title="Application" />
        <div className="admin-alert admin-alert--err">{error.message}</div>
      </>
    );
  }
  if (!data) notFound();

  const r = data as unknown as RawApp;
  const p = one(r.people);
  const cp = one(p?.candidate_profile ?? null);
  const candidateName = p?.full_name || p?.email || null;

  // Referrer picker: assignable team members (the usual referrers), plus the
  // current referrer if it happens to be someone no longer assignable, so the
  // stored value still renders and stays selectable.
  const referrerOptions: PersonOption[] = await listAssignablePeople();
  if (r.referrer_person_id && !referrerOptions.some((o) => o.id === r.referrer_person_id)) {
    const names = await listPeopleNames([r.referrer_person_id]);
    const name = names.get(r.referrer_person_id);
    if (name) referrerOptions.unshift({ id: r.referrer_person_id, name });
  }

  const app: AppManageData = {
    id: r.id,
    jobReqId: r.job_requisition_id,
    personId: r.person_id,
    jobReqTitle: one(r.job_requisitions)?.title ?? null,
    candidateName,
    status: r.status,
    rating: r.rating,
    rejectionReason: r.rejection_reason,
    currentStageId: r.current_stage_id,
    currentStageName: one(r.application_stages)?.name ?? null,
    appliedAt: r.applied_at,
    decidedAt: r.decided_at,
    source: r.source,
    sourceDetail: r.source_detail,
    referrerId: r.referrer_person_id,
    resumeDocumentId: r.resume_document_id,
    email: p?.email ?? null,
    phone: p?.phone ?? null,
    city: p?.city ?? null,
    country: p?.country ?? null,
    headline: cp?.headline ?? null,
    currentTitle: cp?.current_title ?? null,
    linkedinUrl: p?.linkedin_url ?? null,
    portfolioUrl: cp?.portfolio_url ?? null,
    doNotHire: Boolean(cp?.do_not_hire),
    poolStatus: cp?.pool_status ?? null,
    hrAssessment: r.hr_assessment,
    englishProficiency: cp?.english_proficiency ?? null,
    salaryExpectationCents: cp?.salary_expectation_cents ?? null,
    salaryExpectationCurrency: cp?.salary_expectation_currency ?? null,
    noticePeriod: cp?.notice_period ?? null,
  };

  return (
    <>
      <PageHead
        eyebrow={<Link href="/admin/talent/applications">← Applications</Link>}
        title={candidateName || "Candidate"}
        sub={app.jobReqTitle || undefined}
        action={<ApplicationLifecycle applicationId={r.id} archived={Boolean(r.archived_at)} />}
      />

      {r.archived_at && (
        <div
          className="admin-alert"
          style={{ marginBottom: 14, border: "1px solid var(--admin-line-strong)" }}
        >
          This application is archived and hidden from the pipeline. Use Restore to bring it back.
        </div>
      )}

      <div style={{ maxWidth: 760 }}>
        <ApplicationManage app={app} referrerOptions={referrerOptions} />
      </div>
    </>
  );
}
