import Link from "next/link";
import { listEntity } from "@/lib/admin/query";
import { PageHead } from "@/components/admin/PageHead";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { Badge } from "@/components/admin/Badge";
import { ArchivedToggle } from "@/components/admin/ArchivedToggle";
import { FilterBar } from "@/components/admin/FilterBar";
import { formatDate, humanize } from "@/lib/admin/format";
import { firstParam, type SearchParamsObj } from "@/lib/admin/url";
import { CompanyEditDrawer } from "./CompanyEditDrawer";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Companies",
  description: "Organizations tracked in the Company Database.",
};

// Revenue office: companies (accounts). Spine-level, brand-agnostic.
type Company = {
  id: string;
  name: string | null;
  domain: string | null;
  industry: string | null;
  size_band: string | null;
  country: string | null;
  website: string | null;
  priority: string | null;
  archived_at: string | null;
  created_at: string;
};

const PAGE_SIZE = 25;
const SORTABLE = new Set(["name", "domain", "industry", "size_band", "country", "priority", "created_at"]);

const PRIORITY_OPTIONS = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export default async function CompaniesPage({ searchParams }: { searchParams: SearchParamsObj }) {
  const page = Math.max(1, Number(firstParam(searchParams.page) ?? "1") || 1);
  const q = firstParam(searchParams.q) ?? "";
  const sortParam = firstParam(searchParams.sort);
  const sort = sortParam && SORTABLE.has(sortParam) ? sortParam : "created_at";
  const dir = firstParam(searchParams.dir) === "asc" ? "asc" : "desc";
  const showArchived = firstParam(searchParams.archived) === "1";
  const priorityParam = firstParam(searchParams.priority);

  const filters: Record<string, string | number | boolean | null> = {};
  if (priorityParam) filters.priority = priorityParam;

  const { rows, total, pageSize, error } = await listEntity<Company>(
    "companies",
    "id, name, domain, industry, size_band, country, website, priority, archived_at, created_at",
    {
      page,
      pageSize: PAGE_SIZE,
      search: q,
      searchColumns: ["name", "domain"],
      sort,
      dir,
      excludeArchived: !showArchived,
      filters,
    },
  );

  const columns: Column<Company>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      cell: (r) => (
        <Link href={`/admin/revenue/companies/${r.id}`} className="admin-cell-strong">
          {r.name || "(no name)"}
        </Link>
      ),
    },
    { key: "domain", header: "Domain", sortable: true, cell: (r) => <span className="admin-cell-muted">{r.domain || "—"}</span> },
    { key: "industry", header: "Industry", sortable: true, cell: (r) => r.industry || <span className="admin-cell-muted">—</span> },
    { key: "size_band", header: "Size", sortable: true, cell: (r) => r.size_band || <span className="admin-cell-muted">—</span> },
    { key: "country", header: "Country", sortable: true, cell: (r) => r.country || <span className="admin-cell-muted">—</span> },
    {
      key: "priority",
      header: "Priority",
      sortable: true,
      cell: (r) => (
        <span style={{ display: "inline-flex", gap: 4 }}>
          {r.archived_at && <Badge tone="neutral">Archived</Badge>}
          {r.priority ? <Badge>{humanize(r.priority)}</Badge> : !r.archived_at ? <span className="admin-cell-muted">—</span> : null}
        </span>
      ),
    },
    { key: "created_at", header: "Added", sortable: true, cell: (r) => formatDate(r.created_at) },
    { key: "actions", header: "", align: "right", cell: (r) => <CompanyEditDrawer company={r} /> },
  ];

  return (
    <>
      <PageHead
        eyebrow="Revenue"
        title="Companies"
        sub={`${total.toLocaleString()} ${total === 1 ? "company" : "companies"}${showArchived ? " · showing archived" : ""}`}
        action={
          <ArchivedToggle basePath="/admin/revenue/companies" searchParams={searchParams} showArchived={showArchived} />
        }
      />
      {error && <div className="admin-alert admin-alert--err" style={{ marginBottom: 14 }}>{error}</div>}
      <DataTable
        columns={columns}
        rows={rows}
        total={total}
        page={page}
        pageSize={pageSize}
        sort={sort}
        dir={dir}
        basePath="/admin/revenue/companies"
        searchParams={searchParams}
        searchPlaceholder="Search name or domain…"
        emptyText="No companies match."
        filterBar={
          <FilterBar
            basePath="/admin/revenue/companies"
            searchParams={searchParams}
            filters={[{ key: "priority", label: "Priority", options: PRIORITY_OPTIONS }]}
          />
        }
      />
    </>
  );
}
