import Link from "next/link";
import { notFound } from "next/navigation";
import { companyOs } from "@/lib/supabase";
import { PageHead } from "@/components/admin/PageHead";
import { Badge, statusTone } from "@/components/admin/Badge";
import { formatCents, formatDate, humanize } from "@/lib/admin/format";
import type { KanbanColumn } from "@/components/admin/KanbanBoard";
import { JobReqBoard, type AppCard } from "./JobReqBoard";
import { JobPostingEditor } from "./JobPostingEditor";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Job requisition",
  description: "One open role and its applicants.",
};

const one = <T,>(e: T | T[] | null): T | null => (Array.isArray(e) ? e[0] ?? null : e);
const STAGE_ACCENT = ["#287BE8", "#6b7194", "#D1458B", "#f59e0b", "#1a9e74", "#9ca3af"];

type Co = { name: string | null };
type ReqRow = {
  id: string;
  title: string | null;
  status: string | null;
  employment_type: string | null;
  location: string | null;
  remote_policy: string | null;
  salary_min_cents: number | null;
  salary_max_cents: number | null;
  currency: string | null;
  opened_at: string | null;
  description: string | null;
  requirements: string | null;
  responsibilities: string | null;
  slug: string | null;
  is_public: boolean;
  full_jd: string | null;
  application_questions: unknown;
  metadata: Record<string, unknown> | null;
  companies: Co | Co[] | null;
};
type Cp = { headline: string | null };
type P = { full_name: string | null; email: string; candidate_profile: Cp | Cp[] | null };
type AppRow = {
  id: string;
  current_stage_id: string | null;
  status: string | null;
  rating: number | null;
  applied_at: string | null;
  person_id: string | null;
  people: P | P[] | null;
};

export default async function JobReqDetailPage({ params }: { params: { id: string } }) {
  const id = params.id;

  const reqRes = await companyOs
    .from("job_requisitions")
    .select(
      "id, title, status, employment_type, location, remote_policy, salary_min_cents, salary_max_cents, currency, opened_at, description, requirements, responsibilities, slug, is_public, full_jd, application_questions, metadata, companies!client_company_id(name)",
    )
    .eq("id", id)
    .maybeSingle();
  if (reqRes.error || !reqRes.data) notFound();
  const req = reqRes.data as ReqRow;

  const [stagesRes, appsRes] = await Promise.all([
    companyOs.from("application_stages").select("id, name, position, is_terminal").eq("job_requisition_id", id).order("position"),
    companyOs
      .from("applications")
      .select("id, current_stage_id, status, rating, applied_at, person_id, people!person_id(full_name, email, candidate_profile(headline))")
      .eq("job_requisition_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const stages = (stagesRes.data ?? []) as Array<{ id: string; name: string; position: number; is_terminal: boolean }>;
  const columns: KanbanColumn[] = stages.map((s, i) => ({ id: s.id, label: s.name, accent: STAGE_ACCENT[i % STAGE_ACCENT.length] }));
  const firstStageId = columns[0]?.id ?? "";

  const cards: AppCard[] = ((appsRes.data ?? []) as AppRow[]).map((a) => {
    const p = one(a.people);
    const cp = one(p?.candidate_profile ?? null);
    return {
      id: a.id,
      columnId: a.current_stage_id ?? firstStageId,
      candidateName: p?.full_name ?? p?.email ?? null,
      personId: a.person_id,
      headline: cp?.headline ?? null,
      status: a.status,
      rating: a.rating,
      appliedAt: a.applied_at,
    };
  });

  const co = one(req.companies)?.name ?? null;
  const salary =
    req.salary_min_cents != null || req.salary_max_cents != null
      ? `${formatCents(req.salary_min_cents, req.currency ?? undefined)} – ${formatCents(req.salary_max_cents, req.currency ?? undefined)}`
      : null;

  const sections = [
    { label: "Description", body: req.description },
    { label: "Requirements", body: req.requirements },
    { label: "Responsibilities", body: req.responsibilities },
  ].filter((s) => s.body);

  return (
    <>
      <PageHead
        eyebrow={<Link href="/admin/talent/jobs">← Job Reqs</Link>}
        title={req.title || "(untitled req)"}
        sub={[co, salary].filter(Boolean).join(" · ") || undefined}
      />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 20 }}>
        {req.status && <Badge tone={statusTone(req.status)}>{humanize(req.status)}</Badge>}
        {req.employment_type && <Badge>{humanize(req.employment_type)}</Badge>}
        {req.remote_policy && <Badge>{humanize(req.remote_policy)}</Badge>}
        {req.location && <Badge>{req.location}</Badge>}
        {req.opened_at && <span className="admin-cell-muted" style={{ fontSize: 13 }}>Opened {formatDate(req.opened_at)}</span>}
      </div>

      <div style={{ fontWeight: 700, fontSize: 15, margin: "4px 0 10px" }}>
        Hiring pipeline · {cards.length} {cards.length === 1 ? "applicant" : "applicants"}
      </div>
      <JobReqBoard jobReqId={id} columns={columns} initialCards={cards} />

      <JobPostingEditor
        reqId={id}
        posting={{
          isPublic: req.is_public,
          slug: req.slug ?? "",
          fullJd: req.full_jd ?? "",
          excerpt: typeof req.metadata?.excerpt === "string" ? req.metadata.excerpt : "",
          department: typeof req.metadata?.department === "string" ? req.metadata.department : "",
          featured: req.metadata?.featured === true,
          questions: Array.isArray(req.application_questions)
            ? (req.application_questions as unknown[]).filter((q): q is string => typeof q === "string").slice(0, 3)
            : [],
          reqIsOpen: req.status === "open",
        }}
      />

      {sections.length > 0 && (
        <div style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 16 }}>
          {sections.map((s) => (
            <div key={s.label}>
              <div className="admin-label" style={{ marginBottom: 4 }}>{s.label}</div>
              <div className="admin-card" style={{ padding: "14px 16px", whiteSpace: "pre-wrap", fontSize: 14 }}>{s.body}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
