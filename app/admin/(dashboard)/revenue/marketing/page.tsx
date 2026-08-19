import Link from "next/link";
import type { Metadata } from "next";
import { PageHead } from "@/components/admin/PageHead";
import { MetricCard } from "@/components/admin/MetricCard";
import { Badge } from "@/components/admin/Badge";
import { BarChart } from "@/components/admin/charts/BarChart";
import { DonutChart } from "@/components/admin/charts/DonutChart";
import { requireAdmin } from "@/lib/admin-auth";
import { getAnalyticsOverview, toBars } from "@/lib/admin/vercel-analytics";
import {
  getAudienceBreakdown,
  getDeliverability,
  getEmailActivity,
  type EmailAudience,
  type MarketingRange,
} from "@/lib/admin/marketing";
import { firstParam, type SearchParamsObj } from "@/lib/admin/url";
import { EmailAudienceToggle } from "./EmailAudienceToggle";

export const dynamic = "force-dynamic";
// Supabase reads here get frozen by Next's data cache despite force-dynamic;
// the audience and send counts must reflect the CRM as it is right now.
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  title: "Marketing",
  description: "Site traffic, email activity, and the newsletter audience in one place.",
};

const RANGES: { key: MarketingRange; label: string; sub: string }[] = [
  { key: "7d", label: "Last 7 days", sub: "the last 7 days" },
  { key: "30d", label: "Last 30 days", sub: "the last 30 days" },
  { key: "90d", label: "Last 90 days", sub: "the last 90 days" },
  { key: "all", label: "All time", sub: "all time" },
];

function parseRange(value: string | undefined): MarketingRange {
  return value === "7d" || value === "90d" || value === "all" ? value : "30d";
}

function parseAudience(value: string | undefined): EmailAudience {
  return value === "outbound" || value === "transactional" ? value : "all";
}

// The by-source chart follows the same filter as the list, so it says which set
// it is showing rather than implying it covers everything.
const BY_SOURCE_LABEL: Record<EmailAudience, string> = {
  all: "Emails sent by source",
  outbound: "Sales & marketing by source",
  transactional: "Transactional by source",
};

const AUDIENCE_EMPTY: Record<EmailAudience, string> = {
  all: "No email sent in this window.",
  outbound:
    "No sales or marketing email in this window. Campaign sends and CRM correspondence land here.",
  transactional: "No transactional email in this window.",
};

