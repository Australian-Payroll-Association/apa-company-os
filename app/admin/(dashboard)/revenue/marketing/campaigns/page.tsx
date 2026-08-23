import Link from "next/link";
import type { Metadata } from "next";
import { PageHead } from "@/components/admin/PageHead";
import { Badge } from "@/components/admin/Badge";
import { requireAdmin } from "@/lib/admin-auth";
import { listCampaigns, type MarketingCampaignStatus } from "@/lib/admin/marketing-campaigns";
import { listBrands, listPillars, CHANNEL_LABEL } from "@/lib/admin/marketing-calendar";
import { NewCampaignButton } from "./NewCampaignButton";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  title: "Campaigns",
  description: "Founder-led campaigns: one idea, assets across every channel.",
};

const STATUS_TONE: Record<MarketingCampaignStatus, "ok" | "warn" | "err" | "info"> = {
  draft: "info",
  active: "warn",
  done: "ok",
  archived: "info",
};

const STATUS_LABEL: Record<MarketingCampaignStatus, string> = {
  draft: "Draft",
  active: "Active",
  done: "Done",
  archived: "Archived",
};

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function windowLabel(startsOn: string | null, endsOn: string | null): string {
  if (!startsOn && !endsOn) return "—";
  return `${fmt(startsOn)} – ${fmt(endsOn)}`;
}

export default async function CampaignsPage() {
  await requireAdmin();
  const [{ rows, error }, brands, pillars] = await Promise.all([
    listCampaigns(),
    listBrands(),
    listPillars(),
  ]);

  return (
    <div>
      <PageHead
        eyebrow="Revenue · Marketing"
        title="Campaigns"
        sub={`${rows.length} campaign${rows.length === 1 ? "" : "s"}. A campaign is the idea; it spawns assets across every channel.`}
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <Link className="admin-btn" href="/admin/revenue/marketing">
              Back to Marketing
            </Link>
            <NewCampaignButton brands={brands} pillars={pillars} />
          </div>
        }
      />

      {error && (
        <div className="admin-alert admin-alert--err" style={{ marginBottom: 14 }}>
          {error}
        </div>
      )}

      <div className="admin-table-wrap">
        {rows.length === 0 ? (
          <div className="admin-empty">No campaigns yet. Start one with “+ New campaign”.</div>
        ) : (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Status</th>
                  <th>Window</th>
                  <th>Channels</th>
                  <th>Build progress</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const pct = c.assetCount === 0 ? 0 : Math.round((c.builtCount / c.assetCount) * 100);
                  return (
                    <tr key={c.id}>
                      <td className="admin-cell-strong">
                        <Link href={`/admin/revenue/marketing/campaigns/${c.id}`}>{c.name}</Link>
                        <div className="admin-cell-muted" style={{ fontWeight: 400, marginTop: 2 }}>
                          {[c.objective, c.pillarName ? `Pillar: ${c.pillarName}` : null, c.brandName]
                            .filter(Boolean)
                            .join(" · ") || "No goal set"}
                        </div>
                      </td>
                      <td>
                        <Badge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                      </td>
                      <td className="admin-cell-mono">{windowLabel(c.startsOn, c.endsOn)}</td>
                      <td>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {c.channels.length === 0 ? (
                            <span className="admin-cell-muted">—</span>
                          ) : (
                            c.channels.map((ch) => (
                              <span key={ch} className="admin-chip">
                                {CHANNEL_LABEL[ch]}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td style={{ minWidth: 160 }}>
                        <div
                          style={{
                            height: 8,
                            borderRadius: 20,
                            background: "var(--admin-line-soft)",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${pct}%`,
                              height: "100%",
                              borderRadius: 20,
                              background: "var(--admin-accent)",
                            }}
                          />
                        </div>
                        <div className="admin-cell-muted" style={{ marginTop: 5 }}>
                          {c.builtCount} / {c.assetCount} assets built
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
