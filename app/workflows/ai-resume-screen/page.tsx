import type { Metadata } from 'next'
import { WorkflowHero, FlowRail, StepCards, SevenElements, DetailFooter, type WorkflowElement } from '../ui'

const ELEMENTS: WorkflowElement[] = [
  { name: 'Trigger', assignment: 'machine', desc: 'An application submitted on the careers page lands in the talent system attached to its job req.' },
  { name: 'Inputs', assignment: 'machine', desc: 'The full resume and the job description. Every candidate is read against the same spec.' },
  { name: 'Decision', assignment: 'both', desc: 'Two independent ratings: the AI score with written reasoning, and the recruiter’s human rating beside it.' },
  { name: 'Routing', assignment: 'both', desc: 'Candidates rank within their role family; where the two gates agree, they route to the shortlist.' },
  { name: 'Output', assignment: 'machine', desc: 'A structured assessment per candidate: score, reasoning, strengths, and gaps.' },
  { name: 'Delivery', assignment: 'machine', desc: 'A ranked, sortable list in the admin, ready the moment a recruiter opens the req.' },
  { name: 'Measurement', assignment: 'machine', desc: 'Pipeline conversion and where the AI and recruiter gates disagree, the signal that tunes both.' },
]

const title = 'AI Resume Screen + Talent Rank | Edge8 Workflows'
const description =
  'Every application is read and scored by AI, stack-ranked per role family, then rated by a human recruiter. Two gates, no resume unread.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/workflows/ai-resume-screen/' },
  openGraph: { title, description, url: '/workflows/ai-resume-screen/', type: 'website' },
  twitter: { card: 'summary_large_image', title, description },
}

const PROBLEMS = [
  'High-volume roles bury great candidates under hundreds of resumes.',
  'Screeners skim. The 200th resume never gets the attention the 5th did.',
  'Every screener ranks differently, so shortlists depend on who read the pile.',
  'Strong candidates for a different role than they applied to get lost entirely.',
]

export default function AiResumeScreenWorkflowPage() {
  return (
    <main>
      <WorkflowHero
        category="Talent"
        title="AI Resume Screen + Talent Rank"
        tldr="Every application is read in full and scored by AI against the job description, stack-ranked per role family, then rated by a human recruiter. Two independent gates, and no resume goes unread."
        meta={[
          { label: 'AI reads', value: '100% of resumes' },
          { label: 'Gates', value: 'AI + recruiter' },
          { label: 'Ranking', value: 'Per role family' },
        ]}
      />

      {/* The problem */}
      <section className="section" style={{ paddingBottom: 48 }}>
        <div className="container">
          <span className="section-label">The problem</span>
          <h2 className="section-title" style={{ fontSize: 34 }}>
            Screening breaks at volume
          </h2>
          <p className="section-sub" style={{ marginTop: 12 }}>
            Resume screening is the highest-leverage, lowest-consistency step in hiring:
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

      {/* The flow */}
      <section className="section" style={{ background: 'var(--tint)', padding: '72px 0' }}>
        <div className="container">
          <span className="section-label" style={{ background: 'var(--white)' }}>
            The flow
          </span>
          <h2 className="section-title" style={{ fontSize: 34 }}>
            From application to shortlist
          </h2>
          <FlowRail
            steps={[
              { num: '01', title: 'Application', cadence: 'Careers page', actor: 'contractor', actorLabel: 'Candidate' },
              { num: '02', title: 'AI Screen', cadence: 'Automatic', actor: 'ai', actorLabel: 'Claude' },
              { num: '03', title: 'Stack Rank', cadence: 'Automatic', actor: 'ai', actorLabel: 'Claude' },
              { num: '04', title: 'Recruiter Rating', cadence: 'Human review', actor: 'human', actorLabel: 'Recruiter' },
              { num: '05', title: 'Shortlist', cadence: 'Two gates agree', actor: 'human' },
              { num: '06', title: 'Interview', cadence: 'Humans only', actor: 'human' },
            ]}
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
                title: 'Application comes in',
                cadence: 'Public careers page',
                actor: 'contractor',
                actorLabel: 'Candidate',
                body: (
                  <p>
                    Open roles are published on the careers page. A candidate applies with their resume, and the
                    application lands directly in the talent system attached to that job requisition. No inbox, no
                    forwarding.
                  </p>
                ),
              },
              {
                num: '02',
                title: 'AI reads and scores the resume',
                cadence: 'Automatic, on arrival',
                actor: 'ai',
                actorLabel: 'Claude',
                body: (
                  <p>
                    Claude reads the full resume against the job description and writes a structured assessment: a
                    score, the reasoning behind it, and the strengths and gaps it found. Every application gets the
                    same depth of read, whether it arrived first or five hundredth.
                  </p>
                ),
              },
              {
                num: '03',
                title: 'Candidates stack-rank per role family',
                cadence: 'Automatic',
                actor: 'ai',
                actorLabel: 'Claude',
                body: (
                  <p>
                    Scored candidates are stack-ranked within their role family, not just within the single job they
                    applied to. A strong engineer who applied to the wrong opening still surfaces near the top of the
                    engineering family.
                  </p>
                ),
              },
              {
                num: '04',
                title: 'Recruiter adds a human rating',
                cadence: 'Human review',
                actor: 'human',
                actorLabel: 'Recruiter',
                body: (
                  <p>
                    A recruiter reviews the ranked list and records their own rating alongside the AI score. The two
                    ratings sit side by side, and the list can be sorted by either one. Neither gate can silently
                    override the other.
                  </p>
                ),
              },
              {
                num: '05',
                title: 'Shortlist where the gates agree',
                actor: 'human',
                body: (
                  <p>
                    Candidates strong on both the AI screen and the recruiter rating make the shortlist. Disagreements
                    between the two are the interesting cases, and they get a second human look instead of a quiet
                    rejection.
                  </p>
                ),
              },
              {
                num: '06',
                title: 'Interviews stay human',
                actor: 'human',
                body: (
                  <p>
                    From the shortlist onward the process is entirely human: interviews, references, and the hiring
                    decision. AI gets every resume read; people decide who joins the team.
                  </p>
                ),
              },
            ]}
          />
        </div>
      </section>

      {/* Why it works */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <SevenElements elements={ELEMENTS} />
          <div className="wf-info-grid">
            <div className="wf-info-card">
              <h3>The standing rules</h3>
              <ul>
                <li>Every resume is read in full, no exceptions at volume</li>
                <li>AI scores and humans rate, independently</li>
                <li>Ranking happens per role family, not per job posting</li>
                <li>No candidate is rejected by AI alone</li>
              </ul>
            </div>
            <div className="wf-info-card wf-info-card-mint">
              <h3>Why it works</h3>
              <ul>
                <li>Consistent scoring replaces screener-of-the-day variance</li>
                <li>Recruiter time shifts from skimming piles to judging the top of a ranked list</li>
                <li>Cross-role ranking rescues good people from the wrong posting</li>
                <li>Every score comes with written reasoning, so decisions are auditable</li>
              </ul>
            </div>
          </div>
          <DetailFooter />
        </div>
      </section>
    </main>
  )
}
