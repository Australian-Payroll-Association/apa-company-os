import Link from "next/link";
import { companyOs } from "@/lib/supabase";
import { STAGE_WON, STAGE_LOST, STAGE_NEUTRAL } from "@/lib/admin/stageColors";
import { PageHead } from "@/components/admin/PageHead";
import { MetricCard } from "@/components/admin/MetricCard";
import { Badge } from "@/components/admin/Badge";
import { formatCents, formatDate, timeAgo } from "@/lib/admin/format";
import { ACTIVE_LEAD_STATUSES } from "@/lib/lifecycle";
import { CockpitDeals } from "./CockpitDeals";
import type { DealCard } from "./deals/DealsBoard";
import { HANDOFF_COLUMN_ID } from "./deals/constants";
import type { KanbanColumn } from "@/components/admin/KanbanBoard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sales cockpit",
  description: "The one screen for current leads, open pipeline, and what to do next.",
};

// The Revenue office landing: a sales command center. Every open deal is checked
// for the four things a rep needs to act — an owner, a value, a next step, and a
// date — and anything missing is surfaced up top so nothing dies silently.

// Inquiry types that are NOT inbound sales contact (events, commerce, legacy import).
const NON_SALES_INQUIRY_TYPES = "(general,retreat,trip,checkout,newsletter)";

type Embedded<T> = T | T[] | null;
const one = <T,>(e: Embedded<T>): T | null => (Array.isArray(e) ? e[0] ?? null : e);

