import type { Metadata } from 'next'
import { WorkflowHero, FlowRail, StepCards, DetailFooter } from '../ui'

const title = '1-1 Leadership Workflow | Edge8'
const description =
  'A biweekly coaching cadence where AI prepares every meeting, a human runs it, and AI captures every commitment. Nothing gets forgotten between 1-1s.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/workflows/one-on-one/' },
  openGraph: { title, description, url: '/workflows/one-on-one/', type: 'website' },
  twitter: { card: 'summary_large_image', title, description },
}

const PROBLEMS = [
  'Preparation is inconsistent. Some 1-1s get thought, most get winged.',
  'Coaching questions are generic instead of tailored to the person.',
  'Commitments get made in the room and forgotten by Friday.',
  'There is no follow-up between meetings, so nothing compounds.',
  'Growth patterns only show up in hindsight, if at all.',
]

export default function OneOnOneWorkflowPage() {
  return (
    <main>
      <WorkflowHero
        category="Talent"
        title="1-1 Leadership Workflow"
        tldr="A biweekly cadence where AI prepares every meeting, a human runs it, and AI captures every commitment. Nothing gets forgotten between 1-1s."
        meta={[
          { label: 'Cadence', value: 'Biweekly' },
          { label: 'Human time', value: '1 meeting' },
          { label: 'AI touchpoints', value: '4 of 5 steps' },
        ]}
      />

      {/* The problem */}
      <section className="section" style={{ paddingBottom: 48 }}>
        <div className="container">
          <span className="section-label">The problem</span>
          <h2 className="section-title" style={{ fontSize: 34 }}>
            1-1s fail quietly
          </h2>
          <p className="section-sub" style={{ marginTop: 12 }}>
            Most leaders do not skip 1-1s. They just run them without a system, and five things slip through:
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

      {/* The visual cycle */}
      <section className="section" style={{ background: 'var(--tint)', padding: '72px 0' }}>
        <div className="container">
          <span className="section-label" style={{ background: 'var(--white)' }}>
            The cycle
          </span>
          <h2 className="section-title" style={{ fontSize: 34 }}>
            One two-week loop, five steps
          </h2>
          <FlowRail
            steps={[
              { num: '01', title: 'AI Prep', cadence: 'Friday', actor: 'ai' },
              { num: '02', title: 'The 1-1 Meeting', cadence: 'Wednesday', actor: 'human' },
              { num: '03', title: 'Summary & Commitments', cadence: 'Right after', actor: 'ai' },
              { num: '04', title: 'Mid-Cycle Check-in', cadence: 'Next Wednesday', actor: 'system' },
              { num: '05', title: 'Trend Analysis', cadence: 'Monthly', actor: 'ai' },
            ]}
            repeatNote="The loop repeats every two weeks. Trend analysis rolls up every month."
          />
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
                title: 'AI Prep',
                cadence: 'Friday before the meeting',
                actor: 'ai',
                body: (
                  <p>
                    The system reviews the last meeting&apos;s notes, the person&apos;s goals, and your coaching docs,
                    then drafts a tailored set of questions for this specific conversation. The prep lands as a doc you
                    can skim in two minutes.
                  </p>
                ),
              },
              {
                num: '02',
                title: 'The 1-1 Meeting',
                cadence: 'Wednesday',
                actor: 'human',
                body: (
                  <p>
                    The only step a human owns, on purpose. You run the coaching conversation using the AI-prepared
                    questions while the meeting records in the background. Your job is presence, not note-taking.
                  </p>
                ),
              },
              {
                num: '03',
                title: 'Summary & Commitments',
                cadence: 'Right after the meeting',
                actor: 'ai',
                body: (
                  <p>
                    AI transcribes the recording, writes a summary, and extracts every commitment made by either side
                    into a running commitment log. What was said becomes what was agreed.
                  </p>
                ),
              },
              {
                num: '04',
                title: 'Mid-Cycle Check-in',
                cadence: 'The Wednesday in between',
                actor: 'system',
                body: (
                  <p>
                    Halfway through the cycle, an automated nudge checks progress on open commitments. Small course
                    corrections happen in week one instead of surfacing as surprises in the next 1-1.
                  </p>
                ),
              },
              {
                num: '05',
                title: 'Trend Analysis',
                cadence: 'Monthly',
                actor: 'ai',
                body: (
                  <p>
                    Once a month, the system looks across the full history: growth trajectory, recurring themes,
                    follow-through rate, and how this quarter compares to the last. Patterns you would never catch
                    meeting to meeting.
                  </p>
                ),
              },
            ]}
          />
        </div>
      </section>

      {/* Inputs and outputs */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="wf-info-grid">
            <div className="wf-info-card">
              <h3>What feeds the system</h3>
              <ul>
                <li>Your leadership brand and coaching profile</li>
                <li>Your emotional intelligence and communication style guides</li>
                <li>A profile and OKRs for each direct report</li>
                <li>Every prior meeting note and recording</li>
              </ul>
            </div>
            <div className="wf-info-card wf-info-card-mint">
              <h3>What it produces</h3>
              <ul>
                <li>A tailored prep doc before every 1-1</li>
                <li>A meeting summary and commitment log after every 1-1</li>
                <li>Mid-cycle check-in updates on open commitments</li>
                <li>Monthly trend reports: growth, themes, follow-through, quarter over quarter</li>
              </ul>
            </div>
          </div>
          <DetailFooter />
        </div>
      </section>
    </main>
  )
}
