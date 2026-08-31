import type { Metadata } from 'next'
import Link from 'next/link'
import { Montserrat, Source_Sans_3 } from 'next/font/google'

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['300', '400', '600'],
  variable: '--font-apa-display',
  display: 'swap',
})

const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  weight: ['300', '400', '600'],
  variable: '--font-apa-body',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Australian Payroll Association — Company OS',
  description:
    "The single sign-in for everyone who runs Australia's leading payroll training, consulting and advisory service.",
}

// Single entry point into the APA operations platform. Self-contained: carries
// its own APA/Payroll IQ palette + fonts rather than the Edge8 design system in
// globals.css. The three doors route into the existing consoles.
export default function EntryPage() {
  return (
    <main className={`apa-entry ${montserrat.variable} ${sourceSans.variable}`}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* ── Top bar ── */}
      <header className="ae-topbar">
        <div className="ae-wrap ae-topbar-inner">
          <div className="ae-lockup">
            <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true">
              <path d="M4 26c0-9.4 5.6-16 13-16" stroke="#465778" strokeWidth="3.2" strokeLinecap="round" />
              <path d="M12 26c0-6 3.4-10.4 8-10.4" stroke="#6b7993" strokeWidth="3.2" strokeLinecap="round" />
              <rect x="22" y="6" width="8" height="8" rx="1.5" fill="#e4b744" />
            </svg>
            <span className="ae-lockup-text">
              <span className="ae-lockup-name">Australian Payroll Association</span>
              <span className="ae-lockup-sub">Company OS</span>
            </span>
          </div>
          <nav className="ae-nav">
            <a href="https://austpayroll.com.au/">Public site</a>
            <a href="#pillars">About APA</a>
            <a href="#entry">Consoles</a>
            <Link href="/admin/login" className="ae-topbar-cta">Sign in</Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="ae-hero">
        <div className="ae-wrap">
          <span className="ae-eyebrow"><span className="ae-dot" />Internal operations platform</span>
          <h1>Creating <span className="ae-accent">confidence</span> in how people get paid</h1>
          <p className="ae-hero-sub">
            The single sign-in for everyone who runs Australia&apos;s leading payroll training,
            consulting and advisory service.
          </p>
          <div className="ae-hero-meta">
            <span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ebc564" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 4 5v6c0 5 3.4 9.1 8 11 4.6-1.9 8-6 8-11V5l-8-3Z" /></svg>
              RLS-secured Supabase
            </span>
            <span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ebc564" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              One account, one door
            </span>
            <span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ebc564" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m22 4-10 10.01-3-3" /></svg>
              Compliant by design
            </span>
          </div>
        </div>
      </section>

      {/* ── Entry doors ── */}
      <section className="ae-entry" id="entry">
        <div className="ae-wrap">
          <div className="ae-entry-grid">
            <div className="ae-door ae-door--primary">
              <span className="ae-door-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><rect x="7" y="12" width="3" height="6" rx="1" /><rect x="12" y="8" width="3" height="10" rx="1" /><rect x="17" y="5" width="3" height="13" rx="1" /></svg>
              </span>
              <span className="ae-door-tag">APA staff</span>
              <h3>Admin Console</h3>
              <p>Run the association. Members, training cohorts, consulting engagements, recruitment and reporting — all in one place.</p>
              <div className="ae-door-foot">
                <Link href="/admin/login" className="ae-btn ae-btn--gold">Enter Admin Console →</Link>
                <p className="ae-door-help">Staff access only. <Link href="/admin/login">Trouble signing in?</Link></p>
              </div>
            </div>

            <div className="ae-door">
              <span className="ae-door-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
              </span>
              <span className="ae-door-tag">Internal team</span>
              <h3>Team Workspace</h3>
              <p>For APA trainers, consultants and helpdesk. Your assignments, member queries and day-to-day tools.</p>
              <div className="ae-door-foot">
                <Link href="/team/login" className="ae-btn ae-btn--navy">Enter Team Workspace →</Link>
                <p className="ae-door-help">Invited team members. <Link href="/team/login">Get help</Link></p>
              </div>
            </div>

            <div className="ae-door">
              <span className="ae-door-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10 12 5 2 10l10 5 10-5Z" /><path d="M6 12v5c0 1 2.7 3 6 3s6-2 6-3v-5" /></svg>
              </span>
              <span className="ae-door-tag">Clients</span>
              <h3>Client Portal</h3>
              <p>For APA clients: your engagements, deliverables, training progress, reports and the payroll helpdesk.</p>
              <div className="ae-door-foot">
                <Link href="/portal/login" className="ae-btn ae-btn--navy">Enter Client Portal →</Link>
                <p className="ae-door-help">New client? <a href="https://austpayroll.com.au/">Talk to APA</a></p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pillars ── */}
      <section className="ae-pillars" id="pillars">
        <div className="ae-wrap">
          <div className="ae-pillars-head">
            <span className="ae-section-label">What makes APA unique</span>
            <h2>All we do is payroll — and we&apos;re really good at it</h2>
            <p>The same expertise members rely on, now running the platform behind the scenes.</p>
          </div>
          <div className="ae-pillars-grid">
            <div className="ae-pillar">
              <div className="ae-pillar-mark">
                <span className="ae-ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m12 2 2.4 7.4H22l-6 4.5 2.3 7.1-6.3-4.6L5.7 21l2.3-7.1-6-4.5h7.6L12 2Z" /></svg></span>
                <h4>Expertise</h4>
              </div>
              <p>Payroll is the whole business, not a sideline. Depth you won&apos;t find in a generic training vendor.</p>
            </div>
            <div className="ae-pillar">
              <div className="ae-pillar-mark">
                <span className="ae-ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z" /></svg></span>
                <h4>Advice</h4>
              </div>
              <p>Unravelling the complexities of payroll — awards, super, STP Phase 2 — into answers you can act on.</p>
            </div>
            <div className="ae-pillar">
              <div className="ae-pillar-mark">
                <span className="ae-ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 4 5v6c0 5 3.4 9.1 8 11 4.6-1.9 8-6 8-11V5l-8-3Z" /><path d="m9 12 2 2 4-4" /></svg></span>
                <h4>Assurance</h4>
              </div>
              <p>Independent compliance reviews that deliver accuracy and peace of mind — certainty in every pay run.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Newsletter ── */}
      <section className="ae-news">
        <div className="ae-wrap">
          <div className="ae-news-card">
            <div className="ae-news-copy">
              <h3>The latest payroll news, direct to your inbox</h3>
              <p>Practical updates, compliance alerts and expert insights — free every week from APA.</p>
            </div>
            <form className="ae-news-form" action="https://austpayroll.com.au/" method="get">
              <input type="email" name="email" placeholder="you@company.com.au" aria-label="Email address" />
              <button type="submit" className="ae-btn ae-btn--gold ae-btn--auto">Subscribe</button>
            </form>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="ae-footer">
        <div className="ae-wrap ae-footer-inner">
          <div className="ae-footer-links">
            <a href="https://austpayroll.com.au/">Public site</a>
            <a href="https://austpayroll.com.au/about-us">About us</a>
            <a href="https://austpayroll.com.au/contact-us">Contact</a>
          </div>
          <div className="ae-footer-meta">© 2026 Australian Payroll Association · Sydney NSW</div>
        </div>
      </footer>
    </main>
  )
}

