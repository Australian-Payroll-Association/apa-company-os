import type { Metadata } from "next";
import { requirePortalMember } from "@/lib/portal-auth";
import { hasAssignedStaff } from "@/lib/portal/team";
import { hasInvoices } from "@/lib/portal/invoices";
import { hasEventRegistrations } from "@/lib/portal/events";
import { PortalSidebar } from "@/components/portal/PortalSidebar";
import { AssumeBanner } from "@/components/portal/AssumeBanner";
import "../../admin/admin.css";

export const metadata: Metadata = {
  title: { template: "%s · Edge8 Client Portal", default: "Edge8 Client Portal" },
  description: "Your Edge8 client portal.",
  robots: { index: false, follow: false },
};

export default async function PortalDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await requirePortalMember();
  const companyName =
    actor.memberships.length === 1
      ? actor.memberships[0].companyName
      : actor.memberships.map((m) => m.companyName).filter(Boolean).join(" · ") || null;
  // Time Off is visible iff Team is (same scope source: an active staff
  // assignment) — one lookup covers both, per the design doc's entitlement rules.
  const [hasStaff, hasInvoicesResult, hasEventsResult] = await Promise.all([
    hasAssignedStaff(actor),
    hasInvoices(actor),
    hasEventRegistrations(actor),
  ]);
  const entitlements = {
    team: hasStaff,
    timeOff: hasStaff,
    invoices: hasInvoicesResult,
    events: hasEventsResult,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {actor.impersonation && (
        <AssumeBanner
          impersonation={actor.impersonation}
          viewingAsName={actor.displayName}
          companyName={companyName}
        />
      )}
      <div className="admin-shell" style={{ flex: 1, minHeight: 0 }}>
        <PortalSidebar
          name={actor.displayName}
          companyName={companyName}
          entitlements={entitlements}
          impersonating={!!actor.impersonation}
        />
        <main className="admin-main">{children}</main>
      </div>
    </div>
  );
}
