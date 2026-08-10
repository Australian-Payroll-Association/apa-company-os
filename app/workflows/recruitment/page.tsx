import type { Metadata } from 'next'
import { WorkflowHero, FlowRail, StepCards, SevenElements, DetailFooter, type WorkflowElement } from '../ui'

const ELEMENTS: WorkflowElement[] = [
  { name: 'Trigger', assignment: 'both', desc: 'No single trigger. A role opening, a strong inbound resume, a referral, or a pool resurfacing can each start motion — and usually several are running at once.' },
  { name: 'Inputs', assignment: 'both', desc: 'The JD and screening questions, resumes from every channel (careers page, LinkedIn, referrals, agencies, batch drops), and the full history of everyone the company has already met.' },
  { name: 'Decision', assignment: 'both', desc: 'Two independent gates per candidate — the AI screen with written reasoning and the recruiter’s rating — plus explicit human decisions at every exit and every backward move.' },
  { name: 'Routing', assignment: 'both', desc: 'Not forward-only. Candidates move back a stage for another round, return to the shortlist after a declined offer, or exit to the pool and re-enter months later on a different req.' },
  { name: 'Output', assignment: 'machine', desc: 'A living record per candidate: every application, every screen, both ratings, the notes thread, and every status change with its reason.' },
  { name: 'Delivery', assignment: 'machine', desc: 'Ranked, sortable views wherever the work happens: per req, per role family, and across the whole pool.' },
  { name: 'Measurement', assignment: 'machine', desc: 'Conversion inside each loop, AI-vs-recruiter disagreement, time from open req to hire, and how often the pool — not a job board — fills the role.' },
]

const title = 'Recruitment: Three Loops, One Pool | Edge8 Workflows'
const description =
  'Our recruitment process is not a pipeline. Three loops run continuously — demand, sourcing, and selection — around one candidate pool that never forgets. Backward moves are normal, and every exit is a pool entry.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/workflows/recruitment/' },
  openGraph: { title, description, url: '/workflows/recruitment/', type: 'website' },
  twitter: { card: 'summary_large_image', title, description },
}

const PROBLEMS = [
  'Hiring gets documented as a straight line — post, screen, interview, offer. It never runs as one, so the diagram and the reality drift apart until the diagram is fiction.',
  'Resumes arrive by email, LinkedIn, referral, and agency, and half never get a reply. Nobody can say where a candidate stands without asking whoever owns the folder.',
  'Screening quality depends on who reads the pile and when. The 200th resume never gets the read the 5th did.',
  'A declined offer, a paused req, or a near-miss candidate has no path in a linear process — so the work that went into them is simply lost.',
]

const loopCard: React.CSSProperties = {
  background: 'var(--white)',
  border: '1px solid rgba(15, 23, 42, 0.1)',
  borderRadius: 14,
  padding: '20px 22px',
}

