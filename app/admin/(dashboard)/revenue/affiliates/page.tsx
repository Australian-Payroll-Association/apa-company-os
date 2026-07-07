import Link from "next/link";
import { listEntity } from "@/lib/admin/query";
import { PageHead } from "@/components/admin/PageHead";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { Badge } from "@/components/admin/Badge";
import { formatDate, humanize } from "@/lib/admin/format";
import { firstParam, type SearchParamsObj } from "@/lib/admin/url";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Affiliates",
  description: "Referral partners and their commissions.",
};

// Revenue office: affiliate / referral partners. Each links to its person 360.
type P = { full_name: string | null; email: string };
type Affiliate = {
  id: string;
  code: string;
  program_type: string | null;
  rate: number | null;
  stripe_coupon_id: string | null;
  active: boolean | null;
  notes: string | null;
  created_at: string;
  person_id: string | null;
  people: P | P[] | null;
};

const one = <T,>(e: T | T[] | null): T | null => (Array.isArray(e) ? e[0] ?? null : e);
const PAGE_SIZE = 25;
const SORTABLE = new Set(["code", "program_type", "rate", "active", "created_at"]);

export default async function AffiliatesPage({ searchParams }: { searchParams: SearchParamsObj }) {
  const page = Math.max(1, Number(firstParam(searchParams.page) ?? "1") || 1);
  const q = firstParam(searchParams.q) ?? "";
  const sortParam = firstParam(searchParams.sort);
  const sort = sortParam && SORTABLE.has(sortParam) ? sortParam : "created_at";
  const dir = firstParam(searchParams.dir) === "asc" ? "asc" : "desc";

  const { rows, total, pageSize, error } = await listEntity<Affiliate>(
    "affiliates",
    "id, code, program_type, rate, stripe_coupon_id, active, notes, created_at, person_id, people(full_name, email)",
    { page, pageSize: PAGE_SIZE, search: q, searchColumns: ["code", "notes"], sort, dir },
  );

  const columns: Column<Affiliate>[] = [
    { key: "code", header: "Code", sortable: true, cell: (r) => <span className="admin-cell-strong">{r.code}</span> },
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
    { key: "program_type", header: "Program", sortable: true, cell: (r) => (r.program_type ? <Badge>{humanize(r.program_type)}</Badge> : <span className="admin-cell-muted">—</span>) },
    { key: "rate", header: "Rate", sortable: true, cell: (r) => (r.rate != null ? String(r.rate) : <span className="admin-cell-muted">—</span>) },
    { key: "coupon", header: "Coupon", cell: (r) => r.stripe_coupon_id || <span className="admin-cell-muted">—</span> },
    { key: "active", header: "Active", sortable: true, cell: (r) => (r.active ? <Badge tone="ok">Active</Badge> : <Badge tone="neutral">Inactive</Badge>) },
    { key: "created_at", header: "Added", sortable: true, cell: (r) => formatDate(r.created_at) },
  ];

  return (
    <>
      <PageHead eyebrow="Revenue" title="Affiliates" sub={`${total.toLocaleString()} affiliates`} />
      {error && <div className="admin-alert admin-alert--err" style={{ marginBottom: 14 }}>{error}</div>}
      <DataTable columns={columns} rows={rows} total={total} page={page} pageSize={pageSize} sort={sort} dir={dir} basePath="/admin/revenue/affiliates" searchParams={searchParams} searchPlaceholder="Search code or notes…" emptyText="No affiliates match." />
    </>
  );
}
