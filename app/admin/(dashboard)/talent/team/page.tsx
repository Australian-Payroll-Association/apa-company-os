import Link from "next/link";
import { listEntity, countEntity } from "@/lib/admin/query";
import { PageHead } from "@/components/admin/PageHead";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { Badge, statusTone } from "@/components/admin/Badge";
import { formatDate, humanize } from "@/lib/admin/format";
import { firstParam, mergeQuery, type SearchParamsObj } from "@/lib/admin/url";
import { InvitePortalButton } from "@/components/admin/InvitePortalButton";
import { getSignedInAuthUserIds, portalStatusOf } from "@/lib/admin/portal-status";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Team",
  description: "Edge8 team members and departments.",
};

// Talent office: internal team (persona=employee). Name opens the Team Member profile.
type P = { full_name: string | null; email: string; auth_user_id: string | null };
type TeamMember = {
  id: string;
  employee_number: string | null;
  employment_type: string | null;
  work_location: string | null;
  status: string | null;
  start_date: string | null;
  created_at: string;
  person_id: string | null;
  people: P | P[] | null;
};

const one = <T,>(e: T | T[] | null): T | null => (Array.isArray(e) ? e[0] ?? null : e);
const PAGE_SIZE = 25;
const SORTABLE = new Set(["start_date", "created_at", "employee_number", "employment_type", "work_location", "status"]);

// Segment tabs. `filter` is applied on top of search/sort. Order matters: the
// first entry is the default when no (or an unknown) ?seg is present.
type SegKey = "current" | "past" | "contractors" | "all";
const SEGMENTS: { key: SegKey; label: string; filter: NonNullable<Parameters<typeof countEntity>[1]> }[] = [
  { key: "current", label: "Current", filter: { status: "active" } },
  { key: "past", label: "Past", filter: { status: ["terminated", "alumni"] } },
  { key: "contractors", label: "Contractors", filter: { employment_type: "contract" } },
  { key: "all", label: "All", filter: {} },
];

export default async function TeamPage({ searchParams }: { searchParams: SearchParamsObj }) {
  const page = Math.max(1, Number(firstParam(searchParams.page) ?? "1") || 1);
  const q = firstParam(searchParams.q) ?? "";
  const sortParam = firstParam(searchParams.sort);
  const sort = sortParam && SORTABLE.has(sortParam) ? sortParam : "created_at";
  const dir = firstParam(searchParams.dir) === "asc" ? "asc" : "desc";

  const segParam = firstParam(searchParams.seg);
  const seg = SEGMENTS.find((s) => s.key === segParam) ?? SEGMENTS[0];

  // List the active segment's rows, and (in parallel) count every segment for
  // its tab badge. Counts reflect the whole segment, independent of the search.
  const [list, counts] = await Promise.all([
    listEntity<TeamMember>(
      "team_members",
      "id, employee_number, employment_type, work_location, status, start_date, created_at, person_id, people!person_id(full_name, email, auth_user_id)",
      { page, pageSize: PAGE_SIZE, search: q, searchColumns: ["employee_number"], sort, dir, filters: seg.filter },
    ),
    Promise.all(SEGMENTS.map((s) => countEntity("team_members", s.filter))),
  ]);
  const { rows, total, pageSize, error } = list;

  // Portal status per row needs auth.users.last_sign_in_at; fetch the signed-in
  // set once for the visible rows so the Portal column can show invited vs
  // signed in without a lookup per cell.
  const authIds = rows.map((r) => one(r.people)?.auth_user_id).filter((x): x is string => !!x);
  const signedIn = await getSignedInAuthUserIds(authIds);

  const columns: Column<TeamMember>[] = [
    {
      key: "name",
      header: "Name",
      cell: (r) => {
        const p = one(r.people);
        return <span className="admin-cell-strong">{p?.full_name || p?.email || "View"}</span>;
      },
    },
    { key: "employee_number", header: "Employee #", sortable: true, cell: (r) => r.employee_number || <span className="admin-cell-muted">—</span> },
    { key: "employment_type", header: "Type", sortable: true, cell: (r) => (r.employment_type ? <Badge>{humanize(r.employment_type)}</Badge> : <span className="admin-cell-muted">—</span>) },
    { key: "work_location", header: "Location", sortable: true, cell: (r) => r.work_location || <span className="admin-cell-muted">—</span> },
    { key: "status", header: "Status", sortable: true, cell: (r) => (r.status ? <Badge tone={statusTone(r.status)}>{humanize(r.status)}</Badge> : <span className="admin-cell-muted">—</span>) },
    { key: "start_date", header: "Started", sortable: true, cell: (r) => (r.start_date ? formatDate(r.start_date) : <span className="admin-cell-muted">—</span>) },
    {
      key: "portal",
      header: "Portal",
      cell: (r) =>
        r.person_id ? (
          <InvitePortalButton teamMemberId={r.id} status={portalStatusOf(one(r.people)?.auth_user_id, signedIn)} />
        ) : (
          <span className="admin-cell-muted">—</span>
        ),
    },
  ];

  return (
    <>
      <PageHead eyebrow="Talent" title="Team" sub={`${total.toLocaleString()} ${total === 1 ? "team member" : "team members"}`} />
      {error && <div className="admin-alert admin-alert--err" style={{ marginBottom: 14 }}>{error}</div>}
      <nav className="admin-tabs" role="tablist" aria-label="Team segment">
        {SEGMENTS.map((s, i) => (
          <Link
            key={s.key}
            role="tab"
            aria-selected={s.key === seg.key}
            className={`admin-tab${s.key === seg.key ? " is-active" : ""}`}
            href={"/admin/talent/team" + mergeQuery(searchParams, { seg: s.key === "current" ? null : s.key, page: 1 })}
          >
            {s.label} ({counts[i].toLocaleString()})
          </Link>
        ))}
      </nav>
      <DataTable
        columns={columns}
        rows={rows}
        total={total}
        page={page}
        pageSize={pageSize}
        sort={sort}
        dir={dir}
        basePath="/admin/talent/team"
        searchParams={searchParams}
        searchPlaceholder="Search employee #…"
        emptyText={seg.key === "contractors" ? "No contractors yet." : "No team members match."}
        getRowPreview={(r) => {
          const p = one(r.people);
          return {
            eyebrow: "Team member",
            title: p?.full_name || p?.email || "Team member",
            body: (
              <>
                <dl className="admin-kv">
                  <dt>Email</dt>
                  <dd>{p?.email || "—"}</dd>
                  <dt>Employee #</dt>
                  <dd className="admin-cell-mono">{r.employee_number || "—"}</dd>
                  <dt>Type</dt>
                  <dd>{r.employment_type ? <Badge>{humanize(r.employment_type)}</Badge> : "—"}</dd>
                  <dt>Location</dt>
                  <dd>{r.work_location || "—"}</dd>
                  <dt>Status</dt>
                  <dd>{r.status ? <Badge tone={statusTone(r.status)}>{humanize(r.status)}</Badge> : "—"}</dd>
                  <dt>Started</dt>
                  <dd>{r.start_date ? formatDate(r.start_date) : "—"}</dd>
                </dl>
                <div style={{ marginTop: 16 }}>
                  <Link href={`/admin/talent/team/${r.id}`} className="admin-btn admin-btn--primary">
                    Open full profile
                  </Link>
                </div>
              </>
            ),
          };
        }}
      />
    </>
  );
}
