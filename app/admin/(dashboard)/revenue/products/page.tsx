import { listEntity } from "@/lib/admin/query";
import { PageHead } from "@/components/admin/PageHead";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { Badge } from "@/components/admin/Badge";
import { formatCents, formatDate, humanize } from "@/lib/admin/format";
import { firstParam, type SearchParamsObj } from "@/lib/admin/url";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Products",
  description: "Sellable products and services.",
};

// Revenue office: the sellable catalog (events, sprints, memberships).
type Product = {
  id: string;
  title: string | null;
  type: string | null;
  tier: string | null;
  location: string | null;
  date_start: string | null;
  amount_cents: number | null;
  currency: string | null;
  active: boolean | null;
  created_at: string;
};

const PAGE_SIZE = 25;
const SORTABLE = new Set(["title", "type", "tier", "location", "date_start", "amount_cents", "active", "created_at"]);

export default async function ProductsPage({ searchParams }: { searchParams: SearchParamsObj }) {
  const page = Math.max(1, Number(firstParam(searchParams.page) ?? "1") || 1);
  const q = firstParam(searchParams.q) ?? "";
  const sortParam = firstParam(searchParams.sort);
  const sort = sortParam && SORTABLE.has(sortParam) ? sortParam : "created_at";
  const dir = firstParam(searchParams.dir) === "asc" ? "asc" : "desc";

  const { rows, total, pageSize, error } = await listEntity<Product>(
    "products",
    "id, title, type, tier, location, date_start, amount_cents, currency, active, created_at",
    { page, pageSize: PAGE_SIZE, search: q, searchColumns: ["title"], sort, dir },
  );

  const columns: Column<Product>[] = [
    { key: "title", header: "Title", sortable: true, cell: (r) => <span className="admin-cell-strong">{r.title || "(untitled)"}</span> },
    { key: "type", header: "Type", sortable: true, cell: (r) => (r.type ? <Badge>{humanize(r.type)}</Badge> : <span className="admin-cell-muted">—</span>) },
    { key: "tier", header: "Tier", sortable: true, cell: (r) => r.tier || <span className="admin-cell-muted">—</span> },
    { key: "location", header: "Location", sortable: true, cell: (r) => r.location || <span className="admin-cell-muted">—</span> },
    { key: "date_start", header: "Starts", sortable: true, cell: (r) => (r.date_start ? formatDate(r.date_start) : <span className="admin-cell-muted">—</span>) },
    { key: "amount_cents", header: "Price", sortable: true, cell: (r) => formatCents(r.amount_cents, r.currency ?? undefined) },
    { key: "active", header: "Active", sortable: true, cell: (r) => (r.active ? <Badge tone="ok">Active</Badge> : <Badge tone="neutral">Inactive</Badge>) },
    { key: "created_at", header: "Added", sortable: true, cell: (r) => formatDate(r.created_at) },
  ];

  return (
    <>
      <PageHead eyebrow="Revenue" title="Products" sub={`${total.toLocaleString()} products`} />
      {error && <div className="admin-alert admin-alert--err" style={{ marginBottom: 14 }}>{error}</div>}
      <DataTable columns={columns} rows={rows} total={total} page={page} pageSize={pageSize} sort={sort} dir={dir} basePath="/admin/revenue/products" searchParams={searchParams} searchPlaceholder="Search title…" emptyText="No products match." />
    </>
  );
}