function formatRate(value: number | null): string {
  if (value === null) return "—";
  return `${value.toFixed(1)}%`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function MarketingPage({ searchParams }: { searchParams: SearchParamsObj }) {
  await requireAdmin();
  const range = parseRange(firstParam(searchParams.range));
  const emailAudience = parseAudience(firstParam(searchParams.email));
  const active = RANGES.find((r) => r.key === range) ?? RANGES[1];

  const [traffic, email, audience, delivery] = await Promise.all([
    getAnalyticsOverview(range, "public"),
    getEmailActivity(range, emailAudience),
    getAudienceBreakdown(),
    getDeliverability(range),
  ]);

  const trafficError = "error" in traffic ? traffic.error : null;
  const totals = "error" in traffic ? null : traffic.totals;

  return (
    <div>
      <PageHead
        eyebrow="Revenue"
        title="Marketing"
        sub={`Site traffic, email activity, and the newsletter audience, ${active.sub}.`}
        action={
          <Link className="admin-btn admin-btn--primary" href="/admin/revenue/marketing/campaigns">
            Campaigns
          </Link>
        }
      />

      <div className="admin-tabs" role="tablist" style={{ marginBottom: 14 }}>
        {RANGES.map((r) => (
          <Link
            key={r.key}
            href={r.key === "30d" ? "/admin/revenue/marketing" : `/admin/revenue/marketing?range=${r.key}`}
            role="tab"
            aria-selected={r.key === range}
            className={`admin-tab${r.key === range ? " is-active" : ""}`}
            style={{ textDecoration: "none" }}
          >
            {r.label}
          </Link>
        ))}
      </div>

      <div className="mp-kpi-grid">
        <MetricCard
          label="Visitors"
          value={totals ? totals.visitors.toLocaleString() : "—"}
          sub={trafficError ? "Vercel Analytics unavailable" : "unique, public site only"}
        />
        <MetricCard
          label="Page views"
          value={totals ? totals.pageviews.toLocaleString() : "—"}
          sub={trafficError ? "Vercel Analytics unavailable" : "public site only"}
        />
        <MetricCard
          label="Emails sent"
          value={email.total.toLocaleString()}
          sub={`${email.bySource.length} source${email.bySource.length === 1 ? "" : "s"}`}
        />
        <MetricCard
          label="Newsletter audience"
          value={audience.eligible.toLocaleString()}
          sub={`of ${audience.total.toLocaleString()} contacts`}
        />
      </div>

      {trafficError && (
        <div className="admin-alert admin-alert--err" style={{ marginBottom: 16 }}>
          {trafficError}
        </div>
      )}
      {email.error && (
        <div className="admin-alert admin-alert--err" style={{ marginBottom: 16 }}>
          Email activity: {email.error}
        </div>
      )}
      {audience.error && (
        <div className="admin-alert admin-alert--err" style={{ marginBottom: 16 }}>
          Audience: {audience.error}
        </div>
      )}

      <section className="admin-card admin-section-card">
        <div className="admin-card-title">Public site traffic</div>
        <p className="admin-page-sub" style={{ marginTop: 4 }}>
          The marketing site only. Company OS (admin, team, and client portal) is excluded, since
          the team using the internal app is not audience reach.{" "}
          {!("error" in traffic) && traffic.coverage.totalPageviews > 0 && (
            <>
              These pages cover{" "}
              {Math.round(
                (traffic.coverage.shownPageviews / traffic.coverage.totalPageviews) * 100,
              )}
              % of {traffic.coverage.totalPageviews.toLocaleString()} public page views.{" "}
            </>
          )}
          <Link href="/admin/operations/analytics?segment=internal">See Company OS usage</Link>.
        </p>
        <div
          className="admin-summary-grid"
          style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", marginTop: 12 }}
        >
          <div className="admin-card admin-chart-card">
            <div className="mp-kpi-label">Top pages</div>
            <BarChart
              data={"error" in traffic ? [] : toBars(traffic.topPages)}
              ariaLabel="Top pages by page views"
              emptyText="No traffic data."
              stacked
            />
          </div>
          <div className="admin-card admin-chart-card">
            <div className="mp-kpi-label">Top referrers</div>
            <BarChart
              data={"error" in traffic ? [] : toBars(traffic.topReferrers)}
              ariaLabel="Top referrers by page views"
              emptyText="No referrer data."
              stacked
            />
          </div>
        </div>
      </section>

      <section className="admin-card admin-section-card">
        <div className="admin-card-title">Deliverability</div>
        {delivery.error ? (
          <div className="admin-alert admin-alert--err" style={{ marginTop: 12 }}>
            {delivery.error}
          </div>
        ) : !delivery.hasData ? (
          <div className="admin-empty" style={{ marginTop: 12 }}>
            No delivery data yet. Register the Resend webhook at{" "}
            <code>https://www.edge8.ai/api/webhooks/resend/</code> (trailing slash required) and set{" "}
            <code>RESEND_WEBHOOK_SECRET</code>. Events accrue from that point forward.
          </div>
        ) : (
          <>
            <div className="mp-kpi-grid" style={{ marginTop: 12, marginBottom: 0 }}>
              <MetricCard
                label="Delivered"
                value={formatRate(delivery.deliveryRate)}
                sub={`${delivery.delivered.toLocaleString()} of ${delivery.sent.toLocaleString()} sent`}
              />
              <MetricCard
                label="Bounced"
                value={formatRate(delivery.bounceRate)}
                sub={
                  delivery.bounceRate !== null && delivery.bounceRate > 5
                    ? "over 5%, clean the list"
                    : `${delivery.bounced.toLocaleString()} address${delivery.bounced === 1 ? "" : "es"}`
                }
              />
              <MetricCard
                label="Opened"
                value={formatRate(delivery.openRate)}
                sub={`${delivery.opened.toLocaleString()} of those delivered`}
              />
              <MetricCard
                label="Clicked"
                value={formatRate(delivery.clickRate)}
                sub={`${delivery.clicked.toLocaleString()} of those delivered`}
              />
            </div>
            {delivery.problems.length > 0 && (
              <div className="admin-table-wrap" style={{ marginTop: 16 }}>
                <div className="admin-table-scroll">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Address</th>
                        <th>Problem</th>
                        <th>When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {delivery.problems.map((row) => (
                        <tr key={`${row.recipient}-${row.occurredAt}-${row.eventType}`}>
                          <td className="admin-cell-strong">
                            {row.personId ? (
                              <Link href={`/admin/contacts/${row.personId}`}>{row.recipient}</Link>
                            ) : (
                              row.recipient
                            )}
                          </td>
                          <td>
                            <span
                              className={`admin-badge admin-badge--${row.eventType === "complained" ? "err" : "warn"}`}
                            >
                              {row.eventType === "complained" ? "Marked as spam" : "Bounced"}
                            </span>
                          </td>
                          <td className="admin-cell-mono">{formatDate(row.occurredAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <section className="admin-card admin-section-card">
        <div className="admin-card-title">Audience</div>
        <p className="admin-page-sub" style={{ marginTop: 4 }}>
          {audience.eligible.toLocaleString()} of {audience.total.toLocaleString()} contacts can receive
          marketing email. {audience.neverAsked.toLocaleString()} have never been asked,{" "}
          {audience.unsubscribed.toLocaleString()} opted out, and{" "}
          {audience.doNotContact.toLocaleString()}{" "}
          {audience.doNotContact === 1 ? "person is" : "people are"} marked do-not-contact. Job
          seekers and team members are excluded structurally.
        </p>
        <div
          className="admin-summary-grid"
          style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", marginTop: 12 }}
        >
          <div className="admin-card admin-chart-card">
            <div className="mp-kpi-label">Contacts by persona</div>
            <DonutChart
              data={audience.byPersona}
              centerLabel={`${audience.total.toLocaleString()} contacts`}
              ariaLabel="Contacts by persona"
              neutralLabel="Unset"
              emptyText="No contacts."
            />
          </div>
          <div className="admin-card admin-chart-card">
            <div className="mp-kpi-label">{BY_SOURCE_LABEL[emailAudience]}</div>
            <BarChart
              data={email.bySource}
              ariaLabel={BY_SOURCE_LABEL[emailAudience]}
              emptyText={AUDIENCE_EMPTY[emailAudience]}
              stacked
            />
            {email.breakdownTruncated && (
              <div className="admin-hint" style={{ marginTop: 8 }}>
                Based on the most recent sends in this window, not all
                {" "}
                {email.total.toLocaleString()}.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="admin-card admin-section-card">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div className="admin-card-title">Recent email</div>
          <EmailAudienceToggle
            active={emailAudience}
            counts={email.counts}
            searchParams={searchParams}
          />
        </div>
        <div className="admin-table-wrap" style={{ marginTop: 12 }}>
          {email.recent.length === 0 ? (
            <div className="admin-empty">{AUDIENCE_EMPTY[emailAudience]}</div>
          ) : (
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Sent</th>
                    <th>Subject</th>
                    <th>To</th>
                    <th>Type</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {email.recent.map((row) => (
                    <tr key={row.id}>
                      <td className="admin-cell-mono">{formatDate(row.occurredAt)}</td>
                      <td className="admin-cell-strong">{row.subject || "(no subject)"}</td>
                      <td>
                        {row.personId ? (
                          <Link href={`/admin/contacts/${row.personId}`}>{row.personName || row.to}</Link>
                        ) : (
                          <span className="admin-cell-muted">{row.to || "—"}</span>
                        )}
                      </td>
                      <td>
                        <Badge tone={row.kind === "outbound" ? "info" : "neutral"}>{row.kindLabel}</Badge>
                      </td>
                      <td className="admin-cell-muted">{row.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
