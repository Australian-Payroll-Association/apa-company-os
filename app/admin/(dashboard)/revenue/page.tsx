import Link from "next/link";
import { companyOs } from "@/lib/supabase";
import { getActiveBrandId } from "@/lib/admin/brand";
import { PageHead } from "@/components/admin/PageHead";
import { MetricCard } from "@/components/admin/MetricCard";
import { Badge } from "@/components/admin/Badge";
import { formatCents, formatDate, timeAgo } from "@/lib/admin/format";
import { ACTIVE_LEAD_STAGES } from "@/lib/lifecycle";
import { CockpitDeals } from "./CockpitDeals";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sales cockpit",
  description: "The one screen for current leads, open pipeline, and what to do next.",
};

// The Revenue office landing: a sales command center. Every open deal is checked
// for the four things a rep needs to act — an owner, a value, a next step, and a
// date — and anything missing is surfaced up top so nothing dies silently.

const ACTIVE_STATUS_FILTER =
  "lead_status.is.null,lead_status.in.(new,attempting,connected,meeting_booked)";
// Inquiry types that are NOT inbound sales contact (events, commerce, legacy import).
const NON_SALES_INQUIRY_TYPES = "(general,retreat,trip,checkout,newsletter)";

type Embedded<T> = T | T[] | null;
const one = <T,>(e: Embedded<T>): T | null => (Array.isArray(e) ? e[0] ?? null : e);

type Stage = { id: string; name: string; is_won: boolean; is_lost: boolean };
type DealRow = {
  id: string;
  title: string | null;
  stage_id: string | null;
  amount_usd_cents: number | null;
  owner_id: string | null;
  next_step: string | null;
  next_step_date: string | null;
  probability: number | null;
  updated_at: string | null;
  people: Embedded<{ full_name: string | null; email: string }>;
  companies: Embedded<{ name: string | null }>;
};
type LeadRow = {
  id: string;
  full_name: string | null;
  email: string;
  lead_status: string | null;
  lead_sla_due_at: string | null;
  created_at: string;
};
type InquiryRow = {
  id: string;
  subject: string | null;
  type: string | null;
  created_at: string;
  people: Embedded<{ full_name: string | null; email: string }>;
};

function dealGaps(d: DealRow): string[] {
  const gaps: string[] = [];
  if (!d.owner_id) gaps.push("Owner");
  if (!d.amount_usd_cents) gaps.push("Value");
  if (!d.next_step) gaps.push("Next step");
  if (!d.next_step_date) gaps.push("Date");
  return gaps;
}