const CSS = `
  .apa-entry {
    --ae-navy: #465778; --ae-navy-dark: #384660; --ae-navy-tint: #6b7993;
    --ae-gold: #e4b744; --ae-gold-dark: #b89231; --ae-gold-tint: #ebc564; --ae-on-gold: #3a2f00;
    --ae-ink: #333333; --ae-ink-muted: #5c6a85; --ae-page: #f5f6f9; --ae-border: #d1d5dd;
    --ae-field: #f5f8fa; --ae-white: #ffffff;
    --ae-shadow: 0 1px 3px rgba(72,96,138,0.08); --ae-lift: 0 10px 34px rgba(56,70,96,0.16);
    --ae-display: var(--font-apa-display), system-ui, -apple-system, 'Segoe UI', sans-serif;
    --ae-body: var(--font-apa-body), system-ui, -apple-system, 'Segoe UI', sans-serif;
    font-family: var(--ae-body); color: var(--ae-ink); background: var(--ae-page); line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }
  .apa-entry * { box-sizing: border-box; }
  .apa-entry a { color: inherit; text-decoration: none; }
  .ae-wrap { width: 100%; max-width: 1180px; margin: 0 auto; padding: 0 2rem; }

  .ae-topbar { position: sticky; top: 0; z-index: 20; background: rgba(255,255,255,0.92); backdrop-filter: saturate(1.1) blur(8px); border-bottom: 1px solid var(--ae-border); }
  .ae-topbar-inner { display: flex; align-items: center; justify-content: space-between; height: 68px; }
  .ae-lockup { display: flex; align-items: center; gap: 12px; }
  .ae-lockup-text { display: flex; flex-direction: column; line-height: 1.1; }
  .ae-lockup-name { font-family: var(--ae-display); font-weight: 600; font-size: 15px; color: var(--ae-navy); }
  .ae-lockup-sub { font-size: 11px; color: var(--ae-ink-muted); letter-spacing: .02em; }
  /* Reset the bare-element rules leaking from the Edge8 globals.css (nav{position:fixed}). */
  .apa-entry .ae-nav { position: static; inset: auto; z-index: auto; background: none; backdrop-filter: none; display: flex; align-items: center; gap: 28px; }
  .ae-nav a { font-size: 14px; color: var(--ae-ink-muted); }
  .ae-nav a:hover { color: var(--ae-navy); }
  .apa-entry .ae-topbar-cta { font-weight: 600; font-size: 14px; color: var(--ae-navy); border: 2px solid var(--ae-navy); padding: 8px 16px; border-radius: 8px; transition: all .15s; }
  .ae-topbar-cta:hover { background: var(--ae-navy); color: var(--ae-white) !important; }

  .ae-hero { position: relative; overflow: hidden; background: linear-gradient(135deg, var(--ae-navy) 0%, var(--ae-navy-tint) 100%); color: var(--ae-white); padding: 92px 0 108px; }
  .ae-hero::after { content: ""; position: absolute; inset: 0; background: radial-gradient(560px 320px at 88% 12%, rgba(228,183,68,0.16), transparent 70%), radial-gradient(480px 300px at 6% 92%, rgba(255,255,255,0.06), transparent 70%); pointer-events: none; }
  .ae-hero .ae-wrap { position: relative; z-index: 1; }
  .ae-eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; color: var(--ae-gold-tint); background: rgba(228,183,68,0.12); border: 1px solid rgba(228,183,68,0.32); padding: 6px 12px; border-radius: 999px; margin-bottom: 22px; }
  .ae-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--ae-gold); }
  .ae-hero h1 { font-family: var(--ae-display); font-weight: 600; font-size: clamp(2rem, 5vw, 3.5rem); line-height: 1.08; letter-spacing: -0.01em; max-width: 15ch; }
  .ae-accent { color: var(--ae-gold-tint); }
  .ae-hero-sub { margin-top: 22px; font-size: clamp(1.05rem, 2vw, 1.25rem); font-weight: 300; color: rgba(255,255,255,0.9); max-width: 44ch; }
  .ae-hero-meta { margin-top: 30px; display: flex; flex-wrap: wrap; gap: 10px 26px; align-items: center; font-size: 14px; color: rgba(255,255,255,0.78); }
  .ae-hero-meta span { display: inline-flex; align-items: center; gap: 8px; }

  .ae-entry { margin-top: -64px; position: relative; z-index: 5; padding-bottom: 24px; }
  .ae-entry-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
  .ae-door { background: var(--ae-white); border: 1px solid var(--ae-border); border-radius: 16px; padding: 28px 26px 24px; box-shadow: var(--ae-shadow); display: flex; flex-direction: column; transition: transform .18s, box-shadow .18s, border-color .18s; }
  .ae-door:hover { transform: translateY(-4px); box-shadow: var(--ae-lift); border-color: var(--ae-navy-tint); }
  .ae-door--primary { border-top: 3px solid var(--ae-gold); }
  .ae-door-icon { width: 48px; height: 48px; border-radius: 12px; display: grid; place-items: center; margin-bottom: 18px; background: rgba(70,87,120,0.08); color: var(--ae-navy); }
  .ae-door--primary .ae-door-icon { background: rgba(228,183,68,0.14); color: var(--ae-gold-dark); }
  .ae-door-tag { font-size: 11px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; color: var(--ae-ink-muted); margin-bottom: 6px; }
  .ae-door h3 { font-family: var(--ae-display); font-weight: 600; font-size: 20px; color: var(--ae-navy); }
  .ae-door p { margin-top: 8px; font-size: 14.5px; color: var(--ae-ink-muted); flex: 1; }
  .ae-door-foot { margin-top: 20px; }
  .ae-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%; font-family: var(--ae-body); font-weight: 600; font-size: 15px; padding: 11px 18px; border-radius: 8px; cursor: pointer; border: none; transition: background .15s, color .15s; }
  .ae-btn--auto { width: auto; white-space: nowrap; }
  /* Scoped under .apa-entry so the label colour beats the '.apa-entry a { color: inherit }' reset. */
  .apa-entry .ae-btn--gold { background: var(--ae-gold); color: var(--ae-on-gold); }
  .apa-entry .ae-btn--gold:hover { background: var(--ae-gold-dark); color: var(--ae-on-gold); }
  .apa-entry .ae-btn--navy { background: var(--ae-navy); color: var(--ae-white); }
  .apa-entry .ae-btn--navy:hover { background: var(--ae-navy-dark); color: var(--ae-white); }
  .ae-door-help { margin-top: 12px; text-align: center; font-size: 13px; color: var(--ae-ink-muted); }
  .ae-door-help a { color: var(--ae-navy); font-weight: 600; text-decoration: underline; text-underline-offset: 3px; }

  .ae-pillars { padding: 70px 0 20px; }
  .ae-pillars-head { text-align: center; max-width: 640px; margin: 0 auto 40px; }
  .ae-section-label { font-size: 12px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; color: var(--ae-gold-dark); }
  .ae-pillars-head h2 { font-family: var(--ae-display); font-weight: 600; font-size: clamp(1.6rem, 3vw, 1.875rem); color: var(--ae-navy); margin-top: 10px; }
  .ae-pillars-head p { margin-top: 12px; color: var(--ae-ink-muted); font-size: 16px; }
  .ae-pillars-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
  .ae-pillar { background: var(--ae-white); border: 1px solid var(--ae-border); border-radius: 12px; padding: 26px 24px; }
  .ae-pillar-mark { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
  .ae-ico { width: 40px; height: 40px; border-radius: 10px; display: grid; place-items: center; background: rgba(70,87,120,0.08); color: var(--ae-navy); }
  .ae-pillar h4 { font-family: var(--ae-display); font-weight: 600; font-size: 18px; color: var(--ae-navy); }
  .ae-pillar p { color: var(--ae-ink-muted); font-size: 14.5px; }

  .ae-news { padding: 64px 0 78px; }
  .ae-news-card { background: linear-gradient(135deg, var(--ae-navy) 0%, var(--ae-navy-dark) 100%); border-radius: 16px; padding: 44px 48px; color: var(--ae-white); display: flex; align-items: center; justify-content: space-between; gap: 32px; flex-wrap: wrap; position: relative; overflow: hidden; }
  .ae-news-card::after { content: ""; position: absolute; inset: 0; background: radial-gradient(420px 220px at 92% 20%, rgba(228,183,68,0.18), transparent 70%); pointer-events: none; }
  .ae-news-copy { position: relative; z-index: 1; max-width: 52ch; }
  .ae-news-copy h3 { font-family: var(--ae-display); font-weight: 600; font-size: 24px; }
  .ae-news-copy p { margin-top: 8px; color: rgba(255,255,255,0.85); font-size: 15.5px; }
  .ae-news-form { position: relative; z-index: 1; display: flex; flex-direction: row; gap: 10px; }
  .ae-news-form input { font-family: var(--ae-body); font-size: 15px; padding: 12px 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.25); background: rgba(255,255,255,0.95); color: var(--ae-ink); width: 240px; }
  .ae-news-form input::placeholder { color: var(--ae-ink-muted); }

  .ae-footer { background: var(--ae-navy-dark); color: rgba(255,255,255,0.7); padding: 40px 0; }
  .ae-footer-inner { display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
  .ae-footer-links { display: flex; gap: 24px; flex-wrap: wrap; font-size: 14px; }
  .ae-footer-links a:hover { color: var(--ae-white); }
  .ae-footer-meta { font-size: 13px; color: rgba(255,255,255,0.5); }

  @media (max-width: 900px) {
    .ae-entry-grid, .ae-pillars-grid { grid-template-columns: 1fr; }
    .ae-nav a:not(.ae-topbar-cta) { display: none; }
    .ae-entry { margin-top: -48px; }
  }
  @media (max-width: 620px) {
    .ae-wrap { padding: 0 1.25rem; }
    .ae-hero { padding: 64px 0 96px; }
    .ae-news-card { padding: 32px 26px; }
    .ae-news-form { width: 100%; }
    .ae-news-form input { flex: 1; width: auto; }
  }
`
