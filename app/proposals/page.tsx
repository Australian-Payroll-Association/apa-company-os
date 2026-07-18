import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Proposals · Edge8",
  description: "Live client proposals prepared by Edge8 AI.",
  // Client-confidential index: reachable by direct link, but never crawled or
  // surfaced in search. Keep this in step with its absence from the sitemap.
  robots: { index: false, follow: false },
};

type Proposal = {
  client: string;
  kind: string;
  summary: string;
  date: string;
  href: string;
  note?: string;
};

// One entry per proposal file under public/proposals/. Ordered newest first.
const PROPOSALS: Proposal[] = [
  {
    client: "Titan Recruitment",
    kind: "AI Platform Program",
    summary:
      "A staged plan to keep 25 years of recruiting knowledge intact as Titan moves off RDB onto Mercury: own the data layer, stand up the dashboard shell, and build guided workflows priced per feature.",
    date: "July 2026",
    href: "/proposals/titan-recruitment-proposal.html",
  },
  {
    client: "Westbridge & Momentum Wealth",
    kind: "AI Program",
    summary:
      "A staged AI program: coach a lead who can run it, train the team to spot what AI should solve, and build the Company OS data foundation underneath.",
    date: "July 2026",
    href: "/proposals/westbridge-momentum-proposal.html",
  },
  {
    client: "Bstore",
    kind: "AI & Data Proposal",
    summary:
      "A two-track plan to take AI capability past Bstore's leadership team and turn two quarters of workflow mapping into a central database and working automations.",
    date: "July 2026",
    href: "/proposals/bstore-proposal.html",
  },
  {
    client: "AI Program Jumpstart",
    kind: "Fixed-Price Engagement",
    summary:
      "An 8-week, fixed-price engagement to install Company OS on a database you own: your data mapped, the modules you need turned on, and 2 to 4 automations built.",
    date: "July 2026",
    href: "/proposals/ai-program-jumpstart.html",
    note: "Template",
  },
  {
    client: "Arca Wellness & Longevity",
    kind: "AI Storefront Proposal",
    summary:
      "A custom, AI-built storefront for Arca: Vietnam payments integrated directly, owned end to end, built as a low-risk pilot.",
    date: "June 2026",
    href: "/proposals/arca-wellness-proposal-2026-06-26.html",
  },
  {
    client: "Rentwest",
    kind: "AI & Data Proposal",
    summary:
      "A plan to move Rentwest from 15 systems to one company database it owns, with reporting and workflows rebuilt on top and the team trained to run it.",
    date: "June 2026",
    href: "/proposals/rentwest-proposal.html",
  },
  {
    client: "EO APAC",
    kind: "Chapter Operating Platform · Quote",
    summary:
      "Deploy the AI-run chapter operating platform across EO APAC, with a regional rollup for reporting and a dedicated AI engineer to execute.",
    date: "June 2026",
    href: "/proposals/eo-apac-chapter-platform/",
  },
  {
    client: "Accord Plumbing",
    kind: "AI & Data Proposal",
    summary:
      "A staged plan to consolidate Accord Plumbing's data, automate reporting, and reduce what you spend on software and manual work, year over year.",
    date: "June 2026",
    href: "/proposals/accord-plumbing-proposal.html",
  },
  {
    client: "National Housing Blueprint",
    kind: "Client Portal & Property Dashboard",
    summary:
      "Take Ellen's proven dashboard prototype into a stable, secure, production web application her clients can log into from anywhere.",
    date: "May 2026",
    href: "/proposals/national-housing/",
  },
];

export default function ProposalsIndex() {
  return (
    <main>
      <style>{`
        .prop-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          gap: 24px;
        }
        .prop-card {
          display: flex;
          flex-direction: column;
          background: var(--white);
          border: 1px solid var(--card-border);
          border-radius: var(--radius);
          padding: 28px;
          text-decoration: none;
          color: inherit;
          transition: transform var(--transition), box-shadow var(--transition), border-color var(--transition);
        }
        .prop-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 28px rgba(16,16,20,0.08);
          border-color: var(--blue);
        }
        .prop-card-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
        }
        .prop-card-date {
          font-size: 13px;
          color: var(--body-text);
          background: var(--tint);
          border-radius: 40px;
          padding: 4px 12px;
        }
        .prop-card-note {
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--grey-light);
        }
        .prop-card-client {
          font-family: var(--font-display);
          font-size: 22px;
          font-weight: 600;
          line-height: 1.25;
          color: var(--dark);
          margin-bottom: 4px;
        }
        .prop-card-kind {
          font-size: 14px;
          font-weight: 500;
          color: var(--blue);
          margin-bottom: 14px;
        }
        .prop-card-summary {
          font-size: 15px;
          line-height: 1.65;
          color: var(--body-text);
          margin-bottom: 24px;
        }
        .prop-card-cta {
          margin-top: auto;
          font-size: 15px;
          font-weight: 600;
          color: var(--dark);
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .prop-card:hover .prop-card-cta { color: var(--blue); }
      `}</style>

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
          <div className="prop-grid">
            {PROPOSALS.map((p) => (
              <a key={p.href} href={p.href} className="prop-card">
                <div className="prop-card-meta">
                  <span className="prop-card-date">{p.date}</span>
                  {p.note && <span className="prop-card-note">{p.note}</span>}
                </div>
                <div className="prop-card-client">{p.client}</div>
                <div className="prop-card-kind">{p.kind}</div>
                <p className="prop-card-summary">{p.summary}</p>
                <span className="prop-card-cta">View proposal &rarr;</span>
              </a>
            ))}
          </div>

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
