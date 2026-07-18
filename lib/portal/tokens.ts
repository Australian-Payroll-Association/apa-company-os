// Human-token packs. 1 token = 1 hour of skilled work; a pack is 40 tokens at
// $2,000. Same scoping discipline as the other lib/portal helpers: the balance
// is the company-scoped sum of PAID purchases, nothing wider. Purchasing is a
// standalone Stripe Checkout (app/portal/(dashboard)/tokens) — no draw-down
// against work-request billing yet.

import { companyOs } from "@/lib/supabase";
import type { PortalActor } from "@/lib/portal-auth";

export const PACK_TOKENS = 40;
export const PACK_PRICE_CENTS = 200_000; // $2,000
export const MAX_PACKS = 4;

export type TokenPurchase = {
  id: string;
  packs: number;
  tokens: number;
  amountCents: number;
  status: "pending" | "paid" | "expired";
  createdAt: string;
  paidAt: string | null;
};

export type TokenBalance = {
  balanceTokens: number; // sum of paid tokens
  pendingTokens: number; // checkout started, webhook not landed
  purchases: TokenPurchase[];
};

export async function getTokenBalance(actor: PortalActor): Promise<TokenBalance> {
  if (actor.companyScope.length === 0) return { balanceTokens: 0, pendingTokens: 0, purchases: [] };

  const { data } = await companyOs
    .from("token_purchases")
    .select("id, packs, tokens, amount_cents, status, created_at, paid_at")
    .in("company_id", actor.companyScope)
    .order("created_at", { ascending: false });

  let balanceTokens = 0;
  let pendingTokens = 0;
  const purchases = ((data ?? []) as Array<{ id: string; packs: number; tokens: number; amount_cents: number; status: TokenPurchase["status"]; created_at: string; paid_at: string | null }>).map(
    (r) => {
      if (r.status === "paid") balanceTokens += r.tokens;
      if (r.status === "pending") pendingTokens += r.tokens;
      return {
        id: r.id,
        packs: r.packs,
        tokens: r.tokens,
        amountCents: r.amount_cents,
        status: r.status,
        createdAt: r.created_at,
        paidAt: r.paid_at,
      };
    },
  );

  return { balanceTokens, pendingTokens, purchases };
}
