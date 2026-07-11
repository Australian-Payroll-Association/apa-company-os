import Link from "next/link";
import { notFound } from "next/navigation";
import { companyOs } from "@/lib/supabase";
import { PageHead } from "@/components/admin/PageHead";
import { MetricCard } from "@/components/admin/MetricCard";
import { Tabs } from "@/components/admin/Tabs";
import { formatCents, formatDate, humanize } from "@/lib/admin/format";
import { Badge, statusTone } from "@/components/admin/Badge";
import { eventPath, normalizeRegistrationStatus, type EventStatus, type EventType, type EventVisibility } from "@/lib/events";
import { qrPngDataUrl } from "@/lib/qr";
import { getSiteOrigin } from "@/lib/site-origin";
import { eventStatusBadge } from "../EventStatusBadge";
import { RosterTab, type RosterRegistration, type RosterTier } from "./RosterTab";
import { EventSettings, type EventSettingsData, type SettingsTier, type SurveyOption } from "./EventSettings";

export const dynamic = "force-dynamic";

// Ops console for one event: KPIs + signup/feedback QRs, the full roster
// (statuses, manual add, check-in, waitlist promote, bulk no-show, CSV
// export), a revenue ledger, and Settings — the single place everything gets
// edited (fields, survey link, tickets, media, archive). The list-page shelf
// is a read-only summary that links here.

type EventDbRow = {
  id: string;
  slug: string;
  type: EventType;
  status: EventStatus;
  visibility: EventVisibility;
  title: string;
  location: string | null;
  starts_at: string | null;
  ends_at: string | null;
  capacity: number | null;
  landing_path: string | null;
  notes: string | null;
  blurb: string | null;
  description: string | null;
  cover_image_url: string | null;
  media: unknown;
  archived_at: string | null;
  feedback_survey_id: string | null;
};

type TierDbRow = {
  id: string;
  title: string | null;
  tier: string | null;
  description: string | null;
  amount_cents: number | null;
  currency: string | null;
  capacity: number | null;
  active: boolean;
};

