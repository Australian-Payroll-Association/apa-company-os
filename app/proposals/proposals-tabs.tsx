"use client";

import { useState } from "react";

export type ProposalStatus = "open" | "won" | "lost";

export type Proposal = {
  client: string;
  kind: string;
  summary: string;
  date: string;
  href: string;
  status: ProposalStatus;
  note?: string;
};

const VIEWS: { key: ProposalStatus; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
];

export default function ProposalsTabs({ proposals }: { proposals: Proposal[] }) {
  const [view, setView] = useState<ProposalStatus>("open");
  const visible = proposals.filter((p) => p.status === view);

  return (
    <>
      <style>{`
        .prop-tabs {
          display: flex;
          gap: 10px;
          margin-bottom: 32px;
        }
        .prop-tab {
          font-size: 14px;
          font-weight: 600;
          padding: 8px 18px;
          border-radius: 40px;
          border: 1px solid var(--card-border);
          background: var(--white);
          color: var(--body-text);
          cursor: pointer;
          transition: border-color var(--transition), color var(--transition), background var(--transition);
        }
        .prop-tab:hover { border-color: var(--blue); color: var(--blue); }
        .prop-tab.active {
          background: var(--dark);
          border-color: var(--dark);
          color: var(--white);
        }
        .prop-tab .count {
          font-weight: 500;
          opacity: 0.65;
          margin-left: 6px;
        }
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

      <div className="prop-tabs" role="tablist" aria-label="Proposal status">
        {VIEWS.map((v) => {
          const count = proposals.filter((p) => p.status === v.key).length;
          return (
            <button
              key={v.key}
              role="tab"
              aria-selected={view === v.key}
              className={`prop-tab${view === v.key ? " active" : ""}`}
              onClick={() => setView(v.key)}
            >
              {v.label}
              <span className="count">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="prop-grid">
        {visible.map((p) => (
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
    </>
  );
}
