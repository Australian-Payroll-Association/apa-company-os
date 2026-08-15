import { Suspense } from "react";
import Link from "next/link";
import { companyOs } from "@/lib/supabase";
import { PageHead } from "@/components/admin/PageHead";
import { MetricCard } from "@/components/admin/MetricCard";
import { BarChart } from "@/components/admin/charts/BarChart";
import { DonutChart } from "@/components/admin/charts/DonutChart";
import { formatCents, formatDate } from "@/lib/admin/format";
import { getAnalyticsTotals } from "@/lib/admin/vercel-analytics";

// Read fresh on every request — this is live operational data.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dashboard",
  description: "Company dashboard: revenue, talent, and operations — 30 days, YTD, and trends.",
};

// ── Shared shapes ────────────────────────────────────────────────────────────

type Embedded<T> = T | T[] | null;
const one = <T,>(e: Embedded<T>): T | null => (Array.isArray(e) ? e[0] ?? null : e);

type InvoiceRow = { txn_date: string | null; amount_cents: number | null; balance_cents: number | null; status: string | null; entity: string };
type OrderRow = { created_at: string; amount_usd_cents: number | null; status: string | null };
type DealRow = { status: string | null; amount_usd_cents: number | null; created_at: string; closed_at: string | null };
type StaffingRow = { companies: Embedded<{ name: string | null }> };
type TeamRow = { status: string | null; departments: Embedded<{ name: string | null }> };
type AppRow = { status: string | null; applied_at: string | null; decided_at: string | null };
type TimeOffRow = {
  start_date: string;
  end_date: string;
  leave_type: string | null;
  team_members: Embedded<{ people: Embedded<{ full_name: string | null; email: string }> }>;
};
type EventRow = { id: string; title: string | null; starts_at: string | null; capacity: number | null; location: string | null };
type RegRow = { event_id: string | null; status: string | null };

// Inquiry types that are NOT inbound sales contact — mirrors the sales cockpit.
const NON_SALES_INQUIRY_TYPES = "(general,retreat,trip,checkout,newsletter)";
// Registration statuses that hold a seat — mirrors the events screen.
const COUNTED_REG_STATUSES = new Set(["registered", "attended", "confirmed"]);

const MS_DAY = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Compact money for chart direct labels ("$84.2k" beats "$84,203" in 12px type).
function compactUsd(cents: number): string {
  const d = cents / 100;
  if (d >= 100_000) return `$${Math.round(d / 1000)}k`;
  if (d >= 1000) return `$${(d / 1000).toFixed(1)}k`;
  return `$${Math.round(d)}`;
}

// Delta sub-line for rolling-30-day tiles.
function vsPrior(cur: number, prev: number, fmt: (n: number) => string = String): string {
  if (prev <= 0) return `prior 30d: ${fmt(prev)}`;
  const pct = Math.round(((cur - prev) / prev) * 100);
  const arrow = pct > 0 ? "▲" : pct < 0 ? "▼" : "＝";
  return `${arrow} ${Math.abs(pct)}% vs prior 30d (${fmt(prev)})`;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="mp-kpi-label" style={{ margin: "26px 0 10px" }}>{children}</div>;
}

// Two traffic tiles, fetched from the external Vercel Analytics API. Rendered in
// its own async boundary so it streams in after the DB-backed dashboard shell
// instead of gating first paint. getAnalyticsTotals() has a hard timeout, so a
// hung upstream degrades to "—" rather than hanging the page.
async function TrafficTiles() {
  const analytics = await getAnalyticsTotals();
  const traffic = "error" in analytics ? null : analytics.totals;
  return (
    <>
      <MetricCard
        label="Page views"
        value={traffic ? traffic.pageviews.toLocaleString("en-US") : "—"}
        sub="production, since Jul 11"
        href="/admin/operations/analytics"
      />
      <MetricCard
        label="Visitors"
        value={traffic ? traffic.visitors.toLocaleString("en-US") : "—"}
        sub="production, since Jul 11"
        href="/admin/operations/analytics"
      />
    </>
  );
}

function TrafficTilesFallback() {
  return (
    <>
      <MetricCard label="Page views" value="…" sub="production, since Jul 11" href="/admin/operations/analytics" />
      <MetricCard label="Visitors" value="…" sub="production, since Jul 11" href="/admin/operations/analytics" />
    </>
  );
}

