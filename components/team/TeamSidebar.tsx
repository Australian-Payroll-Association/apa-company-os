"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/team/(dashboard)/actions";
import type { TeamRole } from "@/lib/team-auth";

// Lighter sibling of AdminSidebar: reuses the admin shell CSS but drops the brand
// switcher and collapsible offices. Flat nav grouped Me / My Team. Items without
// `enabled` render as muted "soon" placeholders (their slice has not shipped yet),
// mirroring the admin nav so the shell always looks complete without dead links.
type NavItem = { label: string; href: string; ico: string; enabled?: boolean };
type NavGroup = { label: string | null; items: NavItem[] };

const ME: NavGroup[] = [
  { label: null, items: [{ label: "Home", href: "/team", ico: "◈", enabled: true }] },
  {
    label: "Me",
    items: [
      { label: "Time Off", href: "/team/time-off", ico: "☼", enabled: true },
      { label: "My Profile", href: "/team/profile", ico: "☺" },
      { label: "Directory", href: "/team/directory", ico: "☷" },
    ],
  },
];

const MY_TEAM: NavGroup = {
  label: "My Team",
  items: [
    { label: "Approvals", href: "/team/approvals", ico: "✓" },
    { label: "Team calendar", href: "/team/calendar", ico: "▦" },
    { label: "My reports", href: "/team/reports", ico: "⇉" },
  ],
};

function isActive(pathname: string, href: string): boolean {
  if (href === "/team") return pathname === "/team" || pathname === "/team/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function TeamSidebar({ name, role }: { name: string; role: TeamRole }) {
  const pathname = usePathname() ?? "";
  const [navOpen, setNavOpen] = useState(false);

  const groups = role === "manager" ? [...ME, MY_TEAM] : ME;

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
        <strong>Edge8 Workspace</strong>
      </div>

      {navOpen && <div className="admin-scrim" onClick={() => setNavOpen(false)} />}

      <nav className={`admin-sidebar${navOpen ? " is-open" : ""}`} aria-label="Team">
        <div className="admin-brand">
          <span className="admin-brand-mark">E8</span>
          Edge8 Workspace
        </div>

        <div className="admin-nav" onClick={() => setNavOpen(false)}>
          {groups.map((group, gi) => (
            <div className="admin-nav-group" key={group.label ?? `g${gi}`}>
              {group.label && <div className="admin-nav-grouplabel">{group.label}</div>}
              {group.items.map((item) =>
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
          ))}
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
