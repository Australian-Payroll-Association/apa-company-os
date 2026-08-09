import type { Metadata } from 'next'
import { WorkflowHero, StepCards } from '../../../ui'

export const metadata: Metadata = {
  title: 'Staffing Contract Renewal | Edge8',
  description: 'Internal workflow for renewing or extending a staffing contract: CRM deal, agreement, signature, close-out.',
  robots: { index: false, follow: false },
}

const CLIENTS = [
  {
    name: 'Unlock Venture Partners',
    engagement: 'AI Engineer',
    anniversary: 'July 1',
    since: '2024',
    status: '2026 renewal open (Proposal)',
  },
  {
    name: 'On Target by Abound Health',
    engagement: 'Health Team, Product Owner, Mobile Engineers (consolidated 2025)',
    anniversary: 'July 1',
    since: '2024',
    status: '2026 contract extension open (Proposal)',
  },
  {
    name: 'Wareease',
    engagement: 'Qualicious team',
    anniversary: 'January 1',
    since: '2025',
    status: 'Renewed for 2026 (won)',
  },
  {
    name: 'Entrepreneurs Organization',
    engagement: 'HubSpot Rollout + Chapter Management Tools',
    anniversary: 'January',
    since: '2026',
    status: 'Year 1 running, first renewal due T-90 from January 2027',
  },
]

