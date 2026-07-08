"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/admin/(dashboard)/actions";

// Nav is data-driven. `enabled: false` items render muted with a "soon" tag and
// are not navigable — flip them to `true` (and build the route) as each phase
// ships, so the shell always looks complete without dead 404 links.
type NavItem = { label: string; href: string; ico: string; enabled?: boolean };
type NavSubsection = { subheading: string; items: NavItem[] };
type NavEntry = NavItem | NavSubsection;
type NavGroup = { label: string | null; items: NavEntry[]; collapsible?: boolean };

const isSubsection = (e: NavEntry): e is NavSubsection => "subheading" in e;

// Nested-by-office IA, three levels deep: every feature (L3) lives under a System
// (L2) inside an Office (L1). Offices are the Four Offices of the Future (Revenue,
// Talent, Operations, Innovation) plus a Dashboard home and a Settings area;
// Systems are the products within each office (CRM, Commerce, ATS, People, Time
// Off, Workplace, ...). Offices and Systems both collapse. Rows
// open the shared 360s. See docs/product/four-offices-of-the-future.md.
const NAV: NavGroup[] = [
  { label: null, items: [{ label: "Dashboard", href: "/admin", ico: "◈", enabled: true }] },
  {
    label: "Revenue",
    collapsible: true,
    items: [
      {
        subheading: "CRM",
        items: [
          { label: "Cockpit", href: "/admin/revenue", ico: "◎", enabled: true },
          { label: "Deals", href: "/admin/revenue/deals", ico: "$", enabled: true },
          { label: "Leads", href: "/admin/revenue/leads", ico: "◉", enabled: true },
          { label: "Inquiries", href: "/admin/revenue/inquiries", ico: "☰", enabled: true },
          { label: "Companies", href: "/admin/revenue/companies", ico: "▣", enabled: true },
          { label: "Contacts", href: "/admin/contacts", ico: "⚇", enabled: true },
        ],
      },
      {
        subheading: "Commerce",
        items: [
          { label: "Orders", href: "/admin/revenue/orders", ico: "⛁", enabled: true },
          { label: "AIO Pad", href: "/admin/revenue/bookings", ico: "⌂", enabled: true },
          { label: "Public Retreats", href: "/admin/revenue/public-retreats", ico: "✓", enabled: true },
          { label: "Products", href: "/admin/revenue/products", ico: "▦", enabled: true },
          { label: "Affiliates", href: "/admin/revenue/affiliates", ico: "%", enabled: true },
        ],
      },
    ],
  },
  {
    label: "Talent",
    collapsible: true,
    items: [
      {
        subheading: "ATS",
        items: [
          { label: "Applications", href: "/admin/talent/applications", ico: "⇉", enabled: true },
          { label: "Job Reqs", href: "/admin/talent/jobs", ico: "▤", enabled: true },
        ],
      },
      {
        subheading: "People",
        items: [{ label: "Team", href: "/admin/talent/team", ico: "☷", enabled: true }],
      },
    ],
  },
  {
    label: "Operations",
    collapsible: true,
    items: [
      {
        subheading: "Time Off",
        items: [
          { label: "Requests", href: "/admin/operations/time-off/requests", ico: "☼", enabled: true },
          { label: "People", href: "/admin/operations/time-off/people", ico: "☷", enabled: true },
        ],
      },
      {
        subheading: "Workplace",
        items: [
          { label: "Vendors", href: "/admin/operations/vendors", ico: "▥" },
          { label: "Documents", href: "/admin/operations/documents", ico: "⎙" },
          { label: "Surveys", href: "/admin/operations/surveys", ico: "✎", enabled: true },
        ],
      },
    ],
  },
  {
    label: "Innovation",
    collapsible: true,
    items: [
      {
        subheading: "Ideas",
        items: [{ label: "Idea backlog", href: "/admin/innovation/ideas", ico: "✦" }],
      },
    ],
  },
  {
    label: "Settings",
    collapsible: true,
    items: [
      {
        subheading: "Access",
        items: [
          { label: "Admins", href: "/admin/settings/admins", ico: "⚿", enabled: true },
        ],
      },
      {
        subheading: "Configuration",
        items: [
          { label: "Pipelines", href: "/admin/settings/pipelines", ico: "⇶" },
        ],
      },
    ],
  },
];

// The three views a user can land in. These are SEPARATE apps: Admin is this
// /admin console; Team and Manager live in the /team portal. The switcher
// launches into them rather than re-scoping /admin. `current` marks where we are
// now; the others are placeholders until per-user view access is wired.
type View = { key: string; label: string; ico: string; current?: boolean };
const VIEWS: View[] = [
  { key: "admin", label: "Admin", ico: "◈", current: true },
  { key: "manager", label: "Manager", ico: "☰" },
  { key: "team", label: "Team", ico: "☷" },
];

function isActive(pathname: string, href: string): boolean {
  // Index links (Dashboard, Cockpit) match exactly so they don't light up on
  // every child route nested beneath them.
  if (href === "/admin" || href === "/admin/revenue")
    return pathname === href || pathname === `${href}/`;
  return pathname === href || pathname.startsWith(`${href}/`);
}

// No name/profile record yet, so derive a monogram from the email local part:
// "dave.hajdu@…" -> "DH", "dave@…" -> "DA".
function initials(email: string): string {
  const local = (email.split("@")[0] || email).trim();
  const parts = local.split(/[.\-_]+/).filter(Boolean);
  const raw = parts.length >= 2 ? parts[0][0] + parts[1][0] : local.slice(0, 2);
  return raw.toUpperCase();
}

