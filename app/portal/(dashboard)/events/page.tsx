import { requirePortalMember } from "@/lib/portal-auth";
import { getMyEvents, type PortalEventRegistration } from "@/lib/portal/events";
import { PageHead } from "@/components/admin/PageHead";
import { Badge, statusTone } from "@/components/admin/Badge";
import { formatDate, humanize } from "@/lib/admin/format";

export const dynamic = "force-dynamic";

// My Events: self-scoped by construction (event_registrations.person_id =
// actor.personId, enforced in lib/portal/events.ts). No company scoping
// needed — this is the one module that follows the person, not the account.
function dateRange(startsAt: string | null, endsAt: string | null): string {
  if (!startsAt) return "—";
  const start = formatDate(startsAt);
  if (!endsAt || endsAt === startsAt) return start;
  return `${start} → ${formatDate(endsAt)}`;
}

function EventCard({ reg }: { reg: PortalEventRegistration }) {
  return (
    <div className="admin-card admin-section-card" key={reg.id}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
        <div>
          <h2 className="admin-card-title" style={{ marginBottom: 2 }}>{reg.eventTitle || "Event"}</h2>
          <div className="admin-cell-muted">
            {dateRange(reg.startsAt, reg.endsAt)}
            {reg.location ? ` · ${reg.location}` : ""}
            {reg.tierTitle ? ` · ${reg.tierTitle}` : ""}
          </div>
        </div>
        <Badge tone={statusTone(reg.status)}>{humanize(reg.status)}</Badge>
      </div>
    </div>
  );
}

export default async function PortalEventsPage() {
  const actor = await requirePortalMember();
  const registrations = await getMyEvents(actor);

  const today = new Date().toISOString();
  const upcoming = registrations.filter((r) => r.startsAt && r.startsAt >= today);
  const past = registrations.filter((r) => !r.startsAt || r.startsAt < today);

  return (
    <>
      <PageHead eyebrow="Client Portal" title="My Events" sub="Retreats and workshops you're registered for." />

      <div className="admin-card admin-section-card">
        <h2 className="admin-card-title">Upcoming ({upcoming.length})</h2>
      </div>
      {upcoming.length === 0 ? (
        <div className="admin-card admin-section-card">
          <div className="admin-empty">Nothing upcoming.</div>
        </div>
      ) : (
        upcoming.map((r) => <EventCard reg={r} key={r.id} />)
      )}

      <div className="admin-card admin-section-card">
        <h2 className="admin-card-title">Past ({past.length})</h2>
      </div>
      {past.length === 0 ? (
        <div className="admin-card admin-section-card">
          <div className="admin-empty">No past events.</div>
        </div>
      ) : (
        past.map((r) => <EventCard reg={r} key={r.id} />)
      )}
    </>
  );
}
