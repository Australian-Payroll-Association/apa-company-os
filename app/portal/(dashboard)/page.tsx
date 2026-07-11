import { requirePortalMember } from "@/lib/portal-auth";
import { PageHead } from "@/components/admin/PageHead";
import { MetricCard } from "@/components/admin/MetricCard";

export const dynamic = "force-dynamic";

// Portal home. Self-scoped by construction: everything rendered comes off the
// JWT-derived actor. Module pages arrive one PR at a time (see
// docs/plans/2026-07-11-client-portal-design.md); until each ships, the
// sidebar marks it "soon" and this page stays a welcome surface.
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

      <div className="mp-kpi-grid" style={{ marginBottom: 20 }}>
        <MetricCard label="Company" value={companies[0] ?? "—"} sub={actor.email} />
        <MetricCard
          label="Your portal"
          value="Getting started"
          sub="Modules switch on as they ship"
        />
      </div>

      <div className="admin-card" style={{ padding: "18px 20px" }}>
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
