import Link from "next/link";
import { companyOs } from "@/lib/supabase";
import { listEntity, countEntity } from "@/lib/admin/query";
import { getActiveBrandId } from "@/lib/admin/brand";
import { PageHead } from "@/components/admin/PageHead";
import { MetricCard } from "@/components/admin/MetricCard";
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
// No FilterBar: program_type and active are single-valued today, so a dropdown would
// be dead weight — search + sort cover it.
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
  const brandId = getActiveBrandId();
  const page = Math.max(1, Number(firstParam(searchParams.page) ?? "1") || 1);
  const q = firstParam(searchParams.q) ?? "";
  const sortParam = firstParam(searchParams.sort);
  const sort = sortParam && SORTABLE.has(sortParam) ? sortParam : "created_at";
  const dir = firstParam(searchParams.dir) === "asc" ? "asc" : "desc";

  const brandFilter: Record<string, string | number | boolean | null> = brandId ? { brand_id: brandId } : {};

  const [{ rows, total, pageSize, error }, activeCount, couponRes] = await Promise.all([
    listEntity<Affiliate>(
      "affiliates",
      "id, code, program_type, rate, stripe_coupon_id, active, notes, created_at, person_id, people(full_name, email)",
      { page, pageSize: PAGE_SIZE, search: q, searchColumns: ["code", "notes"], sort, dir, filters: brandId ? { brand_id: brandId } : undefined },
    ),
    countEntity("affiliates", { ...brandFilter, active: true }),
    (() => {
      let x = companyOs.from("affiliates").select("*", { count: "exact", head: true }).not("stripe_coupon_id", "is", null);
      if (brandId) x = x.eq("brand_id", brandId);
      return x;
    })(),
  ]);

  const couponCount = couponRes.count ?? 0;

  const columns: Column<Affiliate>[] = [
    { key: "code", header: "Code", sortable: true, cell: (r) => <span className="admin-cell-strong admin-cell-mono">{r.code}</span> },
    {
      key: "person",
      header: "Contact",
      cell: (r) => {
        const p = one(r.people);
        const label = p?.full_name || p?.email;
        return <span className={label ? "admin-cell-strong" : "admin-cell-muted"}>{label || "—"}</span>;
      },
    },
    { key: "program_type", header: "Program", sortable: true, cell: (r) => (r.program_type ? <Badge>{humanize(r.program_type)}</Badge> : <span className="admin-cell-muted">—</span>) },
    { key: "rate", header: "Rate", sortable: true, align: "right", className: "admin-cell-mono", cell: (r) => (r.rate != null ? String(r.rate) : <span className="admin-cell-muted">—</span>) },
    { key: "coupon", header: "Coupon", cell: (r) => (r.stripe_coupon_id ? <span className="admin-cell-mono">{r.stripe_coupon_id}</span> : <span className="admin-cell-muted">—</span>) },
    { key: "active", header: "Active", sortable: true, cell: (r) => (r.active ? <Badge tone="ok">Active</Badge> : <Badge tone="neutral">Inactive</Badge>) },
    { key: "created_at", header: "Added", sortable: true, cell: (r) => formatDate(r.created_at) },
  ];

  return (
    <>
      <PageHead eyebrow="Revenue" title="Affiliates" sub={`${total.toLocaleString()} ${total === 1 ? "affiliate" : "affiliates"}`} />
      {error && <div className="admin-alert admin-alert--err" style={{ marginBottom: 14 }}>{error}</div>}

      <div className="mp-kpi-grid" style={{ marginBottom: 20 }}>
        <MetricCard label="Active affiliates" value={activeCount} sub={`of ${total.toLocaleString()} codes`} />
        <MetricCard label="With Stripe coupon" value={couponCount} sub="linked discount code" />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        total={total}
        page={page}
        pageSize={pageSize}
        sort={sort}
        dir={dir}
        basePath="/admin/revenue/affiliates"
        searchParams={searchParams}
        searchPlaceholder="Search code or notes…"
        emptyText="No affiliates match."
        getRowPreview={(r) => {
          const p = one(r.people);
          return {
            eyebrow: "Affiliate",
            title: r.code,
            body: (
              <>
                <dl className="admin-kv">
                  <dt>Contact</dt>
                  <dd>{p?.full_name || p?.email || "—"}</dd>
                  <dt>Program</dt>
                  <dd>{r.program_type ? <Badge>{humanize(r.program_type)}</Badge> : "—"}</dd>
                  <dt>Rate</dt>
                  <dd className="admin-cell-mono">{r.rate != null ? String(r.rate) : "—"}</dd>
                  <dt>Coupon</dt>
                  <dd className="admin-cell-mono">{r.stripe_coupon_id || "—"}</dd>
                  <dt>Active</dt>
                  <dd>{r.active ? <Badge tone="ok">Active</Badge> : <Badge tone="neutral">Inactive</Badge>}</dd>
                  {r.notes ? (
                    <>
                      <dt>Notes</dt>
                      <dd>{r.notes}</dd>
                    </>
                  ) : null}
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
