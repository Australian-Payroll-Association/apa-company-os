import Link from "next/link";
import { listEntity } from "@/lib/admin/query";
import { PageHead } from "@/components/admin/PageHead";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { Badge, statusTone } from "@/components/admin/Badge";
import { formatCents, formatDate, humanize } from "@/lib/admin/format";
import { firstParam, type SearchParamsObj } from "@/lib/admin/url";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "AIO Pad",
  description: "Scheduled bookings and reservations.",
};

// Revenue office: bookings (private sessions, stays). Each links to its person 360.
type P = { full_name: string | null; email: string };
type Pr = { title: string | null };
type Booking = {
  id: string;
  kind: string | null;
  start_date: string | null;
  end_date: string | null;
  party_size: number | null;
  amount_cents: number | null;
  currency: string | null;
  status: string | null;
  created_at: string;
  person_id: string | null;
  people: P | P[] | null;
  products: Pr | Pr[] | null;
};

const one = <T,>(e: T | T[] | null): T | null => (Array.isArray(e) ? e[0] ?? null : e);
const PAGE_SIZE = 25;
const SORTABLE = new Set(["start_date", "kind", "party_size", "amount_cents", "status", "created_at"]);

export default async function BookingsPage({ searchParams }: { searchParams: SearchParamsObj }) {
  const page = Math.max(1, Number(firstParam(searchParams.page) ?? "1") || 1);
  const q = firstParam(searchParams.q) ?? "";
  const sortParam = firstParam(searchParams.sort);
  const sort = sortParam && SORTABLE.has(sortParam) ? sortParam : "created_at";
  const dir = firstParam(searchParams.dir) === "asc" ? "asc" : "desc";

  const { rows, total, pageSize, error } = await listEntity<Booking>(
    "bookings",
    "id, kind, start_date, end_date, party_size, amount_cents, currency, status, created_at, person_id, people(full_name, email), products(title)",
    { page, pageSize: PAGE_SIZE, search: q, searchColumns: ["kind"], sort, dir },
  );

  const columns: Column<Booking>[] = [
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
    { key: "kind", header: "Kind", sortable: true, cell: (r) => (r.kind ? <Badge>{humanize(r.kind)}</Badge> : <span className="admin-cell-muted">—</span>) },
    {
      key: "start_date",
      header: "Dates",
      sortable: true,
      cell: (r) =>
        r.start_date ? (
          r.end_date ? `${formatDate(r.start_date)} → ${formatDate(r.end_date)}` : formatDate(r.start_date)
        ) : (
          <span className="admin-cell-muted">—</span>
        ),
    },
    { key: "party_size", header: "Party", sortable: true, cell: (r) => r.party_size ?? <span className="admin-cell-muted">—</span> },
    { key: "amount_cents", header: "Amount", sortable: true, cell: (r) => formatCents(r.amount_cents, r.currency ?? undefined) },
    { key: "status", header: "Status", sortable: true, cell: (r) => (r.status ? <Badge tone={statusTone(r.status)}>{humanize(r.status)}</Badge> : <span className="admin-cell-muted">—</span>) },
    { key: "created_at", header: "Added", sortable: true, cell: (r) => formatDate(r.created_at) },
  ];

  return (
    <>
      <PageHead eyebrow="Revenue" title="AIO Pad" sub={`${total.toLocaleString()} bookings`} />
      {error && <div className="admin-alert admin-alert--err" style={{ marginBottom: 14 }}>{error}</div>}
      <DataTable columns={columns} rows={rows} total={total} page={page} pageSize={pageSize} sort={sort} dir={dir} basePath="/admin/revenue/bookings" searchParams={searchParams} searchPlaceholder="Search kind…" emptyText="No bookings match." />
    </>
  );
}