export default async function DashboardPage() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const nowIso = now.toISOString();
  const today = nowIso.slice(0, 10);
  const iso30 = new Date(now.getTime() - 30 * MS_DAY).toISOString();
  const iso60 = new Date(now.getTime() - 60 * MS_DAY).toISOString();
  const date30 = iso30.slice(0, 10);
  const date60 = iso60.slice(0, 10);
  const in7Days = new Date(now.getTime() + 7 * MS_DAY).toISOString().slice(0, 10);
  const yearStart = `${year}-01-01`;

  const [
    invoicesRes,
    ordersRes,
    dealsRes,
    leadsRes,
    inqRes,
    staffingRes,
    teamRes,
    reqsRes,
    appsRes,
    outRes,
    pendingLeaveRes,
    eventsRes,
    regsRes,
    surveysRes,
  ] = await Promise.all([
    companyOs.from("invoices").select("txn_date, amount_cents, balance_cents, status, entity").neq("status", "voided").limit(1000),
    companyOs.from("orders").select("created_at, amount_usd_cents, status").limit(1000),
    companyOs.from("deals").select("status, amount_usd_cents, created_at, closed_at").is("archived_at", null).limit(1000),
    companyOs.from("lead").select("created_at").gte("created_at", iso60).limit(1000),
    companyOs
      .from("inquiries")
      .select("created_at")
      .not("type", "in", NON_SALES_INQUIRY_TYPES)
      .gte("created_at", iso60)
      .limit(1000),
    companyOs.from("staff_assignments").select("companies(name)").eq("status", "active").limit(500),
    // departments needs the FK hint: departments.head_team_member_id points back
    // at team_members, so a bare embed is ambiguous and PostgREST rejects it.
    companyOs.from("team_members").select("status, departments!department_id(name)").limit(500),
    companyOs.from("job_requisitions").select("*", { count: "exact", head: true }).eq("status", "open"),
    companyOs.from("applications").select("status, applied_at, decided_at").limit(2000),
    companyOs
      .from("time_off")
      .select("start_date, end_date, leave_type, team_members!team_member_id(people!person_id(full_name, email))")
      .eq("status", "approved")
      .gte("end_date", today)
      .lte("start_date", in7Days)
      .order("start_date")
      .limit(100),
    companyOs.from("time_off").select("*", { count: "exact", head: true }).eq("status", "requested"),
    companyOs
      .from("events")
      .select("id, title, starts_at, capacity, location")
      .is("archived_at", null)
      .gt("starts_at", nowIso)
      .order("starts_at")
      .limit(4),
    companyOs.from("event_registrations").select("event_id, status").not("event_id", "is", null),
    companyOs.from("survey_responses").select("submitted_at").gte("submitted_at", iso60).limit(2000),
  ]);

  const err =
    invoicesRes.error || ordersRes.error || dealsRes.error || leadsRes.error || inqRes.error ||
    staffingRes.error || teamRes.error || appsRes.error || outRes.error || eventsRes.error ||
    regsRes.error || surveysRes.error;

  // ── Revenue ────────────────────────────────────────────────────────────────
  // "Revenue" = all non-voided QuickBooks invoices by invoice date (accrual —
  // open/overdue count when billed, not when paid; unpaid side is the AR card)
  // + paid Stripe orders. All USD.

  const invoices = (invoicesRes.data as InvoiceRow[] | null) ?? [];
  const orders = (ordersRes.data as OrderRow[] | null) ?? [];
  const deals = (dealsRes.data as DealRow[] | null) ?? [];

  const revenueInvoices = invoices.filter((i) => i.txn_date);
  const paidOrders = orders.filter((o) => o.status === "paid");

  const invoiceCash = (fromDate: string, toDate: string, entity?: "edge8" | "aio") =>
    revenueInvoices.reduce(
      (s, i) =>
        i.txn_date! >= fromDate && i.txn_date! < toDate && (!entity || i.entity === entity)
          ? s + (i.amount_cents ?? 0)
          : s,
      0,
    );
  const stripeCash = (fromDate: string, toDate: string) =>
    paidOrders.reduce((s, o) => {
      const d = o.created_at.slice(0, 10);
      return d >= fromDate && d < toDate ? s + (o.amount_usd_cents ?? 0) : s;
    }, 0);
  const cashBetween = (fromDate: string, toDate: string) => invoiceCash(fromDate, toDate) + stripeCash(fromDate, toDate);

  // Per-company sub-line for the revenue tiles. Stripe checkout runs on
  // edge8.ai, so its orders count on the Edge8 side of the split.
  const entitySplit = (fromDate: string, toDate: string) =>
    `Edge8 ${compactUsd(invoiceCash(fromDate, toDate, "edge8") + stripeCash(fromDate, toDate))} · AIO ${compactUsd(invoiceCash(fromDate, toDate, "aio"))}`;

  const tomorrow = new Date(now.getTime() + MS_DAY).toISOString().slice(0, 10);
  const cash30 = cashBetween(date30, tomorrow);
  const cashPrev30 = cashBetween(date60, date30);
  const cashYtd = cashBetween(yearStart, tomorrow);

  const openInvoices = invoices.filter((i) => i.status === "open" || i.status === "overdue");
  const arOutstanding = openInvoices.reduce((s, i) => s + (i.balance_cents ?? 0), 0);

  const monthlyCash = MONTHS.slice(0, now.getUTCMonth() + 1).map((label, m) => {
    const from = `${year}-${String(m + 1).padStart(2, "0")}-01`;
    const to = m + 1 < 12 ? `${year}-${String(m + 2).padStart(2, "0")}-01` : `${year + 1}-01-01`;
    return { label, value: cashBetween(from, to) };
  });

  const openDeals = deals.filter((d) => d.status === "open");
  const openPipeline = openDeals.reduce((s, d) => s + (d.amount_usd_cents ?? 0), 0);
  const wonDeals = deals.filter((d) => d.status === "won");
  const won30 = wonDeals.filter((d) => d.closed_at && d.closed_at >= iso30);
  const won30Usd = won30.reduce((s, d) => s + (d.amount_usd_cents ?? 0), 0);
  const wonYtd = wonDeals.filter((d) => d.closed_at && d.closed_at >= yearStart);
  const wonYtdUsd = wonYtd.reduce((s, d) => s + (d.amount_usd_cents ?? 0), 0);

  const leadDates = ((leadsRes.data as { created_at: string }[] | null) ?? []).map((l) => l.created_at);
  const leads30 = leadDates.filter((d) => d >= iso30).length;
  const leadsPrev30 = leadDates.filter((d) => d < iso30).length;
  const inqDates = ((inqRes.data as { created_at: string }[] | null) ?? []).map((i) => i.created_at);
  const inq30 = inqDates.filter((d) => d >= iso30).length;

  const funnel30 = [
    { label: "Inquiries", value: inq30 },
    { label: "New leads", value: leads30 },
    { label: "Deals opened", value: deals.filter((d) => d.created_at >= iso30).length },
    { label: "Deals won", value: won30.length },
  ];

  const staffingByClient = new Map<string, number>();
  for (const row of (staffingRes.data as unknown as StaffingRow[] | null) ?? []) {
    const name = one(row.companies)?.name ?? "Unknown";
    staffingByClient.set(name, (staffingByClient.get(name) ?? 0) + 1);
  }
  const staffingChart = [...staffingByClient.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
  const staffingTotal = staffingChart.reduce((s, d) => s + d.value, 0);

  // ── Talent ─────────────────────────────────────────────────────────────────

  // Note: a headcount-over-time trend isn't possible yet — terminated members
  // have no end_date in company_os, so any derived series would never go down.
  const team = (teamRes.data as unknown as TeamRow[] | null) ?? [];
  const active = team.filter((t) => t.status === "active");
  const headcount = active.length;

  const byDept = new Map<string, number>();
  for (const t of active) {
    const name = one(t.departments)?.name ?? "Uncategorized";
    byDept.set(name, (byDept.get(name) ?? 0) + 1);
  }
  const deptChart = [...byDept.entries()].map(([label, value]) => ({ label, value }));

  const apps = (appsRes.data as AppRow[] | null) ?? [];
  const appsByMonth = MONTHS.slice(0, now.getUTCMonth() + 1).map((label, m) => {
    const from = `${year}-${String(m + 1).padStart(2, "0")}-01`;
    const to = m + 1 < 12 ? `${year}-${String(m + 2).padStart(2, "0")}-01` : `${year + 1}-01-01`;
    return { label, value: apps.filter((a) => a.applied_at && a.applied_at >= from && a.applied_at < to).length };
  });
  const activeApps = apps.filter((a) => a.status === "active").length;
  const apps30 = apps.filter((a) => a.applied_at && a.applied_at >= iso30).length;
  const appsPrev30 = apps.filter((a) => a.applied_at && a.applied_at >= iso60 && a.applied_at < iso30).length;
  const hiresYtd = apps.filter((a) => a.status === "hired" && a.decided_at && a.decided_at >= yearStart).length;
  const openReqs = reqsRes.count ?? 0;

  // ── Operations ─────────────────────────────────────────────────────────────

  const leave = ((outRes.data as unknown as TimeOffRow[] | null) ?? []).map((r) => {
    const person = one(one(r.team_members)?.people ?? null);
    return {
      name: person?.full_name || person?.email || "Unknown",
      type: (r.leave_type ?? "leave").replace(/[_-]+/g, " "),
      start: r.start_date,
      end: r.end_date,
    };
  });
  const outToday = leave.filter((l) => l.start <= today);
  const outLater = leave.filter((l) => l.start > today);
  const pendingLeave = pendingLeaveRes.count ?? 0;

  const regs = (regsRes.data as RegRow[] | null) ?? [];
  const regCount = new Map<string, number>();
  for (const r of regs) {
    if (!r.event_id || !COUNTED_REG_STATUSES.has(r.status ?? "")) continue;
    regCount.set(r.event_id, (regCount.get(r.event_id) ?? 0) + 1);
  }
  const upcomingEvents = (eventsRes.data as EventRow[] | null) ?? [];

  const surveyDates = ((surveysRes.data as { submitted_at: string | null }[] | null) ?? [])
    .map((s) => s.submitted_at)
    .filter((d): d is string => !!d);
  const surveys30 = surveyDates.filter((d) => d >= iso30).length;
  const surveysPrev30 = surveyDates.filter((d) => d < iso30).length;

  return (
    <>
      <PageHead
        eyebrow="Company OS"
        title="Dashboard"
        sub="Revenue, talent, and operations — last 30 days, year to date, and trends."
      />

      {err && (
        <div className="admin-alert admin-alert--err" style={{ marginBottom: 14 }}>
          {err.message}
        </div>
      )}

      {/* ── Headline ── */}
      <div className="mp-kpi-grid">
        <MetricCard
          label="Revenue · 30d"
          value={formatCents(cash30)}
          sub={`${entitySplit(date30, tomorrow)} · ${vsPrior(cash30, cashPrev30, formatCents)}`}
        />
        <MetricCard
          label="Revenue · YTD"
          value={formatCents(cashYtd)}
          sub={`${entitySplit(yearStart, tomorrow)} · invoices + Stripe`}
        />
        <MetricCard label="Open pipeline" value={formatCents(openPipeline)} sub={`${openDeals.length} open deals`} href="/admin/revenue/deals" />
        <MetricCard label="AR outstanding" value={formatCents(arOutstanding)} sub={`${openInvoices.length} open invoices`} />
      </div>

      {/* ── Revenue ── */}
      <SectionLabel>Revenue</SectionLabel>
      <div className="mp-kpi-grid">
        <MetricCard label="Deals won · 30d" value={formatCents(won30Usd)} sub={`${won30.length} deals`} href="/admin/revenue/deals" />
        <MetricCard label="Deals won · YTD" value={formatCents(wonYtdUsd)} sub={`${wonYtd.length} deals`} href="/admin/revenue/deals" />
        <MetricCard label="New leads · 30d" value={leads30} sub={vsPrior(leads30, leadsPrev30)} href="/admin/revenue/leads" />
        <MetricCard label="Sales inquiries · 30d" value={inq30} sub="contact-us only" href="/admin/revenue/inquiries" />
      </div>
      <div className="admin-summary-grid" style={{ marginTop: 16 }}>
        <div className="admin-card admin-chart-card">
          <div className="mp-kpi-label">Revenue by month · {year}</div>
          <BarChart data={monthlyCash} ariaLabel="Revenue by month" formatValue={compactUsd} />
        </div>
        <div className="admin-card admin-chart-card">
          <div className="mp-kpi-label">Pipeline flow · last 30 days</div>
          <BarChart data={funnel30} ariaLabel="Pipeline flow over the last 30 days" emptyText="No pipeline activity in the last 30 days." />
        </div>
        <div className="admin-card admin-chart-card">
          <div className="mp-kpi-label">Staffing · {staffingTotal} active placements</div>
          <BarChart data={staffingChart} ariaLabel="Active staffing placements by client" emptyText="No active placements." />
        </div>
      </div>

      {/* ── Talent ── */}
      <SectionLabel>Talent</SectionLabel>
      <div className="mp-kpi-grid">
        <MetricCard label="Headcount" value={headcount} sub="active team members" href="/admin/talent/team" />
        <MetricCard label="Open roles" value={openReqs} sub={`${activeApps} active applications`} href="/admin/talent/jobs" />
        <MetricCard label="Applications · 30d" value={apps30} sub={vsPrior(apps30, appsPrev30)} href="/admin/talent/applications" />
        <MetricCard label="Hires · YTD" value={hiresYtd} sub={`since Jan 1, ${year}`} href="/admin/talent/applications" />
      </div>
      <div className="admin-summary-grid" style={{ marginTop: 16 }}>
        <div className="admin-card admin-chart-card">
          <div className="mp-kpi-label">Headcount by department</div>
          <DonutChart data={deptChart} centerLabel="people" ariaLabel="Active team members by department" />
        </div>
        <div className="admin-card admin-chart-card">
          <div className="mp-kpi-label">Applications by month · {year}</div>
          <BarChart data={appsByMonth} ariaLabel="Job applications received by month" emptyText="No applications this year." />
        </div>
      </div>

      {/* ── Operations ── */}
      <SectionLabel>Operations</SectionLabel>
      <div className="mp-kpi-grid">
        <MetricCard
          label="Out today"
          value={outToday.length}
          sub={pendingLeave > 0 ? `${pendingLeave} requests pending` : "no pending requests"}
          href="/admin/operations/time-off"
        />
        <MetricCard label="Survey responses · 30d" value={surveys30} sub={vsPrior(surveys30, surveysPrev30)} href="/admin/operations/surveys" />
        {/* Traffic tiles hit an external Vercel API — stream them so a slow/cold
            analytics fetch never gates the DB-backed shell above. */}
        <Suspense fallback={<TrafficTilesFallback />}>
          <TrafficTiles />
        </Suspense>
      </div>
      <div className="admin-summary-grid" style={{ marginTop: 16 }}>
        <div className="admin-card admin-chart-card">
          <div className="mp-kpi-label">Out this week</div>
          {leave.length === 0 ? (
            <div className="admin-empty">Everyone's in this week.</div>
          ) : (
            <div className="admin-list">
              {[...outToday, ...outLater].slice(0, 8).map((l, i) => (
                <div key={`${l.name}-${l.start}-${i}`} className="admin-list-row">
                  <div className="admin-list-main">
                    <div className="admin-list-title">{l.name}</div>
                    <div className="admin-list-sub">{l.type}</div>
                  </div>
                  <div className="admin-list-aside">
                    <span className="admin-list-sub">
                      {l.start <= today ? `back ${formatDate(l.end)}` : `${formatDate(l.start)} – ${formatDate(l.end)}`}
                    </span>
                  </div>
                </div>
              ))}
              <div style={{ paddingTop: 10 }}>
                <Link href="/admin/operations/time-off" className="admin-auth-link">Open time off →</Link>
              </div>
            </div>
          )}
        </div>
        <div className="admin-card admin-chart-card">
          <div className="mp-kpi-label">Upcoming events</div>
          {upcomingEvents.length === 0 ? (
            <div className="admin-empty">Nothing on the calendar.</div>
          ) : (
            <div className="admin-list">
              {upcomingEvents.map((e) => (
                <div key={e.id} className="admin-list-row">
                  <div className="admin-list-main">
                    <div className="admin-list-title">
                      <Link href={`/admin/revenue/events/${e.id}`}>{e.title || "Untitled event"}</Link>
                    </div>
                    <div className="admin-list-sub">{[formatDate(e.starts_at), e.location].filter(Boolean).join(" · ")}</div>
                  </div>
                  <div className="admin-list-aside">
                    <span className="admin-list-sub">
                      {regCount.get(e.id) ?? 0}{e.capacity ? ` / ${e.capacity}` : ""} registered
                    </span>
                  </div>
                </div>
              ))}
              <div style={{ paddingTop: 10 }}>
                <Link href="/admin/revenue/events" className="admin-auth-link">Open events →</Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
