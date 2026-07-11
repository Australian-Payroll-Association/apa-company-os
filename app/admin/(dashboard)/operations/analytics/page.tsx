import { PageHead } from "@/components/admin/PageHead";
import { MetricCard } from "@/components/admin/MetricCard";
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
        sub="Site traffic from Vercel Web Analytics, last 30 days, production only."
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
        <div className="admin-card" style={{ padding: 24 }}>
          <p className="admin-card-title" style={{ marginBottom: 8 }}>
            Analytics unavailable
          </p>
          <p style={{ color: "var(--admin-muted)" }}>{overview.error}</p>
        </div>
      ) : (
        <>
          <div className="mp-kpi-grid">
            <MetricCard
              label="Page views (30d)"
              value={overview.totals.pageviews.toLocaleString()}
            />
            <MetricCard
              label="Visitors (30d)"
              value={overview.totals.visitors.toLocaleString()}
            />
          </div>

          <div className="admin-card" style={{ padding: 24, marginBottom: 20 }}>
            <p className="admin-card-title">Daily page views</p>
            <BarChart data={overview.daily} ariaLabel="Daily page views" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div className="admin-card" style={{ padding: 24 }}>
              <p className="admin-card-title">Top pages</p>
              <BarChart data={overview.topPages} ariaLabel="Top pages by page views" />
            </div>
            <div className="admin-card" style={{ padding: 24 }}>
              <p className="admin-card-title">Top referrers</p>
              <BarChart
                data={overview.topReferrers}
                ariaLabel="Top referrers by page views"
                emptyText="No referrer data yet."
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
