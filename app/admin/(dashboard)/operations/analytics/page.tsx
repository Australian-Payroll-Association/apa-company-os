import { PageHead } from "@/components/admin/PageHead";

const VERCEL_ANALYTICS_URL =
  "https://vercel.com/edge8-ais-projects/edge8-web/analytics";

export default function AnalyticsPage() {
  return (
    <div>
      <PageHead
        eyebrow="Operations"
        title="Analytics"
        sub="Site traffic is tracked with Vercel Web Analytics."
      />
      <div className="admin-card" style={{ padding: "24px" }}>
        <p className="admin-card-title" style={{ marginBottom: 8 }}>
          Vercel Web Analytics
        </p>
        <p style={{ color: "var(--admin-muted)", marginBottom: 20, maxWidth: 560 }}>
          Page views, visitors, and top pages for edge8.ai are collected automatically
          via the tracking script installed in the site. The full dashboard, including
          historical trends and referrer breakdowns, lives in Vercel.
        </p>
        <a
          href={VERCEL_ANALYTICS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="admin-btn admin-btn--primary"
        >
          Open Vercel Analytics ↗
        </a>
      </div>
    </div>
  );
}