type RegDbRow = {
  id: string;
  product_id: string | null;
  person_id: string | null;
  attendee_name: string | null;
  attendee_email: string | null;
  status: string | null;
  guest_count: number | null;
  waitlist_position: number | null;
  ticket_code: string | null;
  checked_in_at: string | null;
  created_at: string;
  people: { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null;
  products: { title: string | null; tier: string | null } | { title: string | null; tier: string | null }[] | null;
  orders:
    | { id: string; amount_usd_cents: number | null; currency: string | null; status: string | null; created_at: string; stripe_session_id: string | null }
    | { id: string; amount_usd_cents: number | null; currency: string | null; status: string | null; created_at: string; stripe_session_id: string | null }[]
    | null;
};

const one = <T,>(e: T | T[] | null): T | null => (Array.isArray(e) ? e[0] ?? null : e);

const COUNTED_STATUSES = new Set(["registered", "attended", "confirmed"]);

export default async function EventDetailPage({ params }: { params: { id: string } }) {
  const [eventRes, tiersRes, regsRes, surveysRes] = await Promise.all([
    companyOs
      .from("events")
      .select(
        "id, slug, type, status, visibility, title, location, starts_at, ends_at, capacity, landing_path, notes, blurb, description, cover_image_url, media, archived_at, feedback_survey_id"
      )
      .eq("id", params.id)
      .maybeSingle(),
    companyOs
      .from("products")
      .select("id, title, tier, description, amount_cents, currency, capacity, active")
      .eq("event_id", params.id)
      .order("amount_cents", { ascending: true }),
    companyOs
      .from("event_registrations")
      .select(
        "id, product_id, person_id, attendee_name, attendee_email, status, guest_count, waitlist_position, ticket_code, checked_in_at, created_at, people(full_name, email), products(title, tier), orders(id, amount_usd_cents, currency, status, created_at, stripe_session_id)"
      )
      .eq("event_id", params.id)
      .order("created_at", { ascending: true }),
    companyOs
      .from("surveys")
      .select("id, name")
      .is("archived_at", null)
      .eq("status", "published")
      .order("name", { ascending: true }),
  ]);

  const event = eventRes.data as EventDbRow | null;
  if (!event) notFound();

  const tiers = (tiersRes.data ?? []) as TierDbRow[];
  const regRows = (regsRes.data ?? []) as unknown as RegDbRow[];

  const registrations: RosterRegistration[] = regRows.map((r) => {
    const p = one(r.people);
    const prod = one(r.products);
    const order = one(r.orders);
    return {
      id: r.id,
      productId: r.product_id,
      personId: r.person_id,
      name: r.attendee_name || p?.full_name || null,
      email: r.attendee_email || p?.email || null,
      tierTitle: prod?.title ?? null,
      tierLabel: prod?.tier ?? null,
      status: normalizeRegistrationStatus(r.status ?? "registered"),
      guestCount: r.guest_count ?? 0,
      waitlistPosition: r.waitlist_position,
      ticketCode: r.ticket_code,
      checkedInAt: r.checked_in_at,
      createdAt: r.created_at,
      order: order
        ? {
            id: order.id,
            amountUsdCents: order.amount_usd_cents,
            currency: order.currency,
            status: order.status,
            createdAt: order.created_at,
            stripeSessionId: order.stripe_session_id,
          }
        : null,
    };
  });

  const rosterTiers: RosterTier[] = tiers.map((t) => ({
    id: t.id,
    title: t.title ?? "(untitled tier)",
    tier: t.tier,
    amountCents: t.amount_cents ?? 0,
    currency: t.currency ?? "usd",
  }));

  const registeredSeats = registrations
    .filter((r) => COUNTED_STATUSES.has(r.status))
    .reduce((s, r) => s + 1 + r.guestCount, 0);
  const pendingCount = registrations.filter((r) => r.status === "pending_payment").length;
  const waitlistedCount = registrations.filter((r) => r.status === "waitlisted").length;
  const checkedInCount = registrations.filter((r) => !!r.checkedInAt).length;
  const collectedUsdCents = registrations
    .filter((r) => COUNTED_STATUSES.has(r.status))
    .reduce((s, r) => s + (r.order?.amountUsdCents ?? 0), 0);
  const pendingUsdCents = registrations
    .filter((r) => r.status === "pending_payment")
    .reduce((s, r) => s + (r.order?.amountUsdCents ?? 0), 0);

  const origin = getSiteOrigin();
  const signupUrl = `${origin}${eventPath(event.slug)}`;
  const signupQr = await qrPngDataUrl(signupUrl);

  let feedbackQr: { url: string; png: string } | null = null;
  if (event.feedback_survey_id) {
    const { data: survey } = await companyOs.from("surveys").select("slug").eq("id", event.feedback_survey_id).maybeSingle();
    if (survey?.slug) {
      const url = `${origin}/surveys/${survey.slug}?cohort=${event.slug}`;
      feedbackQr = { url, png: await qrPngDataUrl(url) };
    }
  }

  const overview = (
    <>
      <div className="mp-kpi-grid" style={{ marginBottom: 20 }}>
        <MetricCard
          label="Registered"
          value={event.capacity ? `${registeredSeats} / ${event.capacity}` : String(registeredSeats)}
          sub={waitlistedCount ? `${waitlistedCount} waitlisted` : "seats incl. guests"}
        />
        <MetricCard label="Paid / Pending" value={formatCents(collectedUsdCents, "usd")} sub={pendingCount ? `${formatCents(pendingUsdCents, "usd")} pending (${pendingCount})` : "no pending orders"} />
        <MetricCard label="Checked in" value={checkedInCount} sub={`of ${registeredSeats || 0} registered`} />
        <MetricCard label="Revenue" value={formatCents(collectedUsdCents, "usd")} sub="USD · registered+" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: feedbackQr ? "1fr 1fr" : "1fr", gap: 20 }}>
        <QrBlock title="Signup link" url={signupUrl} png={signupQr} downloadName={`${event.slug}-signup-qr.png`} />
        {feedbackQr && <QrBlock title="Feedback survey" url={feedbackQr.url} png={feedbackQr.png} downloadName={`${event.slug}-feedback-qr.png`} />}
      </div>
    </>
  );

  const revenue = (
    <div className="admin-table-wrap">
      <div className="admin-table-scroll">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Attendee</th>
              <th>Tier</th>
              <th>Order status</th>
              <th style={{ textAlign: "right" }}>Amount</th>
              <th>Placed</th>
            </tr>
          </thead>
          <tbody>
            {registrations.filter((r) => r.order).length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className="admin-empty">No orders for this event.</div>
                </td>
              </tr>
            ) : (
              registrations
                .filter((r) => r.order)
                .map((r) => (
                  <tr key={r.id}>
                    <td className="admin-cell-strong">{r.name || r.email || "—"}</td>
                    <td>{r.tierTitle || "—"}</td>
                    <td>
                      <Badge tone={statusTone(r.order!.status)}>{humanize(r.order!.status)}</Badge>
                    </td>
                    <td className="admin-cell-mono" style={{ textAlign: "right" }}>
                      {formatCents(r.order!.amountUsdCents, r.order!.currency ?? "usd")}
                    </td>
                    <td>{formatDate(r.order!.createdAt)}</td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const surveys: SurveyOption[] = ((surveysRes.data ?? []) as { id: string; name: string }[]).map((x) => ({
    id: x.id,
    name: x.name,
  }));

  const settingsTiers: SettingsTier[] = tiers.map((t) => ({
    id: t.id,
    title: t.title ?? "(untitled tier)",
    description: t.description,
    amountCents: t.amount_cents ?? 0,
    currency: t.currency ?? "usd",
    capacity: t.capacity,
    active: t.active,
  }));

  const settingsData: EventSettingsData = {
    id: event.id,
    slug: event.slug,
    title: event.title,
    type: event.type,
    status: event.status,
    visibility: event.visibility,
    location: event.location,
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    capacity: event.capacity,
    landingPath: event.landing_path,
    notes: event.notes,
    blurb: event.blurb,
    description: event.description,
    coverImageUrl: event.cover_image_url,
    media: Array.isArray(event.media) ? (event.media as EventSettingsData["media"]) : [],
    feedbackSurveyId: event.feedback_survey_id,
    archivedAt: event.archived_at,
    totalRegistrations: registrations.length,
  };

  return (
    <>
      <PageHead
        eyebrow={<Link href="/admin/revenue/events">← Events</Link>}
        title={event.title}
        sub={`${humanize(event.type)} · ${event.location ?? "location TBD"}`}
        action={eventStatusBadge(event.status, event.archived_at)}
      />

      <Tabs
        tabs={[
          { key: "overview", label: "Overview", content: overview },
          { key: "roster", label: "Roster", count: registrations.length, content: <RosterTab eventId={event.id} eventSlug={event.slug} tiers={rosterTiers} registrations={registrations} /> },
          { key: "revenue", label: "Revenue", content: revenue },
          { key: "settings", label: "Settings", content: <EventSettings event={settingsData} tiers={settingsTiers} surveys={surveys} /> },
        ]}
      />
    </>
  );
}

function QrBlock({ title, url, png, downloadName }: { title: string; url: string; png: string; downloadName: string }) {
  return (
    <div>
      <div className="admin-cell-muted" style={{ marginBottom: 6, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {title}
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <img src={png} alt={`QR code for ${url}`} width={120} height={120} style={{ borderRadius: 8, border: "1px solid var(--admin-border, #e2e2e8)" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
          <code className="admin-cell-mono" style={{ wordBreak: "break-all" }}>
            {url}
          </code>
          <a className="admin-btn" href={png} download={downloadName}>
            Download PNG
          </a>
        </div>
      </div>
    </div>
  );
}
