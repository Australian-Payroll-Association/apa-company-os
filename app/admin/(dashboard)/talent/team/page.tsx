import Link from "next/link";
import { companyOs } from "@/lib/supabase";
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
type P = {
  full_name: string | null;
  preferred_name: string | null;
  email: string;
  phone: string | null;
  auth_user_id: string | null;
  city: string | null;
  country: string | null;
  linkedin_url: string | null;
};
type Position = { title: string | null; level: string | null; is_people_manager: boolean | null };
type Department = { name: string | null };
type TeamMember = {
  id: string;
  employee_number: string | null;
  employment_type: string | null;
  employment_stage: string | null;
  work_location: string | null;
  status: string | null;
  start_date: string | null;
  contract_start_date: string | null;
  probation_ends_on: string | null;
  end_date: string | null;
  termination_reason: string | null;
  created_at: string;
  person_id: string | null;
  manager_id: string | null;
  people: P | P[] | null;
  positions: Position | Position[] | null;
  departments: Department | Department[] | null;
};

const one = <T,>(e: T | T[] | null): T | null => (Array.isArray(e) ? e[0] ?? null : e);
const PAGE_SIZE = 25;
const SORTABLE = new Set([
  "name",
  "employee_number",
  "title",
  "employment_type",
  "work_location",
  "status",
  "start_date",
  "portal",
  "created_at",
]);

// Some columns aren't direct team_members columns: Name and Portal live on the
// joined `people` row, Title on the joined `positions` row. Map their sort key
// to the embedded-column ordering expression PostgREST understands
// (order=<embed>(<col>)). Everything else sorts by its own key.
const ORDER_COLUMN: Record<string, string> = {
  name: "people(full_name)",
  portal: "people(auth_user_id)",
  title: "positions(title)",
};

const dash = <span className="admin-cell-muted">—</span>;

