import type { Metadata } from "next";
import Link from "next/link";
import ProposalsTabs, { type Proposal } from "./proposals-tabs";

export const metadata: Metadata = {
  title: "Proposals · Edge8",
  description: "Live client proposals prepared by Edge8 AI.",
  // Client-confidential index: reachable by direct link, but never crawled or
  // surfaced in search. Keep this in step with its absence from the sitemap.
  robots: { index: false, follow: false },
};

// One entry per proposal file under public/proposals/. Ordered newest first.
// status drives the Open / Won / Lost views on the page.
const PROPOSALS: Proposal[] = [
  {
    client: "EO Global",
    kind: "Statements of Work · HubSpot, Events, Approval & Support",
    summary:
      "Four draft SOWs for the next block of build and support work: HubSpot platform improvements, the Eventbrite-to-OneEO event system, the global membership approval flow, and a retained team to roll out ~60 chapters and run continuous feedback.",
    date: "August 2026",
    href: "/proposals/eo-global-sow/",
    status: "open",
  },
  {
    client: "Arca Wellness",
    kind: "1-Day Private Retreat",
    summary:
      "A confirmed 1-day Infinite Leverage Private Retreat for up to 8 people: install the developer stack, ship a live Shopify change through Claude, and stand up Arca's own company database with a playground to build on.",
    date: "August 2026",
    href: "/proposals/arca-wellness-retreat-proposal.html",
    status: "won",
  },
  {
    client: "Home Integrity",
    kind: "Scheduling Platform & Company OS",
    summary:
      "A plan to move Home Integrity's inspection scheduling off Zuper and onto a platform it owns: one central database synced with HubSpot, the scheduling SOPs finally written down, and AI assist to follow.",
    date: "August 2026",
    href: "/proposals/home-integrity-proposal.html",
    status: "open",
  },
  {
    client: "Titan Recruitment",
    kind: "AI Platform Program",
    summary:
      "A staged plan to keep 25 years of recruiting knowledge intact as Titan moves off RDB onto Mercury: own the data layer, stand up the dashboard shell, and build guided workflows priced per feature.",
    date: "July 2026",
    href: "/proposals/titan-recruitment-proposal.html",
    status: "open",
  },
  {
    client: "Westbridge & Momentum Wealth",
    kind: "AI Program",
    summary:
      "A staged AI program: coach a lead who can run it, train the team to spot what AI should solve, and build the Company OS data foundation underneath.",
    date: "July 2026",
    href: "/proposals/westbridge-momentum-proposal.html",
    status: "lost",
  },
  {
    client: "Bstore",
    kind: "AI & Data Proposal",
    summary:
      "A two-track plan to take AI capability past Bstore's leadership team and turn two quarters of workflow mapping into a central database and working automations.",
    date: "July 2026",
    href: "/proposals/bstore-proposal.html",
    status: "won",
  },
  {
    client: "AI Program Jumpstart",
    kind: "Fixed-Price Engagement",
    summary:
      "An 8-week, fixed-price engagement to install Company OS on a database you own: your data mapped, the modules you need turned on, and 2 to 4 automations built.",
    date: "July 2026",
    href: "/proposals/ai-program-jumpstart.html",
    note: "Template",
    status: "open",
  },
  {
    client: "Arca Wellness & Longevity",
    kind: "AI Storefront Proposal",
    summary:
      "A custom, AI-built storefront for Arca: Vietnam payments integrated directly, owned end to end, built as a low-risk pilot.",
    date: "June 2026",
    href: "/proposals/arca-wellness-proposal-2026-06-26.html",
    status: "open",
  },
  {
    client: "Rentwest",
    kind: "AI & Data Proposal",
    summary:
      "A plan to move Rentwest from 15 systems to one company database it owns, with reporting and workflows rebuilt on top and the team trained to run it.",
    date: "June 2026",
    href: "/proposals/rentwest-proposal.html",
    status: "open",
  },
  {
    client: "EO APAC",
    kind: "Chapter Operating Platform · Quote",
    summary:
      "Deploy the AI-run chapter operating platform across EO APAC, with a regional rollup for reporting and a dedicated AI engineer to execute.",
    date: "June 2026",
    href: "/proposals/eo-apac-chapter-platform/",
    status: "lost",
  },
  {
    client: "Accord Plumbing",
    kind: "AI & Data Proposal",
    summary:
      "Version 2: the database foundation priced two ways (native Azure or Supabase/Vercel), with the invoice-verification platform built on top.",
    date: "August 2026",
    href: "/proposals/accord-plumbing-proposal.html",
    status: "open",
  },
  {
    client: "National Housing Blueprint",
    kind: "Client Portal & Property Dashboard",
    summary:
      "Take Ellen's proven dashboard prototype into a stable, secure, production web application her clients can log into from anywhere.",
    date: "May 2026",
    href: "/proposals/national-housing/",
    status: "open",
  },
];

export default function ProposalsIndex() {
  return (
    <main>
      <section className="hero" style={{ paddingBottom: 0 }}>
        <div className="hero-bg" />
        <div className="hero-grid" />
        <div className="container">
          <div className="hero-content">
            <div className="hero-eyebrow">Confidential</div>
            <h1 className="hero-headline">
              Client <span className="accent">Proposals</span>
            </h1>
            <p className="hero-sub">
              Live proposals prepared by Edge8 AI. Each is written for a single client &mdash; please
              don&rsquo;t share these links publicly.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <ProposalsTabs proposals={PROPOSALS} />

          <p style={{ marginTop: 40, fontSize: 13, color: "var(--grey-mid)", lineHeight: 1.6 }}>
            Need something added or updated?{" "}
            <Link href="/contact" className="reserve-inline-link">
              Get in touch
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
