import Link from "next/link";
import { companyOs } from "@/lib/supabase";
import { listEntity } from "@/lib/admin/query";
import { PageHead } from "@/components/admin/PageHead";
import { MetricCard } from "@/components/admin/MetricCard";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { Badge, statusTone } from "@/components/admin/Badge";
import { FilterBar } from "@/components/admin/FilterBar";
import { formatCents, formatDate, humanize } from "@/lib/admin/format";
import { firstParam, type SearchParamsObj } from "@/lib/admin/url";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Public Retreats",
  description: "Scheduled public retreats and their registrations.",
};

// Revenue office: public retreats. A "retreat" is a cohort of products sharing a
// cohort_slug (tiers are the variants); type='event' = public. One row per retreat via
// the company_os.public_retreats view. Registrations roll up by cohort.
type Retreat = {
  id: string; // = cohort_slug
  cohort_slug: string;
  name: string | null;
  location: string | null;
  date_start: string | null;
  date_end: string | null;
  tiers: number | null;
  active: boolean | null;
  from_usd_cents: number | null;
  collected_usd_cents: number | null;
  registrations: number | null;
  confirmed: number | null;
};

type Attendee = {
  name: string | null;
  email: string | null;
  tier: string | null;
  status: string | null;
  person_id: string | null;
};

const one = <T,>(e: T | T[] | null): T | null => (Array.isArray(e) ? e[0] ?? null : e);
const PAGE_SIZE = 25;
const SORTABLE = new Set(["name", "date_start", "registrations", "confirmed", "from_usd_cents", "collected_usd_cents"]);

function dateRange(start: string | null, end: string | null): string {
  if (!start) return "—";
  const s = formatDate(start);
  if (!end || formatDate(end) === s) return s;
  return `${s} → ${formatDate(end)}`;
}

