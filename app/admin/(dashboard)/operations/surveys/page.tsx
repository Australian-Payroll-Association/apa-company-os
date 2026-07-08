import Link from "next/link";
import { PageHead } from "@/components/admin/PageHead";
import { MetricCard } from "@/components/admin/MetricCard";
import { Badge } from "@/components/admin/Badge";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { listEntity, countEntity } from "@/lib/admin/query";
import { firstParam, type SearchParamsObj } from "@/lib/admin/url";
import { formatDate } from "@/lib/admin/format";
import { surveyStatusTone } from "@/lib/admin/surveys";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  slug: string;
  name: string;
  status: string;
  is_anonymous: boolean;
  updated_at: string;
  survey_responses: { count: number }[];
};

const BASE = "/admin/operations/surveys";

export default async function SurveysPage({
  searchParams,
}: {
  searchParams: SearchParamsObj;
}) {
  const sort = firstParam(searchParams.sort) ?? "updated_at";
  const dir = (firstParam(searchParams.dir) as "asc" | "desc" | undefined) ?? "desc";

  const [list, total, published, responses] = await Promise.all([
    listEntity<Row>(
      "surveys",
      "id, slug, name, status, is_anonymous, updated_at, survey_responses(count)",
      {
        page: Number(firstParam(searchParams.page) ?? 1),
        search: firstParam(searchParams.q),
        searchColumns: ["name", "slug"],
        sort: ["name", "status", "updated_at"].includes(sort) ? sort : "updated_at",
        dir,
        excludeArchived: true,
      },
    ),
    countEntity("surveys"),
    countEntity("surveys", { status: "published" }),
    countEntity("survey_responses"),
  ]);

  const responseCount = (r: Row) => r.survey_responses?.[0]?.count ?? 0;

  const columns: Column<Row>[] = [
    {
      key: "name",
      header: "Survey",
      sortable: true,
      cell: (r) => (
        <Link href={`${BASE}/${r.id}`} className="admin-cell-strong">
          {r.name}
        </Link>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      cell: (r) => <Badge tone={surveyStatusTone(r.status)}>{r.status}</Badge>,
    },
    {
      key: "is_anonymous",
      header: "Anonymous",
      cell: (r) => (r.is_anonymous ? <Badge tone="info">anonymous</Badge> : "—"),
    },
    {
      key: "responses",
      header: "Responses",
      align: "right",
      cell: (r) => <span className="admin-cell-mono">{responseCount(r)}</span>,
    },
    {
      key: "updated_at",
      header: "Updated",
      sortable: true,
      cell: (r) => formatDate(r.updated_at),
    },
    {
      key: "actions",
      header: "",
      cell: (r) => (
        <span style={{ display: "inline-flex", gap: 8 }}>
          <Link className="admin-btn admin-btn--sm" href={`${BASE}/${r.id}/results`}>
            Results
          </Link>
          {r.status === "published" && (
            <a
              className="admin-btn admin-btn--sm"
              href={`/surveys/${r.slug}`}
              target="_blank"
              rel="noreferrer"
            >
              Open ↗
            </a>
          )}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHead
        eyebrow="Operations · Workplace"
        title="Surveys"
        sub="Light Typeform: build, share, and read team and external surveys."
        action={
          <Link href={`${BASE}/new`} className="admin-btn admin-btn--primary">
            New survey
          </Link>
        }
      />

      {list.error && <div className="admin-alert admin-alert--err">{list.error}</div>}

      <div className="mp-kpi-grid" style={{ marginBottom: 20 }}>
        <MetricCard label="Surveys" value={total} />
        <MetricCard label="Published" value={published} />
        <MetricCard label="Responses" value={responses} />
      </div>

      <DataTable
        columns={columns}
        rows={list.rows}
        total={list.total}
        page={list.page}
        pageSize={list.pageSize}
        sort={sort}
        dir={dir}
        basePath={BASE}
        searchParams={searchParams}
        searchPlaceholder="Search surveys…"
        emptyText="No surveys yet. Create the first one."
      />
    </>
  );
}
