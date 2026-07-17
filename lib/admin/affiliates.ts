import { companyOs } from "@/lib/supabase";

// Affiliate aggregator for the Revenue office. One affiliate PERSON can hold
// several codes (historically Tracy/Nilssen did; the program is now one active
// code per person but inactive codes and their commissions are kept). Referral
// linkage lives in the CRM two ways and BOTH are resolved here:
//   - deals.affiliate_id  → a code tag (Stripe checkout / manual)
//   - deals.referrer_id   → the referring person directly (e.g. Brad Giles)
//
// Commission rate is a REDEMPTION CHOICE, not a code property: 20% as work
// credit, 10% as cash. A commission is "pending" until the affiliate chooses.

export const WORK_CREDIT_RATE = 0.2;
export const CASH_RATE = 0.1;

export type AffiliateCode = {
  id: string;
  code: string;
  programType: string | null;
  active: boolean;
  stripeCouponId: string | null;
  createdAt: string;
};

export type ReferredDeal = {
  id: string;
  title: string | null;
  status: string | null;
  amountCents: number | null;
  currency: string;
  companyName: string | null;
  via: "code" | "referrer";
};

export type AffiliateCommission = {
  id: string;
  code: string;
  sourceEvent: string;
  sourceRef: string | null;
  grossCents: number;
  rate: number | null;
  commissionCents: number | null;
  redemptionChoice: "work_credit" | "cash" | null;
  chosenAt: string | null;
  paidOut: boolean;
  notes: string | null;
  createdAt: string;
};

type Totals = {
  accruedGrossCents: number; // sum of every commission's gross
  realizedCents: number; // sum of chosen commission_cents
  unpaidCents: number; // chosen but not yet paid out
  pendingCount: number; // redemption_choice still null
};

export type AffiliateGroup = Totals & {
  personId: string;
  fullName: string | null;
  email: string;
  codes: AffiliateCode[];
  active: boolean; // holds at least one active code
  referredDealCount: number;
  referredOpenPipelineCents: number;
};

export type Affiliate360 = Totals & {
  personId: string;
  fullName: string | null;
  email: string;
  codes: AffiliateCode[];
  active: boolean;
  commissions: AffiliateCommission[];
  referredDeals: ReferredDeal[];
};

type Embedded<T> = T | T[] | null;
const one = <T,>(e: Embedded<T>): T | null => (Array.isArray(e) ? e[0] ?? null : e);

// Normalize a deal's amount to the USD-preferred figure the rest of the admin
// UI shows (amount_usd_cents when present, else the native amount).
function dealAmount(d: { amount_usd_cents: number | null; amount_cents: number | null; currency: string | null }) {
  const cents = d.amount_usd_cents ?? d.amount_cents;
  const currency = d.amount_usd_cents != null ? "usd" : d.currency ?? "usd";
  return { cents, currency };
}

const OPEN_STATUS = "open";

function emptyTotals(): Totals {
  return { accruedGrossCents: 0, realizedCents: 0, unpaidCents: 0, pendingCount: 0 };
}

function applyCommission(t: Totals, c: { gross_cents: number; commission_cents: number | null; redemption_choice: string | null; payout_id: string | null }) {
  t.accruedGrossCents += c.gross_cents ?? 0;
  if (c.redemption_choice == null) {
    t.pendingCount += 1;
  } else {
    const realized = c.commission_cents ?? 0;
    t.realizedCents += realized;
    if (!c.payout_id) t.unpaidCents += realized;
  }
}

type AffiliateRow = {
  id: string;
  code: string;
  program_type: string | null;
  active: boolean | null;
  stripe_coupon_id: string | null;
  created_at: string;
  person_id: string | null;
  people: Embedded<{ id: string; full_name: string | null; email: string; archived_at: string | null }>;
};

function toCode(r: AffiliateRow): AffiliateCode {
  return {
    id: r.id,
    code: r.code,
    programType: r.program_type,
    active: !!r.active,
    stripeCouponId: r.stripe_coupon_id,
    createdAt: r.created_at,
  };
}

// Person-grouped list for /admin/revenue/affiliates. Small table (one row per
// affiliate person) so we fetch all three sources whole and aggregate in JS
// rather than paginating — there are only a handful of affiliates.
export async function getAffiliateGroups(): Promise<AffiliateGroup[]> {
  const [{ data: affRows }, { data: commRows }, { data: dealRows }] = await Promise.all([
    companyOs
      .from("affiliates")
      .select("id, code, program_type, active, stripe_coupon_id, created_at, person_id, people(id, full_name, email, archived_at)")
      .order("created_at", { ascending: true }),
    companyOs.from("affiliate_commissions").select("affiliate_id, gross_cents, commission_cents, redemption_choice, payout_id"),
    companyOs
      .from("deals")
      .select("id, status, amount_cents, amount_usd_cents, currency, referrer_id, affiliate_id")
      .or("referrer_id.not.is.null,affiliate_id.not.is.null"),
  ]);

  const codeToPerson = new Map<string, string>(); // affiliate.id -> person_id
  const groups = new Map<string, AffiliateGroup>();

  for (const raw of (affRows ?? []) as AffiliateRow[]) {
    const person = one(raw.people);
    if (!raw.person_id || !person || person.archived_at) continue;
    codeToPerson.set(raw.id, raw.person_id);
    let g = groups.get(raw.person_id);
    if (!g) {
      g = {
        ...emptyTotals(),
        personId: raw.person_id,
        fullName: person.full_name,
        email: person.email,
        codes: [],
        active: false,
        referredDealCount: 0,
        referredOpenPipelineCents: 0,
      };
      groups.set(raw.person_id, g);
    }
    g.codes.push(toCode(raw));
    if (raw.active) g.active = true;
  }

  for (const c of (commRows ?? []) as Array<{ affiliate_id: string; gross_cents: number; commission_cents: number | null; redemption_choice: string | null; payout_id: string | null }>) {
    const personId = codeToPerson.get(c.affiliate_id);
    const g = personId && groups.get(personId);
    if (g) applyCommission(g, c);
  }

  for (const d of (dealRows ?? []) as Array<{ id: string; status: string | null; amount_cents: number | null; amount_usd_cents: number | null; currency: string | null; referrer_id: string | null; affiliate_id: string | null }>) {
    const personId = (d.affiliate_id && codeToPerson.get(d.affiliate_id)) || d.referrer_id || null;
    const g = personId && groups.get(personId);
    if (!g) continue;
    g.referredDealCount += 1;
    if (d.status === OPEN_STATUS) g.referredOpenPipelineCents += dealAmount(d).cents ?? 0;
  }

  return [...groups.values()].sort((a, b) => (a.fullName || a.email).localeCompare(b.fullName || b.email));
}