type Stage = { id: string; name: string; is_won: boolean; is_lost: boolean };
type DealRow = {
  id: string;
  title: string | null;
  stage_id: string | null;
  amount_cents: number | null;
  amount_usd_cents: number | null;
  currency: string | null;
  owner_id: string | null;
  status: string | null;
  source: string | null;
  expected_close_date: string | null;
  next_step: string | null;
  next_step_date: string | null;
  proposal_url: string | null;
  contract_url: string | null;
  handoff_status: string | null;
  lost_reason: string | null;
  probability: number | null;
  person_id: string | null;
  updated_at: string | null;
  referrer_id: string | null;
  people: Embedded<{ full_name: string | null; email: string }>;
  companies: Embedded<{ name: string | null }>;
  referrer: Embedded<{ full_name: string | null; email: string }>;
};
type LeadRow = {
  id: string;
  full_name: string | null;
  email: string;
  lead_status: string | null;
  lead_sla_due_at: string | null;
  created_at: string;
};
// Raw shape from the lead satellite join; flattened into LeadRow after fetch.
type LeadRawRow = {
  status: string | null;
  sla_due_at: string | null;
  created_at: string;
  people: { id: string; full_name: string | null; email: string } | null;
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
  const nowIso = new Date().toISOString();

  let dealsQuery = companyOs
    .from("deals")
    .select(
      "id, title, stage_id, amount_cents, amount_usd_cents, currency, owner_id, status, source, expected_close_date, next_step, next_step_date, proposal_url, contract_url, handoff_status, lost_reason, probability, person_id, updated_at, referrer_id, people!person_id(full_name, email), companies!company_id(name), referrer:people!referrer_id(full_name, email)",
    )
    .eq("status", "open")
    .is("archived_at", null)
    .limit(500);

  let inqQuery = companyOs
    .from("inquiries")
    .select("id, subject, type, created_at, people(full_name, email)")
    .eq("status", "new_lead")
    .not("type", "in", NON_SALES_INQUIRY_TYPES)
    .order("created_at", { ascending: false })
    .limit(50);

  const [stagesRes, dealsRes, leadsRes, inqRes, overdueRes, wonRes] = await Promise.all([
    companyOs.from("pipeline_stages").select("id, name, is_won, is_lost").order("position"),
    dealsQuery,
    companyOs
      .from("lead")
      .select("status, sla_due_at, created_at, people!person_id!inner(id, full_name, email, archived_at)")
      .in("status", ACTIVE_LEAD_STATUSES)
      .is("people.archived_at", null)
      .order("sla_due_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true })
      .limit(50),
    inqQuery,
    companyOs
      .from("lead")
      .select("person_id, people!person_id!inner(id)", { count: "exact", head: true })
      .in("status", ACTIVE_LEAD_STATUSES)
      .is("people.archived_at", null)
      .not("sla_due_at", "is", null)
      .lt("sla_due_at", nowIso),
    companyOs
      .from("deals")
      .select("amount_usd_cents")
      .eq("status", "won")
      .is("archived_at", null)
      .gte("closed_at", "2026-01-01")
      .lt("closed_at", "2027-01-01"),
  ]);

  const stages = (stagesRes.data as Stage[] | null) ?? [];
  const stageName = new Map(stages.map((s) => [s.id, s.name]));
  const deals = (dealsRes.data as DealRow[] | null) ?? [];
  const leads: LeadRow[] = ((leadsRes.data as unknown as LeadRawRow[] | null) ?? [])
    .filter((l) => l.people)
    .map((l) => ({
      id: l.people!.id,
      full_name: l.people!.full_name,
      email: l.people!.email,
      lead_status: l.status,
      lead_sla_due_at: l.sla_due_at,
      created_at: l.created_at,
    }));
  const inquiries = (inqRes.data as InquiryRow[] | null) ?? [];
  const slaOverdue = overdueRes.count ?? 0;
  const dealsClosed = ((wonRes.data as { amount_usd_cents: number | null }[] | null) ?? []).reduce(
    (s, d) => s + (d.amount_usd_cents ?? 0),
    0,
  );
  const err = stagesRes.error || dealsRes.error || leadsRes.error || inqRes.error;

  const openPipeline = deals.reduce((s, d) => s + (d.amount_usd_cents ?? 0), 0);
  const needsAttention = deals
    .map((d) => ({ d, gaps: dealGaps(d) }))
    .filter((x) => x.gaps.length > 0)
    .sort((a, b) => (b.d.amount_usd_cents ?? 0) - (a.d.amount_usd_cents ?? 0));

  const firstStageId = stages[0]?.id ?? "";
  const dealStages: KanbanColumn[] = stages.map((s) => ({
    id: s.id,
    label: s.name,
    accent: s.is_won ? STAGE_WON : s.is_lost ? STAGE_LOST : STAGE_NEUTRAL,
  }));
  const lostStageIds = stages.filter((s) => s.is_lost).map((s) => s.id);

  // Full deal cards for the side car — the same shape the pipeline board uses, so
  // the cockpit opens the identical DealDetail shelf.
  const dealCards: DealCard[] = deals.map((d) => {
    const co = one(d.companies);
    const p = one(d.people);
    const rf = one(d.referrer);
    const pendingHandoff = d.handoff_status === "pending" && d.status === "open";
    return {
      id: d.id,
      columnId: pendingHandoff ? HANDOFF_COLUMN_ID : d.stage_id ?? firstStageId,
      stageId: d.stage_id ?? firstStageId,
      // Not fetched here — this cockpit view only opens DealDetail (no board/list
      // rendering), which never reads or writes position.
      position: 0,
      title: d.title,
      personId: d.person_id,
      personName: p?.full_name ?? p?.email ?? null,
      companyName: co?.name ?? null,
      referrerId: d.referrer_id,
      referrerName: rf?.full_name ?? rf?.email ?? null,
      amountCents: d.amount_cents,
      amountUsdCents: d.amount_usd_cents,
      currency: d.currency,
      probability: d.probability,
      status: d.status,
      expectedClose: d.expected_close_date,
      source: d.source,
      nextStep: d.next_step,
      nextStepDate: d.next_step_date,
      proposalUrl: d.proposal_url,
      contractUrl: d.contract_url,
      handoffStatus: d.handoff_status ?? "none",
      lostReason: d.lost_reason,
      archivedAt: null,
      updatedAt: d.updated_at,
    };
  });

  const cockpitDeals = needsAttention.map(({ d, gaps }) => {
    const co = one(d.companies);
    const p = one(d.people);
    return {
      id: d.id,
      title: d.title || co?.name || p?.full_name || p?.email || "Untitled deal",
      stage: d.stage_id ? stageName.get(d.stage_id) ?? "—" : "—",
      usd: d.amount_usd_cents,
      nextStep: d.next_step,
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
        <MetricCard label="Deals closed" value={formatCents(dealsClosed)} sub="won value, 2026" href="/admin/revenue/deals" />
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
        <CockpitDeals
          deals={cockpitDeals}
          cards={dealCards}
          stages={dealStages}
          lostStageIds={lostStageIds}
        />
      </div>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", alignItems: "start" }}>
        {/* ── Leads to work ── */}
        <div className="admin-card admin-section-card" style={{ alignSelf: "start" }}>
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
        {/* marginTop:0 cancels the `.admin-section-card + .admin-section-card` stacking
            margin, which the grid's adjacent siblings otherwise inherit and which would
            push this card 16px below the Leads card. */}
        <div className="admin-card admin-section-card" style={{ alignSelf: "start", marginTop: 0 }}>
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
