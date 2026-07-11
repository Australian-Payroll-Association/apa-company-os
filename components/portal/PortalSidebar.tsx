"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/portal/(dashboard)/actions";

// Client-portal sibling of TeamSidebar: same admin shell CSS, flat nav. Items
// without `enabled` render as muted "soon" placeholders (their PR has not
// shipped yet) so the shell always looks complete without dead links. Which
// modules apply to a given client is decided per PR as each module ships
// entitlement-driven visibility; the v1 shell shows the full set.
type NavItem = { label: string; href: string; ico: string; enabled?: boolean };

const NAV: NavItem[] = [
  { label: "Home", href: "/portal", ico: "◈", enabled: true },
  { label: "Team", href: "/portal/team", ico: "☷" },
  { label: "Time Off", href: "/portal/time-off", ico: "☼" },
  { label: "Projects", href: "/portal/projects", ico: "⇉" },
  { label: "Invoices", href: "/portal/invoices", ico: "▤" },
  { label: "My Events", href: "/portal/events", ico: "▦" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/portal") return pathname === "/portal" || pathname === "/portal/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PortalSidebar({ name, companyName }: { name: string; companyName: string | null }) {
  const pathname = usePathname() ?? "";
  const [navOpen, setNavOpen] = useState(false);

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
        <span className="admin-brand-mark">E8</span>
        <strong>Edge8 Client Portal</strong>
      </div>

      {navOpen && <div className="admin-scrim" onClick={() => setNavOpen(false)} />}

      <nav className={`admin-sidebar${navOpen ? " is-open" : ""}`} aria-label="Portal">
        <div className="admin-brand">
          <span className="admin-brand-mark">E8</span>
          Edge8 Client Portal
        </div>

        <div className="admin-nav" onClick={() => setNavOpen(false)}>
          <div className="admin-nav-group">
            {companyName && <div className="admin-nav-grouplabel">{companyName}</div>}
            {NAV.map((item) =>
              item.enabled ? (
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
          <form action={signOut}>
            <button type="submit" className="admin-signout">
              Sign out
            </button>
          </form>
        </div>
      </nav>
    </>
  );
}
