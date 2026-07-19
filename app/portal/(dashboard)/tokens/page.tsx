import { requirePortalMember } from "@/lib/portal-auth";
import { getTokenBalance, PACK_PRICE_CENTS, PACK_TOKENS } from "@/lib/portal/tokens";
import { PageHead } from "@/components/admin/PageHead";
import { MetricCard } from "@/components/admin/MetricCard";
import { Badge } from "@/components/admin/Badge";
import { formatCents, formatDate } from "@/lib/admin/format";
import { firstParam, type SearchParamsObj } from "@/lib/admin/url";
import { TokenPurchaseCard } from "./TokenPurchaseCard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Human Tokens",
  description: "Pre-buy packs of skilled hours.",
};

const PURCHASE_TONE = { paid: "ok", pending: "warn", expired: "neutral" } as const;
const PURCHASE_LABEL = { paid: "Paid", pending: "Processing", expired: "Expired" } as const;

export default async function PortalTokensPage({ searchParams }: { searchParams: SearchParamsObj }) {
  const actor = await requirePortalMember();
  const balance = await getTokenBalance(actor);
  const justPaid = firstParam(searchParams.status) === "success";

  return (
    <>
      <PageHead
        eyebrow="Client Portal"
        title="Human Tokens"
        sub={`1 token = 1 hour of skilled work. A pack is ${PACK_TOKENS} tokens for ${formatCents(PACK_PRICE_CENTS, "usd")}.`}
      />

      {justPaid && (
        <div className="admin-alert admin-alert--ok" style={{ marginBottom: 14 }}>
          Payment received — thank you! Your balance updates within a few seconds once Stripe confirms.
        </div>
      )}

      <div className="mp-kpi-grid" style={{ marginBottom: 20 }}>
        <MetricCard label="Token balance" value={balance.balanceTokens} sub="hours of skilled work" />
        {balance.pendingTokens > 0 && (
          <MetricCard label="Processing" value={balance.pendingTokens} sub="awaiting payment confirmation" />
        )}
      </div>

      <div className="admin-card admin-section-card" style={{ marginBottom: 16 }}>
        <h2 className="admin-card-title" style={{ marginBottom: 10 }}>Buy token packs</h2>
        {actor.impersonation && (
          <p className="admin-page-sub" style={{ marginTop: 0 }}>
            Viewing as client — checkout is disabled. This is what the client sees.
          </p>
        )}
        <TokenPurchaseCard />
      </div>

      <div className="admin-card admin-section-card">
        <h2 className="admin-card-title" style={{ marginBottom: 10 }}>Purchases</h2>
        {balance.purchases.length === 0 ? (
          <div className="admin-empty">No token purchases yet.</div>
        ) : (
          <div className="admin-list">
            {balance.purchases.map((p) => (
              <div className="admin-list-row" key={p.id}>
                <div className="admin-list-main">
                  <div className="admin-list-title">
                    {p.packs} {p.packs === 1 ? "pack" : "packs"} · {p.tokens} tokens
                  </div>
                  <div className="admin-list-sub">
                    {formatCents(p.amountCents, "usd")} · {formatDate(p.paidAt ?? p.createdAt)}
                  </div>
                </div>
                <div className="admin-list-aside">
                  <Badge tone={PURCHASE_TONE[p.status]}>{PURCHASE_LABEL[p.status]}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