// Full 360 for one affiliate person — powers the admin shelf and (reshaped) the
// client-portal Referrals page.
export async function getAffiliate360(personId: string): Promise<Affiliate360 | null> {
  const { data: person } = await companyOs
    .from("people")
    .select("id, full_name, email")
    .eq("id", personId)
    .maybeSingle();
  if (!person) return null;

  const { data: affRows } = await companyOs
    .from("affiliates")
    .select("id, code, program_type, active, stripe_coupon_id, created_at")
    .eq("person_id", personId)
    .order("created_at", { ascending: true });
  const codes = (affRows ?? []) as Array<Omit<AffiliateRow, "person_id" | "people">>;
  const codeIds = codes.map((c) => c.id);
  const codeById = new Map(codes.map((c) => [c.id, c.code] as const));

  const [{ data: commRows }, { data: dealRows }] = await Promise.all([
    codeIds.length
      ? companyOs
          .from("affiliate_commissions")
          .select("id, affiliate_id, source_event, source_ref, gross_cents, rate, commission_cents, redemption_choice, chosen_at, payout_id, notes, created_at")
          .in("affiliate_id", codeIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    companyOs
      .from("deals")
      .select("id, title, status, amount_cents, amount_usd_cents, currency, referrer_id, affiliate_id, companies(name)")
      .or(`referrer_id.eq.${personId}${codeIds.length ? `,affiliate_id.in.(${codeIds.join(",")})` : ""}`)
      .order("created_at", { ascending: false }),
  ]);

  const totals = emptyTotals();
  const commissions: AffiliateCommission[] = ((commRows ?? []) as Array<{ id: string; affiliate_id: string; source_event: string; source_ref: string | null; gross_cents: number; rate: number | null; commission_cents: number | null; redemption_choice: string | null; chosen_at: string | null; payout_id: string | null; notes: string | null; created_at: string }>).map((c) => {
    applyCommission(totals, c);
    return {
      id: c.id,
      code: codeById.get(c.affiliate_id) ?? "—",
      sourceEvent: c.source_event,
      sourceRef: c.source_ref,
      grossCents: c.gross_cents,
      rate: c.rate,
      commissionCents: c.commission_cents,
      redemptionChoice: (c.redemption_choice as "work_credit" | "cash" | null) ?? null,
      chosenAt: c.chosen_at,
      paidOut: !!c.payout_id,
      notes: c.notes,
      createdAt: c.created_at,
    };
  });

  const referredDeals: ReferredDeal[] = ((dealRows ?? []) as Array<{ id: string; title: string | null; status: string | null; amount_cents: number | null; amount_usd_cents: number | null; currency: string | null; referrer_id: string | null; affiliate_id: string | null; companies: Embedded<{ name: string | null }> }>).map((d) => {
    const { cents, currency } = dealAmount(d);
    return {
      id: d.id,
      title: d.title,
      status: d.status,
      amountCents: cents,
      currency,
      companyName: one(d.companies)?.name ?? null,
      via: d.affiliate_id && codeById.has(d.affiliate_id) ? "code" : "referrer",
    };
  });

  return {
    ...totals,
    personId: person.id,
    fullName: person.full_name,
    email: person.email,
    codes: codes.map((c) => ({
      id: c.id,
      code: c.code,
      programType: c.program_type,
      active: !!c.active,
      stripeCouponId: c.stripe_coupon_id,
      createdAt: c.created_at,
    })),
    active: codes.some((c) => c.active),
    commissions,
    referredDeals,
  };
}

// Deterministic code from a person's name: uppercase alphanumerics, capped, with
// a numeric suffix on collision. Mirrors the existing codes (BRADGILES, ERIC).
export async function generateAffiliateCode(fullName: string | null, email: string): Promise<string> {
  const base = (fullName || email.split("@")[0] || "AFFILIATE")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 16) || "AFFILIATE";
  const { data } = await companyOs.from("affiliates").select("code").ilike("code", `${base}%`);
  const taken = new Set(((data ?? []) as Array<{ code: string }>).map((r) => r.code.toUpperCase()));
  if (!taken.has(base)) return base;
  for (let n = 2; n < 100; n++) {
    const candidate = `${base}${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}${Date.now().toString().slice(-4)}`;
}
