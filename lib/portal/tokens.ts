// Human-token packs. 1 token = 1 hour of skilled work; a pack is 40 tokens at
// $2,000. Same scoping discipline as the other lib/portal helpers: every read
// is the company-scoped sum, nothing wider. Purchasing is a standalone Stripe
// Checkout (app/portal/(dashboard)/tokens); no draw-down against work-request
// billing yet.
//
// Since HTT Phase 3 the page also shows delivery: Bought (paid Stripe purchases
// plus the current manual allocation per company), Delivered (tracked human
// hours), Planned (roadmap token_high estimates), and AI leverage (AI tokens
// per delivered human hour), with a per-AI-Program drill-down from htt.repos.
// The credit pool stays at company grain; delivery rolls up per repo/program.

import { companyOs, htt } from "@/lib/supabase";
import type { PortalActor } from "@/lib/portal-auth";
import { portalRead } from "@/lib/portal/data";

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

// ---------------------------------------------------------------------------
// HTT delivery rollup
// ---------------------------------------------------------------------------

export type ProgramUsage = {
  repoId: string | null; // null = tracked work not attributed to a repo
  name: string;
  deliveredHours: number;
  aiTokens: number;
  leverage: number | null; // AI tokens per delivered hour; null when no hours
};

export type TokenUsage = {
  purchasedTokens: number; // paid Stripe purchases
  allocatedTokens: number; // current manual allocation (latest seq per company)
  boughtTokens: number; // purchased + allocated
  pendingTokens: number;
  plannedTokens: number; // SUM(client_backlog_items.token_high), active items
  deliveredHours: number; // SUM(htt.man_hour_entries.hours), status <> excluded
  balanceTokens: number; // bought - delivered
  aiTokens: number; // SUM(htt.token_entries.amount) for kind claude/app
  leverage: number | null; // aiTokens / deliveredHours; null when no hours
  programs: ProgramUsage[];
  purchases: TokenPurchase[];
};

const EMPTY_USAGE: TokenUsage = {
  purchasedTokens: 0,
  allocatedTokens: 0,
  boughtTokens: 0,
  pendingTokens: 0,
  plannedTokens: 0,
  deliveredHours: 0,
  balanceTokens: 0,
  aiTokens: 0,
  leverage: null,
  programs: [],
  purchases: [],
};

// PostgREST caps a response at 1000 rows; page through so a company with more
// tracked entries than that still sums correctly. Every caller passes a query
// factory so each page gets a fresh builder with the same scope filters.
const PAGE = 1000;
async function fetchAll<T>(
  build: () => { range: (from: number, to: number) => PromiseLike<{ data: unknown }> },
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await build().range(from, from + PAGE - 1);
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return rows;
}

export async function getTokenUsage(actor: PortalActor): Promise<TokenUsage> {
  if (actor.companyScope.length === 0) return EMPTY_USAGE;
  const scope = actor.companyScope;

  const [balance, allocationRows, plannedRes, repoRows, hourRows, aiRows] = await Promise.all([
    getTokenBalance(actor),
    // Manual credit allocations: append-only, the row with the highest seq per
    // company is current; NULL tokens on that row means removed (counts 0).
    fetchAll<{ company_id: string; tokens: number | null; seq: number }>(() =>
      htt
        .from("token_allocations")
        .select("company_id, tokens, seq")
        .in("company_id", scope)
        .order("seq", { ascending: false }),
    ),
    portalRead(actor, "client_backlog_items", "token_high").is("archived_at", null),
    fetchAll<{ id: string; name: string }>(() =>
      htt.from("repos").select("id, name").in("company_id", scope).order("name"),
    ),
    fetchAll<{ repo_id: string | null; hours: number }>(() =>
      htt
        .from("man_hour_entries")
        .select("repo_id, hours")
        .in("company_id", scope)
        .neq("status", "excluded"),
    ),
    fetchAll<{ repo_id: string | null; amount: number }>(() =>
      htt
        .from("token_entries")
        .select("repo_id, amount")
        .in("company_id", scope)
        .in("kind", ["claude", "app"]),
    ),
  ]);

  // Latest allocation per company (rows arrive seq desc).
  const seenAllocation = new Set<string>();
  let allocatedTokens = 0;
  for (const row of allocationRows) {
    if (seenAllocation.has(row.company_id)) continue;
    seenAllocation.add(row.company_id);
    allocatedTokens += Number(row.tokens ?? 0);
  }

  const plannedTokens = ((plannedRes.data ?? []) as unknown as Array<{ token_high: number | null }>).reduce(
    (sum, r) => sum + Number(r.token_high ?? 0),
    0,
  );

  const hoursByRepo = new Map<string | null, number>();
  let deliveredHours = 0;
  for (const row of hourRows) {
    const h = Number(row.hours ?? 0);
    deliveredHours += h;
    hoursByRepo.set(row.repo_id, (hoursByRepo.get(row.repo_id) ?? 0) + h);
  }

  const aiByRepo = new Map<string | null, number>();
  let aiTokens = 0;
  for (const row of aiRows) {
    const a = Number(row.amount ?? 0);
    aiTokens += a;
    aiByRepo.set(row.repo_id, (aiByRepo.get(row.repo_id) ?? 0) + a);
  }

  const leverageOf = (ai: number, hours: number): number | null =>
    hours > 0 ? ai / hours : null;

  // One row per AI Program (spine: 1 repo = 1 AI Program), plus one for tracked
  // work not attributed to a repo. Programs with no activity yet still list, so
  // the client sees what is being tracked.
  const programs: ProgramUsage[] = repoRows.map((repo) => {
    const hours = hoursByRepo.get(repo.id) ?? 0;
    const ai = aiByRepo.get(repo.id) ?? 0;
    return {
      repoId: repo.id,
      name: repo.name,
      deliveredHours: hours,
      aiTokens: ai,
      leverage: leverageOf(ai, hours),
    };
  });
  const unassignedHours = hoursByRepo.get(null) ?? 0;
  const unassignedAi = aiByRepo.get(null) ?? 0;
  if (unassignedHours > 0 || unassignedAi > 0) {
    programs.push({
      repoId: null,
      name: "Unassigned work",
      deliveredHours: unassignedHours,
      aiTokens: unassignedAi,
      leverage: leverageOf(unassignedAi, unassignedHours),
    });
  }

  const purchasedTokens = balance.balanceTokens;
  const boughtTokens = purchasedTokens + allocatedTokens;

  return {
    purchasedTokens,
    allocatedTokens,
    boughtTokens,
    pendingTokens: balance.pendingTokens,
    plannedTokens,
    deliveredHours,
    balanceTokens: boughtTokens - deliveredHours,
    aiTokens,
    leverage: leverageOf(aiTokens, deliveredHours),
    programs,
    purchases: balance.purchases,
  };
}
