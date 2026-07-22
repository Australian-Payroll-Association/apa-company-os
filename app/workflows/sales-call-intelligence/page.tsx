import type { Metadata } from 'next'
import Link from 'next/link'
import { WorkflowHero, FlowRail, StepCards, SevenElements, DetailFooter, type WorkflowElement } from '../ui'

const title = 'Sales Call Intelligence | Edge8 Workflows'
const description =
  'Every discovery and closing call is classified from the Lark transcript, structured into the CRM as JSON, summarized for the client and the rep, and rolled up monthly for the sales manager. The deal moves stage on the outcome.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/workflows/sales-call-intelligence/' },
  openGraph: { title, description, url: '/workflows/sales-call-intelligence/', type: 'website' },
  twitter: { card: 'summary_large_image', title, description },
}

const ELEMENTS: WorkflowElement[] = [
  { name: 'Trigger', assignment: 'machine', desc: 'A meeting transcript arrives from Lark. Every recorded meeting enters the pipe; the classifier sorts them.' },
  { name: 'Inputs', assignment: 'machine', desc: 'The full transcript, the deal and its current stage, the person’s GPCT qualification, and prior call history.' },
  { name: 'Decision', assignment: 'both', desc: 'AI classifies the call, extracts the outcome, and moves the stage by rule. The rep reviews and can override; overrides are logged.' },
  { name: 'Routing', assignment: 'machine', desc: 'Sales calls flow to extraction; non-sales calls are skipped. Stage moves append to the lifecycle transition log.' },
  { name: 'Output', assignment: 'machine', desc: 'Structured JSON in the CRM, a client-facing recap, an internal rep summary, and a monthly manager rollup.' },
  { name: 'Delivery', assignment: 'machine', desc: 'The recap goes to the client and the rep the same day. The rollup reaches the manager on the 1st.' },
  { name: 'Measurement', assignment: 'machine', desc: 'Conversion per stage arrow, straight from the transition log. The funnel math Roberge coaches from.' },
]

const STAGE_RULES = [
  {
    outcome: 'First substantive conversation held',
    stage: 'Move to Discovery',
    kind: 'approve' as const,
    desc: 'The prospect engaged in a real qualification conversation. The deal advances from Contacted.',
  },
  {
    outcome: 'Qualification complete, proposal agreed',
    stage: 'Move to Proposal',
    kind: 'approve' as const,
    desc: 'GPCT is captured and the prospect asked to see a proposal. The deal advances with the proposal date as its next step.',
  },
  {
    outcome: 'Verbal yes, terms agreed',
    stage: 'Move to Won',
    kind: 'approve' as const,
    desc: 'Closing call succeeded. The deal wins with an enumerated outcome, and the person becomes a customer.',
  },
  {
    outcome: 'Explicit no, or disqualified',
    stage: 'Move to Lost',
    kind: 'reject' as const,
    desc: 'No budget, no timeline, or a direct no. The deal closes with an enumerated lost reason, never a shrug.',
  },
  {
    outcome: 'More work needed at this stage',
    stage: 'Stays, with a dated next step',
    kind: 'info' as const,
    desc: 'A second discovery call, a revised proposal. The stage holds, but the call must produce a next step with a date. No zombie deals.',
  },
]

