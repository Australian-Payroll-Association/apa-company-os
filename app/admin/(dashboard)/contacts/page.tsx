import Link from "next/link";
import { listEntity } from "@/lib/admin/query";
import { getActiveBrandId } from "@/lib/admin/brand";
import { PageHead } from "@/components/admin/PageHead";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { Badge } from "@/components/admin/Badge";
import { ArchivedToggle } from "@/components/admin/ArchivedToggle";
import { FilterBar } from "@/components/admin/FilterBar";
import { formatDate, formatCents, humanize } from "@/lib/admin/format";
import { firstParam, type SearchParamsObj } from "@/lib/admin/url";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Contacts",
  description: "Every person in the Company Database, one searchable contact spine.",
};

type Person = {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  persona: string | null;
  source: string | null;
  do_not_contact: boolean | null;
  is_team_member: boolean | null;
  archived_at: string | null;
  created_at: string;
  deal_value_usd_cents: number | null;
  deal_count: number | null;
};

const PAGE_SIZE = 25;
const SORTABLE = new Set(["full_name", "email", "phone", "persona", "source", "deal_value_usd_cents", "created_at"]);

// Sentinel for "persona is null" — distinct from "" (no filter applied).
const UNSET = "__unset__";

const PERSONA_OPTIONS = [
  { value: "job_seeker", label: "Job seeker" },
  { value: "prospect", label: "Prospect" },
  { value: "client", label: "Client" },
  { value: "employee", label: "Employee" },
  { value: UNSET, label: "Unset" },
];
const STAGE_OPTIONS = [
  { value: "lead", label: "Lead" },
  { value: "customer", label: "Customer" },
  { value: "none", label: "None" },
];
const TEAM_OPTIONS = [
  { value: "true", label: "Team only" },
  { value: "false", label: "Non-team" },
];

export default async function ContactsPage({ searchParams }: { searchParams: SearchParamsObj }) {
  const brandId = getActiveBrandId();
  const page = Math.max(1, Number(firstParam(searchParams.page) ?? "1") || 1);
  const q = firstParam(searchParams.q) ?? "";
  const sortParam = firstParam(searchParams.sort);
  const sort = sortParam && SORTABLE.has(sortParam) ? sortParam : "created_at";
  const dir = firstParam(searchParams.dir) === "asc" ? "asc" : "desc";
  const showArchived = firstParam(searchParams.archived) === "1";

  const personaParam = firstParam(searchParams.persona);
  const stageParam = firstParam(searchParams.stage);
  const teamParam = firstParam(searchParams.team);

  const filters: Record<string, string | number | boolean | null> = {};
  if (brandId) filters.source_brand_id = brandId;
  if (personaParam) filters.persona = personaParam === UNSET ? null : personaParam;
  if (stageParam) filters.lifecycle_stage = stageParam;
  if (teamParam === "true" || teamParam === "false") filters.is_team_member = teamParam === "true";

  const { rows, total, pageSize, error } = await listEntity<Person>(
    "people_with_deals",
    "id, full_name, email, phone, persona, source, do_not_contact, is_team_member, archived_at, created_at, deal_value_usd_cents, deal_count",
    {
      page,
      pageSize: PAGE_SIZE,
      search: q,
      searchColumns: ["full_name", "email", "phone"],
      sort,
      dir,
      excludeArchived: !showArchived,
      filters,
    },
  );

  const columns: Column<Person>[] = [
    {
      key: "full_name",
      header: "Name",
      sortable: true,
      cell: (r) => <span className="admin-cell-strong">{r.full_name || "(no name)"}</span>,
    },
    { key: "email", header: "Email", sortable: true, cell: (r) => <span className="admin-cell-muted">{r.email}</span> },
    { key: "phone", header: "Phone", sortable: true, cell: (r) => r.phone || <span className="admin-cell-muted">—</span> },
    {
      key: "persona",
      header: "Persona",
      sortable: true,
      cell: (r) => (r.persona ? <Badge>{humanize(r.persona)}</Badge> : <span className="admin-cell-muted">—</span>),
    },
    { key: "source", header: "Source", sortable: true, cell: (r) => <span className="admin-cell-muted">{r.source || "—"}</span> },
    {
      key: "deal_value_usd_cents",
      header: "Deal value",
      sortable: true,
      align: "right",
      cell: (r) => (r.deal_count ? formatCents(r.deal_value_usd_cents) : <span className="admin-cell-muted">—</span>),
    },
    {
      key: "flags",
      header: "Flags",
      cell: (r) => (
        <span style={{ display: "inline-flex", gap: 4 }}>
          {r.archived_at && <Badge tone="neutral">Archived</Badge>}
          {r.do_not_contact && <Badge tone="err">Do not contact</Badge>}
          {r.is_team_member && <Badge tone="info">Team</Badge>}
        </span>
      ),
    },
    { key: "created_at", header: "Added", sortable: true, cell: (r) => formatDate(r.created_at) },
  ];

  return (
    <>
      <PageHead
        eyebrow="Spine"
        title="Contacts"
        sub={`${total.toLocaleString()} ${total === 1 ? "person" : "people"}${showArchived ? " · showing archived" : ""} in the Company Database`}
        action={
          <ArchivedToggle basePath="/admin/contacts" searchParams={searchParams} showArchived={showArchived} />
        }
      />
      {error && (
        <div className="admin-alert admin-alert--err" style={{ marginBottom: 14 }}>
          {error}
        </div>
      )}
      <DataTable
        columns={columns}
        rows={rows}
        total={total}
        page={page}
        pageSize={pageSize}
        sort={sort}
        dir={dir}
        basePath="/admin/contacts"
        searchParams={searchParams}
        searchPlaceholder="Search name, email, or phone…"
        emptyText="No contacts match."
        filterBar={
          <FilterBar
            basePath="/admin/contacts"
            searchParams={searchParams}
            filters={[
              { key: "persona", label: "Persona", options: PERSONA_OPTIONS },
              { key: "stage", label: "Stage", options: STAGE_OPTIONS },
              { key: "team", label: "Team", options: TEAM_OPTIONS },
            ]}
          />
        }
        getRowPreview={(r) => ({
          eyebrow: "Contact",
          title: r.full_name || r.email,
          body: (
            <>
              <dl className="admin-kv">
                <dt>Email</dt>
                <dd>{r.email}</dd>
                <dt>Phone</dt>
                <dd>{r.phone || "—"}</dd>
                <dt>Persona</dt>
                <dd>{r.persona ? <Badge>{humanize(r.persona)}</Badge> : "—"}</dd>
                <dt>Source</dt>
                <dd>{r.source || "—"}</dd>
                <dt>Deal value</dt>
                <dd className="admin-cell-mono">
                  {r.deal_count ? formatCents(r.deal_value_usd_cents) : "—"}
                </dd>
              </dl>
              {(r.archived_at || r.do_not_contact || r.is_team_member) && (
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 12 }}>
                  {r.archived_at && <Badge tone="neutral">Archived</Badge>}
                  {r.do_not_contact && <Badge tone="err">Do not contact</Badge>}
                  {r.is_team_member && <Badge tone="info">Team</Badge>}
                </div>
              )}
              <div style={{ marginTop: 16 }}>
                <Link href={`/admin/contacts/${r.id}`} className="admin-btn admin-btn--primary">
                  Open full profile
                </Link>
              </div>
            </>
          ),
        })}
      />
    </>
  );
}
