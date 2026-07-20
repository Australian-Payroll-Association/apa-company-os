import type { Metadata } from 'next'
import Link from 'next/link'
import { WorkflowHero, FlowRail, StepCards, SevenElements, DetailFooter, type WorkflowElement } from '../ui'

const title = 'New Member Onboarding | Edge8 Workflows'
const description =
  'A recruiter marks an applicant hired, and the new member walks themselves in: one form turns an applicant into an employee on probation with a portal account waiting.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/workflows/new-member-onboarding/' },
  openGraph: { title, description, url: '/workflows/new-member-onboarding/', type: 'website' },
  twitter: { card: 'summary_large_image', title, description },
}

const ELEMENTS: WorkflowElement[] = [
  { name: 'Trigger', assignment: 'human', desc: 'A recruiter marks an applicant hired in the ATS. That single decision starts everything downstream.' },
  { name: 'Inputs', assignment: 'both', desc: 'The record the applicant already built during hiring, the onboarding details only they can supply, and the Lark @edge8.ai email the recruiter sets up and records into Edge8 OS.' },
  { name: 'Decision', assignment: 'human', desc: 'Two human calls: the recruiter decides to hire, and the new member decides to accept and complete their form.' },
  { name: 'Routing', assignment: 'machine', desc: 'The hire event emails the onboarding link, the submission finds the existing applicant instead of making a twin, and a portal invite goes out on its own. If there is no applicant on file, the operations team is notified to backfill it.' },
  { name: 'Output', assignment: 'machine', desc: 'One employee record on probation, promoted in place from the applicant, with a portal account ready to activate.' },
  { name: 'Delivery', assignment: 'machine', desc: 'The onboarding email and the portal invite both send automatically, so the new member lands in the team portal without a single handoff.' },
  { name: 'Measurement', assignment: 'machine', desc: 'Probation dates, onboarding completion, and the applicant-to-employee conversion are all stamped, so nothing about the start date is guessed later.' },
]