// Segment tabs. `filter` is applied on top of search/sort. Order matters: the
// first entry is the default when no (or an unknown) ?seg is present.
type SegKey = "current" | "pre-start" | "past" | "contractors" | "all";
const SEGMENTS: { key: SegKey; label: string; filter: NonNullable<Parameters<typeof countEntity>[1]> }[] = [
  { key: "current", label: "Current", filter: { status: "active" } },
  { key: "pre-start", label: "Pre-Start", filter: { status: "pre_start" } },
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

  // Search matches the person's name, which lives on the joined `people` row.
  // PostgREST only narrows parent rows by an embedded column when the embed is
  // an inner join, so ask for `!inner` while searching. Without a query the
  // embed stays a left join, so a team member with no linked person still
  // appears in the list.
  const peopleEmbed = `people!person_id${q ? "!inner" : ""}(full_name, preferred_name, email, phone, auth_user_id, city, country, linkedin_url)`;

  // List the active segment's rows, and (in parallel) count every segment for
  // its tab badge. Counts reflect the whole segment, independent of the search.
  const [list, counts] = await Promise.all([
    listEntity<TeamMember>(
      "team_members",
      "id, employee_number, employment_type, employment_stage, work_location, status, start_date, contract_start_date, probation_ends_on, end_date, termination_reason, created_at, person_id, manager_id, " +
        `${peopleEmbed}, positions!position_id(title, level, is_people_manager), departments!department_id(name)`,
      {
        page,
        pageSize: PAGE_SIZE,
        search: q,
        searchEmbed: { table: "people", columns: ["full_name", "preferred_name"] },
        sort: ORDER_COLUMN[sort] ?? sort,
        dir,
        filters: seg.filter,
      },
    ),
    Promise.all(SEGMENTS.map((s) => countEntity("team_members", s.filter))),
  ]);
  const { rows, total, pageSize, error } = list;

  // Two per-row lookups, both keyed only on the rows we just fetched, so they
  // run as one wave rather than two.
  //
  // Portal status needs auth.users.last_sign_in_at; fetch the signed-in set once
  // for the visible rows so the Portal column can show invited vs signed in
  // without a lookup per cell.
  //
  // Manager is a self-FK on team_members. It is deliberately NOT an embed:
  // PostgREST resolves a self-referencing embed in the reverse direction, so
  // `team_members!manager_id(...)` returns the row's first direct report rather
  // than its manager. Resolving the ids in a second pass keeps it correct.
  const authIds = rows.map((r) => one(r.people)?.auth_user_id).filter((x): x is string => !!x);
  const managerIds = [...new Set(rows.map((r) => r.manager_id).filter((x): x is string => !!x))];

  const [signedIn, managerRes] = await Promise.all([
    getSignedInAuthUserIds(authIds),
    managerIds.length
      ? companyOs.from("team_members").select("id, people!person_id(full_name)").in("id", managerIds)
      : Promise.resolve({ data: null }),
  ]);

  type ManagerRow = { id: string; people: { full_name: string | null } | { full_name: string | null }[] | null };
  const managerName = new Map<string, string>();
  for (const m of ((managerRes.data as ManagerRow[] | null) ?? [])) {
    const name = one(m.people)?.full_name;
    if (name) managerName.set(m.id, name);
  }

  const columns: Column<TeamMember>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      cell: (r) => {
        const p = one(r.people);
        return <span className="admin-cell-strong">{p?.full_name || p?.email || "View"}</span>;
      },
    },
    { key: "employee_number", header: "Employee #", sortable: true, cell: (r) => (r.employee_number ? <span className="admin-cell-mono">{r.employee_number}</span> : dash) },
    { key: "title", header: "Title", sortable: true, cell: (r) => one(r.positions)?.title || dash },
    { key: "employment_type", header: "Type", sortable: true, cell: (r) => (r.employment_type ? <Badge>{humanize(r.employment_type)}</Badge> : dash) },
    { key: "work_location", header: "Location", sortable: true, cell: (r) => r.work_location || dash },
    { key: "status", header: "Status", sortable: true, cell: (r) => (r.status ? <Badge tone={statusTone(r.status)}>{humanize(r.status)}</Badge> : dash) },
    { key: "start_date", header: "Started", sortable: true, cell: (r) => (r.start_date ? formatDate(r.start_date) : dash) },
    {
      key: "portal",
      header: "Portal",
      sortable: true,
      cell: (r) =>
        r.person_id ? (
          <InvitePortalButton teamMemberId={r.id} status={portalStatusOf(one(r.people)?.auth_user_id, signedIn)} />
        ) : (
          dash
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
        searchPlaceholder="Search by name…"
        emptyText={seg.key === "contractors" ? "No contractors yet." : seg.key === "pre-start" ? "No pre-start hires." : "No team members match."}
        getRowPreview={(r) => {
          const p = one(r.people);
          const pos = one(r.positions);
          const basedIn = [p?.city, p?.country].filter(Boolean).join(", ");
          const portal = portalStatusOf(p?.auth_user_id, signedIn);
          const isPast = r.status === "terminated" || r.status === "alumni";
          return {
            eyebrow: pos?.title || "Team member",
            title: p?.full_name || p?.email || "Team member",
            body: (
              <>
                <dl className="admin-kv">
                  <dt>Goes by</dt>
                  <dd>{p?.preferred_name || "—"}</dd>
                  <dt>Email</dt>
                  <dd>{p?.email || "—"}</dd>
                  <dt>Phone</dt>
                  <dd>{p?.phone || "—"}</dd>
                  <dt>LinkedIn</dt>
                  <dd>
                    {p?.linkedin_url ? (
                      <a href={p.linkedin_url} target="_blank" rel="noreferrer">
                        Profile
                      </a>
                    ) : (
                      "—"
                    )}
                  </dd>

                  <dt>Title</dt>
                  <dd>{pos?.title || "—"}</dd>
                  <dt>Level</dt>
                  <dd>{pos?.level ? humanize(pos.level) : "—"}</dd>
                  <dt>Department</dt>
                  <dd>{one(r.departments)?.name || "—"}</dd>
                  <dt>Manager</dt>
                  <dd>{(r.manager_id && managerName.get(r.manager_id)) || "—"}</dd>
                  <dt>Manages people</dt>
                  <dd>{pos?.is_people_manager ? "Yes" : "No"}</dd>

                  <dt>Status</dt>
                  <dd>{r.status ? <Badge tone={statusTone(r.status)}>{humanize(r.status)}</Badge> : "—"}</dd>
                  <dt>Stage</dt>
                  <dd>{r.employment_stage ? humanize(r.employment_stage) : "—"}</dd>
                  <dt>Type</dt>
                  <dd>{r.employment_type ? <Badge>{humanize(r.employment_type)}</Badge> : "—"}</dd>
                  <dt>Work location</dt>
                  <dd>{r.work_location || "—"}</dd>
                  <dt>Based in</dt>
                  <dd>{basedIn || "—"}</dd>

                  <dt>Started</dt>
                  <dd>{r.start_date ? formatDate(r.start_date) : "—"}</dd>
                  <dt>Contract start</dt>
                  <dd>{r.contract_start_date ? formatDate(r.contract_start_date) : "—"}</dd>
                  <dt>Probation ends</dt>
                  <dd>{r.probation_ends_on ? formatDate(r.probation_ends_on) : "—"}</dd>
                  {isPast && (
                    <>
                      <dt>Ended</dt>
                      <dd>{r.end_date ? formatDate(r.end_date) : "—"}</dd>
                      <dt>Reason</dt>
                      <dd>{r.termination_reason ? humanize(r.termination_reason) : "—"}</dd>
                    </>
                  )}

                  <dt>Portal</dt>
                  <dd>{portal === "active" ? "Signed in" : portal === "invited" ? "Invited, never signed in" : "Not invited"}</dd>
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