export default function RecruitmentWorkflowPage() {
  return (
    <main>
      <WorkflowHero
        category="Talent"
        title="Recruitment: Three Loops, One Pool"
        tldr="Our recruitment process is not a pipeline, because almost no real process is. Three loops run continuously — demand (roles open, pause, reopen, close), sourcing (always on, across every channel), and selection (screen, interview as many rounds as it takes, offer) — all orbiting one candidate pool that never forgets. Candidates move backward as often as forward, and every exit from any loop is an entry into the pool."
        meta={[
          { label: 'Shape', value: '3 loops, 1 pool' },
          { label: 'Sourcing', value: 'Always on' },
          { label: 'AI reads', value: '100% of resumes' },
        ]}
      />

      {/* The problem */}
      <section className="section" style={{ paddingBottom: 48 }}>
        <div className="container">
          <span className="section-label">The problem</span>
          <h2 className="section-title" style={{ fontSize: 34 }}>
            Hiring is drawn as a line and lived as a loop
          </h2>
          <p className="section-sub" style={{ marginTop: 12 }}>
            Most hiring processes fail in the gap between the tidy diagram and the messy reality:
          </p>
          <div className="wf-problems">
            {PROBLEMS.map((p) => (
              <div key={p} className="wf-problem">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="13" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {p}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The shape */}
      <section className="section" style={{ background: 'var(--tint)', padding: '72px 0' }}>
        <div className="container">
          <span className="section-label" style={{ background: 'var(--white)' }}>
            The shape
          </span>
          <h2 className="section-title" style={{ fontSize: 34 }}>
            Three loops orbiting one pool
          </h2>
          <p className="section-sub" style={{ marginTop: 12 }}>
            Each loop runs on its own clock. None of them waits for the others, and all of them read from and write to
            the same candidate pool.
          </p>

          <div style={{ maxWidth: 900, margin: '40px auto 0' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              <div style={loopCard}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>⟳ Demand loop</div>
                <div style={{ fontSize: 14, opacity: 0.85 }}>
                  Roles open, pause, reopen, change shape mid-search, and close. Closing a req never discards its
                  candidates.
                </div>
              </div>
              <div style={loopCard}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>⟳ Sourcing loop</div>
                <div style={{ fontSize: 14, opacity: 0.85 }}>
                  Always on: inbound, LinkedIn, referrals, agencies, batch drops — and resurfacing people we already
                  know.
                </div>
              </div>
              <div style={loopCard}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>⟳ Selection loop</div>
                <div style={{ fontSize: 14, opacity: 0.85 }}>
                  AI screen, screening call, as many interview rounds as the role needs, offer. Backward moves are
                  normal.
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'center', fontSize: 22, padding: '10px 0', opacity: 0.6 }}>⇅ ⇅ ⇅</div>
            <div style={{ ...loopCard, textAlign: 'center', borderWidth: 2 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>The Candidate Pool</div>
              <div style={{ fontSize: 14, opacity: 0.85 }}>
                Everyone we have ever met — hired, rejected, parked, withdrawn — ranked by AI screen, grouped by role
                family, searchable forever. Every loop exits into it; the sourcing loop draws from it.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Loop 1: Demand */}
      <section className="section">
        <div className="container">
          <span className="section-label">Loop 1 · Demand</span>
          <h2 className="section-title" style={{ fontSize: 34 }}>
            Roles churn, the system keeps up
          </h2>
          <FlowRail
            steps={[
              { num: 'D1', title: 'Open the Req', cadence: 'One click', actor: 'human', actorLabel: 'Recruiter' },
              { num: 'D2', title: 'Publish the Posting', cadence: 'When ready', actor: 'human', actorLabel: 'Recruiter' },
              { num: 'D3', title: 'Pause / Reshape', cadence: 'As business shifts', actor: 'human', actorLabel: 'Recruiter' },
              { num: 'D4', title: 'Close or Reopen', cadence: 'Filled · closed · cancelled', actor: 'human', actorLabel: 'Recruiter' },
            ]}
            repeatNote="Reqs reopen when demand returns — with their full applicant history intact."
          />
          <StepCards
            steps={[
              {
                num: 'D1',
                title: 'Open the req — the pipeline builds itself',
                cadence: 'One click',
                actor: 'human',
                actorLabel: 'Recruiter',
                body: (
                  <p>
                    A recruiter creates the requisition from the Job Reqs list: title, employment type, location, remote
                    policy, salary band. The system seeds the same five-stage board every role uses — Screen, Interview,
                    Offer, Hired, Rejected — so no two roles ever run subtly different processes. The req opens for
                    hiring immediately but stays off the public site until the posting is ready.
                  </p>
                ),
              },
              {
                num: 'D2',
                title: 'Publish — or don’t',
                cadence: 'When the JD is ready',
                actor: 'human',
                actorLabel: 'Recruiter',
                body: (
                  <p>
                    The public posting is written in markdown on the req itself: the JD, a clean URL, and up to three
                    screening questions. Flipping it public puts it on the careers page. Some roles never publish at all
                    and are filled entirely from sourcing and the pool — the posting is one door among several, not the
                    process.
                  </p>
                ),
              },
              {
                num: 'D3',
                title: 'Reqs pause, reshape, and change mid-search',
                cadence: 'Reality',
                actor: 'human',
                actorLabel: 'Recruiter',
                body: (
                  <p>
                    Budgets move, priorities shift, and the role you started hiring for is not always the role you
                    finish hiring for. A req can go on hold and come back; its JD, salary band, and screening questions
                    can be edited mid-search. Candidates in flight keep their history through every change — nothing
                    resets because the role evolved.
                  </p>
                ),
              },
              {
                num: 'D4',
                title: 'Closing a req is not the end of its candidates',
                cadence: 'Filled, closed, or cancelled',
                actor: 'human',
                actorLabel: 'Recruiter',
                body: (
                  <p>
                    Every close records an outcome — filled, closed without hire, or cancelled — and takes the role off
                    the careers page automatically. The candidates in flight do not vanish: they exit into the pool with
                    their screens, ratings, and notes attached, and the strong ones surface first when a similar req
                    opens. Reopening a req picks up exactly where it left off.
                  </p>
                ),
              },
            ]}
          />
        </div>
      </section>

      {/* Loop 2: Sourcing */}
      <section className="section" style={{ background: 'var(--tint)', padding: '72px 0' }}>
        <div className="container">
          <span className="section-label" style={{ background: 'var(--white)' }}>
            Loop 2 · Sourcing
          </span>
          <h2 className="section-title" style={{ fontSize: 34 }}>
            Always on, across every channel
          </h2>
          <FlowRail
            steps={[
              { num: 'S1', title: 'Inbound', cadence: 'Careers page', actor: 'contractor', actorLabel: 'Candidate' },
              { num: 'S2', title: 'Outbound + Referrals', cadence: 'Continuous', actor: 'human', actorLabel: 'Recruiter' },
              { num: 'S3', title: 'Agencies', cadence: 'Per engagement', actor: 'contractor', actorLabel: 'Agency' },
              { num: 'S4', title: 'Batch Drop', cadence: 'Up to 25 resumes', actor: 'ai', actorLabel: 'Claude' },
              { num: 'S5', title: 'Pool Resurfacing', cadence: 'Every new req', actor: 'system' },
            ]}
            repeatNote="Sourcing never stops when a role is filled — the loop keeps feeding the pool for the next one."
          />
          <StepCards
            steps={[
              {
                num: 'S1',
                title: 'Inbound from the careers page',
                cadence: 'Whenever candidates apply',
                actor: 'contractor',
                actorLabel: 'Candidate',
                body: (
                  <p>
                    A candidate applies with a resume, cover letter, and answers to the role’s screening questions. The
                    application lands in the talent system attached to the req — no inbox, no forwarding, no resume
                    that only exists in one person’s email.
                  </p>
                ),
              },
              {
                num: 'S2',
                title: 'Outbound, referrals, and everything in between',
                cadence: 'Continuous',
                actor: 'human',
                actorLabel: 'Recruiter',
                body: (
                  <p>
                    LinkedIn sourcing, team referrals, event contacts, and agency submissions all run in parallel with
                    inbound — sourcing is a standing activity, not a burst that starts when a req opens. Every channel
                    is tagged at intake (sourced, referral, agency, LinkedIn, job board, event), so the system can later
                    answer which channels actually produce hires.
                  </p>
                ),
              },
              {
                num: 'S3',
                title: 'Agencies feed the same funnel',
                cadence: 'Per engagement',
                actor: 'contractor',
                actorLabel: 'Agency',
                body: (
                  <p>
                    Agency candidates enter through the same doors and get the same treatment as everyone else: the same
                    AI screen, the same two gates, the same record. No parallel spreadsheet process for agency
                    submissions — one system of record regardless of who found the person.
                  </p>
                ),
              },
              {
                num: 'S4',
                title: 'The batch drop: 25 resumes at a time',
                cadence: 'AI prefill, human review',
                actor: 'ai',
                actorLabel: 'Claude',
                body: (
                  <p>
                    Sourced resumes arrive in bulk: a recruiter drops up to 25 files at once and AI reads each one,
                    prefilling a draft — name, email, phone, LinkedIn, headline, current title. The recruiter reviews
                    and saves each draft. Ten minutes of drag-and-drop replaces an afternoon of data entry, and
                    duplicates are impossible by construction: candidates are keyed by email, one application per person
                    per role, and re-adding someone surfaces their existing record instead of creating a second.
                  </p>
                ),
              },
              {
                num: 'S5',
                title: 'The pool is a sourcing channel',
                cadence: 'First stop for every new req',
                actor: 'system',
                body: (
                  <p>
                    When a req opens, sourcing starts from everyone the company has already met — the pool is ranked by
                    best AI screen and grouped by role family, so last quarter’s strong runner-up surfaces at the top of
                    this quarter’s search with full history attached. The cheapest candidate to find is the one you
                    already found.
                  </p>
                ),
              },
            ]}
          />
        </div>
      </section>

      {/* Loop 3: Selection */}
      <section className="section">
        <div className="container">
          <span className="section-label">Loop 3 · Selection</span>
          <h2 className="section-title" style={{ fontSize: 34 }}>
            Screen, interview, offer — with reverse gear
          </h2>
          <FlowRail
            steps={[
              { num: 'C1', title: 'AI Screen', cadence: 'On arrival', actor: 'ai', actorLabel: 'Claude' },
              { num: 'C2', title: 'Two Gates', cadence: 'AI + recruiter', actor: 'human', actorLabel: 'Recruiter' },
              { num: 'C3', title: 'Screening Call', cadence: 'Recruiter call', actor: 'human', actorLabel: 'Recruiter' },
              { num: 'C4', title: 'Interview Rounds', cadence: 'As many as needed', actor: 'human', actorLabel: 'Hiring team' },
              { num: 'C5', title: 'Offer', cadence: 'Negotiated', actor: 'human', actorLabel: 'Hiring team' },
            ]}
            repeatNote="Backward is a normal direction: another round, back a stage, or back to the shortlist after a declined offer."
          />
          <StepCards
            steps={[
              {
                num: 'C1',
                title: 'AI reads and scores every resume',
                cadence: 'Automatic, on arrival from any channel',
                actor: 'ai',
                actorLabel: 'Claude',
                body: (
                  <>
                    <p>
                      The moment an application lands — from any door — Claude reads the full resume against the JD and
                      writes a structured screen: a 0–5 fit rating, an overview, concrete strengths and gaps, an
                      English-proficiency read, and the salary expectation and notice period exactly as stated, never
                      guessed. Every application gets the same depth of read whether it arrived first or five
                      hundredth.
                    </p>
                    <p>
                      Scored candidates also stack-rank within their role family, not just the single job they applied
                      to — a strong engineer who applied to the wrong opening still surfaces near the top of the
                      engineering family.
                    </p>
                  </>
                ),
              },
              {
                num: 'C2',
                title: 'Two independent gates, sorted either way',
                cadence: 'AI score + recruiter rating',
                actor: 'human',
                actorLabel: 'Recruiter',
                body: (
                  <p>
                    Every application carries the AI’s score with its written reasoning and the recruiter’s own star
                    rating, side by side. Neither silently overrides the other. Candidates strong on both gates move
                    forward; where the gates disagree is exactly where a second human look goes instead of a quiet
                    rejection. Nobody is rejected by AI alone.
                  </p>
                ),
              },
              {
                num: 'C3',
                title: 'The screening call',
                cadence: 'Short recruiter call',
                actor: 'human',
                actorLabel: 'Recruiter',
                body: (
                  <p>
                    Before any formal interview, a recruiter talks to the candidate: motivation, expectations, notice
                    period, the things a resume can’t say. What the call surfaces goes into the application’s notes
                    thread, on the record — and plenty of candidates loop back to the pool here as
                    good-person-wrong-role rather than continuing.
                  </p>
                ),
              },
              {
                num: 'C4',
                title: 'Interview rounds — as many as the role needs',
                cadence: 'One to several, sometimes repeated',
                actor: 'human',
                actorLabel: 'Hiring team',
                body: (
                  <>
                    <p>
                      Interviews are not a fixed count. A senior role may take three rounds and a follow-up with a
                      different interviewer; a junior role may take one. Candidates move back a stage for an extra
                      conversation when the panel is split, and that backward move is recorded like any other — no
                      side-channel “can you talk to her once more” that the system never sees.
                    </p>
                    <p>
                      All working context lives on the application: the notes thread, the resume (replaceable when a
                      better version arrives), the cover letter and answers, both ratings, and the stage history.
                      Anyone on the team can open it and know exactly where things stand.
                    </p>
                  </>
                ),
              },
              {
                num: 'C5',
                title: 'Offer — and what happens when it’s declined',
                cadence: 'Negotiated, sometimes lost',
                actor: 'human',
                actorLabel: 'Hiring team',
                body: (
                  <>
                    <p>
                      Offers get negotiated, and offers get declined. A declined offer sends the search back to the
                      shortlist — which is still ranked, still warm, and still in the system — not back to square one.
                      A hire flips the application status and hands off to the{' '}
                      <a href="/workflows/new-member-onboarding/">New Member Onboarding workflow</a>, which turns the
                      applicant record into an employee record without re-typing anything.
                    </p>
                    <p>
                      Either way, the loop closes with an explicit status and a recorded reason. Nobody is left in
                      limbo, and no outcome is silent.
                    </p>
                  </>
                ),
              },
            ]}
          />
        </div>
      </section>

      {/* Every exit is a pool entry */}
      <section className="section" style={{ background: 'var(--tint)', padding: '72px 0' }}>
        <div className="container">
          <span className="section-label" style={{ background: 'var(--white)' }}>
            The hub
          </span>
          <h2 className="section-title" style={{ fontSize: 34 }}>
            Every exit is a pool entry
          </h2>
          <p className="section-sub" style={{ marginTop: 12 }}>
            “Rejected” is a status, not a deletion. Every way out of the three loops lands in the pool with full
            history:
          </p>
          <div className="wf-info-grid" style={{ marginTop: 32 }}>
            <div className="wf-info-card">
              <h3>The ways out</h3>
              <ul>
                <li>Rejected — always with a recorded reason</li>
                <li>Withdrew — candidates change their minds; the door stays open</li>
                <li>Future consideration — right person, wrong timing, parked deliberately</li>
                <li>On hold / passive — in flight but paused, usually with the req</li>
                <li>Hired — off to onboarding, still on the record</li>
              </ul>
            </div>
            <div className="wf-info-card wf-info-card-mint">
              <h3>What the pool does with them</h3>
              <ul>
                <li>Ranks everyone by their best AI screen, across every application</li>
                <li>Groups by role family so the next search starts pre-sorted</li>
                <li>Keeps every screen, rating, and note attached to the person</li>
                <li>Feeds the sourcing loop: resurfaced candidates skip the cold start</li>
                <li>Honors a do-not-hire flag where the decision is final</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Why it works */}
      <section className="section">
        <div className="container">
          <SevenElements elements={ELEMENTS} />
          <div className="wf-info-grid">
            <div className="wf-info-card">
              <h3>The standing rules</h3>
              <ul>
                <li>Every role runs the identical five-stage board — the loops vary, the record doesn’t</li>
                <li>Every door produces the same structured record, agency or inbound alike</li>
                <li>Every resume is read in full by AI on arrival</li>
                <li>Backward is a normal direction, and every move is on the record</li>
                <li>No candidate is rejected by AI alone, and every exit has a recorded reason</li>
                <li>Closing a req never discards its candidates; nothing is ever deleted</li>
              </ul>
            </div>
            <div className="wf-info-card wf-info-card-mint">
              <h3>Why it works</h3>
              <ul>
                <li>The documented process matches the lived one, so people actually keep the system true</li>
                <li>One system of record ends the where-does-this-candidate-stand question</li>
                <li>Always-on sourcing means a new req starts warm, not cold</li>
                <li>Two independent gates catch what either one alone would miss</li>
                <li>The pool compounds: every search makes the next one faster</li>
                <li>Declined offers and paused reqs cost days, not restarts</li>
              </ul>
            </div>
          </div>
          <DetailFooter />
        </div>
      </section>
    </main>
  )
}
