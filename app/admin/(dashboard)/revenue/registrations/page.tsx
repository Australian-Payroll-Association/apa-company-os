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
  title: "Retreat",
  description: "Event and program registrations.",
};

// Revenue office: event registrations. Each links to its person 360 when known.
type P = { full_name: string | null; email: string };
type Pr = { title: string | null };
type Registration = {
  id: string;
  attendee_name: string | null;
  attendee_email: string | null;
  status: string | null;
  created_at: string;
  person_id: string | null;
  people: P | P[] | null;
  products: Pr | Pr[] | null;
};

const one = <T,>(e: T | T[] | null): T | null => (Array.isArray(e) ? e[0] ?? null : e);
const PAGE_SIZE = 25;
const SORTABLE = new Set(["attendee_name", "attendee_email", "status", "created_at"]);

// Real distinct values in the table today (checked against the DB).
const STATUS_OPTIONS = [
  { value: "confirmed", label: "Confirmed" },
  { value: "refunded", label: "Refunded" },
];

export default async function RegistrationsPage({ searchParams }: { searchParams: SearchParamsObj }) {
  const page = Math.max(1, Number(firstParam(searchParams.page) ?? "1") || 1);
  const q = firstParam(searchParams.q) ?? "";
  const sortParam = firstParam(searchParams.sort);
  const sort = sortParam && SORTABLE.has(sortParam) ? sortParam : "created_at";
  const dir = firstParam(searchParams.dir) === "asc" ? "asc" : "desc";
  const statusParam = firstParam(searchParams.status);

  const filters: Record<string, string | number | boolean | null> = {};
  if (statusParam) filters.status = statusParam;

  const [{ rows, total, pageSize, error }, confirmedCount, refundedCount] = await Promise.all([
    listEntity<Registration>(
      "event_registrations",
      "id, attendee_name, attendee_email, status, created_at, person_id, people(full_name, email), products(title)",
      { page, pageSize: PAGE_SIZE, search: q, searchColumns: ["attendee_name", "attendee_email"], sort, dir, filters },
    ),
    countEntity("event_registrations", { status: "confirmed" }),
    countEntity("event_registrations", { status: "refunded" }),
  ]);

  const columns: Column<Registration>[] = [
    {
      key: "attendee_name",
      header: "Attendee",
      sortable: true,
      cell: (r) => {
        const p = one(r.people);
        const label = r.attendee_name || p?.full_name;
        return <span className={label ? "admin-cell-strong" : "admin-cell-muted"}>{label || "—"}</span>;
      },
    },
    { key: "attendee_email", header: "Email", sortable: true, cell: (r) => <span className="admin-cell-muted">{r.attendee_email || one(r.people)?.email || "—"}</span> },
    { key: "product", header: "Product", cell: (r) => one(r.products)?.title || <span className="admin-cell-muted">—</span> },
    { key: "status", header: "Status", sortable: true, cell: (r) => (r.status ? <Badge tone={statusTone(r.status)}>{humanize(r.status)}</Badge> : <span className="admin-cell-muted">—</span>) },
    { key: "created_at", header: "Added", sortable: true, cell: (r) => formatDate(r.created_at) },
  ];

  return (
    <>
      <PageHead eyebrow="Revenue" title="Retreat" sub={`${total.toLocaleString()} ${total === 1 ? "registration" : "registrations"}`} />
      {error && <div className="admin-alert admin-alert--err" style={{ marginBottom: 14 }}>{error}</div>}

      <div className="mp-kpi-grid" style={{ marginBottom: 20 }}>
        <MetricCard label="Confirmed" value={confirmedCount} sub="attending" />
        <MetricCard label="Refunded" value={refundedCount} sub="cancelled with refund" />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        total={total}
        page={page}
        pageSize={pageSize}
        sort={sort}
        dir={dir}
        basePath="/admin/revenue/registrations"
        searchParams={searchParams}
        searchPlaceholder="Search attendee…"
        emptyText="No registrations match."
        filterBar={
          <FilterBar
            basePath="/admin/revenue/registrations"
            searchParams={searchParams}
            filters={[{ key: "status", label: "Status", options: STATUS_OPTIONS }]}
          />
        }
        getRowPreview={(r) => {
          const p = one(r.people);
          return {
            eyebrow: "Registration",
            title: r.attendee_name || p?.full_name || p?.email || "Attendee",
            body: (
              <>
                <dl className="admin-kv">
                  <dt>Attendee</dt>
                  <dd>{r.attendee_name || p?.full_name || "—"}</dd>
                  <dt>Email</dt>
                  <dd>{r.attendee_email || p?.email || "—"}</dd>
                  <dt>Product</dt>
                  <dd>{one(r.products)?.title || "—"}</dd>
                  <dt>Status</dt>
                  <dd>{r.status ? <Badge tone={statusTone(r.status)}>{humanize(r.status)}</Badge> : "—"}</dd>
                  <dt>Created</dt>
                  <dd>{formatDate(r.created_at)}</dd>
                </dl>
                {r.person_id && (
                  <div style={{ marginTop: 16 }}>
                    <Link href={`/admin/contacts/${r.person_id}`} className="admin-btn admin-btn--primary">
                      Open contact
                    </Link>
                  </div>
                )}
              </>
            ),
          };
        }}
      />
    </>
  );
}