export default async function PublicRetreatsPage({ searchParams }: { searchParams: SearchParamsObj }) {
  const page = Math.max(1, Number(firstParam(searchParams.page) ?? "1") || 1);
  const q = firstParam(searchParams.q) ?? "";
  const sortParam = firstParam(searchParams.sort);
  const sort = sortParam && SORTABLE.has(sortParam) ? sortParam : "date_start";
  const dir = firstParam(searchParams.dir) === "asc" ? "asc" : "desc";
  const cohortParam = firstParam(searchParams.retreat);

  const filters: Record<string, string | number | boolean | null> = {};
  if (cohortParam) filters.cohort_slug = cohortParam;

  const [{ rows, total, pageSize, error }, optsRes, aggRes, attendeeRes] = await Promise.all([
    listEntity<Retreat>(
      "public_retreats",
      "id, cohort_slug, name, location, date_start, date_end, tiers, active, from_usd_cents, collected_usd_cents, registrations, confirmed",
      { page, pageSize: PAGE_SIZE, search: q, searchColumns: ["name", "location", "cohort_slug"], sort, dir, filters },
    ),
    // Filter options + KPI aggregates: the whole (small) retreat catalogue.
    companyOs.from("public_retreats").select("cohort_slug, name, location, date_start, active, confirmed, collected_usd_cents"),
    companyOs.from("public_retreats").select("active, confirmed, collected_usd_cents"),
    // Attendees grouped by cohort for the side car (small table — fetch all).
    companyOs
      .from("event_registrations")
      .select("status, attendee_name, attendee_email, person_id, people(full_name, email), products!inner(cohort_slug, tier)"),
  ]);

  // Build the "pick a retreat" filter options (label disambiguates same-city cohorts by date).
  type Opt = { cohort_slug: string; name: string | null; location: string | null; date_start: string | null };
  const retreatOptions = ((optsRes.data as Opt[] | null) ?? [])
    .sort((a, b) => (a.date_start ?? "").localeCompare(b.date_start ?? ""))
    .map((r) => ({
      value: r.cohort_slug,
      label: `${r.name || r.cohort_slug}${r.date_start ? " · " + formatDate(r.date_start) : ""}`,
    }));

  // KPI strip.
  const agg = (aggRes.data as { active: boolean | null; confirmed: number | null; collected_usd_cents: number | null }[] | null) ?? [];
  const activeRetreats = agg.filter((r) => r.active).length;
  const totalRegistered = agg.reduce((s, r) => s + (r.confirmed ?? 0), 0);
  const totalCollected = agg.reduce((s, r) => s + (r.collected_usd_cents ?? 0), 0);

  // Group attendees by cohort_slug for the side car.
  type RegRow = {
    status: string | null;
    attendee_name: string | null;
    attendee_email: string | null;
    person_id: string | null;
    people: { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null;
    products: { cohort_slug: string | null; tier: string | null } | { cohort_slug: string | null; tier: string | null }[] | null;
  };
  const attendeesByCohort = new Map<string, Attendee[]>();
  for (const r of (attendeeRes.data as RegRow[] | null) ?? []) {
    const prod = one(r.products);
    const cohort = prod?.cohort_slug;
    if (!cohort) continue;
    const p = one(r.people);
    const list = attendeesByCohort.get(cohort) ?? [];
    list.push({
      name: r.attendee_name || p?.full_name || null,
      email: r.attendee_email || p?.email || null,
      tier: prod?.tier ?? null,
      status: r.status,
      person_id: r.person_id,
    });
    attendeesByCohort.set(cohort, list);
  }

  const columns: Column<Retreat>[] = [
    {
      key: "name",
      header: "Retreat",
      sortable: true,
      cell: (r) => <span className="admin-cell-strong">{r.name || r.cohort_slug}</span>,
    },
    { key: "location", header: "Location", cell: (r) => r.location || <span className="admin-cell-muted">—</span> },
    { key: "date_start", header: "Dates", sortable: true, cell: (r) => dateRange(r.date_start, r.date_end) },
    {
      key: "confirmed",
      header: "Registered",
      sortable: true,
      align: "right",
      className: "admin-cell-mono",
      cell: (r) => {
        const c = r.confirmed ?? 0;
        const total = r.registrations ?? 0;
        return total > c ? `${c} (${total} incl. unconfirmed)` : String(c);
      },
    },
    { key: "from_usd_cents", header: "From", sortable: true, align: "right", className: "admin-cell-mono", cell: (r) => formatCents(r.from_usd_cents, "usd") },
    { key: "collected_usd_cents", header: "Collected", sortable: true, align: "right", className: "admin-cell-mono", cell: (r) => formatCents(r.collected_usd_cents, "usd") },
    { key: "active", header: "Status", cell: (r) => (r.active ? <Badge tone="ok">Active</Badge> : <Badge tone="neutral">Inactive</Badge>) },
  ];

  return (
    <>
      <PageHead
        eyebrow="Revenue"
        title="Public Retreats"
        sub={`${total.toLocaleString()} ${total === 1 ? "retreat" : "retreats"}`}
      />
      {error && <div className="admin-alert admin-alert--err" style={{ marginBottom: 14 }}>{error}</div>}

      <div className="mp-kpi-grid" style={{ marginBottom: 20 }}>
        <MetricCard label="Active retreats" value={activeRetreats} sub={`of ${agg.length} scheduled`} />
        <MetricCard label="Registered" value={totalRegistered} sub="confirmed attendees" />
        <MetricCard label="Collected" value={formatCents(totalCollected, "usd")} sub="USD · confirmed" />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        total={total}
        page={page}
        pageSize={pageSize}
        sort={sort}
        dir={dir}
        basePath="/admin/revenue/public-retreats"
        searchParams={searchParams}
        searchPlaceholder="Search retreat or location…"
        emptyText="No retreats match."
        filterBar={
          <FilterBar
            basePath="/admin/revenue/public-retreats"
            searchParams={searchParams}
            filters={[{ key: "retreat", label: "Retreat", options: retreatOptions }]}
          />
        }
        getRowPreview={(r) => {
          const attendees = attendeesByCohort.get(r.cohort_slug) ?? [];
          return {
            eyebrow: "Retreat",
            title: r.name || r.cohort_slug,
            body: (
              <>
                <dl className="admin-kv">
                  <dt>Location</dt>
                  <dd>{r.location || "—"}</dd>
                  <dt>Dates</dt>
                  <dd>{dateRange(r.date_start, r.date_end)}</dd>
                  <dt>Tiers</dt>
                  <dd>{r.tiers ?? 0}</dd>
                  <dt>From</dt>
                  <dd className="admin-cell-mono">{formatCents(r.from_usd_cents, "usd")}</dd>
                  <dt>Collected</dt>
                  <dd className="admin-cell-mono">{formatCents(r.collected_usd_cents, "usd")}</dd>
                  <dt>Registered</dt>
                  <dd>{r.confirmed ?? 0} confirmed{(r.registrations ?? 0) > (r.confirmed ?? 0) ? ` · ${r.registrations} total` : ""}</dd>
                  <dt>Status</dt>
                  <dd>{r.active ? <Badge tone="ok">Active</Badge> : <Badge tone="neutral">Inactive</Badge>}</dd>
                </dl>

                <div style={{ marginTop: 16 }}>
                  <div className="admin-cell-muted" style={{ marginBottom: 6, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Attendees
                  </div>
                  {attendees.length === 0 ? (
                    <div className="admin-empty">No registrations yet.</div>
                  ) : (
                    <div className="admin-list">
                      {attendees.map((a, i) => (
                        <div className="admin-list-row" key={i}>
                          <div className="admin-list-main">
                            <div className="admin-list-title">
                              {a.person_id ? (
                                <Link href={`/admin/contacts/${a.person_id}`} className="admin-cell-strong">
                                  {a.name || a.email || "Attendee"}
                                </Link>
                              ) : (
                                a.name || a.email || "Attendee"
                              )}
                            </div>
                            <div className="admin-list-sub">{a.tier ? humanize(a.tier) : "—"}</div>
                          </div>
                          <div className="admin-list-aside">
                            {a.status ? <Badge tone={statusTone(a.status)}>{humanize(a.status)}</Badge> : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ),
          };
        }}
      />
    </>
  );
}
