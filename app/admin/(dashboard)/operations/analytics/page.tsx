import Link from "next/link";
import { PageHead } from "@/components/admin/PageHead";
import { BarChart } from "@/components/admin/charts/BarChart";
import { getAnalyticsOverview, type AnalyticsRange } from "@/lib/admin/vercel-analytics";
import { firstParam, type SearchParamsObj } from "@/lib/admin/url";

export const dynamic = "force-dynamic";

const VERCEL_ANALYTICS_URL = "https://vercel.com/edge8-ais-projects/edge8-web/analytics";

const RANGES: { key: AnalyticsRange; label: string; sub: string }[] = [
  { key: "7d", label: "Last 7 days", sub: "rolling 7 days" },
  { key: "30d", label: "Last 30 days", sub: "rolling 30 days" },
  { key: "90d", label: "Last 90 days", sub: "rolling 90 days" },
  { key: "all", label: "All time", sub: "since Jul 11, 2026" },
];

function parseRange(value: string | undefined): AnalyticsRange {
  return value === "7d" || value === "30d" || value === "90d" ? value : "all";
}

export default async function AnalyticsPage({ searchParams }: { searchParams: SearchParamsObj }) {
  const range = parseRange(firstParam(searchParams.range));
  const active = RANGES.find((r) => r.key === range) ?? RANGES[0];
  const overview = await getAnalyticsOverview(range);

  return (
    <div>
      <PageHead
        eyebrow="Operations"
        title="Analytics"
        sub={`Site traffic from Vercel Web Analytics, ${active.sub}, production only.`}
        action={
          <a
            href={VERCEL_ANALYTICS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="admin-btn"
          >
            Open in Vercel ↗
          </a>
        }
      />

      <div className="admin-tabs" role="tablist" style={{ marginBottom: 14 }}>
        {RANGES.map((r) => (
          <Link
            key={r.key}
            href={r.key === "all" ? "/admin/operations/analytics" : `/admin/operations/analytics?range=${r.key}`}
            role="tab"
            aria-selected={r.key === range}
            className={`admin-tab${r.key === range ? " is-active" : ""}`}
            style={{ textDecoration: "none" }}
          >
            {r.label}
          </Link>
        ))}
      </div>

      {"error" in overview ? (
        <div className="admin-alert admin-alert--err">{overview.error}</div>
      ) : (
        <div className="admin-summary">
          <div className="admin-summary-pills">
            <div className="admin-pill">
              <span className="admin-pill-label">Page views</span>
              <span className="admin-pill-val">{overview.totals.pageviews.toLocaleString()}</span>
            </div>
            <div className="admin-pill">
              <span className="admin-pill-label">Visitors</span>
              <span className="admin-pill-val">{overview.totals.visitors.toLocaleString()}</span>
            </div>
          </div>
          <div
            className="admin-summary-grid"
            style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
          >
            <div className="admin-card admin-chart-card">
              <div className="mp-kpi-label">Daily page views</div>
              <BarChart data={overview.daily} ariaLabel="Daily page views" />
            </div>
            <div className="admin-card admin-chart-card">
              <div className="mp-kpi-label">Top referrers</div>
              <BarChart
                data={overview.topReferrers}
                ariaLabel="Top referrers by page views"
                emptyText="No referrer data yet."
              />
            </div>
          </div>
          <div className="admin-card admin-chart-card">
            <div className="mp-kpi-label">Top pages</div>
            <BarChart data={overview.topPages} ariaLabel="Top pages by page views" stacked />
          </div>
        </div>
      )}
    </div>
  );
}
