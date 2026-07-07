import Link from "next/link";
import { listEntity } from "@/lib/admin/query";
import { PageHead } from "@/components/admin/PageHead";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { Badge, statusTone } from "@/components/admin/Badge";
import { formatCents, formatDate, humanize } from "@/lib/admin/format";
import { firstParam, type SearchParamsObj } from "@/lib/admin/url";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Orders",
  description: "Customer orders and payments.",
};

// Revenue office: orders (financial records, read-mostly). Born from checkout.
type P = { full_name: string | null; email: string };
type Pr = { title: string | null };
type Order = {
  id: string;
  amount_cents: number | null;
  currency: string | null;
  status: string | null;
  payment_method: string | null;
  refunded_cents: number | null;
  stripe_session_id: string | null;
  created_at: string;
  person_id: string | null;
  people: P | P[] | null;
  products: Pr | Pr[] | null;
};

const one = <T,>(e: T | T[] | null): T | null => (Array.isArray(e) ? e[0] ?? null : e);
const PAGE_SIZE = 25;
const SORTABLE = new Set(["amount_cents", "status", "payment_method", "created_at"]);

export default async function OrdersPage({ searchParams }: { searchParams: SearchParamsObj }) {
  const page = Math.max(1, Number(firstParam(searchParams.page) ?? "1") || 1);
  const q = firstParam(searchParams.q) ?? "";
  const sortParam = firstParam(searchParams.sort);
  const sort = sortParam && SORTABLE.has(sortParam) ? sortParam : "created_at";
  const dir = firstParam(searchParams.dir) === "asc" ? "asc" : "desc";

  const { rows, total, pageSize, error } = await listEntity<Order>(
    "orders",
    "id, amount_cents, currency, status, payment_method, refunded_cents, stripe_session_id, created_at, person_id, people(full_name, email), products(title)",
    { page, pageSize: PAGE_SIZE, search: q, searchColumns: ["stripe_session_id"], sort, dir },
  );

  const columns: Column<Order>[] = [
    {
      key: "person",
      header: "Contact",
      cell: (r) => {
        const p = one(r.people);
        return r.person_id ? (
          <Link href={`/admin/contacts/${r.person_id}`} className="admin-cell-strong">
            {p?.full_name || p?.email || "View"}
          </Link>
        ) : (
          <span className="admin-cell-muted">{p?.email || "—"}</span>
        );
      },
    },
    { key: "product", header: "Product", cell: (r) => one(r.products)?.title || <span className="admin-cell-muted">—</span> },
    { key: "amount_cents", header: "Amount", sortable: true, cell: (r) => formatCents(r.amount_cents, r.currency ?? undefined) },
    { key: "status", header: "Status", sortable: true, cell: (r) => (r.status ? <Badge tone={statusTone(r.status)}>{humanize(r.status)}</Badge> : <span className="admin-cell-muted">—</span>) },
    { key: "payment_method", header: "Method", sortable: true, cell: (r) => r.payment_method || <span className="admin-cell-muted">—</span> },
    { key: "created_at", header: "Added", sortable: true, cell: (r) => formatDate(r.created_at) },
  ];

  return (
    <>
      <PageHead eyebrow="Revenue" title="Orders" sub={`${total.toLocaleString()} orders`} />
      {error && <div className="admin-alert admin-alert--err" style={{ marginBottom: 14 }}>{error}</div>}
      <DataTable columns={columns} rows={rows} total={total} page={page} pageSize={pageSize} sort={sort} dir={dir} basePath="/admin/revenue/orders" searchParams={searchParams} searchPlaceholder="Search Stripe session…" emptyText="No orders match." />
    </>
  );
}
