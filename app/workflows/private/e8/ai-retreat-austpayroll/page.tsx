import type { Metadata } from 'next'
import { WorkflowHero, FlowRail, StepCards } from '../../../ui'

export const metadata: Metadata = {
  title: 'AI Retreat Week Brief: Australian Payroll Association | Edge8',
  description: 'Week brief for Tracy Angwin: goal, survey results, and the adaptive payroll training workflows for the 4-day AI Retreat.',
  robots: { index: false, follow: false },
}

const RATINGS: { label: string; score: number }[] = [
  { label: 'I feel confident using AI for real work in my role.', score: 5 },
  { label: 'My company has a clear AI strategy.', score: 3 },
  { label: "My company's workflows are clearly documented.", score: 2 },
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

export default function AiRetreatAustPayrollPage() {
  return (
    <main>
      <WorkflowHero
        category="AI Retreat · Client Week Brief"
        title="Australian Payroll Association"
        tldr="Tracy Angwin, building the adaptive payroll training platform. The Friday goal: a learner takes a knowledge assessment and gets served a 90-day micro-learning program built only from what they do not already know. In Tracy's words: if the app is working Friday, 100% satisfied."
        meta={[
          { label: 'Participant', value: 'Tracy Angwin' },
          { label: 'North star', value: 'Reinvent payroll training' },
          { label: 'Retreat', value: 'Week of Mon 27 Jul 2026' },
          { label: 'Pre-survey', value: 'Mon 27 Jul, 9:42am' },
        ]}
      />

      {/* Goal */}
      <section className="section" style={{ paddingBottom: 48 }}>
        <div className="container">
          <span className="section-label">The goal</span>
          <h2 className="section-title section-title--sm">
            Build product to sell, not slides to show
          </h2>
          <p className="section-sub" style={{ marginTop: 12 }}>
            Twenty years of classroom training revenue is declining, and an acquisition target in the same space shows
            the same trend. The waste is obvious: a busy payroll professional gives up a full day to sit through eight
            hours of content and may already know six and a half hours of it. The play is to blow up that model with
            assessment-driven micro-learning. The content pipeline already works, built solo and self-taught. The weak
            point, in Tracy&apos;s words: &quot;it just looks ugly.&quot;
          </p>
          <div className="wf-problems">
            <div className="wf-problem wf-problem-ok">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <strong>A learner signs up and takes the knowledge assessment</strong> on the platform, start to finish.
            </div>
            <div className="wf-problem wf-problem-ok">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <strong>The assessment produces a gap profile</strong> of what this learner already knows versus does not.
            </div>
            <div className="wf-problem wf-problem-ok">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <strong>A personalized 90-day program is generated</strong> containing only the gaps.
            </div>
            <div className="wf-problem wf-problem-ok">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <strong>Micro-learning videos play inside the program</strong>, served from the Synthesia library.
            </div>
            <div className="wf-problem wf-problem-ok">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <strong>The UI is lifted to a professional standard</strong> worthy of selling to clients.
            </div>
            <div className="wf-problem wf-problem-ok">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <strong>Tracy can explain the GitHub and env var setup behind it</strong>, not just confirm that it runs.
            </div>
          </div>

          <span className="section-label" style={{ marginTop: 48 }}>
            Personal learning focus, agreed at kickoff
          </span>
          <div className="wf-info-grid" style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div className="wf-info-card">
              <h3>GitHub hygiene</h3>
              <ul>
                <li>Working alone hides most git pain, and running multiple parallel sessions has already caused conflicts once.</li>
                <li>The team is about to start building too, so branch discipline and clean collaboration habits start now.</li>
              </ul>
            </div>
            <div className="wf-info-card">
              <h3>Environment variables, all three layers</h3>
              <ul>
                <li>Variables in Vercel (the deployed app), variables in the local environment, and how keys are shared safely in remote or team environments.</li>
                <li>The third layer is where security breaks, and in payroll, client security is a sales issue, not just a technical one.</li>
              </ul>
            </div>
          </div>

          <div className="wf-info-grid" style={{ marginTop: 24 }}>
            <div className="wf-info-card wf-info-card-mint">
              <h3>Operating context worth remembering</h3>
              <ul>
                <li>Tracy&apos;s superpower is a PhD in the customers&apos; problems, not the technology.</li>
                <li>Some content cannot be self-tested: the long service leave calculator needs subject matter experts to validate the rules.</li>
                <li>The team has two speeds: 20-year process followers wary of change, and self-starters like BJ, who built a consultant project tracker off his own bat.</li>
                <li>The BJ lesson applies to everything built this week: document the workflow, write the plan, and pull grassroots builds into one platform before they scatter data across disparate systems.</li>
              </ul>
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
            Submitted Monday 27 July 2026 at 9:42am, before the kickoff session. Company name as submitted:
            &quot;Australian Payroll Group&quot; (CRM record: Australian Payroll Association).
          </p>
          <div style={{ border: '1px solid var(--card-border)', borderRadius: 20, overflow: 'hidden', marginTop: 32 }}>
            <div style={surveyRow}>
              <span>Company name</span>
              <strong>Australian Payroll Group</strong>
            </div>
            <div style={surveyRow}>
              <span>What industry do you work in?</span>
              <strong>Professional Services</strong>
            </div>
            <div style={surveyRow}>
              <span>Which AI platforms do you currently use?</span>
              <strong>Claude, ChatGPT</strong>
            </div>
            <div style={surveyRow}>
              <span>How often do you use AI at work?</span>
              <strong>Daily</strong>
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
              <strong style={{ maxWidth: 520 }}>
                &quot;Build and delivery digital products using IP held on documents or staff heads. Clients: security
                is an issue in the payroll industry.&quot;
              </strong>
            </div>
          </div>
          <div className="wf-info-grid" style={{ marginTop: 32, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div className="wf-info-card">
              <h3>Strengths to build on</h3>
              <ul>
                <li>Daily AI use and 5/5 confidence: a confident builder who has already shipped a working pipeline.</li>
                <li>The vision is sharp: kill the wasted training day. Strategy at 3/5 fits a company mid-transition.</li>
              </ul>
            </div>
            <div className="wf-info-card wf-info-card-mint">
              <h3>Gaps this week attacks</h3>
              <ul>
                <li>
                  Workflows documented scores 2/5, the lowest number on the sheet, and the pain point says the same
                  thing: the product is the IP, and the IP lives in documents and in staff heads. Every workflow written
                  down this week becomes two assets at once: training content and a spec AI can build from.
                </li>
                <li>
                  Security is a market requirement in payroll, which is exactly why environment variables and key
                  handling are on the learning list.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Workflow A: content pipeline */}
      <section className="section" style={{ paddingTop: 24, paddingBottom: 48 }}>
        <div className="container">
          <span className="section-label">Workflow A</span>
          <h2 className="section-title section-title--sm">
            Content production pipeline
          </h2>
          <p className="section-sub" style={{ marginTop: 12 }}>
            Already built and working. The IP from 20 years of live training becomes product, one recording at a time.
            This week it keeps feeding the library while the learner journey gets built.
          </p>
          <FlowRail
            steps={[
              { num: '1', title: 'Training recordings', cadence: 'Existing IP', actor: 'human', actorLabel: 'Trainer' },
              { num: '2', title: 'Claude writes micro-units', cadence: 'Decks + notes', actor: 'ai' },
              { num: '3', title: 'Synthesia renders videos', cadence: 'Via API', actor: 'system' },
              { num: '4', title: 'Micro-learning library', cadence: 'Ready to serve', actor: 'system' },
            ]}
          />
          <StepCards
            steps={[
              {
                num: '01',
                title: 'Training recordings go in',
                actor: 'human',
                actorLabel: 'Trainer',
                body: 'Recordings of the training the business has run for 20 years. The IP already exists; this converts it into product.',
              },
              {
                num: '02',
                title: 'Claude splits content into micro-learning units',
                actor: 'ai',
                body: 'One recording becomes many small units, each with a slide deck and speaker notes matched to brand guidelines.',
              },
              {
                num: '03',
                title: 'Synthesia renders each unit as a presenter video',
                actor: 'system',
                body: 'The API connection is already working. Videos generate without a studio or a presenter.',
              },
              {
                num: '04',
                title: 'The library grows, with a quality gate to add',
                actor: 'system',
                body: 'Tagged units ready to be assembled into programs. Quality gate to add: subject matter experts validate content Tracy cannot self-test, like the long service leave rules.',
              },
            ]}
          />
        </div>
      </section>

      {/* Workflow B: learner journey */}
      <section className="section" style={{ paddingTop: 24, paddingBottom: 72 }}>
        <div className="container">
          <span className="section-label">Workflow B</span>
          <h2 className="section-title section-title--sm">
            Adaptive learner journey
          </h2>
          <p className="section-sub" style={{ marginTop: 12 }}>
            The Friday demo. Steps 2 to 4 must work as one unbroken chain, plus a UI worthy of the product. Never
            re-teach the six and a half hours the learner already knows.
          </p>
          <FlowRail
            steps={[
              { num: '1', title: 'Learner joins the platform', cadence: 'Sign up', actor: 'human', actorLabel: 'Learner' },
              { num: '2', title: 'Knowledge assessment', cadence: 'Before any content', actor: 'system' },
              { num: '3', title: 'Gap profile built', cadence: 'Known topics stripped', actor: 'ai' },
              { num: '4', title: '90-day program assembled', cadence: 'Gaps only', actor: 'system' },
              { num: '5', title: 'Micro-learning delivery', cadence: 'Around the work week', actor: 'human', actorLabel: 'Learner' },
              { num: '6', title: 'Program complete', cadence: 'Time = knowledge', actor: 'system' },
            ]}
          />
          <StepCards
            steps={[
              {
                num: '01',
                title: 'Learner joins the platform',
                actor: 'human',
                actorLabel: 'Learner',
                body: 'A busy payroll professional who cannot afford a wasted training day.',
              },
              {
                num: '02',
                title: 'Knowledge assessment',
                actor: 'system',
                body: 'The learner is tested across the payroll curriculum before seeing any content.',
              },
              {
                num: '03',
                title: 'Gap profile',
                actor: 'ai',
                body: 'Known topics are stripped out. Only genuine gaps remain. This is the whole pitch.',
              },
              {
                num: '04',
                title: 'Personalized 90-day program',
                actor: 'system',
                body: 'The platform assembles a program from the micro-learning library covering only the gap topics.',
              },
              {
                num: '05',
                title: 'Micro-learning delivery',
                actor: 'human',
                actorLabel: 'Learner',
                body: 'Short Synthesia videos, consumed around a working week instead of a day out of the business.',
              },
              {
                num: '06',
                title: 'Learner completes the program',
                actor: 'system',
                body: 'Time invested maps one-to-one to knowledge gained. This is the product that sells to clients, and the model that replaces the eight-hour training day.',
              },
            ]}
          />
        </div>
      </section>
    </main>
  )
}
