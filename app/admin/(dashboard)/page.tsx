import { Suspense } from "react";
import Link from "next/link";
import { companyOs } from "@/lib/supabase";
import { PageHead } from "@/components/admin/PageHead";
import { MetricCard } from "@/components/admin/MetricCard";
import { formatCents } from "@/lib/admin/format";
import { getAnalyticsTotals } from "@/lib/admin/vercel-analytics";
import { getOfficeGoals, healthSummary, type OfficeKey, type OfficeSnapshot } from "@/lib/admin/office-goals";
import { compactUsd, vsPrior, MS_DAY } from "@/lib/admin/dashboard-helpers";

// Live operational data, read fresh on every request.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Company Dashboard",
  description: "The company at a glance, one panel per office. Each office's full picture lives on its cockpit.",
};

const NON_SALES_INQUIRY_TYPES = "(general,retreat,trip,checkout,newsletter)";
// Work-request statuses that are finished; anything else is still in flight.
const WR_TERMINAL = "(completed,rejected,cancelled,draft)";

type InvoiceRow = { txn_date: string | null; amount_cents: number | null; status: string | null; entity: string };
type OrderRow = { created_at: string; amount_usd_cents: number | null; status: string | null };
type DealRow = { status: string | null; amount_usd_cents: number | null; created_at: string; closed_at: string | null };

// One office block: the office's three headline numbers, its goal-health chips,
// and a link to the office cockpit that holds the full picture.
function OfficePanel({
  office,
  label,
  snapshot,
  quarterLabel,
  children,
}: {
  office: OfficeKey;
  label: string;
  snapshot: OfficeSnapshot;
  quarterLabel: string;
  children: React.ReactNode;
}) {
  const chips = healthSummary(snapshot.health);
  const issues = snapshot.openIssues;
  return (
    <section style={{ marginTop: 26 }}>
      <div className="admin-panel-head">
        <div className="mp-kpi-label" style={{ margin: 0 }}>{label}</div>
        <Link href={`/admin/${office}`} className="admin-auth-link">Open cockpit →</Link>
      </div>
      <div className="mp-kpi-grid">{children}</div>
      {(chips || issues > 0) && (
        <div className="mp-kpi-note" style={{ marginTop: 10 }}>
          {quarterLabel} goals: {chips || "none set"}
          {issues > 0 ? ` · ${issues} open ${issues === 1 ? "issue" : "issues"}` : ""}
        </div>
      )}
    </section>
  );
}

async function TrafficNote() {
  const analytics = await getAnalyticsTotals();
  const traffic = "error" in analytics ? null : analytics.totals;
  return (
    <MetricCard
      label="Page views"
      value={traffic ? traffic.pageviews.toLocaleString("en-US") : "—"}
      sub="since Jul 11"
      href="/admin/operations/analytics"
    />
  );
}
function TrafficNoteFallback() {
  return <MetricCard label="Page views" value="…" sub="since Jul 11" href="/admin/operations/analytics" />;
}

