import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { listCalls, scorecardAverage, type CallRow, type CallType } from "@/lib/admin/calls";
import { PageHead } from "@/components/admin/PageHead";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { FilterBar } from "@/components/admin/FilterBar";
import { formatDate } from "@/lib/admin/format";
import { firstParam, type SearchParamsObj } from "@/lib/admin/url";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sales Intelligence",
  description: "Every recorded call, searchable by what was actually said, with coaching scorecards.",
};

const PAGE_SIZES = [25, 50, 100];
const TYPES: CallType[] = ["sales", "client", "internal", "other"];

const TYPE_BADGE: Record<CallType, string> = {
  sales: "admin-badge admin-badge--ok",
  client: "admin-badge admin-badge--info",
  internal: "admin-badge",
  other: "admin-badge",
};

function fmtDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const m = Math.round(seconds / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

function fmtRatio(r: number | null): string {
  return r == null ? "—" : `${Math.round(r * 100)}%`;
}

// List page: the call library. Search is full-text over transcript content, so
// "cash flow" finds the calls where the words were said, not just titled.
export default async function SalesIntelligencePage({ searchParams }: { searchParams: SearchParamsObj }) {
  await requireAdmin();

  const page = Math.max(1, Number(firstParam(searchParams.page) ?? "1") || 1);
  const sizeParam = Number(firstParam(searchParams.size));
  const pageSize = PAGE_SIZES.includes(sizeParam) ? sizeParam : 25;
  const q = firstParam(searchParams.q) ?? "";
  const typeParam = firstParam(searchParams.type) as CallType | undefined;
  const type = typeParam && TYPES.includes(typeParam) ? typeParam : undefined;

  const { rows, total, error } = await listCalls({ page, pageSize, search: q, type });

  const columns: Column<CallRow>[] = [
    {
      key: "started_at",
      header: "Date",
      cell: (c) => (c.startedAt ? formatDate(c.startedAt) : <span className="admin-cell-muted">—</span>),
    },
    {
      key: "title",
      header: "Call",
      cell: (c) => (
        <Link className="admin-cell-strong" href={`/admin/revenue/sales-intelligence/${c.id}`}>
          {c.title}
        </Link>
      ),
    },
    {
      key: "call_type",
      header: "Type",
      cell: (c) => <span className={TYPE_BADGE[c.callType]}>{c.callType}</span>,
    },
    {
      key: "duration",
      header: "Length",
      cell: (c) => <span className="admin-cell-muted">{fmtDuration(c.durationSeconds)}</span>,
    },
    {
      key: "talk_ratio",
      header: "Talk ratio",
      cell: (c) => <span className="admin-cell-muted">{fmtRatio(c.scorecard?.talkRatio ?? null)}</span>,
    },
    {
      key: "score",
      header: "Score",
      cell: (c) => {
        const avg = scorecardAverage(c.scorecard);
        if (avg == null) return <span className="admin-cell-muted">—</span>;
        const cls = avg >= 4 ? "admin-badge admin-badge--ok" : avg >= 3 ? "admin-badge admin-badge--warn" : "admin-badge admin-badge--err";
        return <span className={cls}>{avg.toFixed(1)} / 5</span>;
      },
    },
  ];

  return (
    <>
      <PageHead
        eyebrow="Revenue"
        title="Sales Intelligence"
        sub={`${total.toLocaleString()} call${total === 1 ? "" : "s"} on record, searchable by what was said`}
      />
      {error && <div className="admin-alert admin-alert--err" style={{ marginBottom: 14 }}>{error}</div>}
      <DataTable
        columns={columns}
        rows={rows}
        total={total}
        page={page}
        pageSize={pageSize}
        pageSizeOptions={PAGE_SIZES}
        basePath="/admin/revenue/sales-intelligence"
        searchParams={searchParams}
        searchPlaceholder="Search what was said, e.g. cash flow…"
        emptyText="No calls match."
        filterBar={
          <FilterBar
            basePath="/admin/revenue/sales-intelligence"
            searchParams={searchParams}
            filters={[
              {
                key: "type",
                label: "Type",
                options: TYPES.map((t) => ({ value: t, label: t[0].toUpperCase() + t.slice(1) })),
              },
            ]}
          />
        }
      />
    </>
  );
}
