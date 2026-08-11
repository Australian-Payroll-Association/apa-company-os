"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, endAssumeSession } from "@/app/portal/(dashboard)/actions";

// Client-portal sibling of TeamSidebar: same admin shell CSS, flat nav. A nav
// item renders live only when its module has BOTH shipped (`built`) and the
// actor is entitled to it (design doc: "Team visible iff any company in scope
// has an active staff_assignments row", etc.) — otherwise it renders as a
// muted "soon" placeholder so the shell always looks complete without dead
// links. Modules with no `entitlementKey` (Home) are always live once built.
export type PortalEntitlements = {
  team: boolean;
  timeOff: boolean;
  invoices: boolean;
  events: boolean;
  referrals: boolean;
  meetings: boolean;
};

type EntitlementKey = keyof PortalEntitlements;
type NavItem = { label: string; href: string; ico: string; built?: boolean; entitlementKey?: EntitlementKey };

const NAV: NavItem[] = [
  { label: "Home", href: "/portal", ico: "◈", built: true },
  // AI Programs: being a portal member IS the entitlement for v1 (like Requests);
  // token/staff-based gating is refined later with the Human Token Tracker.
  { label: "AI Programs", href: "/portal/programs", ico: "⇉", built: true },
  // Documents: company-level files shared with Edge8; membership is the
  // entitlement, same as Requests and AI Programs.
  { label: "Documents", href: "/portal/documents", ico: "▣", built: true },
  // Requests has no entitlement key on purpose: being a portal member IS the
  // entitlement to ask for work; all data inside is company-scoped anyway.
  { label: "Requests", href: "/portal/requests", ico: "✎", built: true },
  { label: "Meetings", href: "/portal/meetings", ico: "☰", built: true, entitlementKey: "meetings" },
  { label: "Team", href: "/portal/team", ico: "☷", built: true, entitlementKey: "team" },
  { label: "Time Off", href: "/portal/time-off", ico: "☼", built: true, entitlementKey: "timeOff" },
  { label: "Invoices", href: "/portal/invoices", ico: "▤", built: true, entitlementKey: "invoices" },
  { label: "My Events", href: "/portal/events", ico: "▦", built: true, entitlementKey: "events" },
  { label: "Referrals", href: "/portal/referrals", ico: "%", built: true, entitlementKey: "referrals" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/portal") return pathname === "/portal" || pathname === "/portal/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PortalSidebar({
  name,
  companyName,
  entitlements,
  impersonating = false,
}: {
  name: string;
  companyName: string | null;
  entitlements: PortalEntitlements;
  // While an admin is viewing via Assume, the footer control ends the Assume
  // session instead of signing out — this is the admin's REAL session
  // underneath, not the client's, so a plain "Sign out" here would be wrong
  // (and confusing) rather than just ending the view-as.
  impersonating?: boolean;
}) {
  const pathname = usePathname() ?? "";
  const [navOpen, setNavOpen] = useState(false);

  const isEnabled = (item: NavItem) =>
    !!item.built && (!item.entitlementKey || entitlements[item.entitlementKey]);

  return (
    <>
      <div className="admin-mobilebar">
        <button
          className="admin-mobile-toggle"
          aria-label="Open navigation"
          onClick={() => setNavOpen(true)}
        >
          ☰
        </button>
        <strong>Edge8 Client Portal</strong>
      </div>

      {navOpen && <div className="admin-scrim" onClick={() => setNavOpen(false)} />}

      <nav className={`admin-sidebar${navOpen ? " is-open" : ""}`} aria-label="Portal">
        <div className="admin-brand">
          Edge8 Client Portal
        </div>

        <div className="admin-nav" onClick={() => setNavOpen(false)}>
          <div className="admin-nav-group">
            {companyName && <div className="admin-nav-grouplabel">{companyName}</div>}
            {NAV.map((item) =>
              isEnabled(item) ? (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`admin-nav-link${isActive(pathname, item.href) ? " is-active" : ""}`}
                >
                  <span className="admin-nav-ico" aria-hidden>
                    {item.ico}
                  </span>
                  {item.label}
                </Link>
              ) : (
                <span
                  key={item.href}
                  className="admin-nav-link"
                  aria-disabled
                  style={{ opacity: 0.4, cursor: "not-allowed" }}
                  title="Coming soon"
                >
                  <span className="admin-nav-ico" aria-hidden>
                    {item.ico}
                  </span>
                  {item.label}
                  <span className="admin-nav-badge">soon</span>
                </span>
              ),
            )}
          </div>
        </div>

        <div className="admin-foot">
          <span className="admin-foot-email">{name}</span>
          <form action={impersonating ? endAssumeSession : signOut}>
            <button type="submit" className="admin-signout">
              {impersonating ? "Exit assume mode" : "Sign out"}
            </button>
          </form>
        </div>
      </nav>
    </>
  );
}