export default function NewMemberOnboardingWorkflowPage() {
  return (
    <main>
      <WorkflowHero
        category="Talent"
        title="New Member Onboarding"
        tldr="Hiring ends where onboarding begins. The recruiter marks an applicant hired, an email invites the new member to fill in the last details themselves, and their submission converts the same record into an employee on probation. A portal account is waiting the moment they finish."
        meta={[
          { label: 'Human decisions', value: '2' },
          { label: 'Records created', value: '0 duplicates' },
          { label: 'Portal account', value: 'Automatic' },
        ]}
      />

      {/* The flow */}
      <section className="section" style={{ paddingBottom: 48 }}>
        <div className="container">
          <span className="section-label">The flow</span>
          <h2 className="section-title" style={{ fontSize: 34 }}>
            From hired to onboarded, one path
          </h2>
          <p className="section-sub" style={{ marginTop: 12 }}>
            This picks up exactly where{' '}
            <Link href="/workflows/ai-resume-screen">AI Resume Screen + Talent Rank</Link> leaves off. The applicant
            that made it through screening becomes the employee that walks in the door, without anyone retyping a thing.
          </p>
          <FlowRail
            steps={[
              { num: '01', title: 'Recruiter Marks Hired', cadence: 'In the ATS', actor: 'human', actorLabel: 'Recruiter' },
              { num: '02', title: 'Recruiter Sets Up Lark Email', cadence: 'Manual, in parallel', actor: 'human', actorLabel: 'Recruiter' },
              { num: '03', title: 'Onboarding Email Sends', cadence: 'Automatic', actor: 'system' },
              { num: '04', title: 'New Member Completes Form', cadence: 'Self-serve', actor: 'human', actorLabel: 'New member' },
              { num: '05', title: 'Applicant Converts to Employee', cadence: 'On submit', actor: 'system' },
              { num: '06', title: 'Portal Invite Sends', cadence: 'Same moment', actor: 'system' },
              { num: '07', title: 'First Login to the Portal', cadence: 'Day one', actor: 'human', actorLabel: 'Employee' },
            ]}
            repeatNote="Every new hire runs the same path. The recruiter starts it, the new member finishes it, and the machine handles the middle."
          />
        </div>
      </section>

      {/* Step detail */}
      <section className="section" style={{ background: 'var(--tint)', padding: '72px 0' }}>
        <div className="container">
          <span className="section-label" style={{ background: 'var(--white)' }}>
            Step by step
          </span>
          <h2 className="section-title" style={{ fontSize: 34 }}>
            How each step works
          </h2>
          <StepCards
            steps={[
              {
                num: '01',
                title: 'The recruiter marks the applicant hired',
                cadence: 'In the ATS',
                actor: 'human',
                actorLabel: 'Recruiter',
                body: (
                  <p>
                    The hire decision is made where the hiring happened. On the job requisition, the recruiter moves the
                    chosen applicant to hired. That status change is the only trigger this workflow needs.
                  </p>
                ),
              },
              {
                num: '02',
                title: 'The recruiter sets up the Lark email and records it',
                cadence: 'Manual, in parallel',
                actor: 'human',
                actorLabel: 'Recruiter',
                body: (
                  <p>
                    Right after the hire, the recruiter creates the new member&rsquo;s <code>@edge8.ai</code> Lark
                    account by hand and enters that email into Edge8 OS, so their company identity lives on their
                    record. This runs alongside onboarding and never holds up the portal invite, which goes to their
                    personal email. When a Lark provisioning API is available, this step automates too.
                  </p>
                ),
              },
              {
                num: '03',
                title: 'The onboarding email sends itself',
                cadence: 'Automatic',
                actor: 'system',
                body: (
                  <p>
                    The moment the applicant is marked hired, an onboarding email goes out carrying a private,
                    single-use link. No one drafts it, and no one has to remember to send it.
                  </p>
                ),
              },
              {
                num: '04',
                title: 'The new member completes the form',
                cadence: 'Self-serve',
                actor: 'human',
                actorLabel: 'New member',
                body: (
                  <p>
                    The link opens the onboarding form, already tied to the right person. The new member fills in the
                    details only they can provide: contact, emergency contact, banking, and identity. This is the same
                    intake that used to live in a spreadsheet, now built into the site.
                  </p>
                ),
              },
              {
                num: '05',
                title: 'The applicant becomes an employee on probation',
                cadence: 'On submit',
                actor: 'system',
                body: (
                  <p>
                    On submit, the details are saved and the existing applicant record is promoted in place to an
                    employee on probation. The system matches the person instead of creating a duplicate, so their
                    hiring history stays attached to who they now are. Sensitive fields land in the restricted store,
                    not the general record. If someone was hired directly and has no applicant on file, the record is
                    still created and the operations team is notified to backfill the hiring-side details, so
                    onboarding is never blocked waiting on paperwork.
                  </p>
                ),
              },
              {
                num: '06',
                title: 'The portal invite sends',
                cadence: 'Same moment',
                actor: 'system',
                body: (
                  <p>
                    Completing the form triggers a portal invitation sent to their personal email. The new employee
                    sets a password and gets an account on the team portal, no admin ticket required. Because the invite
                    uses the personal address, it never waits on the Lark account.
                  </p>
                ),
              },
              {
                num: '07',
                title: 'The employee logs in on day one',
                cadence: 'Day one',
                actor: 'human',
                actorLabel: 'Employee',
                body: (
                  <p>
                    First login lands on their onboarding home: the information they just submitted, their probation
                    details, and the benefits and health-insurance surface we keep building out. Onboarding stops being
                    a folder of PDFs and becomes a place they can log into.
                  </p>
                ),
              },
            ]}
          />
        </div>
      </section>

      {/* Anatomy + rules */}
      <section className="section">
        <div className="container">
          <SevenElements elements={ELEMENTS} />
          <div className="wf-info-grid">
            <div className="wf-info-card">
              <h3>The standing rules</h3>
              <ul>
                <li>Only a hired applicant triggers onboarding; the recruiter owns that call</li>
                <li>A submission promotes the existing record; it never creates a second one</li>
                <li>A direct hire with no applicant on file still onboards; operations is notified to backfill it</li>
                <li>The Lark @edge8.ai email is set up by hand after the hire and recorded in Edge8 OS; it never gates the portal invite</li>
                <li>Banking and identity data live in the restricted store, out of the general record</li>
                <li>The portal account is issued on completion, not by an admin request</li>
              </ul>
            </div>
            <div className="wf-info-card wf-info-card-mint">
              <h3>Why it works</h3>
              <ul>
                <li>The applicant and the employee are the same record, so nothing is retyped or lost</li>
                <li>The new member does their own intake, on their own time, from a link</li>
                <li>Hiring flows straight into onboarding with no manual handoff in between</li>
                <li>Every start date is backed by stamped dates and a completed form, not memory</li>
              </ul>
            </div>
          </div>
          <DetailFooter />
        </div>
      </section>
    </main>
  )
}