export function AdminSidebar({
  user,
}: {
  user: { email: string };
}) {
  const pathname = usePathname() ?? "";
  const [navOpen, setNavOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const userInitials = initials(user.email);

  function toggle(key: string) {
    setCollapsed((c) => ({ ...c, [key]: !c[key] }));
  }

  function renderItem(item: NavItem, isSub: boolean) {
    const cls = `admin-nav-link${isActive(pathname, item.href) ? " is-active" : ""}${isSub ? " is-sub" : ""}`;
    if (item.enabled) {
      return (
        <Link key={item.href} href={item.href} className={cls}>
          <span className="admin-nav-ico" aria-hidden>
            {item.ico}
          </span>
          {item.label}
        </Link>
      );
    }
    return (
      <span
        key={item.href}
        className={cls}
        aria-disabled
        style={{ opacity: 0.4, cursor: "not-allowed" }}
        title="Coming in a later phase"
      >
        <span className="admin-nav-ico" aria-hidden>
          {item.ico}
        </span>
        {item.label}
        <span className="admin-nav-badge">soon</span>
      </span>
    );
  }

  function renderSubsection(sub: NavSubsection, groupLabel: string | null) {
    const key = `${groupLabel ?? ""}/${sub.subheading}`;
    const subCollapsed = Boolean(collapsed[key]);
    return (
      <div key={`sub-${key}`}>
        <button
          className="admin-nav-subhead admin-nav-subtoggle"
          aria-expanded={!subCollapsed}
          onClick={(e) => {
            e.stopPropagation();
            toggle(key);
          }}
        >
          {sub.subheading}
          <span className={`admin-nav-caret${subCollapsed ? " is-collapsed" : ""}`} aria-hidden>
            ▾
          </span>
        </button>
        {!subCollapsed && (
          <div className="admin-nav-railgroup">
            {sub.items.map((item) => renderItem(item, true))}
          </div>
        )}
      </div>
    );
  }

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
        <strong>Edge8 OS</strong>
      </div>

      {navOpen && <div className="admin-scrim" onClick={() => setNavOpen(false)} />}

      <nav className={`admin-sidebar${navOpen ? " is-open" : ""}`} aria-label="Admin">
        <div className="admin-brand">
          <span className="admin-brand-lead">
            <span className="admin-brand-mark">E8</span>
            Edge8 OS
          </span>
          <span className="admin-brand-actions">
            <button
              type="button"
              className="admin-iconbtn"
              aria-disabled
              aria-label="Inbox"
              title="Inbox (coming soon)"
            >
              ✉
            </button>
            <button
              type="button"
              className="admin-avatarbtn"
              aria-haspopup="menu"
              aria-expanded={profileMenuOpen}
              aria-label="Profile and views"
              onClick={() => {
                setProfileMenuOpen((v) => !v);
              }}
            >
              {userInitials}
            </button>
          </span>
        </div>

        {profileMenuOpen && (
          <div className="admin-profilemenu" role="menu" aria-label="Profile and views">
            <div className="admin-profilemenu-head">
              <span className="admin-avatarbtn admin-avatarbtn--lg" aria-hidden>
                {userInitials}
              </span>
              <span className="admin-profilemenu-email">{user.email}</span>
            </div>

            <div className="admin-profilemenu-label">Switch view</div>
            {VIEWS.map((v) =>
              v.current ? (
                <span key={v.key} className="admin-profilemenu-item" role="menuitem" aria-current="true">
                  <span className="admin-profilemenu-ico" aria-hidden>
                    {v.ico}
                  </span>
                  {v.label}
                  <span className="admin-profilemenu-here">Current</span>
                </span>
              ) : (
                <span
                  key={v.key}
                  className="admin-profilemenu-item is-disabled"
                  role="menuitem"
                  aria-disabled
                  title="Switching views is coming soon"
                >
                  <span className="admin-profilemenu-ico" aria-hidden>
                    {v.ico}
                  </span>
                  {v.label}
                  <span className="admin-nav-badge">soon</span>
                </span>
              ),
            )}

            <div className="admin-profilemenu-sep" />

            <span
              className="admin-profilemenu-item is-disabled"
              role="menuitem"
              aria-disabled
              title="Coming soon"
            >
              <span className="admin-profilemenu-ico" aria-hidden>
                ☺
              </span>
              My profile
              <span className="admin-nav-badge">soon</span>
            </span>

            <form action={signOut}>
              <button type="submit" className="admin-signout admin-profilemenu-signout">
                Sign out
              </button>
            </form>
          </div>
        )}

        <div className="admin-nav" onClick={() => setNavOpen(false)}>
          {NAV.map((group, gi) => {
            const label = group.label;
            const isCollapsed = Boolean(label && group.collapsible && collapsed[label]);
            return (
            <div className="admin-nav-group" key={label ?? `g${gi}`}>
              {label && group.collapsible ? (
                <button
                  className="admin-nav-grouplabel admin-nav-grouptoggle"
                  aria-expanded={!isCollapsed}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(label);
                  }}
                >
                  {label}
                  <span className={`admin-nav-caret${isCollapsed ? " is-collapsed" : ""}`} aria-hidden>
                    ▾
                  </span>
                </button>
              ) : (
                label && <div className="admin-nav-grouplabel">{label}</div>
              )}
              {!isCollapsed &&
              group.items.map((entry) =>
                isSubsection(entry) ? renderSubsection(entry, label) : renderItem(entry, false),
              )}
            </div>
            );
          })}
        </div>
      </nav>
    </>
  );
}
