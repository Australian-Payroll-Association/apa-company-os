import { requirePortalMember } from "@/lib/portal-auth";
import { PageHead } from "@/components/admin/PageHead";

export const dynamic = "force-dynamic";

// Portal home. Self-scoped by construction: everything rendered comes off the
// JWT-derived actor. Module pages arrive one PR at a time (see
// docs/plans/2026-07-11-client-portal-design.md); until each ships, the
// sidebar marks it "soon" and this page stays a welcome surface.
//
// Company/email render via .admin-kv (dt/dd), not MetricCard/.mp-kpi — that
// component is a stat tile (28px bold, ~212px-minimum column), built for
// short numbers, not a full company name or an email address. Using it here
// produced ugly mid-word wraps ("Entrepreneu" / "rs") once long values were
// forced to wrap instead of overflowing. A plain info card has no such width
// constraint and wraps at word boundaries like everywhere else in the app.
export default async function PortalHome() {
  const actor = await requirePortalMember();
  const companies = actor.memberships.map((m) => m.companyName).filter(Boolean) as string[];

  return (
    <>
      <PageHead
        eyebrow="Client Portal"
        title={`Welcome, ${actor.displayName}`}
        sub={companies.length > 0 ? companies.join(" · ") : undefined}
      />

      <div className="admin-card admin-section-card" style={{ marginBottom: 20 }}>
        <h2 className="admin-card-title">Your account</h2>
        <dl className="admin-kv">
          <dt>Company</dt>
          <dd>{companies[0] ?? "—"}</dd>
          <dt>Email</dt>
          <dd>{actor.email}</dd>
        </dl>
      </div>

      <div className="admin-card admin-section-card">
        <h2 className="admin-card-title">Your portal is being set up</h2>
        <p className="admin-page-sub" style={{ marginTop: 0 }}>
          Your team, time off, project updates, invoices, and events are arriving shortly. The
          items marked &quot;soon&quot; in the sidebar will switch on as each one goes live. If
          anything looks wrong, reply to your invite email and we will sort it out.
        </p>
      </div>
    </>
  );
}
