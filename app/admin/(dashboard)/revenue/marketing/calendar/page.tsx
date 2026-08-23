import Link from "next/link";
import type { Metadata } from "next";
import { PageHead } from "@/components/admin/PageHead";
import { requireAdmin } from "@/lib/admin-auth";
import { listEntries, listBrands, listPillars, getPillarPerformance } from "@/lib/admin/marketing-calendar";
import { listBrandProfiles } from "@/lib/admin/brand-profiles";
import { CalendarClient } from "./CalendarClient";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  title: "Marketing calendar",
  description: "Plan content across blog, email, LinkedIn, and Facebook.",
};

export default async function MarketingCalendarPage() {
  await requireAdmin();
  const [{ rows, error }, brands, pillars, performance, profiles] = await Promise.all([
    listEntries(),
    listBrands(),
    listPillars(),
    getPillarPerformance(),
    listBrandProfiles(),
  ]);
  const stylePrefs = profiles.map((p) => ({
    brandId: p.brandId,
    blog: p.preferredBlogTypes,
    image: p.preferredImageStyles,
    social: p.preferredSocialStyles,
  }));

  return (
    <div>
      <PageHead
        eyebrow="Revenue · Marketing"
        title="Calendar"
        sub="One plan across blog, email, LinkedIn, and Facebook. Email entries can spawn a real campaign."
        action={
          <Link className="admin-btn" href="/admin/revenue/marketing">
            Back to Marketing
          </Link>
        }
      />

      {error && (
        <div className="admin-alert admin-alert--err" style={{ marginBottom: 14 }}>
          {error}
        </div>
      )}

      {performance.length > 0 && (
        <section className="admin-card admin-section-card">
          <div className="admin-card-title">Performance by pillar</div>
          <div className="admin-table-wrap" style={{ marginTop: 12 }}>
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Pillar</th>
                    <th>Campaigns</th>
                    <th>Sent</th>
                    <th>Delivered</th>
                    <th>Opened</th>
                    <th>Clicked</th>
                    <th>Click rate</th>
                  </tr>
                </thead>
                <tbody>
                  {performance.map((p) => (
                    <tr key={p.pillar}>
                      <td className="admin-cell-strong">{p.pillar}</td>
                      <td className="admin-cell-mono">{p.campaigns}</td>
                      <td className="admin-cell-mono">{p.sent.toLocaleString()}</td>
                      <td className="admin-cell-mono">{p.delivered.toLocaleString()}</td>
                      <td className="admin-cell-mono">{p.opened.toLocaleString()}</td>
                      <td className="admin-cell-mono">{p.clicked.toLocaleString()}</td>
                      <td className="admin-cell-mono">
                        {p.delivered > 0 ? `${Math.round((p.clicked / p.delivered) * 100)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <CalendarClient initialEntries={rows} brands={brands} initialPillars={pillars} stylePrefs={stylePrefs} />
    </div>
  );
}
