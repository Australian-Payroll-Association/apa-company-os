import Link from "next/link";
import { listEntity } from "@/lib/admin/query";
import { PageHead } from "@/components/admin/PageHead";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { Badge } from "@/components/admin/Badge";
import { FilterBar } from "@/components/admin/FilterBar";
import { formatDate } from "@/lib/admin/format";
import { firstParam, type SearchParamsObj } from "@/lib/admin/url";
import {
  WORK_REQUEST_STATUSES,
  WORK_REQUEST_STATUS_LABEL,
  workRequestTone,
  formatHours,
  type WorkRequestStatus,
} from "@/lib/admin/contractors";
import { REQUEST_SELECT, onePerson, type RequestRow } from "./request-shared";
import { RequestsShelfProvider, RequestShelfRow } from "./RequestsShelf";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Work Requests",
  description: "Contractor work requests — estimate, approve, track, pay.",
};

const PAGE_SIZES = [25, 50, 100];
const SORTABLE = new Set(["title", "status", "created_at"]);

export default async function ContractorRequestsPage({ searchParams }: { searchParams: SearchParamsObj }) {
  const page = Math.max(1, Number(firstParam(searchParams.page) ?? "1") || 1);
  const sizeParam = Number(firstParam(searchParams.size));
  const pageSizeChoice = PAGE_SIZES.includes(sizeParam) ? sizeParam : 25;
  const q = firstParam(searchParams.q) ?? "";
  const sortParam = firstParam(searchParams.sort);
  const sort = sortParam && SORTABLE.has(sortParam) ? sortParam : "created_at";
  const dir = firstParam(searchParams.dir) === "asc" ? "asc" : "desc";
  const statusParam = firstParam(searchParams.status);

  const filters: Record<string, string> = {};
  if (statusParam && (WORK_REQUEST_STATUSES as readonly string[]).includes(statusParam)) {
    filters.status = statusParam;
  }

  const { rows, total, pageSize, error } = await listEntity<RequestRow>(
    "contractor_work_requests",
    REQUEST_SELECT,
    {
      page,
      pageSize: pageSizeChoice,
      search: q,
      searchColumns: ["title", "brief"],
      sort,
      dir,
      filters,
    },
  );

  const columns: Column<RequestRow>[] = [
    {
      key: "title",
      header: "Request",
      sortable: true,
      cell: (r) => <span className="admin-cell-strong">{r.title}</span>,
    },
    {
      key: "contractor",
      header: "Contractor",
      cell: (r) => onePerson(r.people)?.full_name || onePerson(r.people)?.email || "—",
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      cell: (r) => (
        <Badge tone={workRequestTone(r.status)}>
          {WORK_REQUEST_STATUS_LABEL[r.status as WorkRequestStatus] ?? r.status}
        </Badge>
      ),
    },
    {
      key: "estimated_hours",
      header: "Est.",
      align: "right",
      cell: (r) =>
        r.estimated_hours !== null ? (
          <span className="admin-cell-mono">{formatHours(r.estimated_hours)}</span>
        ) : (
          <span className="admin-cell-muted">—</span>
        ),
    },
    {
      key: "actual_hours",
      header: "Actual",
      align: "right",
      cell: (r) =>
        r.actual_hours !== null ? (
          <span className="admin-cell-mono">{formatHours(r.actual_hours)}</span>
        ) : (
          <span className="admin-cell-muted">—</span>
        ),
    },
    { key: "created_at", header: "Created", sortable: true, cell: (r) => formatDate(r.created_at) },
  ];

  return (
    <>
      <PageHead
        eyebrow="Operations"
        title="Work Requests"
        sub={`${total.toLocaleString()} ${total === 1 ? "request" : "requests"}`}
        action={
          <Link href="/admin/operations/contractor-requests/new" className="admin-btn admin-btn--primary">
            New request
          </Link>
        }
      />
      {error && <div className="admin-alert admin-alert--err" style={{ marginBottom: 14 }}>{error}</div>}
      <RequestsShelfProvider>
        <DataTable
          columns={columns}
          rows={rows}
          total={total}
          page={page}
          pageSize={pageSize}
          pageSizeOptions={PAGE_SIZES}
          sort={sort}
          dir={dir}
          basePath="/admin/operations/contractor-requests"
          searchParams={searchParams}
          searchPlaceholder="Search title or brief…"
          emptyText="No work requests yet."
          filterBar={
            <FilterBar
              basePath="/admin/operations/contractor-requests"
              searchParams={searchParams}
              filters={[
                {
                  key: "status",
                  label: "Status",
                  options: WORK_REQUEST_STATUSES.map((s) => ({
                    value: s,
                    label: WORK_REQUEST_STATUS_LABEL[s],
                  })),
                },
              ]}
            />
          }
          renderRow={(row, cells) => <RequestShelfRow row={row}>{cells}</RequestShelfRow>}
        />
      </RequestsShelfProvider>
    </>
  );
}
