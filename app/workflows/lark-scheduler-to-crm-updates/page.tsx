import type { Metadata } from 'next'
import Link from 'next/link'
import { WorkflowHero, FlowRail, StepCards, SevenElements, DetailFooter, type WorkflowElement } from '../ui'

const title = 'Lark Scheduler to CRM Updates | Edge8 Workflows'
const description =
  'Two scheduled agents bracket every sales call: one turns each external calendar booking into a CRM lead before the call, and one turns each recorded call into a complete CRM record, a drafted follow-up, and a coaching note after it.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/workflows/lark-scheduler-to-crm-updates/' },
  openGraph: { title, description, url: '/workflows/lark-scheduler-to-crm-updates/', type: 'website' },
  twitter: { card: 'summary_large_image', title, description },
}

const ELEMENTS: WorkflowElement[] = [
  { name: 'Trigger', assignment: 'machine', desc: 'Time, twice a day. 6am catches the bookings that arrived overnight; 6pm catches the calls that happened since.' },
  { name: 'Inputs', assignment: 'machine', desc: 'Calendar events with external guests, and the day&rsquo;s meeting transcripts from Lark Minutes. Both already exist; nobody types anything.' },
  { name: 'Decision', assignment: 'both', desc: 'The agents decide what is external, who matches whom, and how a lead advances. Anything uncertain is skipped and flagged for the human, never guessed.' },
  { name: 'Routing', assignment: 'machine', desc: 'Internal meetings and 1-1s are filtered out. Only genuine external conversations reach the CRM.' },
  { name: 'Output', assignment: 'machine', desc: 'CRM rows: person, company, lead, meeting with full transcript, interactions, lifecycle transitions. Plus one drafted follow-up email per call.' },
  { name: 'Delivery', assignment: 'machine', desc: 'A morning Lark message listing new leads, and an evening one per day with calls: CRM links, the waiting draft, and two coaching notes.' },
  { name: 'Measurement', assignment: 'human', desc: 'The pipeline is inspectable at any hour: every lead has a source, every deal has a next step with a date, every call has a transcript behind it.' },
]

const GUARDRAILS = [
  {
    rule: 'Nothing external, ever',
    chip: 'Hard rule',
    kind: 'reject' as const,
    desc: 'No email is sent, no prospect is messaged, no calendar event is touched. The agents write to the CRM and talk to one person: the owner.',
  },
  {
    rule: 'Drafts are drafts',
    chip: 'Human sends',
    kind: 'approve' as const,
    desc: 'The follow-up email waits in the drafts folder for a human read and a human send. The send button is a human job by design.',
  },
  {
    rule: 'Leads are not deals',
    chip: 'No phantom pipeline',
    kind: 'reject' as const,
    desc: 'A deal is created only when a call discussed a real, priced opportunity. Nobody gets a pipeline full of invented value.',
  },
  {
    rule: 'Idempotent by design',
    chip: 'Re-runs are no-ops',
    kind: 'info' as const,
    desc: 'Every write is keyed to the calendar event or the recording token. Running twice changes nothing, and never duplicates.',
  },
  {
    rule: 'Uncertain means skipped',
    chip: 'Flag, never guess',
    kind: 'info' as const,
    desc: 'A booking or recording the agent cannot confidently match is reported to the human, not guessed at. A wrong record is worse than a missing one.',
  },
]

