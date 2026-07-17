"use client";

import { useEffect, useState } from "react";
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
      { label: "Ideas", href: "/team/ideas", ico: "✦", enabled: true },
      { label: "My Profile", href: "/team/profile", ico: "☺", enabled: true },
      { label: "Directory", href: "/team/directory", ico: "☷", enabled: true },
      { label: "Org Chart", href: "/team/org", ico: "⌥", enabled: true },
      { label: "Gallery", href: "/team/gallery", ico: "▦", enabled: true },
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

// Mirror of AdminSidebar's VIEWS: Admin and Team are separate apps, the
// switcher navigates between them. "Admin" is only live for team members who
// are also admins (see TeamActor.isAdmin in lib/team-auth.ts).
type View = { key: string; label: string; ico: string; href: string; current?: boolean };
const VIEWS: View[] = [
  { key: "team", label: "Team", ico: "☷", href: "/team", current: true },
  { key: "admin", label: "Admin", ico: "◈", href: "/admin" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/team") return pathname === "/team" || pathname === "/team/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

// "Dave Hajdu" -> "DH", "dave" -> "DA".
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const raw = parts.length >= 2 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return raw.toUpperCase();
}

export function TeamSidebar({
  name,
  role,
  isAdmin,
}: {
  name: string;
  role: TeamRole;
  isAdmin: boolean;
}) {
  const pathname = usePathname() ?? "";
  const [navOpen, setNavOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const groups = role === "manager" ? [...ME, MY_TEAM] : ME;
  const userInitials = initials(name);

  useEffect(() => {
    if (!profileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setProfileMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [profileMenuOpen]);

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
          <span className="admin-brand-lead">
            <span className="admin-brand-mark">E8</span>
            Edge8 Workspace
          </span>
          <span className="admin-brand-actions">
            <button
              type="button"
              className="admin-avatarbtn"
              aria-haspopup="menu"
              aria-expanded={profileMenuOpen}
              aria-label="Switch view"
              onClick={() => setProfileMenuOpen((v) => !v)}
            >
              {userInitials}
            </button>
          </span>
        </div>

        {profileMenuOpen && (
          <div className="admin-profilemenu-backdrop" onClick={() => setProfileMenuOpen(false)} />
        )}
        {profileMenuOpen && (
          <div className="admin-profilemenu" role="menu" aria-label="Switch view">
            <div className="admin-profilemenu-label">Switch view</div>
            {VIEWS.map((v) => {
              if (v.current) {
                return (
                  <span key={v.key} className="admin-profilemenu-item" role="menuitem" aria-current="true">
                    <span className="admin-profilemenu-ico" aria-hidden>
                      {v.ico}
                    </span>
                    {v.label}
                    <span className="admin-profilemenu-here">Current</span>
                  </span>
                );
              }
              const live = v.key === "admin" ? isAdmin : false;
              if (live) {
                return (
                  <Link
                    key={v.key}
                    href={v.href}
                    className="admin-profilemenu-item"
                    role="menuitem"
                    onClick={() => setProfileMenuOpen(false)}
                  >
                    <span className="admin-profilemenu-ico" aria-hidden>
                      {v.ico}
                    </span>
                    {v.label}
                  </Link>
                );
              }
              return (
                <span
                  key={v.key}
                  className="admin-profilemenu-item is-disabled"
                  role="menuitem"
                  aria-disabled
                  title="Not an admin"
                >
                  <span className="admin-profilemenu-ico" aria-hidden>
                    {v.ico}
                  </span>
                  {v.label}
                  <span className="admin-nav-badge">n/a</span>
                </span>
              );
            })}
          </div>
        )}

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
