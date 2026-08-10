import type { Metadata } from 'next'
import { WorkflowHero, FlowRail, StepCards, SevenElements, DetailFooter, type WorkflowElement } from '../ui'

const ELEMENTS: WorkflowElement[] = [
  { name: 'Trigger', assignment: 'human', desc: 'A role opens. One click creates the req and its five-stage pipeline; nothing else has to be set up.' },
  { name: 'Inputs', assignment: 'both', desc: 'The job description, up to three screening questions, and every resume — from the careers page or a recruiter batch drop.' },
  { name: 'Decision', assignment: 'both', desc: 'Two independent gates per candidate: the AI screen with written reasoning, and the recruiter’s star rating beside it.' },
  { name: 'Routing', assignment: 'both', desc: 'Applications move Screen → Interview → Offer on the req’s board; every applicant also lands in the permanent candidate pool.' },
  { name: 'Output', assignment: 'machine', desc: 'One structured record per candidate: profile, resume, AI assessment, both ratings, the notes thread, and a final status with its reason.' },
  { name: 'Delivery', assignment: 'machine', desc: 'Ranked, sortable lists the moment a recruiter opens the admin: per req, per role family, and across the whole pool.' },
  { name: 'Measurement', assignment: 'machine', desc: 'Stage-by-stage conversion, AI-vs-recruiter disagreement, and time from open req to hire.' },
]

const title = 'Recruitment: Open Req to Hire | Edge8 Workflows'
const description =
  'How a role goes from open req to signed hire in one system: a one-click pipeline, careers-page and batch-resume intake, an AI read on every resume, human interviews, and a candidate pool that never forgets.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/workflows/recruitment/' },
  openGraph: { title, description, url: '/workflows/recruitment/', type: 'website' },
  twitter: { card: 'summary_large_image', title, description },
}

const PROBLEMS = [
  'Hiring lives in inboxes and spreadsheets. Resumes arrive by email, LinkedIn, and referral, and half never get a reply.',
  'Nobody can say where a candidate stands without asking the one person who owns the folder.',
  'Screening quality depends on who reads the pile and when. The 200th resume never gets the read the 5th did.',
  'Every rejected candidate disappears, so the next search starts from zero instead of from everyone you already met.',
]

