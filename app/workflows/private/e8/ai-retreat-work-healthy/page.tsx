import type { Metadata } from 'next'
import { WorkflowHero, FlowRail, StepCards } from '../../../ui'

export const metadata: Metadata = {
  title: 'AI Retreat Week Brief: Work Healthy Australia | Edge8',
  description: 'Week brief for Dr James Murray: goal, survey results, and the OccuSpan workflows for the 4-day AI Retreat.',
  robots: { index: false, follow: false },
}

const RATINGS: { label: string; score: number }[] = [
  { label: 'I feel confident using AI for real work in my role.', score: 5 },
  { label: 'My company has a clear AI strategy.', score: 4 },
  { label: "My company's workflows are clearly documented.", score: 5 },
  { label: "Our company's information and data are organized and ready for AI to use.", score: 3 },
]

function Meter({ score }: { score: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 3, marginRight: 10, verticalAlign: 'middle' }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          style={{
            width: 18,
            height: 10,
            borderRadius: 3,
            background: i <= score ? 'var(--blue)' : 'var(--tint-deep)',
          }}
        />
      ))}
    </span>
  )
}

const surveyRow: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px 20px',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '14px 22px',
  borderBottom: '1px solid var(--card-border)',
  fontSize: 15,
}

export default function AiRetreatWorkHealthyPage() {
  return (
    <main>
      <WorkflowHero
        category="AI Retreat · Client Week Brief"
        title="Work Healthy Australia"
        tldr="Dr James Murray, building OccuSpan. The Friday goal: run Work Healthy Australia's two core clinical workflows end to end, live, on test patients, so the team back home can see that OccuSpan is a real, working product. These two workflows are roughly 85% of what the business drives revenue from every day."
        meta={[
          { label: 'Participant', value: 'Dr James Murray' },
          { label: 'Product', value: 'OccuSpan' },
          { label: 'Retreat', value: 'Week of Mon 27 Jul 2026' },
          { label: 'Pre-survey', value: 'Mon 27 Jul, 9:43am' },
        ]}
      />

      {/* Goal */}
      <section className="section" style={{ paddingBottom: 48 }}>
        <div className="container">
          <span className="section-label">The goal</span>
          <h2 className="section-title section-title--sm">
            Friday must prove OccuSpan is real
          </h2>
          <p className="section-sub" style={{ marginTop: 12 }}>
            The patient treatment workflow alone is about 60% of what the team does each day. A working demo is also the
            change-management lever: the team is attached to the legacy system and skeptical it can be replaced in
            months, and a 20-minute vision presentation landed in silence. Working software is the answer to that
            silence.
          </p>
          <div className="wf-problems">
            <div className="wf-problem wf-problem-ok">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <strong>Screen one test patient at three employers.</strong> Same person, three separate pre-employment
              screen transactions, none visible across employers.
            </div>
            <div className="wf-problem wf-problem-ok">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <strong>Flip the patient to hired at one employer.</strong> The clinician pulls the patient into that
              employer&apos;s environment, e.g. Kilcoy Global Foods. Prior screens elsewhere stay invisible.
            </div>
            <div className="wf-problem wf-problem-ok">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <strong>Send the new-patient onboarding link.</strong> Different consent form, different privacy
              declaration, different medical history than the screen.
            </div>
            <div className="wf-problem wf-problem-ok">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <strong>Examine, diagnose, plan, treat.</strong> The full clinical flow runs in the app, not on slides.
            </div>
            <div className="wf-problem wf-problem-ok">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <strong>Post-treatment note lands in the client portal.</strong> The economic buyer sees the appointment
              and the report.
            </div>
            <div className="wf-problem wf-problem-ok">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <strong>Every step is a real click-through.</strong> A role-by-role pressure test (18 user roles, would
              each pay $1,000 a month) exposed features that pass review but are landing pages only. The bar this week
              is a repeatable test pass.
            </div>
          </div>

          <span className="section-label" style={{ marginTop: 48 }}>
            Guardrails for the week
          </span>
          <div className="wf-problems" style={{ marginTop: 20 }}>
            <div className="wf-problem">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="4.9" y1="4.9" x2="19.1" y2="19.1" />
              </svg>
              <strong>Do not break the return-to-work coordinator role.</strong> The next business after injury
              prevention serves RTW coordinators: about 78,000 in Australia with no single place for training,
              mentoring, support, or software. Not built this week, but no broken links, dead pages, or dead ends for
              that role, and the architecture stays open for it.
            </div>
            <div className="wf-problem">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="4.9" y1="4.9" x2="19.1" y2="19.1" />
              </svg>
              <strong>Privacy never bends for speed.</strong> The privacy model below is the product. Shortcuts are not
              acceptable, even in a demo build. Back home, clinical staff are limited to Gemini only after patient notes
              were found in ChatGPT. Trust is the whole game.
            </div>
          </div>
        </div>
      </section>

      {/* Survey */}
      <section className="section" style={{ paddingTop: 24, paddingBottom: 48 }}>
        <div className="container">
          <span className="section-label">Survey results</span>
          <h2 className="section-title section-title--sm">
            AI Journey pre-retreat survey
          </h2>
          <p className="section-sub" style={{ marginTop: 12 }}>
            Submitted Monday 27 July 2026 at 9:43am, before the kickoff session.
          </p>
          <div style={{ border: '1px solid var(--card-border)', borderRadius: 20, overflow: 'hidden', marginTop: 32 }}>
            <div style={surveyRow}>
              <span>Company name</span>
              <strong>Work Healthy Australia</strong>
            </div>
            <div style={surveyRow}>
              <span>What industry do you work in?</span>
              <strong>Wellness</strong>
            </div>
            <div style={surveyRow}>
              <span>Which AI platforms do you currently use?</span>
              <strong>ChatGPT, Claude, Gemini</strong>
            </div>
            <div style={surveyRow}>
              <span>How often do you use AI at work?</span>
              <strong>Many times a day</strong>
            </div>
            {RATINGS.map((r) => (
              <div key={r.label} style={surveyRow}>
                <span>{r.label}</span>
                <strong>
                  <Meter score={r.score} />
                  {r.score} / 5
                </strong>
              </div>
            ))}
            <div style={{ ...surveyRow, borderBottom: 'none', background: 'var(--tint)' }}>
              <span>What is your biggest pain point with AI right now?</span>
              <strong>&quot;Trust and change process.&quot;</strong>
            </div>
          </div>
          <div className="wf-info-grid" style={{ marginTop: 32, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div className="wf-info-card">
              <h3>Strengths to build on</h3>
              <ul>
                <li>Power user: three platforms, many times a day, 5/5 confidence. No time needed on tool basics.</li>
                <li>
                  Workflows documented 5/5 is the unfair advantage. James is a clinician who built the original system
                  and can specify every screen and hand-off. That is why an end-to-end build in four days is realistic.
                </li>
                <li>AI strategy already at 4/5, ahead of most companies at this stage.</li>
              </ul>
            </div>
            <div className="wf-info-card wf-info-card-mint">
              <h3>Gaps this week attacks</h3>
              <ul>
                <li>
                  Data readiness 3/5. Patient data sits behind strict privacy boundaries, and the pressure-test audit
                  showed the app&apos;s claimed state and real state disagree. Test data, seeded roles, and repeatable
                  test passes close this.
                </li>
                <li>
                  The pain point is people, not tech. &quot;Trust and change process&quot; matches the kickoff exactly.
                  The Friday demo is aimed at the team&apos;s trust, not just at the code.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Workflow A: PES */}
      <section className="section" style={{ paddingTop: 24, paddingBottom: 48 }}>
        <div className="container">
          <span className="section-label">Workflow A</span>
          <h2 className="section-title section-title--sm">
            Pre-employment screen
          </h2>
          <p className="section-sub" style={{ marginTop: 12 }}>
            A separate front door, paid for by the employer. Roughly 80% of screened candidates are never hired or quit
            within six weeks; the 20% who are hired feed the treatment workflow below.
          </p>
          <FlowRail
            steps={[
              { num: '1', title: 'Client purchases a screen', cadence: 'Client portal', actor: 'human', actorLabel: 'Client' },
              { num: '2', title: 'Candidate invited by SMS + email', cadence: 'Resend + SMS', actor: 'system' },
              { num: '3', title: 'Candidate onboards', cadence: '24h before appt', actor: 'human', actorLabel: 'Candidate' },
              { num: '4', title: 'Examination + functional testing', cadence: 'In the room', actor: 'human', actorLabel: 'Clinician' },
              { num: '5', title: 'Notes aggregated into findings', cadence: 'Automatic', actor: 'ai' },
              { num: '6', title: 'Rating + manual handling demand', cadence: 'Clinical judgment', actor: 'human', actorLabel: 'Clinician' },
              { num: '7', title: 'PDF report to client portal', cadence: 'On save', actor: 'system' },
            ]}
          />
          <StepCards
            steps={[
              {
                num: '01',
                title: 'Client purchases a pre-employment screen',
                actor: 'human',
                actorLabel: 'Client',
                body: "The screen is bought as a product by the employer, then the client enters just two things: the candidate's name and mobile number. Everything else comes from the candidate or the clinician.",
              },
              {
                num: '02',
                title: 'Candidate gets an SMS and an email at the same time',
                actor: 'system',
                body: '"You are going to Kilcoy Global Foods for a pre-employment screen." The candidate is asked to onboard at least 24 hours before the appointment and confirm the time. Scheduler, SMS, and email all have to be connected and working.',
              },
              {
                num: '03',
                title: 'Candidate self-onboards, with an in-room fallback',
                actor: 'human',
                actorLabel: 'Candidate',
                body: 'PES-specific medical history (different from the treatment history), informed consent, and a privacy declaration. Consent is broad by design: it is a condition of the screen. Fallback: many candidates are functionally illiterate, do not speak English, or cannot spare the time, so the clinician must be able to find the invitee and onboard them in the room.',
              },
              {
                num: '04',
                title: 'Clinician examination, including functional testing',
                actor: 'human',
                actorLabel: 'Clinician',
                body: 'Standard examination flow. Screens auto-save and advance in a fixed order.',
              },
              {
                num: '05',
                title: 'AI aggregates the notes into findings',
                actor: 'ai',
                body: 'Raw exam notes become structured findings for the clinician to review.',
              },
              {
                num: '06',
                title: 'Clinician concludes: rating plus manual handling demand',
                actor: 'human',
                actorLabel: 'Clinician',
                body: 'Good, Fair, or Poor with a reason, plus the manual handling level the candidate can safely take: Very heavy, Heavy, Medium, Light, Very light. This informs the hire decision, safe placement against job task demands, and referral into work hardening or injury prevention.',
              },
              {
                num: '07',
                title: 'PDF report lands in the client portal, never in the patient file',
                actor: 'system',
                body: 'Downloadable and stored safely, but never in the patient file. A screen report in the clinical file creates liability, so it is buried and not discoverable from the patient record.',
              },
            ]}
          />
        </div>
      </section>

      {/* Privacy flip */}
      <section className="section" style={{ paddingTop: 24, paddingBottom: 48 }}>
        <div className="container">
          <span className="section-label">The privacy model</span>
          <h2 className="section-title section-title--sm">
            One patient, many employers, one flip
          </h2>
          <p className="section-sub" style={{ marginTop: 12 }}>
            A person has one patient file but can have screen transactions at up to 12 different employers. No employer
            may ever see the others. The person does not belong to an employer until a clinician pulls them across after
            hire.
          </p>
          <div className="wf-info-grid" style={{ marginTop: 32, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div className="wf-info-card">
              <h3>Before hire: outside every employer</h3>
              <ul>
                <li>One patient file, owned by the person, visible to no client.</li>
                <li>Employer A, B, and C each hold their own screen transaction and see only their own report.</li>
                <li>A candidate can carry screens from 12 different employers without any of them knowing.</li>
              </ul>
            </div>
            <div className="wf-info-card wf-info-card-mint">
              <h3>After hire: inside one employer</h3>
              <ul>
                <li>The clinician flips the patient file into the hiring employer&apos;s environment, and only then is the person visible there.</li>
                <li>Screens at the other employers remain invisible. Not their data.</li>
                <li>Of the hired 20%, about 80% are seen within their first week for work hardening or injury prevention, which is where the treatment workflow picks up.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Workflow B: Treatment */}
      <section className="section" style={{ paddingTop: 24, paddingBottom: 72 }}>
        <div className="container">
          <span className="section-label">Workflow B</span>
          <h2 className="section-title section-title--sm">
            Patient treatment episode
          </h2>
          <p className="section-sub" style={{ marginTop: 12 }}>
            About 60% of the team&apos;s daily work: onboarding, examination, diagnosis, care plan, treatment, and
            reporting for the economic buyer.
          </p>
          <FlowRail
            steps={[
              { num: '1', title: 'Patient invited', cadence: 'SMS + link', actor: 'human', actorLabel: 'Coordinator' },
              { num: '2', title: 'Patient onboards', cadence: 'Before visit', actor: 'human', actorLabel: 'Patient' },
              { num: '3', title: 'Exam tailored by joint', cadence: 'In the room', actor: 'human', actorLabel: 'Clinician' },
              { num: '4', title: 'Diagnosis + recovery widget', cadence: 'Care plan length', actor: 'ai' },
              { num: '5', title: 'Treatment delivered', cadence: 'Per care plan', actor: 'human', actorLabel: 'Clinician' },
              { num: '6', title: 'Notes + next appointment', cadence: 'Every visit', actor: 'human', actorLabel: 'Clinician' },
              { num: '7', title: 'Buyer visibility + discharge', cadence: 'Portal + survey', actor: 'system' },
            ]}
            repeatNote="Steps 5 to 6 repeat each visit until the final treatment, when the patient is released from care."
          />
          <StepCards
            steps={[
              {
                num: '01',
                title: 'Program manager or RTW coordinator invites the patient',
                actor: 'human',
                actorLabel: 'Coordinator',
                body: 'Name and mobile in, SMS with an onboarding link out.',
              },
              {
                num: '02',
                title: 'Patient onboards with treatment paperwork, with an in-room fallback',
                actor: 'human',
                actorLabel: 'Patient',
                body: 'A treatment-focused medical history covering underlying conditions that are barriers to healing, a treatment-specific privacy declaration and consent, and the complaint form: "I hurt my shoulder last Thursday reaching overhead, it keeps me awake at night." If the patient walks up with no paperwork done, the workflow flips to the clinician, who onboards them in the room.',
              },
              {
                num: '03',
                title: 'Standard musculoskeletal examination, tailored by joint',
                actor: 'human',
                actorLabel: 'Clinician',
                body: 'The exam adapts to the joint where the patient reports the majority of the pain.',
              },
              {
                num: '04',
                title: 'Diagnosis, then a care plan with recovery intelligence',
                actor: 'ai',
                body: 'Macro-level patient profiling, e.g. "82% chance of recovery in the first four weeks, make the care plan no shorter than four weeks." Plans run 4, 6, 8, or 10 weeks.',
              },
              {
                num: '05',
                title: 'Treatment delivered, guided by findings',
                actor: 'human',
                actorLabel: 'Clinician',
                body: 'The system picks the modalities and the structures from the exam findings.',
              },
              {
                num: '06',
                title: 'Treatment notes, post-treatment note, next appointment booked',
                actor: 'human',
                actorLabel: 'Clinician',
                body: 'Recorded and saved every visit.',
              },
              {
                num: '07',
                title: 'Visibility to the economic buyer, then discharge',
                actor: 'system',
                body: 'Each appointment becomes visible to whoever pays for the care, and the patient gets a text. At the final treatment the patient is released from care, the closing post-treatment note is written, and the patient receives a survey.',
              },
            ]}
          />
        </div>
      </section>
    </main>
  )
}