export default function SalesCallIntelligenceWorkflowPage() {
  return (
    <main>
      <WorkflowHero
        category="Revenue"
        title="Sales Call Intelligence"
        tldr="Every discovery and closing call is classified from the Lark transcript, structured into the CRM as JSON, and summarized twice: a recap for the client and the rep the same day, a rollup for the sales manager monthly. And the deal always moves: the outcome of the conversation decides the stage."
        meta={[
          { label: 'Source', value: 'Lark transcripts' },
          { label: 'Framework', value: 'Sales Acceleration Formula' },
          { label: 'Stage moves', value: 'Every call' },
        ]}
      />

      {/* The flow */}
      <section className="section" style={{ paddingBottom: 48 }}>
        <div className="container">
          <span className="section-label">The flow</span>
          <h2 className="section-title" style={{ fontSize: 34 }}>
            From transcript to stage move
          </h2>
          <p className="section-sub" style={{ marginTop: 12 }}>
            Salespeople sell. The system listens, writes everything down, updates the CRM, and tells everyone who needs
            to know. The rep&apos;s only admin job is reviewing what the machine already did.
          </p>
          <FlowRail
            steps={[
              { num: '01', title: 'The Call Happens', cadence: 'Recorded in Lark', actor: 'human', actorLabel: 'Salesperson' },
              { num: '02', title: 'Transcript Lands', cadence: 'Automatic', actor: 'system' },
              { num: '03', title: 'Classify: Sales?', cadence: 'AI gate', actor: 'ai', actorLabel: 'Claude' },
              { num: '04', title: 'Extract to JSON', cadence: 'Into the CRM', actor: 'ai', actorLabel: 'Claude' },
              { num: '05', title: 'Move the Stage', cadence: 'By outcome', actor: 'ai', actorLabel: 'Claude' },
              { num: '06', title: 'Send the Recaps', cadence: 'Same day', actor: 'system' },
              { num: '07', title: 'Manager Rollup', cadence: '1st of month', actor: 'system' },
            ]}
          />
          <div className="wf-loop-note">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span>
              The classifier is the gate: internal meetings, coaching sessions, and project calls are skipped. Only
              genuine sales conversations flow into the CRM, so the pipeline never fills with noise.
            </span>
          </div>
        </div>
      </section>

      {/* Stage decision rules */}
      <section className="section" style={{ background: 'var(--tint)', padding: '72px 0' }}>
        <div className="container">
          <span className="section-label" style={{ background: 'var(--white)' }}>
            The stage decision
          </span>
          <h2 className="section-title" style={{ fontSize: 34 }}>
            The outcome decides the stage
          </h2>
          <p className="section-sub" style={{ marginTop: 12 }}>
            Our pipeline runs New, Contacted, Discovery, Proposal, Contract Sent, then Won or Lost. After every call, the extracted
            outcome maps to a stage decision by rule. Every move appends to the lifecycle transition log, so the funnel
            math is always real.
          </p>
          <div className="wf-elements">
            {STAGE_RULES.map((r) => (
              <div key={r.outcome} className="wf-element">
                <div className="wf-element-head">
                  <span className="wf-element-name">{r.outcome}</span>
                </div>
                <div className="wf-outcomes" style={{ marginTop: 0, marginBottom: 10 }}>
                  <span className={`wf-outcome wf-outcome-${r.kind}`}>{r.stage}</span>
                </div>
                <p className="wf-element-desc">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Step detail */}
      <section className="section">
        <div className="container">
          <span className="section-label">Step by step</span>
          <h2 className="section-title" style={{ fontSize: 34 }}>
            How each step works
          </h2>
          <StepCards
            steps={[
              {
                num: '01',
                title: 'The call happens',
                actor: 'human',
                actorLabel: 'Salesperson',
                body: (
                  <p>
                    A discovery or closing call runs on Lark and gets recorded. The rep&apos;s job on the call is the
                    conversation: qualifying with GPCT, handling objections, asking for the close. Not note-taking.
                  </p>
                ),
              },
              {
                num: '02',
                title: 'The transcript lands',
                actor: 'system',
                body: (
                  <p>
                    The meeting transcript syncs from Lark into the system, keyed by its external id so the same
                    meeting can never be ingested twice.
                  </p>
                ),
              },
              {
                num: '03',
                title: 'AI classifies the call',
                actor: 'ai',
                actorLabel: 'Claude',
                body: (
                  <p>
                    Claude reads the transcript and answers one question first: is this a sales conversation? Internal
                    standups, client delivery calls, and coaching sessions are skipped. Sales calls are further typed
                    as discovery or closing, which shapes what gets extracted next.
                  </p>
                ),
              },
              {
                num: '04',
                title: 'The conversation becomes structured JSON',
                actor: 'ai',
                actorLabel: 'Claude',
                body: (
                  <>
                    <p>The transcript is distilled into a structured record that inserts straight into the CRM:</p>
                    <ul>
                      <li>GPCT qualification: goals, plans, challenges, timeline, plus budget and authority signals</li>
                      <li>Objections raised and how they were handled</li>
                      <li>Commitments made by each side</li>
                      <li>The outcome of the call and the agreed next step, with a date</li>
                    </ul>
                    <p style={{ marginTop: 10 }}>
                      The CRM gets updated by the system, not by rep discipline. That is the difference between a CRM
                      that is true and a CRM that is aspirational.
                    </p>
                  </>
                ),
              },
              {
                num: '05',
                title: 'The deal moves stage',
                actor: 'ai',
                actorLabel: 'Claude',
                body: (
                  <p>
                    The extracted outcome maps to a stage decision using the rules above. Wins and losses always carry
                    an enumerated reason, every move is appended to the transition log, and a call that holds its stage
                    must still produce a dated next step. The rep reviews the move and can override it; overrides are
                    logged too, because they are signal about the rules.
                  </p>
                ),
              },
              {
                num: '06',
                title: 'Two recaps go out the same day',
                actor: 'system',
                body: (
                  <>
                    <p>The same conversation produces two different documents:</p>
                    <ul>
                      <li>
                        <strong>Client recap</strong>: what was discussed, what was agreed, and the next step. Sent to
                        the client while the conversation is still warm.
                      </li>
                      <li>
                        <strong>Rep summary</strong>: the internal view, including objections, risks, and the
                        qualification gaps still open.
                      </li>
                    </ul>
                  </>
                ),
              },
              {
                num: '07',
                title: 'The manager gets the monthly picture',
                cadence: '1st of the month',
                actor: 'system',
                body: (
                  <p>
                    On the 1st, the system rolls the month up for the sales manager: calls per rep, stage conversion
                    per funnel arrow, win and loss reasons, recurring objections, and where qualification keeps
                    stalling. This is the Sales Acceleration Formula in practice: coaching from metrics, not from
                    anecdotes.
                  </p>
                ),
              },
            ]}
          />
        </div>
      </section>

      {/* Anatomy + rules */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <SevenElements elements={ELEMENTS} />
          <div className="wf-info-grid">
            <div className="wf-info-card">
              <h3>The standing rules</h3>
              <ul>
                <li>Every sales call is recorded, classified, and extracted, no exceptions</li>
                <li>The CRM is written by the system; reps review instead of retype</li>
                <li>Every call moves the deal or stamps a dated next step, never neither</li>
                <li>Wins and losses always carry an enumerated reason</li>
                <li>Stage moves append to the transition log, so funnel math stays honest</li>
              </ul>
            </div>
            <div className="wf-info-card wf-info-card-mint">
              <h3>Why it works</h3>
              <ul>
                <li>Reps sell more because the admin happens to them, not by them</li>
                <li>Same-day client recaps compound trust while the call is still warm</li>
                <li>A system-written CRM makes the forecast believable</li>
                <li>Managers coach from conversion data per stage, the Roberge way</li>
                <li>Override tracking tunes the stage rules instead of eroding them</li>
              </ul>
            </div>
          </div>
          <p style={{ marginTop: 32, fontSize: 15, color: 'var(--body-text)' }}>
            This workflow runs on the sales process from Mark Roberge&apos;s Sales Acceleration Formula: GPCT
            qualification, enumerated outcomes, and metrics-driven coaching. It feeds the same pipeline as{' '}
            <Link href="/workflows/lead-capture" style={{ color: 'var(--blue)' }}>
              Lead Capture to CRM
            </Link>
            .
          </p>
          <DetailFooter />
        </div>
      </section>
    </main>
  )
}