export default async function SalesCockpitPage() {
  const brandId = getActiveBrandId();
  const nowIso = new Date().toISOString();

  let dealsQuery = companyOs
    .from("deals")
    .select(
      "id, title, stage_id, amount_usd_cents, owner_id, next_step, next_step_date, probability, updated_at, people!person_id(full_name, email), companies(name)",
    )
    .eq("status", "open")
    .is("archived_at", null)
    .limit(500);
  if (brandId) dealsQuery = dealsQuery.eq("brand_id", brandId);

  let inqQuery = companyOs
    .from("inquiries")
    .select("id, subject, type, created_at, people(full_name, email)")
    .eq("status", "new_lead")
    .not("type", "in", NON_SALES_INQUIRY_TYPES)
    .order("created_at", { ascending: false })
    .limit(50);
  if (brandId) inqQuery = inqQuery.eq("brand_id", brandId);

  const [stagesRes, dealsRes, leadsRes, inqRes, overdueRes] = await Promise.all([
    companyOs.from("pipeline_stages").select("id, name, is_won, is_lost").order("position"),
    dealsQuery,
    companyOs
      .from("people")
      .select("id, full_name, email, lead_status, lead_sla_due_at, created_at")
      .in("lifecycle_stage", ACTIVE_LEAD_STAGES)
      .or(ACTIVE_STATUS_FILTER)
      .is("archived_at", null)
      .order("lead_sla_due_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true })
      .limit(50),
    inqQuery,
    companyOs
      .from("people")
      .select("id", { count: "exact", head: true })
      .in("lifecycle_stage", ACTIVE_LEAD_STAGES)
      .or(ACTIVE_STATUS_FILTER)
      .is("archived_at", null)
      .not("lead_sla_due_at", "is", null)
      .lt("lead_sla_due_at", nowIso),
  ]);

  const stages = (stagesRes.data as Stage[] | null) ?? [];
  const stageName = new Map(stages.map((s) => [s.id, s.name]));
  const deals = (dealsRes.data as DealRow[] | null) ?? [];
  const leads = (leadsRes.data as LeadRow[] | null) ?? [];
  const inquiries = (inqRes.data as InquiryRow[] | null) ?? [];
  const slaOverdue = overdueRes.count ?? 0;
  const err = stagesRes.error || dealsRes.error || leadsRes.error || inqRes.error;

  const openPipeline = deals.reduce((s, d) => s + (d.amount_usd_cents ?? 0), 0);
  const weighted = deals.reduce(
    (s, d) => s + (d.amount_usd_cents ?? 0) * ((d.probability ?? 0) / 100),
    0,
  );
  const needsAttention = deals
    .map((d) => ({ d, gaps: dealGaps(d) }))
    .filter((x) => x.gaps.length > 0)
    .sort((a, b) => (b.d.amount_usd_cents ?? 0) - (a.d.amount_usd_cents ?? 0));

  const cockpitDeals = needsAttention.map(({ d, gaps }) => {
    const co = one(d.companies);
    const p = one(d.people);
    return {
      id: d.id,
      title: d.title || co?.name || p?.full_name || p?.email || "Untitled deal",
      stage: d.stage_id ? stageName.get(d.stage_id) ?? "—" : "—",
      usd: d.amount_usd_cents,
      hasOwner: !!d.owner_id,
      probability: d.probability,
      nextStep: d.next_step,
      nextStepDate: d.next_step_date,
      company: co?.name ?? null,
      person: p?.full_name ?? p?.email ?? null,
      gaps,
    };
  });

  return (
    <>
      <PageHead
        eyebrow="Revenue"
        title="Sales cockpit"
        sub="Current leads, open pipeline, and everything missing a next move."
      />
      {err && (
        <div className="admin-alert admin-alert--err" style={{ marginBottom: 14 }}>
          {err.message}
        </div>
      )}

      <div className="mp-kpi-grid" style={{ marginBottom: 20 }}>
        <MetricCard label="Open pipeline" value={formatCents(openPipeline)} sub={`${deals.length} open deals`} href="/admin/revenue/deals" />
        <MetricCard label="Weighted" value={formatCents(Math.round(weighted))} sub="by probability" />
        <MetricCard label="Leads to work" value={leads.length} sub={slaOverdue > 0 ? `${slaOverdue} SLA overdue` : "all inside SLA"} href="/admin/revenue/leads" />
        <MetricCard label="Inquiries to triage" value={inquiries.length} sub="contact-us, unworked" href="/admin/revenue/inquiries" />
        <MetricCard
          label="Deals needing attention"
          value={needsAttention.length}
          sub={needsAttention.length > 0 ? "missing owner / value / next step" : "pipeline is clean"}
        />
      </div>

      {/* ── Deals needing attention: the priority action list ── */}
      <div className="admin-card admin-section-card" style={{ marginBottom: 20 }}>
        <h2 className="admin-card-title">Deals needing attention</h2>
        <CockpitDeals deals={cockpitDeals} />
      </div>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", alignItems: "start" }}>
        {/* ── Leads to work ── */}
        <div className="admin-card admin-section-card">
          <h2 className="admin-card-title">Leads to work</h2>
          {leads.length === 0 ? (
            <div className="admin-empty">No current leads in the queue.</div>
          ) : (
            <div className="admin-list">
              {leads.slice(0, 8).map((l) => {
                const overdue = l.lead_sla_due_at && l.lead_sla_due_at < nowIso;
                return (
                  <div key={l.id} className="admin-list-row">
                    <div className="admin-list-main">
                      <div className="admin-list-title">
                        <Link href={`/admin/contacts/${l.id}`}>{l.full_name || l.email}</Link>
                      </div>
                      <div className="admin-list-sub">{l.email}</div>
                    </div>
                    <div className="admin-list-aside">
                      <Badge tone={overdue ? "err" : "info"} dot>
                        {l.lead_status ?? "new"}
                      </Badge>
                      <span className="admin-list-sub">
                        {l.lead_sla_due_at ? `SLA ${overdue ? "overdue" : formatDate(l.lead_sla_due_at)}` : `added ${timeAgo(l.created_at)}`}
                      </span>
                    </div>
                  </div>
                );
              })}
              {leads.length > 8 && (
                <div style={{ paddingTop: 10 }}>
                  <Link href="/admin/revenue/leads" className="admin-auth-link">View all {leads.length} in the queue →</Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Inquiries to triage ── */}
        <div className="admin-card admin-section-card">
          <h2 className="admin-card-title">Inquiries to triage</h2>
          {inquiries.length === 0 ? (
            <div className="admin-empty">No new contact-us inquiries. Inbox zero.</div>
          ) : (
            <div className="admin-list">
              {inquiries.slice(0, 8).map((q) => {
                const p = one(q.people);
                return (
                  <div key={q.id} className="admin-list-row">
                    <div className="admin-list-main">
                      <div className="admin-list-title">{p?.full_name || p?.email || "Unknown"}</div>
                      <div className="admin-list-sub">{q.subject || "Contact-us inquiry"}</div>
                    </div>
                    <div className="admin-list-aside">
                      <span className="admin-list-sub">{timeAgo(q.created_at)}</span>
                    </div>
                  </div>
                );
              })}
              <div style={{ paddingTop: 10 }}>
                <Link href="/admin/revenue/inquiries" className="admin-auth-link">Open the inquiries board →</Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
