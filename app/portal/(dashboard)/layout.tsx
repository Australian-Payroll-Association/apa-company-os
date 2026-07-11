import type { Metadata } from "next";
import { requirePortalMember } from "@/lib/portal-auth";
import { hasAssignedStaff } from "@/lib/portal/team";
import { hasInvoices } from "@/lib/portal/invoices";
import { PortalSidebar } from "@/components/portal/PortalSidebar";
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
  const [hasStaff, hasInvoicesResult] = await Promise.all([
    hasAssignedStaff(actor),
    hasInvoices(actor),
  ]);
  const entitlements = { team: hasStaff, timeOff: hasStaff, invoices: hasInvoicesResult };

  return (
    <div className="admin-shell">
      <PortalSidebar name={actor.displayName} companyName={companyName} entitlements={entitlements} />
      <main className="admin-main">{children}</main>
    </div>
  );
}