export default function LarkSchedulerToCrmUpdatesWorkflowPage() {
  return (
    <main>
      <WorkflowHero
        category="Revenue"
        title="Lark Scheduler to CRM Updates"
        tldr="A prospect books a call, the call happens, and the pipeline quietly falls behind the calendar unless someone types it all in. Two scheduled agents close that gap: one turns every external booking into a CRM lead before the call, and one turns every recorded call into a complete CRM record, a drafted follow-up, and a coaching note after it. The human keeps the two moments that matter: the call itself, and the send button."
        meta={[
          { label: 'Source', value: 'Lark Calendar + Minutes' },
          { label: 'Cadence', value: 'Daily, 6am and 6pm' },
          { label: 'Human touchpoints', value: 'The call, the send' },
        ]}
      />

      {/* The flow */}
      <section className="section" style={{ paddingBottom: 48 }}>
        <div className="container">
          <span className="section-label">The flow</span>
          <h2 className="section-title section-title--sm">Two agents, bracketing the call</h2>
          <p className="section-sub" style={{ marginTop: 12 }}>
            The calendar and the call recordings already hold everything a CRM entry needs. What was missing was the
            courier. Done by hand, each call costs 20 to 30 minutes of admin, and gets skipped on exactly the busy days
            when the pipeline is fullest.
          </p>
          <FlowRail
            steps={[
              { num: '01', title: 'Booking Lands', cadence: 'Scheduling link', actor: 'system' },
              { num: '02', title: 'Lead Created', cadence: '6am daily', actor: 'ai', actorLabel: 'Claude' },
              { num: '03', title: 'The Call Happens', cadence: 'Recorded in Lark', actor: 'human', actorLabel: 'Owner' },
              { num: '04', title: 'Transcript Lands', cadence: 'Automatic', actor: 'system' },
              { num: '05', title: 'CRM Caught Up', cadence: '6pm daily', actor: 'ai', actorLabel: 'Claude' },
              { num: '06', title: 'Follow-up Drafted', cadence: 'Never auto-sent', actor: 'ai', actorLabel: 'Claude' },
              { num: '07', title: 'Report + Coaching', cadence: 'One Lark message', actor: 'system' },
            ]}
          />
          <div className="wf-loop-note">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span>
              The failure mode this kills is silent: nobody notices an uncaptured lead. The booking happened, the call
              went well, and three weeks later there is no record, no next step, and no follow-up ever sent.
            </span>
          </div>
        </div>
      </section>

      {/* Guardrails */}
      <section className="section" style={{ background: 'var(--tint)', padding: '72px 0' }}>
        <div className="container">
          <span className="section-label" style={{ background: 'var(--white)' }}>
            Guardrails
          </span>
          <h2 className="section-title section-title--sm">What the agents are not allowed to do</h2>
          <p className="section-sub" style={{ marginTop: 12 }}>
            Automation earns trust by what it refuses to do. These rules are written into each agent&apos;s runbook, not
            left to judgment.
          </p>
          <div className="wf-elements">
            {GUARDRAILS.map((g) => (
              <div key={g.rule} className="wf-element">
                <div className="wf-element-head">
                  <span className="wf-element-name">{g.rule}</span>
                </div>
                <div className="wf-outcomes" style={{ marginTop: 0, marginBottom: 10 }}>
                  <span className={`wf-outcome wf-outcome-${g.kind}`}>{g.chip}</span>
                </div>
                <p className="wf-element-desc">{g.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Step detail */}
      <section className="section">
        <div className="container">
          <span className="section-label">Step by step</span>
          <h2 className="section-title section-title--sm">How each step works</h2>
          <StepCards
            steps={[
              {
                num: '01',
                title: 'A booking lands on the calendar',
                actor: 'system',
                body: (
                  <p>
                    A prospect books through the scheduling link and the event appears in Lark Calendar with their email
                    on it. That email address is the whole trigger: an external guest means a potential lead.
                  </p>
                ),
              },
              {
                num: '02',
                title: 'The morning agent creates the lead',
                cadence: '6am daily',
                actor: 'ai',
                actorLabel: 'Claude',
                body: (
                  <>
                    <p>
                      The booking-to-lead agent scans the next 14 days of calendar for events with external guests and
                      writes each new one into the CRM properly modelled:
                    </p>
                    <ul>
                      <li>The person, with the company inferred from their email domain</li>
                      <li>The lead itself, status &ldquo;meeting booked&rdquo;</li>
                      <li>The inquiry, and the meeting logged as an interaction</li>
                    </ul>
                    <p style={{ marginTop: 10 }}>
                      Repeat visitors are recognised by email and enriched, never duplicated, and never demoted.
                    </p>
                  </>
                ),
              },
              {
                num: '03',
                title: 'The call happens',
                actor: 'human',
                actorLabel: 'Owner',
                body: (
                  <p>
                    The human&apos;s job is the conversation: discovery, qualification, the ask. Recording is on, which
                    is the one dependency the evening agent has. No notes, no tab-switching into the CRM mid-call.
                  </p>
                ),
              },
              {
                num: '04',
                title: 'The transcript lands',
                actor: 'system',
                body: (
                  <p>
                    Lark Minutes produces the full speaker-attributed transcript a few minutes after the call ends.
                    Nobody asks for it; it is simply there.
                  </p>
                ),
              },
              {
                num: '05',
                title: 'The evening agent catches the CRM up',
                cadence: '6pm daily',
                actor: 'ai',
                actorLabel: 'Claude',
                body: (
                  <>
                    <p>The call-to-CRM agent finds the day&apos;s external call recordings and, for each one:</p>
                    <ul>
                      <li>Loads the full transcript into the CRM against the meeting record</li>
                      <li>
                        Writes a structured summary from the raw conversation, not the auto-summary: company snapshot,
                        pain points, BANT, next steps
                      </li>
                      <li>Advances the lead truthfully, with every move logged as a lifecycle transition</li>
                      <li>Opens a deal only when the call produced a concrete, priced opportunity</li>
                    </ul>
                  </>
                ),
              },
              {
                num: '06',
                title: 'The follow-up email gets drafted',
                actor: 'ai',
                actorLabel: 'Claude',
                body: (
                  <p>
                    One draft per call, covering exactly what was promised in the conversation: the recap in the
                    prospect&apos;s own words, the links, the dates, the single next step. It sits in the mail drafts
                    folder and never sends itself.
                  </p>
                ),
              },
              {
                num: '07',
                title: 'One report, with coaching attached',
                cadence: 'Evenings with calls',
                actor: 'system',
                body: (
                  <>
                    <p>
                      A single Lark message closes the day: each call&apos;s outcome, a link to its CRM entry, and a
                      pointer to the waiting draft. Then the part that compounds: two short coaching notes per call,
                      written from the evidence of the transcript in the style of a sales coach.
                    </p>
                    <ul>
                      <li>
                        <strong>The call note</strong>: what the seller did well or missed. Talk ratio, discovery
                        depth, whether the pain got a dollar figure, whether the close got a date.
                      </li>
                      <li>
                        <strong>The follow-up note</strong>: the single highest-leverage move for the next touch with
                        this prospect.
                      </li>
                    </ul>
                  </>
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
                <li>Every external booking becomes a lead before the call, untouched by a human</li>
                <li>Every recorded call becomes a full CRM record by dinner</li>
                <li>The CRM is written by the system; the human reviews instead of retypes</li>
                <li>Follow-ups are drafted the same day and sent by a human, always</li>
                <li>A call with no recording is flagged, not silently skipped</li>
              </ul>
            </div>
            <div className="wf-info-card wf-info-card-mint">
              <h3>Why it works</h3>
              <ul>
                <li>The courier work is scheduled, so it happens on busy days too</li>
                <li>Same-day follow-ups go out while the conversation is still warm</li>
                <li>A system-written CRM makes the pipeline believable</li>
                <li>Every transcript doubles as a coaching rep, so the craft compounds daily</li>
                <li>No custom software: two written runbooks on a schedule, built in an afternoon</li>
              </ul>
            </div>
          </div>
          <p style={{ marginTop: 32, fontSize: 15, color: 'var(--body-text)' }}>
            This workflow replaced our earlier Sales Call Intelligence pipeline: same philosophy, now running end to end
            on scheduled agents. It feeds the same pipeline as{' '}
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
