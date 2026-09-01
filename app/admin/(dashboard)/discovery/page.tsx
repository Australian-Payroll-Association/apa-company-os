import Link from "next/link";
import { discoveryDb } from "@/lib/discovery/data";
import { PageHead } from "@/components/admin/PageHead";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { Badge, type BadgeTone } from "@/components/admin/Badge";
import { formatDate } from "@/lib/admin/format";
import type { SearchParamsObj } from "@/lib/admin/url";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Payroll 360 Discovery",
  description: "Client discovery questionnaires — track progress, review submissions.",
};

type EngagementListRow = {
  id: string;
  client_name: string;
  status: string;
  access_token: string;
  created_at: string;
  submitted_at: string | null;
  consultant: { full_name: string | null } | { full_name: string | null }[] | null;
};

const STATUS_LABEL: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  submitted: "Submitted",
  under_review: "Under review",
  report_drafted: "Report drafted",
  completed: "Completed",
};
const STATUS_TONE: Record<string, BadgeTone> = {
  not_started: "neutral",
  in_progress: "info",
  submitted: "warn",
  under_review: "warn",
  report_drafted: "ok",
  completed: "ok",
};

const one = <T,>(e: T | T[] | null): T | null => (Array.isArray(e) ? (e[0] ?? null) : e);

export default async function DiscoveryListPage({ searchParams }: { searchParams: SearchParamsObj }) {
  const { data, error } = await discoveryDb
    .from("discovery_engagements")
    .select("id, client_name, status, access_token, created_at, submitted_at, consultant:people!consultant_person_id(full_name)")
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as unknown as EngagementListRow[];

  const columns: Column<EngagementListRow>[] = [
    {
      key: "client_name",
      header: "Client",
      cell: (r) => (
        <Link href={`/admin/discovery/${r.id}`} className="admin-cell-strong">
          {r.client_name}
        </Link>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{STATUS_LABEL[r.status] ?? r.status}</Badge>,
    },
    {
      key: "consultant",
      header: "Consultant",
      cell: (r) => one(r.consultant)?.full_name || <span className="admin-cell-muted">Unassigned</span>,
    },
    { key: "created_at", header: "Created", cell: (r) => formatDate(r.created_at) },
    {
      key: "submitted_at",
      header: "Submitted",
      cell: (r) => (r.submitted_at ? formatDate(r.submitted_at) : <span className="admin-cell-muted">—</span>),
    },
  ];

  return (
    <>
      <PageHead
        eyebrow="Payroll 360"
        title="Discovery"
        sub={`${rows.length.toLocaleString()} ${rows.length === 1 ? "review" : "reviews"}`}
        action={
          <Link href="/admin/discovery/new" className="admin-btn admin-btn--primary">
            New review
          </Link>
        }
      />
      {error && (
        <div className="admin-alert admin-alert--err" style={{ marginBottom: 14 }}>
          {error.message}
        </div>
      )}
      <DataTable
        columns={columns}
        rows={rows}
        total={rows.length}
        page={1}
        pageSize={Math.max(rows.length, 1)}
        basePath="/admin/discovery"
        searchParams={searchParams}
        emptyText="No discovery reviews yet — create one to get started."
      />
    </>
  );
}
