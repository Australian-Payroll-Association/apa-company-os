import type { Metadata } from 'next'
import Link from 'next/link'
import PrivateGate from '../../PrivateGate'

export const metadata: Metadata = {
  title: 'UI Redesign Plan — AIO Labs | Edge8',
  description:
    'Internal plan brief for three aiolabz-fe UI redesigns: Team Dashboard Quick Actions, the Mission Control Grading Outcome card, and the Blog index.',
  robots: { index: false, follow: false },
}

// The brief is authored in the AI Program Brief template (its own self-contained
// design system). It is rendered inside an isolated iframe so those styles cannot
// collide with the site's global workflow CSS, while staying behind PrivateGate.
const BRIEF_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>UI Redesign Plan — aiolabz-fe</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet" />
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Inter, sans-serif; background: #EAEEF2; color: #0A0A0A; font-size: 16px; }

  /* Topbar */
  .topbar {
    position: fixed; top: 0; left: 0; right: 0; height: 56px;
    background: #092244; display: flex; align-items: center;
    justify-content: space-between; padding: 0 24px; z-index: 100;
  }
  .topbar-brand { font-size: 15px; font-weight: 700; color: #FFFFFF; }
  .topbar-brand span { color: #287BE8; }
  .topbar-meta { font-size: 11px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.12em; color: rgba(255,255,255,0.55); }

  /* Content */
  .content {
    max-width: 860px; margin: 0 auto;
    padding: 80px 16px 60px; display: flex; flex-direction: column; gap: 16px;
  }

  /* Page header */
  .page-header { padding: 24px 0 8px; }
  .eyebrow { font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.12em; color: #287BE8; margin-bottom: 8px; }
  .page-title { font-size: 28px; font-weight: 700; color: #0A0A0A; margin-bottom: 6px; }
  .page-meta { font-size: 14px; color: #737373; }

  /* Card */
  .card {
    background: #FFFFFF; border: 1px solid #D4D4D4;
    border-radius: 16px; padding: 24px;
    box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05);
  }
  .section-label {
    font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.12em; color: #287BE8; margin-bottom: 12px;
  }
  .card-title {
    font-size: 17px; font-weight: 700; color: #0A0A0A; margin-bottom: 18px;
  }
  .card-title .pr-tag {
    font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700;
    color: #287BE8; background: rgba(40,123,232,0.1); padding: 3px 8px;
    border-radius: 4px; margin-left: 8px; vertical-align: middle;
  }
  .card-title a { color: inherit; text-decoration: none; }

  /* Insight block */
  .insight {
    border-left: 4px solid #287BE8;
    padding: 14px 18px;
    background: rgba(40,123,232,0.05);
    border-radius: 0 8px 8px 0;
    margin-bottom: 12px;
  }
  .insight-label {
    font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.1em; color: #287BE8; margin-bottom: 4px;
  }
  .insight-body { font-size: 14px; color: #0A0A0A; line-height: 1.6; }

  /* Warning block */
  .warning {
    border-left: 4px solid #D1458B;
    padding: 14px 18px;
    background: rgba(209,69,139,0.05);
    border-radius: 0 8px 8px 0;
    margin-bottom: 12px;
  }
  .warning-label {
    font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.1em; color: #D1458B; margin-bottom: 4px;
  }

  /* Dark quote block */
  .dark-block {
    background: #092244; border-radius: 8px; padding: 16px 20px; margin-bottom: 12px;
  }
  .dark-block-label {
    font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.1em; color: #6FF2C1; margin-bottom: 8px;
  }
  .dark-block-body { font-size: 14px; color: rgba(255,255,255,0.85); line-height: 1.65; }
  .dark-block-body strong { color: #FFFFFF; }

  /* Two-col grid */
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  @media (max-width: 560px) { .two-col { grid-template-columns: 1fr; } }

  /* Stat block */
  .stat { border: 1px solid #D4D4D4; border-radius: 10px; padding: 16px 18px; background: #FFFFFF; }
  .stat-num { font-size: 28px; font-weight: 700; color: #092244; }
  .stat-num.mono { font-family: 'JetBrains Mono', monospace; }
  .stat-label { font-size: 13px; color: #737373; margin-top: 2px; line-height: 1.4; }

  /* Numbered step list */
  .step-list { display: flex; flex-direction: column; gap: 10px; }
  .step-item { display: flex; align-items: flex-start; gap: 12px; }
  .step-badge {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 22px; height: 22px; background: #287BE8; color: #fff;
    font-size: 11px; font-weight: 700; border-radius: 3px; flex-shrink: 0; margin-top: 2px;
  }
  .step-badge.done { background: #16A34A; }
  .step-body { font-size: 14px; color: #737373; line-height: 1.6; }
  .step-body strong { color: #0A0A0A; }

  /* Before / After compare */
  .compare { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  @media (max-width: 560px) { .compare { grid-template-columns: 1fr; } }
  .compare-col { border: 1px solid #D4D4D4; border-radius: 10px; padding: 14px 16px; }
  .compare-col.before { background: #FAFAFA; }
  .compare-col.after { background: rgba(40,123,232,0.04); border-color: #287BE8; }
  .compare-head {
    font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;
    margin-bottom: 8px;
  }
  .compare-col.before .compare-head { color: #737373; }
  .compare-col.after .compare-head { color: #287BE8; }
  .compare-list { list-style: none; display: flex; flex-direction: column; gap: 6px; }
  .compare-list li { font-size: 13px; color: #0A0A0A; line-height: 1.5; padding-left: 16px; position: relative; }
  .compare-list li::before { content: "—"; position: absolute; left: 0; color: #A3A3A3; }
  .compare-col.after .compare-list li::before { content: "+"; color: #16A34A; font-weight: 700; }

  /* Workflow arrow diagram */
  .workflow-wrap { overflow-x: auto; width: 100%; }
  .workflow {
    display: flex; align-items: stretch; gap: 0;
    min-width: 560px; margin-bottom: 20px;
  }
  .wf-node {
    flex: 1; background: #092244; border-radius: 10px;
    padding: 14px 12px; text-align: center; position: relative;
  }
  .wf-node-label {
    font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.1em; color: #6FF2C1; margin-bottom: 6px;
  }
  .wf-node-title {
    font-size: 13px; font-weight: 700; color: #FFFFFF; margin-bottom: 0;
  }
  .wf-arrow { display: flex; align-items: center; padding: 0 4px; flex-shrink: 0; }
  .wf-arrow svg { display: block; }

  .wf-desc-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; min-width: 560px; }
  .wf-desc-label {
    font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.08em; color: #287BE8; margin-bottom: 4px;
  }
  .wf-desc-text { font-size: 12px; color: #737373; line-height: 1.55; }

  /* Data map table */
  .table-wrap { overflow-x: auto; width: 100%; border-radius: 10px; overflow: hidden; border: 1px solid #D4D4D4; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  thead tr { background: #092244; }
  thead th {
    padding: 12px 16px; text-align: left; color: #FFFFFF;
    font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
  }
  tbody tr:nth-child(odd) { background: #FFFFFF; }
  tbody tr:nth-child(even) { background: #EAEEF2; }
  tbody td { padding: 12px 16px; border: 1px solid #D4D4D4; color: #0A0A0A; line-height: 1.5; vertical-align: top; }
  tbody td:first-child { font-weight: 600; color: #092244; white-space: nowrap; }
  td .mono { font-family: 'JetBrains Mono', monospace; font-size: 12px; }
  .pill-ok {
    display: inline-block; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700;
    color: #16A34A; background: rgba(22,163,74,0.12); padding: 2px 8px; border-radius: 4px; white-space: nowrap;
  }

  /* Roadmap list */
  .roadmap-list { display: flex; flex-direction: column; gap: 10px; }
  .roadmap-item {
    display: flex; align-items: flex-start; gap: 12px;
    padding: 12px 14px; border: 1px solid #D4D4D4; border-radius: 10px; background: #FFFFFF;
  }
  .roadmap-num {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 22px; height: 22px; background: #287BE8; color: #fff;
    font-size: 11px; font-weight: 700; border-radius: 3px; flex-shrink: 0; margin-top: 1px;
  }
  .roadmap-content { flex: 1; }
  .roadmap-title { font-size: 14px; font-weight: 700; color: #0A0A0A; margin-bottom: 2px; }
  .roadmap-rationale { font-size: 13px; color: #737373; line-height: 1.5; }
  .roadmap-badge {
    font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
    padding: 2px 8px; border-radius: 4px; flex-shrink: 0; margin-top: 2px;
    background: rgba(40,123,232,0.12); color: #287BE8;
  }
  .roadmap-badge.selected { background: rgba(111,242,193,0.15); color: #16A34A; }

  /* Subsection */
  .subsection { border-bottom: 1px solid #D4D4D4; padding-bottom: 18px; margin-bottom: 18px; }
  .subsection:last-child { border-bottom: none; padding-bottom: 0; margin-bottom: 0; }
  .subsection-title { font-size: 13px; font-weight: 700; color: #0A0A0A; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.06em; }

  .file-tag {
    display: inline-block; font-family: 'JetBrains Mono', monospace; font-size: 12px;
    color: #092244; background: #EAEEF2; border: 1px solid #D4D4D4;
    padding: 2px 8px; border-radius: 4px; margin: 2px 4px 2px 0;
  }
</style>
</head>
<body>

<!-- Topbar -->
<div class="topbar">
  <div class="topbar-brand"><span>AI Officer</span> Institute</div>
  <div class="topbar-meta">UI Redesign Plan &nbsp;|&nbsp; aiolabz-fe</div>
</div>

<div class="content">

  <!-- Page Header -->
  <div class="page-header">
    <div class="eyebrow">Frontend Redesign — talentedgeai/aiolabz-fe</div>
    <div class="page-title">UI Redesign Plan</div>
    <div class="page-meta">Viet Ha &nbsp;·&nbsp; UX Design, aiolabz.com &nbsp;·&nbsp; Aug 3, 2026</div>
  </div>

  <!-- Section 1: Overview -->
  <div class="card">
    <div class="section-label">Section 01 — Overview</div>
    <div class="card-title">Three redesigns, imported from Claude Design and shipped as PRs</div>

    <div class="subsection">
      <div class="subsection-title">What this covers</div>
      <div class="insight">
        <div class="insight-body">Three UI designs from the shared Claude Design project were imported, mapped onto the real codebase, implemented against live data, and opened as independent pull requests: the <strong>Team Dashboard Quick Actions</strong>, the <strong>Mission Control Grading Outcome card</strong>, and the <strong>Blog index</strong>.</div>
      </div>
    </div>

    <div class="subsection">
      <div class="subsection-title">At a glance</div>
      <div class="two-col">
        <div class="stat">
          <div class="stat-num mono">3</div>
          <div class="stat-label">design specs imported &amp; implemented</div>
        </div>
        <div class="stat">
          <div class="stat-num mono">3</div>
          <div class="stat-label">independent PRs, each branched off <span class="mono" style="font-family:'JetBrains Mono',monospace">main</span></div>
        </div>
      </div>
    </div>

    <div class="subsection">
      <div class="subsection-title">The three items</div>
      <div class="roadmap-list">
        <div class="roadmap-item">
          <div class="roadmap-num">1</div>
          <div class="roadmap-content">
            <div class="roadmap-title">Team Dashboard — Quick Actions</div>
            <div class="roadmap-rationale">Compact 3-up link cards replacing the large 2-up cards · <span style="font-family:'JetBrains Mono',monospace">/team</span></div>
          </div>
          <div class="roadmap-badge selected">PR #698</div>
        </div>
        <div class="roadmap-item">
          <div class="roadmap-num">2</div>
          <div class="roadmap-content">
            <div class="roadmap-title">Mission Control — Grading Outcome card</div>
            <div class="roadmap-rationale">Rich grade card with dimension breakdown · challenge detail page</div>
          </div>
          <div class="roadmap-badge selected">PR #699</div>
        </div>
        <div class="roadmap-item">
          <div class="roadmap-num">3</div>
          <div class="roadmap-content">
            <div class="roadmap-title">Blog index</div>
            <div class="roadmap-rationale">Hero search, featured, filter/sort/view toolbar, load-more · <span style="font-family:'JetBrains Mono',monospace">/blog</span></div>
          </div>
          <div class="roadmap-badge selected">PR #701</div>
        </div>
      </div>
    </div>

    <div class="subsection">
      <div class="subsection-title">Guiding principle</div>
      <div class="dark-block">
        <div class="dark-block-label">Design fidelity, real data</div>
        <div class="dark-block-body">Every redesign is driven by data the app <strong>already has</strong> and reuses the repo's own theme tokens (navy <strong>#04102d</strong>, brand blue <strong>#287be8</strong>, mint <strong>#6ff2c1</strong>). No values are invented, no inline styles are added against house rules, and no new runtime dependencies are introduced.</div>
      </div>
    </div>
  </div>

  <!-- Section 2: Team Dashboard Quick Actions -->
  <div class="card">
    <div class="section-label">Section 02 — Redesign 01</div>
    <div class="card-title">Team Dashboard · Quick Actions <span class="pr-tag">PR #698</span></div>

    <div class="subsection">
      <div class="subsection-title">Problem</div>
      <div class="insight">
        <div class="insight-label">Before</div>
        <div class="insight-body">Quick Actions rendered as two large cards using an <span style="font-family:'JetBrains Mono',monospace">onClick</span> router push, with a scale-and-shadow hover — heavy for what are really three navigation shortcuts.</div>
      </div>
    </div>

    <div class="subsection">
      <div class="subsection-title">What changed</div>
      <div class="compare">
        <div class="compare-col before">
          <div class="compare-head">Before</div>
          <ul class="compare-list">
            <li>2-column large cards</li>
            <li>Card + onClick navigation</li>
            <li>48px icon, long copy</li>
            <li>Scale + large-shadow hover</li>
          </ul>
        </div>
        <div class="compare-col after">
          <div class="compare-head">After</div>
          <ul class="compare-list">
            <li>Compact 3-up grid</li>
            <li>Real keyboard-focusable links</li>
            <li>32px icon badge, trailing arrow</li>
            <li>Brand-blue border + soft shadow</li>
          </ul>
        </div>
      </div>
    </div>

    <div class="subsection">
      <div class="subsection-title">Fidelity notes</div>
      <div class="insight">
        <div class="insight-body">Styled with existing tokens (<span style="font-family:'JetBrains Mono',monospace">border-sidebar-border</span>, <span style="font-family:'JetBrains Mono',monospace">border-brand-blue</span>) — no new inline styles. The rest of the dashboard already matched the design, so only the Quick Actions section was touched.</div>
      </div>
      <div class="file-tag">src/app/team/page.tsx</div>
    </div>
  </div>

  <!-- Section 3: Grading Outcome -->
  <div class="card">
    <div class="section-label">Section 03 — Redesign 02</div>
    <div class="card-title">Mission Control · Grading Outcome card <span class="pr-tag">PR #699</span></div>

    <div class="subsection">
      <div class="subsection-title">The key decision</div>
      <div class="warning">
        <div class="warning-label">Design surface vs. data surface</div>
        <div class="insight-body">The design is framed inside the coach chat, but the chat grading result is <strong>backend-authored markdown</strong> — the structured rich-card path was deliberately removed and the server only sends a status + buttons. The only place with structured grade data (score, attempt, per-dimension scores, feedback) is <strong>GradeCard</strong> on the challenge detail page — so that is where the redesign was implemented.</div>
      </div>
    </div>

    <div class="subsection">
      <div class="subsection-title">What changed</div>
      <div class="step-list">
        <div class="step-item"><div class="step-badge">1</div><div class="step-body"><strong>Gradient-capped card</strong> with JetBrains Mono data accents, a verdict + <span style="font-family:'JetBrains Mono',monospace">NN/100</span> score chip, and attempt number.</div></div>
        <div class="step-item"><div class="step-badge">2</div><div class="step-body"><strong>Per-dimension breakdown</strong> from <span style="font-family:'JetBrains Mono',monospace">component_scores</span> — one colour-banded bar per dimension.</div></div>
        <div class="step-item"><div class="step-badge">3</div><div class="step-body"><strong>"Close this next"</strong> callout naming the single weakest dimension.</div></div>
        <div class="step-item"><div class="step-badge">4</div><div class="step-body"><strong>Full feedback</strong> in a disclosure with a "Graded &lt;time ago&gt;" stamp.</div></div>
      </div>
    </div>

    <div class="subsection">
      <div class="subsection-title">Data map — every value is a real submission field</div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Field</th><th>Drives</th></tr></thead>
          <tbody>
            <tr><td>score</td><td>Headline score chip (NN/100)</td></tr>
            <tr><td>grade_status</td><td>Pass / redo verdict, accent colour, gradient</td></tr>
            <tr><td>attempt_no</td><td>"attempt N" in the eyebrow</td></tr>
            <tr><td>component_scores</td><td>Dimension bars + weakest "close this next" (parsed from 3 shapes)</td></tr>
            <tr><td>feedback</td><td>Full-feedback disclosure body</td></tr>
            <tr><td>graded_at</td><td>"Graded &lt;time ago&gt;" stamp</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="subsection">
      <div class="subsection-title">Fidelity notes</div>
      <div class="insight">
        <div class="insight-body">Sections render only when their data exists — no dimension is invented. Also wired <strong>JetBrains Mono</strong> via <span style="font-family:'JetBrains Mono',monospace">next/font</span> under the <span style="font-family:'JetBrains Mono',monospace">--font-jetbrains</span> variable globals already referenced. Self-suppression on professor review and the legitimate-zero guard are preserved.</div>
      </div>
      <div class="file-tag">GradeCard.tsx</div>
      <div class="file-tag">GradeCard.test.tsx</div>
      <div class="file-tag">app/layout.tsx</div>
    </div>
  </div>

  <!-- Section 4: Blog index -->
  <div class="card">
    <div class="section-label">Section 04 — Redesign 03</div>
    <div class="card-title">Blog index <span class="pr-tag">PR #701</span></div>

    <div class="subsection">
      <div class="subsection-title">Problem</div>
      <div class="insight">
        <div class="insight-label">Before</div>
        <div class="insight-body">The listing had the hero and tag tabs, but no search, no sort, no grid/list toggle, and no pagination — all 31 posts rendered at once.</div>
      </div>
    </div>

    <div class="subsection">
      <div class="subsection-title">What changed</div>
      <div class="step-list">
        <div class="step-item"><div class="step-badge">1</div><div class="step-body"><strong>Hero search</strong> (⌘K hint) filtering by title, summary, and topic.</div></div>
        <div class="step-item"><div class="step-badge">2</div><div class="step-body"><strong>Featured split card</strong> — a pinned editorial pick when present, else the newest post ("Editor's pick" vs "Latest").</div></div>
        <div class="step-item"><div class="step-badge">3</div><div class="step-body"><strong>Sticky toolbar</strong>: topic pills, live result count, Newest / Quickest-read sort, grid ⇄ list toggle.</div></div>
        <div class="step-item"><div class="step-badge">4</div><div class="step-body"><strong>Grid &amp; list views</strong>, a search-aware empty state, and <strong>Load more</strong> (9 at a time).</div></div>
      </div>
    </div>

    <div class="subsection">
      <div class="subsection-title">Reused, unchanged</div>
      <div class="insight">
        <div class="insight-body">The server→client data flow, the content view-model, the <span style="font-family:'JetBrains Mono',monospace">POST_TOPICS</span> taxonomy, image resolution with <span style="font-family:'JetBrains Mono',monospace">onError</span> fallback, and <span style="font-family:'JetBrains Mono',monospace">/blog/[slug]</span> routing are all reused as-is. Pagination resets via the derive-during-render pattern, not an effect.</div>
      </div>
      <div class="file-tag">src/features/cms/components/CmsBlogView.tsx</div>
    </div>
  </div>

  <!-- Section 5: Delivery Workflow -->
  <div class="card">
    <div class="section-label">Section 05 — Delivery Workflow</div>
    <div class="card-title">Import → Map → Implement → Verify → Ship</div>

    <div class="workflow-wrap">
      <div class="workflow">
        <div class="wf-node"><div class="wf-node-label">Stage 1</div><div class="wf-node-title">Import</div></div>
        <div class="wf-arrow"><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 10h12M12 6l4 4-4 4" stroke="#287BE8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        <div class="wf-node"><div class="wf-node-label">Stage 2</div><div class="wf-node-title">Map</div></div>
        <div class="wf-arrow"><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 10h12M12 6l4 4-4 4" stroke="#287BE8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        <div class="wf-node"><div class="wf-node-label">Stage 3</div><div class="wf-node-title">Implement</div></div>
        <div class="wf-arrow"><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 10h12M12 6l4 4-4 4" stroke="#287BE8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        <div class="wf-node"><div class="wf-node-label">Stage 4</div><div class="wf-node-title">Verify</div></div>
        <div class="wf-arrow"><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 10h12M12 6l4 4-4 4" stroke="#287BE8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        <div class="wf-node"><div class="wf-node-label">Stage 5</div><div class="wf-node-title">Ship</div></div>
      </div>

      <div class="wf-desc-grid" style="margin-top:12px;">
        <div class="wf-desc-item"><div class="wf-desc-label">Import</div><div class="wf-desc-text">Read the design spec and its assets via the Claude Design MCP</div></div>
        <div class="wf-desc-item"><div class="wf-desc-label">Map</div><div class="wf-desc-text">Locate the real component + data shape in the repo; decide the correct surface</div></div>
        <div class="wf-desc-item"><div class="wf-desc-label">Implement</div><div class="wf-desc-text">Tailwind + existing tokens, real data, house rules (no inline styles)</div></div>
        <div class="wf-desc-item"><div class="wf-desc-label">Verify</div><div class="wf-desc-text">pnpm tsc, ESLint on changed files, and unit tests where present</div></div>
        <div class="wf-desc-item"><div class="wf-desc-label">Ship</div><div class="wf-desc-text">Branch off main, commit, push, open a focused PR</div></div>
      </div>
    </div>
  </div>

  <!-- Section 6: Verification & Status -->
  <div class="card">
    <div class="section-label">Section 06 — Verification &amp; Status</div>
    <div class="card-title">Checks per redesign</div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Redesign</th><th>Surface</th><th>PR</th><th>Checks</th><th>Status</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>Quick Actions</td>
            <td>/team</td>
            <td><span class="mono">#698</span></td>
            <td>tsc clean · ESLint clean</td>
            <td><span class="pill-ok">PR open</span></td>
          </tr>
          <tr>
            <td>Grading Outcome</td>
            <td>Challenge detail</td>
            <td><span class="mono">#699</span></td>
            <td>tsc clean · 11 tests pass · ESLint clean</td>
            <td><span class="pill-ok">PR open</span></td>
          </tr>
          <tr>
            <td>Blog index</td>
            <td>/blog</td>
            <td><span class="mono">#701</span></td>
            <td>tsc clean · ESLint 0 errors</td>
            <td><span class="pill-ok">PR open</span></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="subsection" style="margin-top:18px;">
      <div class="subsection-title">Open follow-ups</div>
      <div class="warning">
        <div class="warning-label">Notes for review</div>
        <div class="insight-body">All three PRs are open against <span style="font-family:'JetBrains Mono',monospace">main</span> and awaiting review. The Blog's mono accents render in JetBrains Mono once PR #699 (which wires that font) merges; until then they fall back to the system monospace. Cover images keep the existing <span style="font-family:'JetBrains Mono',monospace">&lt;img&gt;</span> + onError fallback pattern.</div>
      </div>
    </div>
  </div>

</div>

<script type="application/json" id="artifact-data">
{"rows":[
  {"section":"Overview","field":"Scope","value":"Three Claude Design specs imported and shipped as PRs: Team Dashboard Quick Actions, Mission Control Grading Outcome card, Blog index"},
  {"section":"Overview","field":"Principle","value":"Design fidelity on real data; reuse repo tokens (navy #04102d, blue #287be8, mint #6ff2c1); no invented values, no new deps"},
  {"section":"Redesign 01 — Quick Actions","field":"PR","value":"#698 · src/app/team/page.tsx · /team"},
  {"section":"Redesign 01 — Quick Actions","field":"Before","value":"Two large cards, onClick navigation, scale+shadow hover"},
  {"section":"Redesign 01 — Quick Actions","field":"After","value":"Compact 3-up keyboard-focusable link cards, 32px icon badge, trailing arrow, brand-blue border + soft shadow; existing tokens, no inline styles"},
  {"section":"Redesign 02 — Grading Outcome","field":"PR","value":"#699 · GradeCard.tsx, GradeCard.test.tsx, app/layout.tsx · challenge detail page"},
  {"section":"Redesign 02 — Grading Outcome","field":"Key decision","value":"Chat grading is backend markdown with no structured data; GradeCard on the challenge detail page is the real data-backed target"},
  {"section":"Redesign 02 — Grading Outcome","field":"What changed","value":"Gradient-capped card, JetBrains Mono accents, verdict + NN/100 score, per-dimension breakdown from component_scores, weakest 'close this next' callout, feedback disclosure with graded-at; JetBrains Mono wired via next/font"},
  {"section":"Redesign 02 — Grading Outcome","field":"Data fields","value":"score, grade_status, attempt_no, component_scores, feedback, graded_at — all real submission fields; sections render only when data exists"},
  {"section":"Redesign 03 — Blog index","field":"PR","value":"#701 · src/features/cms/components/CmsBlogView.tsx · /blog"},
  {"section":"Redesign 03 — Blog index","field":"Before","value":"Hero + tag tabs only; no search, sort, view toggle, or pagination; all 31 posts at once"},
  {"section":"Redesign 03 — Blog index","field":"After","value":"Hero search (⌘K), featured split card (Editor's pick/Latest), sticky filter+count+sort+view toolbar, grid & list views, empty state, load-more (9 at a time)"},
  {"section":"Redesign 03 — Blog index","field":"Reused","value":"Server→client flow, content view-model, POST_TOPICS taxonomy, image resolution with onError fallback, /blog/[slug] routing; pagination resets via derive-during-render"},
  {"section":"Delivery Workflow","field":"Stages","value":"Import (Design MCP) → Map (repo + data shape) → Implement (Tailwind + tokens + real data) → Verify (tsc/ESLint/tests) → Ship (branch, commit, push, PR)"},
  {"section":"Verification","field":"Quick Actions #698","value":"tsc clean · ESLint clean · PR open"},
  {"section":"Verification","field":"Grading Outcome #699","value":"tsc clean · 11 tests pass · ESLint clean · PR open"},
  {"section":"Verification","field":"Blog index #701","value":"tsc clean · ESLint 0 errors · PR open"},
  {"section":"Verification","field":"Follow-ups","value":"All three PRs open against main, awaiting review; Blog mono accents upgrade to JetBrains Mono once #699 merges"}
]}
</script>

</body>
</html>
`

export default function AioLabsUiRedesignPlanPage() {
  return (
    <PrivateGate>
      <main>
        <section className="wf-hero">
          <div className="container">
            <div className="wf-hero-inner">
              <div className="wf-breadcrumb">
                <Link href="/workflows">Workflows</Link>
                <span>/</span>
                <Link href="/workflows/private">Private</Link>
                <span>/</span>
                <Link href="/workflows/private/aio-labs">AIO Labs</Link>
                <span>/</span>
                <span>UI Redesign Plan</span>
              </div>
              <h1 className="section-title">UI Redesign Plan</h1>
              <p className="wf-hero-sub">
                Plan brief for three shipped aiolabz-fe redesigns — Team Dashboard Quick Actions,
                the Mission Control Grading Outcome card, and the Blog index.
              </p>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <iframe
              title="UI Redesign Plan brief"
              srcDoc={BRIEF_HTML}
              style={{
                width: '100%',
                height: 'calc(100vh - 140px)',
                minHeight: 640,
                border: '1px solid var(--border, #d4d4d4)',
                borderRadius: 12,
                background: '#EAEEF2',
              }}
            />
          </div>
        </section>
      </main>
    </PrivateGate>
  )
}
