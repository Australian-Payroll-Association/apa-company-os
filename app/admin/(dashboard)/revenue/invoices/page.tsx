import Link from "next/link";
import { companyOs } from "@/lib/supabase";
import { listEntity } from "@/lib/admin/query";
import { PageHead } from "@/components/admin/PageHead";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { Badge, statusTone } from "@/components/admin/Badge";
import { FilterBar } from "@/components/admin/FilterBar";
import { formatCents, formatDate, humanize } from "@/lib/admin/format";
import { firstParam, type SearchParamsObj } from "@/lib/admin/url";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Invoices",
  description: "QuickBooks invoice ledger — read-only mirror, synced weekly.",
};

const PAGE_SIZES = [25, 50, 100];
const SORTABLE = new Set(["doc_number", "txn_date", "due_date", "amount_cents", "balance_cents"]);
const STATUSES = ["paid", "open", "overdue", "voided"] as const;

type InvoiceListRow = {
  id: string;
  doc_number: string | null;
  txn_date: string;
  due_date: string | null;
  currency: string;
  amount_cents: number;
  balance_cents: number;
  status: string;
  customer_name: string | null;
  company_id: string;
  companies: { name: string } | null;
};

const INVOICE_SELECT =
  "id, doc_number, txn_date, due_date, currency, amount_cents, balance_cents, status, customer_name, company_id, companies(name)";

export default async function InvoicesPage({ searchParams }: { searchParams: SearchParamsObj }) {
  const page = Math.max(1, Number(firstParam(searchParams.page) ?? "1") || 1);
  const sizeParam = Number(firstParam(searchParams.size));
  const pageSizeChoice = PAGE_SIZES.includes(sizeParam) ? sizeParam : 25;
  const q = firstParam(searchParams.q) ?? "";
  const sortParam = firstParam(searchParams.sort);
  const sort = sortParam && SORTABLE.has(sortParam) ? sortParam : "txn_date";
  const dir = firstParam(searchParams.dir) === "asc" ? "asc" : "desc";
  const statusParam = firstParam(searchParams.status);

  const filters: Record<string, string> = {};
  if (statusParam && (STATUSES as readonly string[]).includes(statusParam)) {
    filters.status = statusParam;
  }

  const [{ rows, total, pageSize, error }, outstandingRes] = await Promise.all([
    listEntity<InvoiceListRow>("invoices", INVOICE_SELECT, {
      page,
      pageSize: pageSizeChoice,
      search: q,
      searchColumns: ["doc_number", "customer_name"],
      sort,
      dir,
      filters,
    }),
    companyOs.from("invoices").select("balance_cents").in("status", ["open", "overdue"]),
  ]);

  const outstandingCents = ((outstandingRes.data as { balance_cents: number }[] | null) ?? []).reduce(
    (s, r) => s + r.balance_cents,
    0,
  );

  const columns: Column<InvoiceListRow>[] = [
    {
      key: "doc_number",
      header: "Invoice",
      sortable: true,
      cell: (r) => <span className="admin-cell-mono admin-cell-strong">{r.doc_number || "—"}</span>,
    },
    {
      key: "company",
      header: "Company",
      cell: (r) =>
        r.companies ? (
          <Link href={`/admin/revenue/companies/${r.company_id}`}>{r.companies.name}</Link>
        ) : (
          <span className="admin-cell-muted">—</span>
        ),
    },
    {
      key: "customer_name",
      header: "Billed to",
      cell: (r) =>
        r.customer_name && r.customer_name !== r.companies?.name ? (
          <span className="admin-cell-muted">{r.customer_name}</span>
        ) : (
          <span className="admin-cell-muted">—</span>
        ),
    },
    { key: "txn_date", header: "Date", sortable: true, cell: (r) => formatDate(r.txn_date) },
    {
      key: "due_date",
      header: "Due",
      sortable: true,
      cell: (r) => (r.due_date ? formatDate(r.due_date) : <span className="admin-cell-muted">—</span>),
    },
    {
      key: "amount_cents",
      header: "Amount",
      sortable: true,
      cell: (r) => <span className="admin-cell-mono">{formatCents(r.amount_cents, r.currency)}</span>,
    },
    {
      key: "balance_cents",
      header: "Balance",
      sortable: true,
      cell: (r) =>
        r.balance_cents > 0 ? (
          <span className="admin-cell-mono">{formatCents(r.balance_cents, r.currency)}</span>
        ) : (
          <span className="admin-cell-muted">—</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => <Badge tone={statusTone(r.status)}>{humanize(r.status)}</Badge>,
    },
  ];

  return (
    <>
      <PageHead
        eyebrow="Revenue"
        title="Invoices"
        sub={`${total.toLocaleString()} ${total === 1 ? "invoice" : "invoices"} · ${formatCents(outstandingCents)} outstanding · synced from QuickBooks`}
      />
      {error && <div className="admin-alert admin-alert--err" style={{ marginBottom: 14 }}>{error}</div>}
      <DataTable
        columns={columns}
        rows={rows}
        total={total}
        page={page}
        pageSize={pageSize}
        pageSizeOptions={PAGE_SIZES}
        sort={sort}
        dir={dir}
        basePath="/admin/revenue/invoices"
        searchParams={searchParams}
        searchPlaceholder="Search invoice # or billed-to name…"
        emptyText="No invoices match."
        filterBar={
          <FilterBar
            basePath="/admin/revenue/invoices"
            searchParams={searchParams}
            filters={[
              { key: "status", label: "Status", options: STATUSES.map((s) => ({ value: s, label: humanize(s) })) },
            ]}
          />
        }
      />
    </>
  );
}
