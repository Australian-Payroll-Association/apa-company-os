import Link from "next/link";
import { listEntity, countEntity } from "@/lib/admin/query";
import { PageHead } from "@/components/admin/PageHead";
import { MetricCard } from "@/components/admin/MetricCard";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { Badge, statusTone } from "@/components/admin/Badge";
import { FilterBar } from "@/components/admin/FilterBar";
import { formatDate, humanize } from "@/lib/admin/format";
import { firstParam, type SearchParamsObj } from "@/lib/admin/url";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Candidates",
  description: "The talent pool and applicant records.",
};

// Talent office: candidates (persona=job_seeker). The row opens the recruiting
// Candidate detail; resume links to the signed-URL route handler.
type P = { full_name: string | null; email: string };
type Co = { name: string | null };
type Candidate = {
  id: string;
  headline: string | null;
  current_title: string | null;
  pool_status: string | null;
  linkedin_url: string | null;
  resume_document_id: string | null;
  person_id: string | null;
  created_at: string;
  people: P | P[] | null;
  companies: Co | Co[] | null;
};

const one = <T,>(e: T | T[] | null): T | null => (Array.isArray(e) ? e[0] ?? null : e);
const PAGE_SIZE = 25;
const SORTABLE = new Set(["created_at", "pool_status", "headline", "current_title"]);

// Real distinct values in the table today (checked against the DB).
const POOL_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "passive", label: "Passive" },
  { value: "placed", label: "Placed" },
  { value: "do_not_pursue", label: "Do not pursue" },
];

export default async function CandidatesPage({ searchParams }: { searchParams: SearchParamsObj }) {
  const page = Math.max(1, Number(firstParam(searchParams.page) ?? "1") || 1);
  const q = firstParam(searchParams.q) ?? "";
  const sortParam = firstParam(searchParams.sort);
  const sort = sortParam && SORTABLE.has(sortParam) ? sortParam : "created_at";
  const dir = firstParam(searchParams.dir) === "asc" ? "asc" : "desc";
  const poolParam = firstParam(searchParams.pool);

  const filters: Record<string, string | number | boolean | null> = {};
  if (poolParam) filters.pool_status = poolParam;

  const [{ rows, total, pageSize, error }, activeCount, passiveCount, placedCount] = await Promise.all([
    listEntity<Candidate>(
      "candidates",
      "id, headline, current_title, pool_status, linkedin_url, resume_document_id, person_id, created_at, people!person_id(full_name, email), companies(name)",
      { page, pageSize: PAGE_SIZE, search: q, searchColumns: ["headline", "current_title"], sort, dir, filters },
    ),
    countEntity("candidates", { pool_status: "active" }),
    countEntity("candidates", { pool_status: "passive" }),
    countEntity("candidates", { pool_status: "placed" }),
  ]);

  const columns: Column<Candidate>[] = [
    {
      key: "name",
      header: "Name",
      cell: (r) => {
        const p = one(r.people);
        return <span className="admin-cell-strong">{p?.full_name || p?.email || "(no name)"}</span>;
      },
    },
    { key: "headline", header: "Headline", sortable: true, cell: (r) => r.headline || <span className="admin-cell-muted">—</span> },
    {
      key: "current_title",
      header: "Current",
      sortable: true,
      cell: (r) => {
        const co = one(r.companies)?.name;
        const t = r.current_title;
        return t ? <span>{co ? `${t} @ ${co}` : t}</span> : <span className="admin-cell-muted">—</span>;
      },
    },
    { key: "pool_status", header: "Pool", sortable: true, cell: (r) => (r.pool_status ? <Badge tone={statusTone(r.pool_status)}>{humanize(r.pool_status)}</Badge> : <span className="admin-cell-muted">—</span>) },
    { key: "linkedin", header: "LinkedIn", cell: (r) => (r.linkedin_url ? <a href={r.linkedin_url} target="_blank" rel="noreferrer" className="admin-cell-strong">in ↗</a> : <span className="admin-cell-muted">—</span>) },
    { key: "resume", header: "Resume", cell: (r) => (r.resume_document_id ? <a href={`/admin/talent/resume/${r.resume_document_id}`} target="_blank" rel="noreferrer" className="admin-cell-strong">📎</a> : <span className="admin-cell-muted">—</span>) },
    { key: "created_at", header: "Added", sortable: true, cell: (r) => formatDate(r.created_at) },
  ];

  return (
    <>
      <PageHead eyebrow="Talent" title="Candidates" sub={`${total.toLocaleString()} ${total === 1 ? "candidate" : "candidates"} in the pool`} />
      {error && <div className="admin-alert admin-alert--err" style={{ marginBottom: 14 }}>{error}</div>}

      <div className="mp-kpi-grid" style={{ marginBottom: 20 }}>
        <MetricCard label="Active" value={activeCount} sub="sourceable now" />
        <MetricCard label="Passive" value={passiveCount} sub="open to nurture" />
        <MetricCard label="Placed" value={placedCount} sub="hired out" />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        total={total}
        page={page}
        pageSize={pageSize}
        sort={sort}
        dir={dir}
        basePath="/admin/talent/candidates"
        searchParams={searchParams}
        searchPlaceholder="Search headline or title…"
        emptyText="No candidates match."
        filterBar={
          <FilterBar
            basePath="/admin/talent/candidates"
            searchParams={searchParams}
            filters={[{ key: "pool", label: "Pool", options: POOL_OPTIONS }]}
          />
        }
        getRowPreview={(r) => {
          const p = one(r.people);
          const co = one(r.companies)?.name;
          return {
            eyebrow: "Candidate",
            title: p?.full_name || p?.email || "(no name)",
            body: (
              <>
                <dl className="admin-kv">
                  <dt>Headline</dt>
                  <dd>{r.headline || "—"}</dd>
                  <dt>Current</dt>
                  <dd>{r.current_title ? (co ? `${r.current_title} @ ${co}` : r.current_title) : "—"}</dd>
                  <dt>Pool</dt>
                  <dd>{r.pool_status ? <Badge tone={statusTone(r.pool_status)}>{humanize(r.pool_status)}</Badge> : "—"}</dd>
                  <dt>LinkedIn</dt>
                  <dd>{r.linkedin_url ? <a href={r.linkedin_url} target="_blank" rel="noreferrer">Profile ↗</a> : "—"}</dd>
                  <dt>Resume</dt>
                  <dd>{r.resume_document_id ? <a href={`/admin/talent/resume/${r.resume_document_id}`} target="_blank" rel="noreferrer">Open ↗</a> : "—"}</dd>
                  <dt>Added</dt>
                  <dd>{formatDate(r.created_at)}</dd>
                </dl>
                <div style={{ marginTop: 16 }}>
                  <Link href={`/admin/talent/candidates/${r.id}`} className="admin-btn admin-btn--primary">
                    Open full profile
                  </Link>
                </div>
              </>
            ),
          };
        }}
      />
    </>
  );
}
