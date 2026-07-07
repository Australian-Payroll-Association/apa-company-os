import { listEntity, countEntity } from "@/lib/admin/query";
import { PageHead } from "@/components/admin/PageHead";
import { MetricCard } from "@/components/admin/MetricCard";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { Badge, statusTone } from "@/components/admin/Badge";
import { FilterBar } from "@/components/admin/FilterBar";
import { formatDate, humanize } from "@/lib/admin/format";
import { firstParam, type SearchParamsObj } from "@/lib/admin/url";
import { ApplicationManage } from "./ApplicationManage";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Applications",
  description: "Job applications moving through the hiring pipeline.",
};

// Talent office: applications across all reqs. Candidate -> Contact 360,
// Job req -> the req's hiring board.
type P = { full_name: string | null; email: string };
type Cand = { person_id: string | null; people: P | P[] | null };
type Jr = { title: string | null };
type St = { name: string | null };
type Application = {
  id: string;
  status: string | null;
  rating: number | null;
  applied_at: string | null;
  decided_at: string | null;
  rejection_reason: string | null;
  current_stage_id: string | null;
  candidate_id: string | null;
  job_requisition_id: string | null;
  created_at: string;
  candidates: Cand | Cand[] | null;
  job_requisitions: Jr | Jr[] | null;
  application_stages: St | St[] | null;
};

const one = <T,>(e: T | T[] | null): T | null => (Array.isArray(e) ? e[0] ?? null : e);
const PAGE_SIZE = 25;
const SORTABLE = new Set(["applied_at", "created_at", "rating", "status", "decided_at"]);

// Real distinct values in the table today (checked against the DB).
const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On hold" },
  { value: "hired", label: "Hired" },
  { value: "rejected", label: "Rejected" },
];

export default async function ApplicationsPage({ searchParams }: { searchParams: SearchParamsObj }) {
  const page = Math.max(1, Number(firstParam(searchParams.page) ?? "1") || 1);
  const q = firstParam(searchParams.q) ?? "";
  const sortParam = firstParam(searchParams.sort);
  const sort = sortParam && SORTABLE.has(sortParam) ? sortParam : "created_at";
  const dir = firstParam(searchParams.dir) === "asc" ? "asc" : "desc";
  const statusParam = firstParam(searchParams.status);

  const filters: Record<string, string | number | boolean | null> = {};
  if (statusParam) filters.status = statusParam;

  const [{ rows, total, pageSize, error }, activeCount, onHoldCount, hiredCount] = await Promise.all([
    listEntity<Application>(
      "applications",
      "id, status, rating, applied_at, decided_at, rejection_reason, current_stage_id, candidate_id, job_requisition_id, created_at, candidates(person_id, people!person_id(full_name, email)), job_requisitions(title), application_stages(name)",
      { page, pageSize: PAGE_SIZE, search: q, searchColumns: ["source"], sort, dir, filters },
    ),
    countEntity("applications", { status: "active" }),
    countEntity("applications", { status: "on_hold" }),
    countEntity("applications", { status: "hired" }),
  ]);

  const columns: Column<Application>[] = [
    {
      key: "candidate",
      header: "Candidate",
      cell: (r) => {
        const cand = one(r.candidates);
        const p = one(cand?.people ?? null);
        const label = p?.full_name || p?.email;
        return <span className={label ? "admin-cell-strong" : "admin-cell-muted"}>{label || "—"}</span>;
      },
    },
    {
      key: "req",
      header: "Job req",
      cell: (r) => one(r.job_requisitions)?.title || <span className="admin-cell-muted">—</span>,
    },
    { key: "stage", header: "Stage", cell: (r) => one(r.application_stages)?.name || <span className="admin-cell-muted">—</span> },
    { key: "status", header: "Status", sortable: true, cell: (r) => (r.status ? <Badge tone={statusTone(r.status)}>{humanize(r.status)}</Badge> : <span className="admin-cell-muted">—</span>) },
    { key: "rating", header: "Rating", sortable: true, align: "right", className: "admin-cell-mono", cell: (r) => (r.rating != null ? `${r.rating}★` : <span className="admin-cell-muted">—</span>) },
    { key: "applied_at", header: "Applied", sortable: true, cell: (r) => (r.applied_at ? formatDate(r.applied_at) : <span className="admin-cell-muted">—</span>) },
    { key: "decided_at", header: "Decided", sortable: true, cell: (r) => (r.decided_at ? formatDate(r.decided_at) : <span className="admin-cell-muted">—</span>) },
  ];

  return (
    <>
      <PageHead eyebrow="Talent" title="Applications" sub={`${total.toLocaleString()} ${total === 1 ? "application" : "applications"}`} />
      {error && <div className="admin-alert admin-alert--err" style={{ marginBottom: 14 }}>{error}</div>}

      <div className="mp-kpi-grid" style={{ marginBottom: 20 }}>
        <MetricCard label="Active" value={activeCount} sub="in pipeline" />
        <MetricCard label="On hold" value={onHoldCount} sub="parked" />
        <MetricCard label="Hired" value={hiredCount} sub="closed won" />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        total={total}
        page={page}
        pageSize={pageSize}
        sort={sort}
        dir={dir}
        basePath="/admin/talent/applications"
        searchParams={searchParams}
        searchPlaceholder="Search source…"
        emptyText="No applications match."
        filterBar={
          <FilterBar
            basePath="/admin/talent/applications"
            searchParams={searchParams}
            filters={[{ key: "status", label: "Status", options: STATUS_OPTIONS }]}
          />
        }
        getRowPreview={(r) => {
          const cand = one(r.candidates);
          const p = one(cand?.people ?? null);
          const candidateName = p?.full_name || p?.email || null;
          return {
            eyebrow: "Application",
            title: candidateName || "Candidate",
            body: (
              <ApplicationManage
                app={{
                  id: r.id,
                  jobReqId: r.job_requisition_id,
                  personId: cand?.person_id ?? null,
                  jobReqTitle: one(r.job_requisitions)?.title ?? null,
                  candidateName,
                  status: r.status,
                  rating: r.rating,
                  rejectionReason: r.rejection_reason,
                  currentStageId: r.current_stage_id,
                  currentStageName: one(r.application_stages)?.name ?? null,
                  appliedAt: r.applied_at,
                  decidedAt: r.decided_at,
                }}
              />
            ),
          };
        }}
      />
    </>
  );
}