export default async function DashboardPage() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const yearStart = `${year}-01-01`;
  const tomorrow = new Date(now.getTime() + MS_DAY).toISOString().slice(0, 10);
  const date30 = new Date(now.getTime() - 30 * MS_DAY).toISOString().slice(0, 10);
  const iso30 = new Date(now.getTime() - 30 * MS_DAY).toISOString();
  const iso60 = new Date(now.getTime() - 60 * MS_DAY).toISOString();
  const iso90 = new Date(now.getTime() - 90 * MS_DAY).toISOString();

  const [
    invoicesRes,
    ordersRes,
    dealsRes,
    leadsRes,
    teamRes,
    openReqsRes,
    appsRes,
    daysOffRes,
    reqRes,
    botRes,
    ideasRes,
    krRes,
    goals,
  ] = await Promise.all([
    companyOs.from("invoices").select("txn_date, amount_cents, status, entity").neq("status", "voided").limit(2000),
    companyOs.from("orders").select("created_at, amount_usd_cents, status").limit(2000),
    companyOs.from("deals").select("status, amount_usd_cents, created_at, closed_at").is("archived_at", null).limit(2000),
    companyOs.from("lead").select("created_at").gte("created_at", iso90).limit(1000),
    companyOs.from("team_members").select("status, start_date").limit(1000),
    companyOs.from("job_requisitions").select("id", { count: "exact", head: true }).eq("status", "open"),
    companyOs.from("applications").select("applied_at").gte("applied_at", iso60).limit(2000),
    companyOs.from("time_off").select("id", { count: "exact", head: true }).eq("status", "approved").gte("start_date", date30),
    companyOs.from("contractor_work_requests").select("id", { count: "exact", head: true }).not("status", "in", WR_TERMINAL),
    companyOs.from("assistant_conversations").select("id", { count: "exact", head: true }).is("archived_at", null).gte("last_message_at", iso30),
    companyOs.from("ideas").select("kind, created_at").neq("status", "archived").limit(1000),
    companyOs.from("key_results").select("delivery_mix"),
    getOfficeGoals(),
  ]);

  const err =
    invoicesRes.error || ordersRes.error || dealsRes.error || leadsRes.error || teamRes.error ||
    appsRes.error || ideasRes.error || krRes.error;

  // ── Revenue ──
  const invoices = ((invoicesRes.data as InvoiceRow[] | null) ?? []).filter((i) => i.txn_date);
  const paidOrders = ((ordersRes.data as OrderRow[] | null) ?? []).filter((o) => o.status === "paid");
  const invoiceCash = (from: string, to: string, entity?: "edge8" | "aio") =>
    invoices.reduce(
      (s, i) => (i.txn_date! >= from && i.txn_date! < to && (!entity || i.entity === entity) ? s + (i.amount_cents ?? 0) : s),
      0,
    );
  const stripeCash = (from: string, to: string) =>
    paidOrders.reduce((s, o) => {
      const d = o.created_at.slice(0, 10);
      return d >= from && d < to ? s + (o.amount_usd_cents ?? 0) : s;
    }, 0);
  const cashBetween = (from: string, to: string) => invoiceCash(from, to) + stripeCash(from, to);

  const cash30 = cashBetween(date30, tomorrow);
  const cashYtd = cashBetween(yearStart, tomorrow);
  const rev30Edge8 = invoiceCash(date30, tomorrow, "edge8") + stripeCash(date30, tomorrow);
  const rev30Aio = invoiceCash(date30, tomorrow, "aio");

  const deals = (dealsRes.data as DealRow[] | null) ?? [];
  const openDeals = deals.filter((d) => d.status === "open");
  const openPipeline = openDeals.reduce((s, d) => s + (d.amount_usd_cents ?? 0), 0);
  const dealsAdded30 = deals.filter((d) => d.created_at >= iso30).length;

  const leadDates = ((leadsRes.data as { created_at: string }[] | null) ?? []).map((l) => l.created_at);
  const newLeads30 = leadDates.filter((d) => d >= iso30).length;
  const newLeadsPrev30 = leadDates.filter((d) => d >= iso60 && d < iso30).length;
  const leads90 = leadDates.filter((d) => d >= iso90).length;
  const won90 = deals.filter((d) => d.status === "won" && d.closed_at && d.closed_at >= iso90).length;
  const conversion90 = leads90 ? Math.round((won90 / leads90) * 1000) / 10 : 0;

  // ── Talent ──
  const team = (teamRes.data as { status: string | null; start_date: string | null }[] | null) ?? [];
  const headcount = team.filter((t) => t.status === "active").length;
  const newHires = team.filter((t) => t.start_date && t.start_date >= yearStart).length;
  const apps = (appsRes.data as { applied_at: string | null }[] | null) ?? [];
  const apps30 = apps.filter((a) => a.applied_at && a.applied_at >= iso30).length;
  const appsPrev30 = apps.filter((a) => a.applied_at && a.applied_at >= iso60 && a.applied_at < iso30).length;
  const openRoles = openReqsRes.count ?? 0;

  // ── Operations ──
  const daysOff30 = daysOffRes.count ?? 0;
  const openRequests = reqRes.count ?? 0;
  const botCount = botRes.count ?? 0;

  // ── Innovation ──
  const ideas = (ideasRes.data as { kind: string | null; created_at: string }[] | null) ?? [];
  const buildIdeas = ideas.filter((i) => i.kind === "build").length;
  const learnings30 = ideas.filter((i) => i.kind === "learning" && i.created_at >= iso30).length;
  const krs = (krRes.data as { delivery_mix: string | null }[] | null) ?? [];
  const mixTotal = krs.length;
  const agentShare = mixTotal
    ? Math.round((krs.filter((k) => k.delivery_mix === "ai" || k.delivery_mix === "blended").length / mixTotal) * 100)
    : 0;

  return (
    <>
      <PageHead
        eyebrow="Company OS"
        title="Company Dashboard"
        sub="The company at a glance, one panel per office. Open a cockpit for the full picture."
      />

      {err && (
        <div className="admin-alert admin-alert--err" style={{ marginBottom: 14 }}>
          {err.message}
        </div>
      )}

      {/* ── Vitals ── */}
      <div className="mp-kpi-grid">
        <MetricCard
          label="Revenue · 30d"
          value={formatCents(cash30)}
          sub={
            <>
              <div>Edge8 {compactUsd(rev30Edge8)}</div>
              <div>AIO {compactUsd(rev30Aio)}</div>
            </>
          }
        />
        <MetricCard label="Pipeline · 30d" value={formatCents(openPipeline)} sub={`${openDeals.length} open · ${dealsAdded30} added`} href="/admin/revenue/deals" />
        <MetricCard label="Headcount" value={headcount} sub="active team members" href="/admin/talent" />
        <MetricCard
          label="Open issues"
          value={goals.openIssuesTotal}
          sub={goals.openIssuesTotal === 0 ? "nothing on the board" : "across the offices"}
          href="/admin/edges/issues"
        />
      </div>

      <OfficePanel office="revenue" label="Revenue" snapshot={goals.byOffice.revenue} quarterLabel={goals.quarter.label}>
        <MetricCard label="Revenue · YTD" value={formatCents(cashYtd)} sub={`${year} to date`} href="/admin/revenue" />
        <MetricCard label="New leads · 30d" value={newLeads30} sub={vsPrior(newLeads30, newLeadsPrev30)} href="/admin/revenue/leads" />
        <MetricCard label="Conversion · 90d" value={`${conversion90}%`} sub="lead → won" href="/admin/revenue" />
      </OfficePanel>

      <OfficePanel office="talent" label="Talent" snapshot={goals.byOffice.talent} quarterLabel={goals.quarter.label}>
        <MetricCard label="Open roles" value={openRoles} sub="hiring now" href="/admin/talent/jobs" />
        <MetricCard label="Applications · 30d" value={apps30} sub={vsPrior(apps30, appsPrev30)} href="/admin/talent/applications" />
        <MetricCard label={`New hires · ${year}`} value={newHires} sub="joined this year" href="/admin/talent" />
      </OfficePanel>

      <OfficePanel office="operations" label="Operations" snapshot={goals.byOffice.operations} quarterLabel={goals.quarter.label}>
        <MetricCard label="Days off · 30d" value={daysOff30} sub="approved leave" href="/admin/operations/time-off/requests" />
        <MetricCard label="Open requests" value={openRequests} sub="contractor + client" href="/admin/operations/contractor-requests" />
        <MetricCard label="Chat bot · 30d" value={botCount} sub="assistant conversations" href="/admin/operations" />
      </OfficePanel>

      <OfficePanel office="innovation" label="Innovation" snapshot={goals.byOffice.innovation} quarterLabel={goals.quarter.label}>
        <MetricCard label="Ideas" value={buildIdeas} sub="open build ideas" href="/admin/innovation" />
        <MetricCard label="Learning · 30d" value={learnings30} sub="learnings logged" href="/admin/innovation" />
        <MetricCard label="AI delivery mix" value={`${agentShare}%`} sub={mixTotal ? "agent-run key results" : "no key results yet"} href="/admin/innovation" />
      </OfficePanel>

      {/* Traffic streams in its own boundary so a slow external analytics fetch
          never gates the office panels above. */}
      <section style={{ marginTop: 26 }}>
        <div className="mp-kpi-label" style={{ marginBottom: 10 }}>Traffic</div>
        <div className="mp-kpi-grid">
          <Suspense fallback={<TrafficNoteFallback />}>
            <TrafficNote />
          </Suspense>
        </div>
      </section>
    </>
  );
}
