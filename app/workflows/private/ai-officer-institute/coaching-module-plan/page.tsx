import type { Metadata } from 'next'
import Link from 'next/link'
import PrivateGate from '../../PrivateGate'

export const metadata: Metadata = {
  title: 'Coaching Module — Plan | AI Officer Institute | Edge8',
  description:
    'Build plan for the Open Coaching module: surfaces, core flows, data model, rules and states, architecture fit, and phased delivery.',
  robots: { index: false, follow: false },
}

// The brief is authored as a self-contained HTML page (its own design system).
// It is rendered inside an isolated iframe so those styles cannot collide with
// the site's global workflow CSS, while staying behind PrivateGate.
const BRIEF_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Coaching Module — Plan Brief · AI Officer Institute</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
  :root{
    --dark:#092244; --blue:#287BE8; --body-text:#3f5168; --muted:#6b7d92;
    --bg:#EAEEF2; --white:#ffffff; --tint:#eef3ff; --card-border:#dbe2ea;
    --ok:#0f9d58; --warn:#b7791f; --font:'Inter',system-ui,sans-serif;
  }
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:var(--font);background:var(--bg);color:var(--body-text);font-size:16px;line-height:1.6;}

  .topbar{position:sticky;top:0;z-index:50;height:56px;background:var(--dark);display:flex;align-items:center;justify-content:space-between;padding:0 24px;}
  .topbar-brand{font-size:15px;font-weight:700;color:#fff;}
  .topbar-brand span{color:var(--blue);}
  .topbar-meta{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.12em;color:rgba(255,255,255,.55);}

  .wrap{max-width:900px;margin:0 auto;padding:40px 20px 80px;}
  .breadcrumb{font-size:12.5px;color:var(--muted);margin-bottom:18px;}
  .breadcrumb span{color:var(--blue);}
  .h1{font-size:34px;font-weight:700;color:var(--dark);line-height:1.15;letter-spacing:-.01em;}
  .status-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px;}
  .pill{font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;padding:4px 10px;border-radius:999px;}
  .pill-draft{background:#fff4e0;color:var(--warn);}
  .pill-blue{background:var(--tint);color:var(--blue);}
  .pill-gray{background:#e7edf3;color:var(--muted);}
  .lead{font-size:17px;line-height:1.7;color:var(--body-text);max-width:780px;margin-top:18px;}

  .section{margin-top:52px;}
  .kicker{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--blue);margin-bottom:10px;}
  .h2{font-size:25px;font-weight:600;color:var(--dark);line-height:1.25;margin-bottom:12px;}
  .p{font-size:15.5px;line-height:1.7;color:var(--body-text);max-width:780px;}
  .p + .p{margin-top:12px;}

  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:18px;margin-top:22px;}
  .card{background:var(--white);border:1px solid var(--card-border);border-radius:14px;padding:22px;}
  .card h3{font-size:16px;font-weight:700;color:var(--dark);margin-bottom:8px;}
  .card p{font-size:14px;line-height:1.6;color:var(--body-text);}
  .card .tag{display:inline-block;margin-top:12px;font-size:11.5px;font-weight:600;color:var(--blue);background:var(--tint);border-radius:6px;padding:3px 8px;}

  ul.list{list-style:none;display:flex;flex-direction:column;gap:11px;margin-top:16px;}
  ul.list li{position:relative;padding-left:22px;font-size:15px;line-height:1.6;}
  ul.list li::before{content:'';position:absolute;left:0;top:8px;width:8px;height:8px;border-radius:50%;background:var(--blue);}
  ul.list li strong{color:var(--dark);}

  .callout{margin-top:22px;background:var(--tint);border-left:3px solid var(--blue);border-radius:10px;padding:16px 20px;font-size:14.5px;line-height:1.65;}
  .callout.warn{background:#fff7ea;border-left-color:var(--warn);}
  .callout strong{color:var(--dark);}

  table{width:100%;border-collapse:collapse;margin-top:20px;background:var(--white);border:1px solid var(--card-border);border-radius:12px;overflow:hidden;font-size:14px;}
  th,td{text-align:left;padding:12px 14px;border-bottom:1px solid var(--card-border);vertical-align:top;}
  th{background:#f2f6fa;color:var(--dark);font-weight:700;font-size:12.5px;text-transform:uppercase;letter-spacing:.04em;}
  tr:last-child td{border-bottom:none;}
  td code{background:#eef2f6;border-radius:4px;padding:1px 6px;font-size:12.5px;color:var(--dark);}
  .phase-num{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:var(--dark);color:#fff;font-size:12px;font-weight:700;}
  .done{color:var(--ok);font-weight:700;}

  .flow{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:18px;}
  .flow .step{background:var(--white);border:1px solid var(--card-border);border-radius:8px;padding:8px 12px;font-size:13px;font-weight:600;color:var(--dark);}
  .flow .arrow{color:var(--muted);font-weight:700;}

  .q{background:var(--white);border:1px solid var(--card-border);border-radius:12px;padding:16px 18px;margin-top:12px;}
  .q .qh{font-weight:700;color:var(--dark);font-size:14.5px;}
  .q .qb{font-size:14px;margin-top:4px;color:var(--body-text);}
  a{color:var(--blue);}
  .foot{margin-top:60px;padding-top:20px;border-top:1px solid var(--card-border);font-size:12.5px;color:var(--muted);}
</style>
</head>
<body>
  <div class="topbar">
    <div class="topbar-brand">AI Officer <span>Institute</span></div>
    <div class="topbar-meta">Plan Brief · Internal</div>
  </div>

  <div class="wrap">
    <div class="breadcrumb">Workflows / Private / AI Officer Institute / <span>Coaching Module</span></div>
    <h1 class="h1">Coaching Module — build plan</h1>
    <div class="status-row">
      <span class="pill pill-blue">Plan brief</span>
      <span class="pill pill-gray">Open Coaching</span>
      <span class="pill pill-gray">aiolabz-fe · feature module</span>
    </div>
    <p class="lead">
      This brief turns the <strong>Open Coaching prototype</strong> into a real product module inside the AI Officer
      Institute. Open Coaching mirrors the prototype at <a href="https://www.caiocoach.com/coaching">caiocoach.com/coaching</a>:
      a live weekly session where members bring a real AI challenge and get coached. Like micro-sessions, it has an
      <strong>Upcoming</strong> view and an <strong>Archive</strong>, and every session is recorded and auto-published.
    </p>

    <!-- 1. Goal -->
    <div class="section">
      <div class="kicker">Goal</div>
      <h2 class="h2">What we're building, and what "done" means</h2>
      <p class="p">
        A coaching feature that lets any member sign up for the weekly session in one tap, optionally submit a
        challenge, and vote up the challenges they most want coached. The top topics get coached live; the recording
        lands in the Archive automatically with attendees, key learnings, video, and resources attached.
      </p>
      <ul class="list">
        <li><strong>Cadence:</strong> every Thursday, 11:00 AM GMT+7. A second US-friendly time is expected later — the model must support multiple recurring slots.</li>
        <li><strong>Open to all members:</strong> attendees can listen in and ask questions. Signing up does <em>not</em> require submitting a challenge.</li>
        <li><strong>Max 8 topics per session:</strong> submissions are capped; the highest-voted are coached that day.</li>
        <li><strong>Recorded &amp; published:</strong> each session is recorded and automatically added to the Archive.</li>
      </ul>
    </div>

    <!-- 2. Views -->
    <div class="section">
      <div class="kicker">Surfaces</div>
      <h2 class="h2">Three screens, mirroring micro-sessions</h2>
      <div class="cards">
        <div class="card">
          <h3>Upcoming</h3>
          <p>The next session: date/time, the running list of submitted challenges with vote counts (0–8), a one-tap <em>Sign up</em>, and an optional <em>Submit a challenge</em>. Shows the 8/8 "full" state.</p>
          <span class="tag">Prototype ✓</span>
        </div>
        <div class="card">
          <h3>Archive</h3>
          <p>Every past session as a card — number, date, coach, topic count, attendee count — filterable/searchable. Each opens a session detail page.</p>
          <span class="tag">Prototype ✓</span>
        </div>
        <div class="card">
          <h3>Session detail</h3>
          <p>Recording (video); <strong>key learnings</strong> in a box that expands to its own page when there are many; <strong>topics coached</strong> shown in full — name, description, who submitted it, and a coached / not-coached indicator; then <strong>attendees</strong> with <strong>additional resources beneath</strong>. The durable artifact members return to.</p>
          <span class="tag">Prototype ✓</span>
        </div>
      </div>
      <div class="callout">
        <strong>The prototype already covers all three surfaces</strong> and the core interactions (voting, 8-topic cap, sign-up modal without name/email, session detail). It is the visual spec for this build — see the Open Coaching prototype in the Prototypes tab.
      </div>
    </div>

    <!-- 3. Flows -->
    <div class="section">
      <div class="kicker">Core flows</div>
      <h2 class="h2">The member journeys</h2>

      <p class="p" style="margin-top:8px;"><strong>Sign up</strong> (member is already logged in — no name/email):</p>
      <div class="flow">
        <span class="step">Open Upcoming</span><span class="arrow">→</span>
        <span class="step">Tap “Sign up”</span><span class="arrow">→</span>
        <span class="step">Pick session</span><span class="arrow">→</span>
        <span class="step">Confirm</span><span class="arrow">→</span>
        <span class="step">Calendar invite + join link</span>
      </div>

      <p class="p" style="margin-top:22px;"><strong>Submit &amp; vote</strong> (optional):</p>
      <div class="flow">
        <span class="step">Submit challenge</span><span class="arrow">→</span>
        <span class="step">Appears in list (if &lt; 8)</span><span class="arrow">→</span>
        <span class="step">Members upvote</span><span class="arrow">→</span>
        <span class="step">Top topics coached live</span>
      </div>

      <p class="p" style="margin-top:22px;"><strong>After the session</strong> (mostly automated):</p>
      <div class="flow">
        <span class="step">Session ends</span><span class="arrow">→</span>
        <span class="step">Recording ingested</span><span class="arrow">→</span>
        <span class="step">Auto-published to Archive</span><span class="arrow">→</span>
        <span class="step">Learnings + resources added</span>
      </div>
    </div>

    <!-- 4. Data model -->
    <div class="section">
      <div class="kicker">Data model</div>
      <h2 class="h2">Entities the backend needs</h2>
      <table>
        <thead><tr><th>Entity</th><th>Key fields</th><th>Notes</th></tr></thead>
        <tbody>
          <tr><td><code>coaching_session</code></td><td>id, starts_at, timezone, status, coach, focus_topic, recording_url, duration</td><td>status: <code>scheduled → live → published</code>. Recurring slot generates these.</td></tr>
          <tr><td><code>challenge</code></td><td>id, session_id, member_id, title, description, vote_count, status, <strong>coached</strong></td><td>Max 8 <code>accepted</code> per session. <code>member_id</code> = “submitted by”. <code>coached</code> = did the submitter attend and get it discussed live (drives the coached / not-coached indicator).</td></tr>
          <tr><td><code>challenge_vote</code></td><td>challenge_id, member_id</td><td>One vote per member per challenge; drives ranking.</td></tr>
          <tr><td><code>signup</code></td><td>session_id, member_id, created_at</td><td>Independent of submitting a challenge.</td></tr>
          <tr><td><code>attendance</code></td><td>session_id, member_id, joined</td><td>Populates the Archive attendee list.</td></tr>
          <tr><td><code>session_learning</code></td><td>session_id, order, text</td><td>Key learnings. Can be many → detail page shows a preview and expands to a dedicated learnings page.</td></tr>
          <tr><td><code>session_resource</code></td><td>session_id, label, kind, url</td><td>kind: doc / slides / code / link.</td></tr>
        </tbody>
      </table>
    </div>

    <!-- 5. Rules & states -->
    <div class="section">
      <div class="kicker">Rules &amp; states</div>
      <h2 class="h2">The edges that must be handled</h2>
      <ul class="list">
        <li><strong>Topic cap:</strong> once 8 challenges are accepted, hide “submit” and show the full-session notice (submit for a later Thursday).</li>
        <li><strong>Voting window:</strong> voting closes when the session goes live; ranking freezes for the record.</li>
        <li><strong>Session lifecycle:</strong> <code>scheduled</code> (Upcoming) → <code>live</code> → <code>published</code> (Archive). Only published sessions appear in Archive.</li>
        <li><strong>Members-only:</strong> the whole module is gated to signed-in members; respect iframe vs full-app auth.</li>
        <li><strong>Loading &amp; error states:</strong> every query must render <code>&lt;QueryErrorState onRetry /&gt;</code> on error (per repo rule) — never a blank Upcoming/Archive.</li>
        <li><strong>Empty states:</strong> “no challenges yet — be the first”, “no sessions archived yet”.</li>
      </ul>
    </div>

    <!-- 6. Where it lives -->
    <div class="section">
      <div class="kicker">Architecture fit</div>
      <h2 class="h2">Where it lives in aiolabz-fe</h2>
      <ul class="list">
        <li><strong>Feature module:</strong> <code>src/features/coaching/</code> — components, hooks (TanStack Query), services, types, stores, <code>CoachingView.tsx</code>, following the existing feature pattern.</li>
        <li><strong>Routes:</strong> a dashboard route for Upcoming/Archive and a session-detail route; reuse the micro-sessions layout so the two feel like siblings.</li>
        <li><strong>Server state:</strong> TanStack Query only; UI state in a focused Zustand store if needed.</li>
        <li><strong>Recording:</strong> video needs an authenticated signed-URL path — note the recently removed unauthenticated <code>/api/videos/signed-url</code> route; the coaching player must use the secure pattern, not reintroduce that hole.</li>
        <li><strong>Notifications:</strong> weekly reminder + “recording published” via the existing notifications feature.</li>
      </ul>
    </div>

    <!-- 7. Phases -->
    <div class="section">
      <div class="kicker">Delivery</div>
      <h2 class="h2">Build in phases</h2>
      <table>
        <thead><tr><th>Phase</th><th>Scope</th><th>Status</th></tr></thead>
        <tbody>
          <tr><td><span class="phase-num">0</span></td><td>Static prototype — all three surfaces, interactions, session detail</td><td><span class="done">Done ✓</span></td></tr>
          <tr><td><span class="phase-num">1</span></td><td>Read-only Upcoming + Archive wired to real sessions (no auth actions yet)</td><td>Next</td></tr>
          <tr><td><span class="phase-num">2</span></td><td>Sign-up (one tap) + calendar invite / join link</td><td>Planned</td></tr>
          <tr><td><span class="phase-num">3</span></td><td>Challenge submission + voting, with the 8-topic cap enforced server-side</td><td>Planned</td></tr>
          <tr><td><span class="phase-num">4</span></td><td>Recording ingest → auto-publish, session detail (learnings, resources, attendees)</td><td>Planned</td></tr>
          <tr><td><span class="phase-num">5</span></td><td>Second US time slot + weekly / published notifications</td><td>Later</td></tr>
        </tbody>
      </table>
    </div>

    <div class="foot">
      Coaching Module plan brief · AI Officer Institute. Companion to the Open Coaching prototype and the “Video, Micro Sessions and Coaching” program plan.
    </div>
  </div>
</body>
</html>
`

export default function CoachingModulePlanPage() {
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
                <Link href="/workflows/private/ai-officer-institute">AI Officer Institute</Link>
                <span>/</span>
                <span>Coaching Module</span>
              </div>
              <h1 className="section-title">Coaching Module — build plan</h1>
              <p className="wf-hero-sub">
                Turning the Open Coaching prototype into a real product module: surfaces, core
                flows, data model, rules and states, architecture fit, and phased delivery.
              </p>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <iframe
              title="Coaching Module plan brief"
              srcDoc={BRIEF_HTML}
              style={{
                width: '100%',
                height: 'calc(100vh - 140px)',
                minHeight: 720,
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
