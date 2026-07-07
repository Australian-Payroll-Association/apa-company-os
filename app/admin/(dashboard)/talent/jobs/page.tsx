import Link from "next/link";
import { listEntity } from "@/lib/admin/query";
import { PageHead } from "@/components/admin/PageHead";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { Badge, statusTone } from "@/components/admin/Badge";
import { formatCents, formatDate, humanize } from "@/lib/admin/format";
import { firstParam, type SearchParamsObj } from "@/lib/admin/url";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Job requisitions",
  description: "Open roles and their hiring status.",
};

// Talent office: job requisitions. Title opens the req's hiring board.
type Co = { name: string | null };
type JobReq = {
  id: string;
  title: string | null;
  employment_type: string | null;
  location: string | null;
  remote_policy: string | null;
  salary_min_cents: number | null;
  salary_max_cents: number | null;
  currency: string | null;
  status: string | null;
  opened_at: string | null;
  created_at: string;
  companies: Co | Co[] | null;
};

const one = <T,>(e: T | T[] | null): T | null => (Array.isArray(e) ? e[0] ?? null : e);
const PAGE_SIZE = 25;
const SORTABLE = new Set(["title", "opened_at", "created_at", "employment_type", "location", "salary_min_cents", "status"]);

function salaryBand(min: number | null, max: number | null, cur: string | null) {
  if (min == null && max == null) return null;
  const c = cur ?? undefined;
  if (min != null && max != null) return `${formatCents(min, c)} – ${formatCents(max, c)}`;
  return formatCents(min ?? max, c);
}

export default async function JobsPage({ searchParams }: { searchParams: SearchParamsObj }) {
  const page = Math.max(1, Number(firstParam(searchParams.page) ?? "1") || 1);
  const q = firstParam(searchParams.q) ?? "";
  const sortParam = firstParam(searchParams.sort);
  const sort = sortParam && SORTABLE.has(sortParam) ? sortParam : "created_at";
  const dir = firstParam(searchParams.dir) === "asc" ? "asc" : "desc";

  const { rows, total, pageSize, error } = await listEntity<JobReq>(
    "job_requisitions",
    "id, title, employment_type, location, remote_policy, salary_min_cents, salary_max_cents, currency, status, opened_at, created_at, companies!client_company_id(name)",
    { page, pageSize: PAGE_SIZE, search: q, searchColumns: ["title"], sort, dir },
  );

  const columns: Column<JobReq>[] = [
    { key: "title", header: "Title", sortable: true, cell: (r) => <Link href={`/admin/talent/jobs/${r.id}`} className="admin-cell-strong">{r.title || "(untitled req)"}</Link> },
    { key: "company", header: "Company", cell: (r) => one(r.companies)?.name || <span className="admin-cell-muted">—</span> },
    { key: "employment_type", header: "Type", sortable: true, cell: (r) => (r.employment_type ? <Badge>{humanize(r.employment_type)}</Badge> : <span className="admin-cell-muted">—</span>) },
    {
      key: "location",
      header: "Location",
      sortable: true,
      cell: (r) => {
        const parts = [r.location, r.remote_policy ? humanize(r.remote_policy) : null].filter(Boolean);
        return parts.length ? parts.join(" · ") : <span className="admin-cell-muted">—</span>;
      },
    },
    { key: "salary_min_cents", header: "Salary", sortable: true, cell: (r) => salaryBand(r.salary_min_cents, r.salary_max_cents, r.currency) || <span className="admin-cell-muted">—</span> },
    { key: "status", header: "Status", sortable: true, cell: (r) => (r.status ? <Badge tone={statusTone(r.status)}>{humanize(r.status)}</Badge> : <span className="admin-cell-muted">—</span>) },
    { key: "opened_at", header: "Opened", sortable: true, cell: (r) => (r.opened_at ? formatDate(r.opened_at) : <span className="admin-cell-muted">—</span>) },
  ];

  return (
    <>
      <PageHead eyebrow="Talent" title="Job Reqs" sub={`${total.toLocaleString()} requisitions`} />
      {error && <div className="admin-alert admin-alert--err" style={{ marginBottom: 14 }}>{error}</div>}
      <DataTable columns={columns} rows={rows} total={total} page={page} pageSize={pageSize} sort={sort} dir={dir} basePath="/admin/talent/jobs" searchParams={searchParams} searchPlaceholder="Search title…" emptyText="No job reqs match." />
    </>
  );
}
