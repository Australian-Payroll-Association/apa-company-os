import type { Metadata } from 'next'
import { WorkflowHero, FlowRail, StepCards } from '../../../ui'

export const metadata: Metadata = {
  title: 'Staffing Contract Renewal | Edge8',
  description: 'Internal workflow for renewing or extending a staffing contract: CRM deal, agreement, signature, close-out.',
  robots: { index: false, follow: false },
}

export default function StaffingContractRenewalPage() {
  return (
    <main>
      <WorkflowHero
        category="Sales · Internal"
        title="Staffing Contract Renewal"
        tldr="Staffing revenue renews on contract anniversaries, not on new sales calls. This workflow starts 60 to 90 days before an anniversary and ends with a signed agreement, a won deal in Company OS, and a clean renewal chain from the original deal to the current one."
        meta={[
          { label: 'Audience', value: 'Sales ops' },
          { label: 'Trigger', value: '60-90 days before anniversary' },
          { label: 'System of record', value: 'Company OS deals' },
        ]}
      />

      {/* CRM conventions */}
      <section className="section" style={{ paddingBottom: 48 }}>
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

      {/* Flow rail */}
      <section className="section" style={{ paddingTop: 24, paddingBottom: 48 }}>
        <div className="container">
          <span className="section-label">The loop</span>
          <h2 className="section-title" style={{ fontSize: 34 }}>
            Six steps, anniversary to signature
          </h2>
          <FlowRail
            steps={[
              { num: '1', title: 'Check the renewal calendar', cadence: 'Monthly', actor: 'ai' },
              { num: '2', title: 'Review the contract year', cadence: 'T-90 days', actor: 'human' },
              { num: '3', title: 'Create the renewal deal', cadence: 'Same day', actor: 'ai' },
              { num: '4', title: 'Draft the agreement', cadence: 'T-60 days', actor: 'ai' },
              { num: '5', title: 'Send and track', cadence: 'Until signed', actor: 'human' },
              { num: '6', title: 'Close out the deal', cadence: 'On signature', actor: 'ai' },
            ]}
            repeatNote="Repeats every contract year, per client."
          />
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
                    on the list. Current anniversaries: Unlock and On Target renew July 1, Wareease renews January 1.
                  </>
                ),
              },
              {
                num: '2',
                title: 'Review the contract year',
                cadence: 'T-90 days',
                actor: 'human',
                body: (
                  <>
                    Pull the expiring agreement and answer three questions. Did the team change (people, seniority,
                    hours)? Does the rate change? Is the client happy enough to renew as-is, or is there an upsell or a
                    risk? The answers decide the deal type: same shape is a <strong>renewal</strong>, bigger shape is
                    an <strong>expansion</strong>. This is the only judgment step in the workflow.
                  </>
                ),
              },
              {
                num: '3',
                title: 'Create the renewal deal',
                cadence: 'Same day',
                actor: 'ai',
                body: (
                  <>
                    New deal in the Default sales pipeline at stage Proposal, status open. Title pattern:{' '}
                    <em>Client Contract Renewal YYYY</em>. Set <code>metadata.type</code>,{' '}
                    <code>metadata.renews_deal_id</code>, category Staffing with the full estimated value, and a
                    financials block: estimated USD, monthly payment, duration, and the new{' '}
                    <code>contract_start_date</code>. Estimate at the current run rate until the new rate is agreed.
                  </>
                ),
              },
              {
                num: '4',
                title: 'Draft the agreement',
                cadence: 'T-60 days',
                actor: 'ai',
                actorLabel: 'AI + human review',
                body: (
                  <>
                    Copy last year&apos;s agreement Google Doc (linked from the prior deal&apos;s{' '}
                    <code>contract_url</code>), update the term dates, team roster, and rates, and leave the rest
                    untouched. A human reads the final doc before it goes anywhere near the client.
                  </>
                ),
              },
              {
                num: '5',
                title: 'Send and track',
                cadence: 'Until signed',
                actor: 'human',
                body: (
                  <>
                    Send the agreement, move the deal to Contract Sent, and chase it. The deal stays open until
                    signature; if the anniversary passes while negotiating, the deal stays open at the estimated value,
                    never silently rolled into the old contract.
                  </>
                ),
              },
              {
                num: '6',
                title: 'Close out the deal',
                cadence: 'On signature',
                actor: 'ai',
                body: (
                  <>
                    Mark the deal won with the real <code>closed_at</code>, replace the estimate with actuals in the
                    financials block, and store the signed doc link in <code>metadata.contract_url</code>. If the
                    client did not renew, mark it lost with a <code>lost_reason</code> so churn is visible in the
                    pipeline, then check whether the proposals page needs a status update.
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
