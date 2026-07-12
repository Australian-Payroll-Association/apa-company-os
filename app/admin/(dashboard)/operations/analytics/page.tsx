import { PageHead } from "@/components/admin/PageHead";
import { BarChart } from "@/components/admin/charts/BarChart";
import { getAnalyticsOverview } from "@/lib/admin/vercel-analytics";

export const dynamic = "force-dynamic";

const VERCEL_ANALYTICS_URL = "https://vercel.com/edge8-ais-projects/edge8-web/analytics";

export default async function AnalyticsPage() {
  const overview = await getAnalyticsOverview();

  return (
    <div>
      <PageHead
        eyebrow="Operations"
        title="Analytics"
        sub="Site traffic from Vercel Web Analytics, since Jul 11, 2026, production only."
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