export default function StaffingContractRenewalPage() {
  return (
    <main>
      <WorkflowHero
        category="Sales · Internal"
        title="Staffing Contract Renewal"
        tldr="Staffing revenue renews on contract anniversaries, not on new sales calls. This workflow starts 60 to 90 days before an anniversary, forces an explicit decision (renew as-is, renew at a new rate or shape, or walk away), and ends with a closed deal in Company OS either way, so renewals and churn are both visible in the pipeline."
        meta={[
          { label: 'Audience', value: 'Sales ops' },
          { label: 'Trigger', value: '60-90 days before anniversary' },
          { label: 'System of record', value: 'Company OS deals' },
        ]}
      />

      {/* Staffing clients */}
      <section className="section" style={{ paddingBottom: 48 }}>
        <div className="container">
          <span className="section-label">Who this applies to</span>
          <h2 className="section-title" style={{ fontSize: 34 }}>
            The staffing clients
          </h2>
          <p style={{ maxWidth: 720, marginBottom: 24 }}>
            The CRM is the source of truth: any deal carrying the <code>Staffing</code> category belongs to this
            workflow. As of August 2026 that is four clients.
          </p>
          <div className="wf-problems">
            {CLIENTS.map((c) => (
              <div key={c.name} className="wf-problem">
                <strong>{c.name}.</strong> {c.engagement}. Client since {c.since}, contract anniversary{' '}
                {c.anniversary}. Current: {c.status}.
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CRM conventions */}
      <section className="section" style={{ paddingTop: 24, paddingBottom: 48 }}>
        <div className="container">
          <span className="section-label">Ground rules</span>
          <h2 className="section-title" style={{ fontSize: 34 }}>
            How renewals live in the CRM
          </h2>
          <div className="wf-problems">
            <div className="wf-problem">
              <strong>One deal, one contract.</strong> Every contract year is its own deal. The signed agreement is a
              Google Doc linked in the deal&apos;s <code>metadata.contract_url</code>. Never stretch an old deal to
              cover a new year.
            </div>
            <div className="wf-problem">
              <strong>Every deal has exactly one type.</strong> <code>metadata.type</code> is <code>new</code>,{' '}
              <code>renewal</code>, or <code>expansion</code>. Same team, next year: renewal. Bigger team or wider
              scope: expansion. First contract with the client: new.
            </div>
            <div className="wf-problem">
              <strong>Renewals chain backwards.</strong> Every renewal or expansion deal carries{' '}
              <code>metadata.renews_deal_id</code> pointing at the deal it replaces, so the full history of a client
              reads as a chain from the original deal to the current one.
            </div>
            <div className="wf-problem">
              <strong>Categories carry the money.</strong> <code>metadata.categories</code> is a list of{' '}
              <code>{'{name, amount_usd}'}</code> entries (Staffing, AI Program, Keynote, AIOlabz). A deal can hold
              more than one category; the amounts must always sum to the deal value.
            </div>
          </div>
        </div>
      </section>

      {/* Decision flow diagram */}
      <section className="section" style={{ paddingTop: 24, paddingBottom: 48 }}>
        <div className="container">
          <span className="section-label">The flow</span>
          <h2 className="section-title" style={{ fontSize: 34 }}>
            One decision point, three paths
          </h2>
          <style dangerouslySetInnerHTML={{ __html: `
            .rnw-flow { margin-top: 12px; }
            .rnw-node {
              border: 1px solid var(--card-border);
              border-radius: 12px;
              background: var(--white);
              padding: 14px 16px;
              font-size: 14px;
              line-height: 1.45;
            }
            .rnw-node strong { display: block; font-family: var(--font-display); font-size: 15px; color: var(--dark); margin-bottom: 2px; }
            .rnw-top { display: flex; align-items: stretch; }
            .rnw-top .rnw-node { flex: 1; }
            .rnw-arrow {
              flex: 0 0 36px;
              display: flex; align-items: center; justify-content: center;
              color: var(--blue); font-size: 18px; font-weight: 700;
            }
            .rnw-decision {
              border: 2px solid var(--blue);
              background: rgba(40, 123, 232, 0.06);
            }
            .rnw-decision strong { color: var(--blue); }
            .rnw-split { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0 20px; }
            .rnw-branch { display: flex; flex-direction: column; }
            .rnw-branch-label {
              font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
              text-align: center; padding: 6px 12px; border-radius: 40px; margin: 0 auto;
            }
            .rnw-branch .rnw-node { border-top-width: 3px; }
            .rnw-drop { height: 34px; position: relative; }
            .rnw-drop::before {
              content: ''; position: absolute; top: 0; bottom: 0; left: 50%;
              border-left: 2px dashed var(--card-border);
            }
            .rnw-vgap { height: 20px; position: relative; }
            .rnw-vgap::before {
              content: ''; position: absolute; top: 0; bottom: 0; left: 50%;
              border-left: 2px solid var(--card-border);
            }
            .rnw-end { text-align: center; font-size: 13px; font-weight: 600; padding: 10px 12px; border-radius: 12px; }
            .rnw-a .rnw-branch-label { background: rgba(43, 168, 74, 0.12); color: var(--wf-green); }
            .rnw-a .rnw-node { border-top-color: var(--wf-green); }
            .rnw-a .rnw-end { background: rgba(43, 168, 74, 0.1); color: var(--wf-green); }
            .rnw-b .rnw-branch-label { background: rgba(40, 123, 232, 0.12); color: var(--blue); }
            .rnw-b .rnw-node { border-top-color: var(--blue); }
            .rnw-b .rnw-end { background: rgba(40, 123, 232, 0.1); color: var(--blue); }
            .rnw-c .rnw-branch-label { background: rgba(16, 16, 20, 0.08); color: var(--dark); }
            .rnw-c .rnw-node { border-top-color: var(--dark); }
            .rnw-c .rnw-end { background: rgba(16, 16, 20, 0.06); color: var(--dark); }
            @media (max-width: 860px) {
              .rnw-top { flex-direction: column; }
              .rnw-arrow { flex-basis: 30px; transform: rotate(90deg); }
              .rnw-split { grid-template-columns: 1fr; gap: 28px; }
            }
          ` }} />
          <div className="rnw-flow">
            <div className="rnw-top">
              <div className="rnw-node">
                <strong>1 · Renewal calendar</strong>
                Monthly query: staffing deals with an anniversary inside 90 days and no successor deal.
              </div>
              <div className="rnw-arrow">→</div>
              <div className="rnw-node">
                <strong>2 · Collect the feedback</strong>
                No survey this contract year? Send it now. Operations summarizes everything the client told us all
                year.
              </div>
              <div className="rnw-arrow">→</div>
              <div className="rnw-node">
                <strong>3 · Review the contract year</strong>
                Delivery quality, team changes, rate pressure, and the feedback summary. Gather the facts.
              </div>
              <div className="rnw-arrow">→</div>
              <div className="rnw-node rnw-decision">
                <strong>4 · Decision</strong>
                Will they renew, and at what shape? Three paths out, never zero.
              </div>
            </div>
            <div className="rnw-split">
              <div className="rnw-branch rnw-a">
                <div className="rnw-drop" />
                <div className="rnw-branch-label">Renews as-is</div>
                <div className="rnw-vgap" />
                <div className="rnw-node">
                  <strong>Create renewal deal</strong>
                  Type <code>renewal</code>, current run rate, chained to last year&apos;s deal.
                </div>
                <div className="rnw-vgap" />
                <div className="rnw-node">
                  <strong>Roll the agreement</strong>
                  Copy last year&apos;s doc, update the term dates only. Human reads it, client signs.
                </div>
                <div className="rnw-vgap" />
                <div className="rnw-end">Deal won · contract linked</div>
              </div>
              <div className="rnw-branch rnw-b">
                <div className="rnw-drop" />
                <div className="rnw-branch-label">Renews at a new rate or shape</div>
                <div className="rnw-vgap" />
                <div className="rnw-node">
                  <strong>Create renewal or expansion deal</strong>
                  New financials block. Same team at a new rate is a <code>renewal</code>; a bigger team or wider
                  scope is an <code>expansion</code>.
                </div>
                <div className="rnw-vgap" />
                <div className="rnw-node">
                  <strong>Negotiate and redraft</strong>
                  New rates and roster in the agreement. Stage Contract Sent; loop here until terms are agreed,
                  updating the estimate each round.
                </div>
                <div className="rnw-vgap" />
                <div className="rnw-end">Deal won at new value · contract linked</div>
              </div>
              <div className="rnw-branch rnw-c">
                <div className="rnw-drop" />
                <div className="rnw-branch-label">Does not renew</div>
                <div className="rnw-vgap" />
                <div className="rnw-node">
                  <strong>Record the churn</strong>
                  The renewal deal is still created, then marked lost with a <code>lost_reason</code>. Churn must be
                  visible in the pipeline, not silent.
                </div>
                <div className="rnw-vgap" />
                <div className="rnw-node">
                  <strong>Offboard cleanly</strong>
                  Wind down the team, send the final invoice, hand over documentation.
                </div>
                <div className="rnw-vgap" />
                <div className="rnw-end">Deal lost · relationship stays warm</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Step details */}
      <section className="section" style={{ paddingTop: 24, paddingBottom: 48 }}>
        <div className="container">
          <span className="section-label">Step by step</span>
          <h2 className="section-title" style={{ fontSize: 34 }}>
            The workflow in detail
          </h2>
          <StepCards
            steps={[
              {
                num: '1',
                title: 'Check the renewal calendar',
                cadence: 'Monthly',
                actor: 'ai',
                body: (
                  <>
                    Query Company OS for staffing deals with a <code>contract_start_date</code> in{' '}
                    <code>metadata.financials</code>. Anniversary = start date + duration. Anything inside the next 90
                    days without a successor deal (no newer deal whose <code>renews_deal_id</code> points at it) goes
                    on the list.
                  </>
                ),
              },
              {
                num: '2',
                title: 'Collect and summarize the feedback',
                cadence: 'T-90 days',
                actor: 'human',
                actorLabel: 'Operations + AI',
                body: (
                  <>
                    Check whether the client received a satisfaction survey during this contract year. If not, send
                    one the moment the calendar flags the renewal, so the responses are back before the decision. Then
                    the operations person compiles everything the client told us across the year (survey responses,
                    meeting notes, praise, complaints, escalations) into a one-page feedback summary attached to the
                    deal. The renewal decision is made on that summary, not on memory.
                  </>
                ),
              },
              {
                num: '3',
                title: 'Review the contract year',
                cadence: 'T-80 days',
                actor: 'human',
                body: (
                  <>
                    Pull the expiring agreement and gather the facts the decision needs: did the team change (people,
                    seniority, hours)? Is the rate still right for the market and the margin? And what does the
                    feedback summary say: is the client happy, and is there an upsell or a risk on the table?
                  </>
                ),
              },
              {
                num: '4',
                title: 'Make the renewal decision',
                cadence: 'T-75 days',
                actor: 'human',
                body: (
                  <>
                    The decision point has exactly three outcomes, and one of them must be chosen explicitly:{' '}
                    <strong>renews as-is</strong> (same team, same rate), <strong>renews at a new rate or shape</strong>{' '}
                    (repriced, or a bigger team, which makes it an expansion), or <strong>does not renew</strong>.
                    &ldquo;We&apos;ll see&rdquo; is not an outcome; an undecided renewal inside 75 days is a risk to
                    escalate, not a state to sit in.
                  </>
                ),
              },
              {
                num: '5',
                title: 'Create the successor deal',
                cadence: 'Same day',
                actor: 'ai',
                body: (
                  <>
                    Every path gets a deal in the Default sales pipeline, title pattern{' '}
                    <em>Client Contract Renewal YYYY</em>, with <code>metadata.type</code>,{' '}
                    <code>metadata.renews_deal_id</code>, category Staffing, and a financials block. As-is: open at
                    Proposal, estimated at the current run rate. New rate or shape: open at Proposal with the proposed
                    financials. No renewal: created and immediately marked lost with a <code>lost_reason</code>, so
                    churn shows up in pipeline history instead of disappearing.
                  </>
                ),
              },
              {
                num: '6',
                title: 'Agreement, send, and track',
                cadence: 'Until signed',
                actor: 'ai',
                actorLabel: 'AI + human review',
                body: (
                  <>
                    Copy last year&apos;s agreement Google Doc (linked from the prior deal&apos;s{' '}
                    <code>contract_url</code>). As-is renewals only change the term dates; repriced or reshaped
                    renewals also change rates and roster, and may loop through negotiation, updating the deal estimate
                    each round. A human reads the final doc before it reaches the client. Move the deal to Contract
                    Sent and chase it; if the anniversary passes while negotiating, the deal stays open at the
                    estimated value, never silently rolled into the old contract.
                  </>
                ),
              },
              {
                num: '7',
                title: 'Close out the deal',
                cadence: 'On signature',
                actor: 'ai',
                body: (
                  <>
                    Signed: mark the deal won with the real <code>closed_at</code>, replace estimates with actuals in
                    the financials block, and store the signed doc link in <code>metadata.contract_url</code>. Lost:
                    confirm the <code>lost_reason</code>, wind down the team, send the final invoice, and keep the
                    client on the relationship list; a lost renewal this year is a warm lead next year. Either way,
                    check whether the proposals page needs a status update.
                  </>
                ),
              },
            ]}
          />
        </div>
      </section>
    </main>
  )
}
