import { remark } from "remark";
import remarkHtml from "remark-html";
import { listEntity } from "@/lib/admin/query";
import { PageHead } from "@/components/admin/PageHead";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { Badge } from "@/components/admin/Badge";
import { FilterBar } from "@/components/admin/FilterBar";
import { formatDate } from "@/lib/admin/format";
import { firstParam, type SearchParamsObj } from "@/lib/admin/url";
import {
  IDEA_KINDS,
  IDEA_KIND_LABEL,
  IDEA_OFFICES,
  IDEA_STATUSES,
  IDEA_STATUS_LABEL,
  OFFICE_LABEL,
  ideaKindTone,
  ideaStatusTone,
  officeTone,
  type IdeaKind,
  type IdeaOffice,
  type IdeaStatus,
} from "@/lib/ideas";
import { IDEA_SELECT, submitterName, type IdeaRow } from "./idea-shared";
import { IdeasShelfProvider, IdeaShelfRow } from "./IdeasShelf";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Idea backlog",
  description: "Employee-submitted build ideas and learnings — Ideas that Spark Solutions.",
};

const PAGE_SIZES = [25, 50, 100];
const SORTABLE = new Set(["title", "kind", "office", "status", "created_at"]);

export default async function IdeasBacklogPage({ searchParams }: { searchParams: SearchParamsObj }) {
  const page = Math.max(1, Number(firstParam(searchParams.page) ?? "1") || 1);
  const sizeParam = Number(firstParam(searchParams.size));
  const pageSizeChoice = PAGE_SIZES.includes(sizeParam) ? sizeParam : 25;
  const q = firstParam(searchParams.q) ?? "";
  const sortParam = firstParam(searchParams.sort);
  const sort = sortParam && SORTABLE.has(sortParam) ? sortParam : "created_at";
  const dir = firstParam(searchParams.dir) === "asc" ? "asc" : "desc";
  const officeParam = firstParam(searchParams.office);
  const statusParam = firstParam(searchParams.status);
  const kindParam = firstParam(searchParams.kind);

  // No archived_at column here — "archived" is a status. Default view hides it.
  const filters: Record<string, string | string[]> = {};
  if (kindParam && (IDEA_KINDS as readonly string[]).includes(kindParam)) {
    filters.kind = kindParam;
  }
  if (officeParam && (IDEA_OFFICES as readonly string[]).includes(officeParam)) {
    filters.office = officeParam;
  }
  if (statusParam && (IDEA_STATUSES as readonly string[]).includes(statusParam)) {
    filters.status = statusParam;
  } else {
    filters.status = IDEA_STATUSES.filter((s) => s !== "archived");
  }

  const { rows, total, pageSize, error } = await listEntity<IdeaRow>("ideas", IDEA_SELECT, {
    page,
    pageSize: pageSizeChoice,
    search: q,
    searchColumns: ["title", "problem", "roi", "story", "takeaway"],
    sort,
    dir,
    filters,
  });

  // Pre-render each plan's markdown so the client shelf shows it instantly.
  const md = remark().use(remarkHtml, { sanitize: true });
  const withHtml: IdeaRow[] = await Promise.all(
    rows.map(async (r) => ({
      ...r,
      planHtml: r.ai_plan ? String(await md.process(r.ai_plan)) : null,
    })),
  );

  const columns: Column<IdeaRow>[] = [
    {
      key: "title",
      header: "Idea",
      sortable: true,
      cell: (r) => <span className="admin-cell-strong">{r.title}</span>,
    },
    { key: "submitter", header: "Submitted by", cell: (r) => submitterName(r) },
    {
      key: "kind",
      header: "Type",
      sortable: true,
      cell: (r) => (
        <Badge tone={ideaKindTone(r.kind)}>{IDEA_KIND_LABEL[r.kind as IdeaKind] ?? r.kind}</Badge>
      ),
    },
    {
      key: "office",
      header: "Office",
      sortable: true,
      cell: (r) =>
        r.office ? (
          <Badge tone={officeTone(r.office)}>{OFFICE_LABEL[r.office as IdeaOffice]}</Badge>
        ) : (
          <span className="admin-cell-muted">—</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      cell: (r) => (
        <Badge tone={ideaStatusTone(r.status)}>{IDEA_STATUS_LABEL[r.status as IdeaStatus] ?? r.status}</Badge>
      ),
    },
    {
      key: "plan",
      header: "Plan",
      cell: (r) =>
        r.ai_plan ? (
          <Badge tone="ok">Ready</Badge>
        ) : r.ai_error ? (
          <Badge tone="err">Failed</Badge>
        ) : (
          <span className="admin-cell-muted">—</span>
        ),
    },
    { key: "created_at", header: "Submitted", sortable: true, cell: (r) => formatDate(r.created_at) },
  ];

  return (
    <>
      <PageHead
        eyebrow="Innovation"
        title="Idea backlog"
        sub={`${total.toLocaleString()} ${total === 1 ? "entry" : "entries"} — build ideas planned by Claude via the 5D framework, plus learnings shared by the team`}
      />
      {error && <div className="admin-alert admin-alert--err" style={{ marginBottom: 14 }}>{error}</div>}
      <IdeasShelfProvider>
        <DataTable
          columns={columns}
          rows={withHtml}
          total={total}
          page={page}
          pageSize={pageSize}
          pageSizeOptions={PAGE_SIZES}
          sort={sort}
          dir={dir}
          basePath="/admin/innovation/ideas"
          searchParams={searchParams}
          searchPlaceholder="Search title, problem or ROI…"
          emptyText="No ideas match."
          filterBar={
            <FilterBar
              basePath="/admin/innovation/ideas"
              searchParams={searchParams}
              filters={[
                {
                  key: "kind",
                  label: "Type",
                  options: IDEA_KINDS.map((k) => ({ value: k, label: IDEA_KIND_LABEL[k] })),
                },
                {
                  key: "office",
                  label: "Office",
                  options: IDEA_OFFICES.map((o) => ({ value: o, label: OFFICE_LABEL[o] })),
                },
                {
                  key: "status",
                  label: "Status",
                  options: IDEA_STATUSES.map((s) => ({ value: s, label: IDEA_STATUS_LABEL[s] })),
                },
              ]}
            />
          }
          renderRow={(row, cells) => <IdeaShelfRow row={row}>{cells}</IdeaShelfRow>}
        />
      </IdeasShelfProvider>
    </>
  );
}
