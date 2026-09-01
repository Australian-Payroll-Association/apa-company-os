import Link from "next/link";
import { discoveryDb, normalizeOverview, type EngagementOverview, type TeamMember } from "@/lib/discovery/data";
import { computeProgress } from "@/lib/discovery/progress";
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
  overview: Partial<EngagementOverview> | null;
  team_members: TeamMember[] | null;
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

// Reads like an inbox rather than a flat table: whatever needs a consultant's
// attention right now (a fresh client submission, a drafted report waiting to
// be sharpened) sorts to the top, ahead of engagements that are just waiting
// on the client or are already wrapped up. Ties break by most recent
// submission (falling back to created date for not-yet-submitted rows).
const STATUS_PRIORITY: Record<string, number> = {
  submitted: 0,
  report_drafted: 1,
  under_review: 2,
  in_progress: 3,
  not_started: 4,
  completed: 5,
};
const NEEDS_REVIEW = new Set(["submitted", "report_drafted"]);
const NOT_YET_SUBMITTED = new Set(["not_started", "in_progress"]);

export default async function DiscoveryListPage({ searchParams }: { searchParams: SearchParamsObj }) {
  const { data, error } = await discoveryDb
    .from("discovery_engagements")
    .select("id, client_name, status, access_token, created_at, submitted_at, overview, team_members, consultant:people!consultant_person_id(full_name)");

  const rows = ((data ?? []) as unknown as EngagementListRow[]).sort((a, b) => {
    const pa = STATUS_PRIORITY[a.status] ?? 99;
    const pb = STATUS_PRIORITY[b.status] ?? 99;
    if (pa !== pb) return pa - pb;
    return (b.submitted_at ?? b.created_at).localeCompare(a.submitted_at ?? a.created_at);
  });
  const needsReviewCount = rows.filter((r) => NEEDS_REVIEW.has(r.status)).length;

  // One batched query for every row's responses rather than N+1 — fine at the
  // low volumes this list runs at (see DataTable usage below: no real
  // pagination either, for the same reason).
  const preSubmissionIds = rows.filter((r) => NOT_YET_SUBMITTED.has(r.status)).map((r) => r.id);
  const { data: allResponses } = preSubmissionIds.length
    ? await discoveryDb.from("discovery_responses").select("engagement_id, question_id, options, text").in("engagement_id", preSubmissionIds)
    : { data: [] as { engagement_id: string; question_id: string; options: string[]; text: string | null }[] };
  const responsesByEngagement = new Map<string, { question_id: string; options: string[]; text: string | null }[]>();
  (allResponses ?? []).forEach((r) => {
    const list = responsesByEngagement.get(r.engagement_id) ?? [];
    list.push(r);
    responsesByEngagement.set(r.engagement_id, list);
  });
  const progressById = new Map(
    rows
      .filter((r) => NOT_YET_SUBMITTED.has(r.status))
      .map((r) => [r.id, computeProgress(normalizeOverview(r.overview), r.team_members ?? [], responsesByEngagement.get(r.id) ?? [])] as const),
  );

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
      key: "progress",
      header: "Progress",
      cell: (r) => {
        const p = progressById.get(r.id);
        if (!p) return <span className="admin-cell-muted">—</span>;
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 100 }}>
            <div style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--admin-line, #e2e5ea)", overflow: "hidden" }}>
              <div style={{ width: `${p.pct}%`, height: "100%", background: "var(--admin-accent)", borderRadius: 3 }} />
            </div>
            <span style={{ fontSize: 12, whiteSpace: "nowrap" }}>{p.pct}%</span>
          </div>
        );
      },
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
        sub={
          needsReviewCount > 0
            ? `${rows.length.toLocaleString()} ${rows.length === 1 ? "review" : "reviews"} · ${needsReviewCount} need${needsReviewCount === 1 ? "s" : ""} your attention`
            : `${rows.length.toLocaleString()} ${rows.length === 1 ? "review" : "reviews"}`
        }
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
