import { companyOs } from "@/lib/supabase";
import { PageHead } from "@/components/admin/PageHead";
import { MetricCard } from "@/components/admin/MetricCard";
import { formatCents } from "@/lib/admin/format";
import { RetreatsTable, type RetreatRow } from "./RetreatsTable";
import type { RetreatAttendee, RetreatTier } from "./RetreatManage";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Public Retreats",
  description: "Scheduled public retreats and their registrations.",
};

// Revenue office: public retreats. A "retreat" is a cohort of products sharing a
// cohort_slug (tiers are the variants); type='event' = public. One row per retreat
// via the company_os.public_retreats view. The catalogue is small, so rows load
// once and the client table owns search, filter, paging, and the manage shelf
// (edit, guest list, delete) — rows + shelf must be one client tree for the row
// click to work.
type ViewRow = {
  id: string; // = cohort_slug
  cohort_slug: string;
  name: string | null;
  location: string | null;
  date_start: string | null;
  date_end: string | null;
  active: boolean | null;
  from_usd_cents: number | null;
  collected_usd_cents: number | null;
  registrations: number | null;
  confirmed: number | null;
};

type TierRow = {
  id: string;
  cohort_slug: string | null;
  tier: string | null;
  title: string | null;
  amount_cents: number | null;
  currency: string | null;
  active: boolean;
};

type RegRow = {
  status: string | null;
  attendee_name: string | null;
  attendee_email: string | null;
  person_id: string | null;
  people: { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null;
  products: { cohort_slug: string | null; tier: string | null } | { cohort_slug: string | null; tier: string | null }[] | null;
};

const one = <T,>(e: T | T[] | null): T | null => (Array.isArray(e) ? e[0] ?? null : e);

type RevRow = {
  orders: { amount_usd_cents: number | null } | { amount_usd_cents: number | null }[] | null;
};

export default async function PublicRetreatsPage() {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  const [retreatsRes, tiersRes, attendeeRes, revRes] = await Promise.all([
    companyOs
      .from("public_retreats")
      .select("id, cohort_slug, name, location, date_start, date_end, active, from_usd_cents, collected_usd_cents, registrations, confirmed")
      .order("date_start", { ascending: false }),
    companyOs
      .from("products")
      .select("id, cohort_slug, tier, title, amount_cents, currency, active")
      .eq("type", "event")
      .not("cohort_slug", "is", null)
      .order("amount_cents", { ascending: true }),
    // Attendees grouped by cohort for the shelf's guest list (small table — fetch all).
    companyOs
      .from("event_registrations")
      .select("status, attendee_name, attendee_email, person_id, people(full_name, email), products!inner(cohort_slug, tier)"),
    // Revenue this month: confirmed registrations whose order was created this month.
    companyOs
      .from("event_registrations")
      .select("orders!inner(amount_usd_cents, created_at), products!inner(type)")
      .eq("status", "confirmed")
      .eq("products.type", "event")
      .gte("orders.created_at", monthStart),
  ]);

  const error = retreatsRes.error?.message ?? tiersRes.error?.message ?? attendeeRes.error?.message ?? null;
  const revenueThisMonth = ((revRes.data ?? []) as RevRow[]).reduce(
    (s, r) => s + (one(r.orders)?.amount_usd_cents ?? 0),
    0,
  );

  const tiersByCohort = new Map<string, RetreatTier[]>();
  for (const t of (tiersRes.data ?? []) as TierRow[]) {
    if (!t.cohort_slug) continue;
    const list = tiersByCohort.get(t.cohort_slug) ?? [];
    list.push({
      id: t.id,
      tier: t.tier,
      title: t.title ?? "(untitled tier)",
      amountCents: t.amount_cents ?? 0,
      currency: t.currency ?? "usd",
      active: t.active,
    });
    tiersByCohort.set(t.cohort_slug, list);
  }

  const attendeesByCohort = new Map<string, RetreatAttendee[]>();
  for (const r of ((attendeeRes.data ?? []) as unknown as RegRow[])) {
    const prod = one(r.products);
    const cohort = prod?.cohort_slug;
    if (!cohort) continue;
    const p = one(r.people);
    const list = attendeesByCohort.get(cohort) ?? [];
    list.push({
      name: r.attendee_name || p?.full_name || null,
      email: r.attendee_email || p?.email || null,
      tier: prod?.tier ?? null,
      status: r.status,
      personId: r.person_id,
    });
    attendeesByCohort.set(cohort, list);
  }

  const rows: RetreatRow[] = ((retreatsRes.data ?? []) as ViewRow[]).map((r) => ({
    id: r.id,
    cohortSlug: r.cohort_slug,
    name: r.name || r.cohort_slug,
    location: r.location,
    dateStart: r.date_start,
    dateEnd: r.date_end,
    active: r.active ?? false,
    fromUsdCents: r.from_usd_cents,
    collectedUsdCents: r.collected_usd_cents,
    registrations: r.registrations ?? 0,
    confirmed: r.confirmed ?? 0,
    tiers: tiersByCohort.get(r.cohort_slug) ?? [],
    attendees: attendeesByCohort.get(r.cohort_slug) ?? [],
  }));

  const activeRetreats = rows.filter((r) => r.active).length;
  const totalRegistered = rows.reduce((s, r) => s + r.confirmed, 0);
  const totalCollected = rows.reduce((s, r) => s + (r.collectedUsdCents ?? 0), 0);

  return (
    <>
      <PageHead
        eyebrow="Revenue"
        title="Public Retreats"
        sub={`${rows.length.toLocaleString()} ${rows.length === 1 ? "retreat" : "retreats"}`}
      />
      {error && <div className="admin-alert admin-alert--err" style={{ marginBottom: 14 }}>{error}</div>}

      <div className="mp-kpi-grid" style={{ marginBottom: 20 }}>
        <MetricCard label="Total Collected" value={formatCents(totalCollected, "usd")} sub="USD · confirmed" />
        <MetricCard label="Revenue this Month" value={formatCents(revenueThisMonth, "usd")} sub="USD · confirmed" />
        <MetricCard label="Active retreats" value={activeRetreats} sub={`of ${rows.length} scheduled`} />
        <MetricCard label="Registered" value={totalRegistered} sub="confirmed attendees" />
      </div>

      <RetreatsTable rows={rows} />
    </>
  );
}