export default function RecruitmentWorkflowPage() {
  return (
    <main>
      <WorkflowHero
        category="Talent"
        title="Recruitment: Open Req to Hire"
        tldr="One system carries a role from open req to signed hire. The pipeline is created in one click, candidates arrive from the careers page or a 25-resume batch drop, AI reads and scores every resume on arrival, and humans run every interview. Every applicant we have ever met stays in a ranked, searchable pool."
        meta={[
          { label: 'Intake', value: 'Careers page + batch drop' },
          { label: 'AI reads', value: '100% of resumes' },
          { label: 'Memory', value: 'Every applicant, forever' },
        ]}
      />

      {/* The problem */}
      <section className="section" style={{ paddingBottom: 48 }}>
        <div className="container">
          <span className="section-label">The problem</span>
          <h2 className="section-title" style={{ fontSize: 34 }}>
            Hiring without a system is a memory leak
          </h2>
          <p className="section-sub" style={{ marginTop: 12 }}>
            Most small companies run recruitment on goodwill and inbox search:
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
            From open req to signed hire
          </h2>
          <FlowRail
            steps={[
              { num: '01', title: 'Open the Req', cadence: 'One click', actor: 'human', actorLabel: 'Recruiter' },
              { num: '02', title: 'Publish the Posting', cadence: 'When ready', actor: 'human', actorLabel: 'Recruiter' },
              { num: '03', title: 'Candidates Arrive', cadence: 'Two doors', actor: 'contractor', actorLabel: 'Candidate' },
              { num: '04', title: 'AI Screen', cadence: 'On arrival', actor: 'ai', actorLabel: 'Claude' },
              { num: '05', title: 'Pipeline', cadence: 'Screen → Offer', actor: 'human', actorLabel: 'Recruiter' },
              { num: '06', title: 'Decision', cadence: 'Humans only', actor: 'human' },
              { num: '07', title: 'Pool Never Forgets', cadence: 'Forever', actor: 'system' },
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
                title: 'Open the req — the pipeline builds itself',
                cadence: 'One click',
                actor: 'human',
                actorLabel: 'Recruiter',
                body: (
                  <p>
                    A recruiter creates the requisition from the Job Reqs list: title, employment type, location,
                    remote policy, and the salary band. The system seeds the same five-stage pipeline every role uses
                    — Screen, Interview, Offer, Hired, Rejected — so no two roles ever have subtly different processes.
                    The req opens for hiring immediately but stays off the public site until the posting is ready.
                  </p>
                ),
              },
              {
                num: '02',
                title: 'Write and publish the posting',
                cadence: 'When the JD is ready',
                actor: 'human',
                actorLabel: 'Recruiter',
                body: (
                  <p>
                    The public posting is written in markdown on the req itself: the job description, a clean URL slug,
                    and up to three screening questions every applicant answers. Flipping it public puts the role on
                    the careers page; closing the req later takes it down automatically. Internal notes stay internal —
                    the posting and the working record are two views of one req.
                  </p>
                ),
              },
              {
                num: '03',
                title: 'Candidates arrive through two doors',
                cadence: 'Careers page + batch drop',
                actor: 'contractor',
                actorLabel: 'Candidate',
                body: (
                  <>
                    <p>
                      <strong>Door one: the careers page.</strong> A candidate applies with a resume, cover letter, and
                      answers to the screening questions. The application lands in the talent system attached to the
                      req — no inbox, no forwarding.
                    </p>
                    <p>
                      <strong>Door two: the recruiter batch drop.</strong> Sourced candidates — from LinkedIn, referrals,
                      or agencies — enter through the same funnel. A recruiter drops up to 25 resumes at once, and AI
                      reads each file and prefills a draft: name, email, phone, LinkedIn, headline, current title. The
                      recruiter reviews each draft and saves it. Ten minutes of drag-and-drop replaces an afternoon of
                      data entry, and both doors produce identical records.
                    </p>
                    <p>
                      Duplicates cannot happen by construction: candidates are keyed by email, and one person holds at
                      most one application per role. Re-adding someone surfaces their existing application instead of
                      silently creating a second.
                    </p>
                  </>
                ),
              },
              {
                num: '04',
                title: 'AI reads and scores every resume',
                cadence: 'Automatic, on arrival',
                actor: 'ai',
                actorLabel: 'Claude',
                body: (
                  <>
                    <p>
                      The moment an application lands — from either door — Claude reads the full resume against the job
                      description and writes a structured screen: a 0–5 fit rating, an overview paragraph, the
                      candidate&apos;s concrete strengths and gaps, an English-proficiency read, and the salary
                      expectation and notice period exactly as stated (never guessed).
                    </p>
                    <p>
                      That assessment travels with the candidate everywhere: it appears in the application&apos;s side
                      panel, on the req&apos;s ranked list, and in the candidate pool. Every application gets the same
                      depth of read whether it arrived first or five hundredth — screening quality no longer depends on
                      who reads the pile.
                    </p>
                    <p>
                      Scored candidates also stack-rank within their <strong>role family</strong>, not just the single
                      job they applied to. A strong engineer who applied to the wrong opening still surfaces near the
                      top of the engineering family instead of dying in the wrong folder.
                    </p>
                  </>
                ),
              },
              {
                num: '05',
                title: 'Work the pipeline with two independent ratings',
                cadence: 'Screen → Interview → Offer',
                actor: 'human',
                actorLabel: 'Recruiter',
                body: (
                  <>
                    <p>
                      Each req has a kanban board: candidates move Screen → Interview → Offer by drag, and every
                      application carries two ratings side by side — the AI&apos;s score with its written reasoning and
                      the recruiter&apos;s own star rating. The list sorts by either one. Candidates strong on both
                      gates make the shortlist; where the gates disagree is exactly where a second human look goes,
                      instead of a quiet rejection.
                    </p>
                    <p>
                      All working context lives on the application: a notes thread, the resume (replaceable if a better
                      version arrives), the cover letter and question answers, and the candidate&apos;s profile. Anyone
                      on the team can open any application and know exactly where it stands.
                    </p>
                  </>
                ),
              },
              {
                num: '06',
                title: 'The decision stays human',
                cadence: 'Interviews, references, offer',
                actor: 'human',
                actorLabel: 'Hiring team',
                body: (
                  <>
                    <p>
                      From the shortlist on, the process is entirely human: interviews, references, and the offer. AI
                      gets every resume read; people decide who joins. A candidate leaves the pipeline with an explicit
                      status and a recorded reason — hired, rejected with a note, withdrawn, or parked as future
                      consideration. Nobody is rejected by AI alone, and nobody is left in limbo.
                    </p>
                    <p>
                      A hire flips the application status and hands off to the{' '}
                      <a href="/workflows/new-member-onboarding/">New Member Onboarding workflow</a>, which turns the
                      applicant record into an employee record without re-typing anything.
                    </p>
                  </>
                ),
              },
              {
                num: '07',
                title: 'The candidate pool never forgets',
                cadence: 'Permanent',
                actor: 'system',
                body: (
                  <>
                    <p>
                      Every person who has ever applied — hired, rejected, or parked — stays in one searchable,
                      sortable pool, stack-ranked by their best AI screen and grouped into role families. When the next
                      role opens, sourcing starts from everyone the company has already met, not from zero.
                    </p>
                    <p>
                      The strong runner-up from last quarter&apos;s search surfaces at the top of the next one, with the
                      full history attached: every application, every screen, every note.
                    </p>
                  </>
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
                <li>Every role runs the identical five-stage pipeline</li>
                <li>Both intake doors produce the same structured record</li>
                <li>Every resume is read in full by AI on arrival</li>
                <li>AI scores and humans rate, independently — and ranking spans role families, not just postings</li>
                <li>No candidate is rejected by AI alone, and every exit has a recorded reason</li>
                <li>Nothing is deleted: every applicant stays in the pool</li>
              </ul>
            </div>
            <div className="wf-info-card wf-info-card-mint">
              <h3>Why it works</h3>
              <ul>
                <li>One system of record ends the where-does-this-candidate-stand question</li>
                <li>Batch intake makes sourced candidates as cheap to process as inbound ones</li>
                <li>Two independent gates catch what either one alone would miss</li>
                <li>The pool compounds: every search makes the next one faster</li>
                <li>Hire-to-onboarding handoff means no candidate data is ever re-typed</li>
              </ul>
            </div>
          </div>
          <DetailFooter />
        </div>
      </section>
    </main>
  )
}
