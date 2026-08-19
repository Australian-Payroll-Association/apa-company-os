"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Client hub tab nav. Active state from the pathname: exact match for
// Overview, prefix match for the subroutes.

const TABS = [
  { href: "", label: "Overview" },
  { href: "/roadmap", label: "Roadmap" },
  { href: "/board", label: "Board" },
  { href: "/documents", label: "Documents" },
];

export function HubTabs({ base }: { base: string }) {
  const pathname = (usePathname() ?? "").replace(/\/$/, "");
  return (
    <nav className="admin-tabs" style={{ marginBottom: 18 }}>
      {TABS.map((t) => {
        const href = `${base}${t.href}`;
        const active = t.href === "" ? pathname === base : pathname.startsWith(href);
        return (
          <Link key={t.label} href={href} className={`admin-tab${active ? " is-active" : ""}`}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
