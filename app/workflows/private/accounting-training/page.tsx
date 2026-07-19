import type { Metadata } from 'next'
import Link from 'next/link'
import { WorkflowHero, StepCards } from '../../ui'

export const metadata: Metadata = {
  title: 'Accounting Training Guide | Edge8',
  description: 'Internal training guide for the Edge8 monthly accounting close.',
  robots: { index: false, follow: false },
}

export default function AccountingTrainingPage() {
  return (
    <main>
      <WorkflowHero
        category="Operations · Internal"
        title="Accounting Training Guide"
        tldr="Everything around the monthly close that is not a step: the ground rules, the exceptions, the vendor treatments, and the traps that have already cost us money. The expense entry workflow covers the steps; the monthly invoicing workflow is separate and produces the invoices that pass-throughs reconcile against."
        meta={[
          { label: 'Audience', value: 'Accounting' },
          { label: 'Judgment zones', value: 'AIO + pass-throughs' },
          { label: 'Cost of getting it wrong', value: '$5,000+ last year' },
        ]}
      />

      {/* Ground rules */}
      <section className="section" style={{ paddingBottom: 48 }}>
        <div className="container">
          <span className="section-label">Never bend these</span>
          <h2 className="section-title" style={{ fontSize: 34 }}>
            The five ground rules
          </h2>
          <div className="wf-problems">
            <div className="wf-problem">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="4.9" y1="4.9" x2="19.1" y2="19.1" />
              </svg>
              <strong>Do not link the bank account.</strong> Checking 2058 has mixed use with EO and is out of balance.
              Everything is entered manually.
            </div>
            <div className="wf-problem">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="4.9" y1="4.9" x2="19.1" y2="19.1" />
              </svg>
              <strong>No accounts payable.</strong> We pay everything immediately. Every expense is a direct payment out
              of checking 2058.
            </div>
            <div className="wf-problem">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="4.9" y1="4.9" x2="19.1" y2="19.1" />
              </svg>
              <strong>Coiboi never enters QuickBooks.</strong> Online Chinese astrology is not a business expense. No
              exceptions.
            </div>
            <div className="wf-problem">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="4.9" y1="4.9" x2="19.1" y2="19.1" />
              </svg>
              <strong>Can&apos;t bill it? Not a pass-through.</strong> If no client can be invoiced for it, it is a real
              expense. Categorize it as one.
            </div>
            <div className="wf-problem">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="4.9" y1="4.9" x2="19.1" y2="19.1" />
              </svg>
              <strong>Non-core activity gets paired.</strong> Brett-type trips go in as Other Income and Other Expense
              so we can see if the activity made money. Expect less of this over time.
            </div>
          </div>
        </div>
      </section>

      {/* Mental model */}
      <section className="section" style={{ paddingTop: 24, paddingBottom: 48 }}>
        <div className="container">
          <span className="section-label">The mental model</span>
          <h2 className="section-title" style={{ fontSize: 34 }}>
            Three things make this easy. One makes it hard.
          </h2>
          <div className="wf-problems">
            <div className="wf-problem wf-problem-ok">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <strong>The business is stable.</strong> Revenue and costs barely change month to month. Your best error
              detector is the previous month&apos;s P&amp;L.
            </div>
            <div className="wf-problem wf-problem-ok">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <strong>We pay immediately.</strong> No accounts payable, no accruals. Every expense is a direct payment
              out of checking 2058.
            </div>
            <div className="wf-problem wf-problem-ok">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <strong>Costs are consistent.</strong> Staffing and operations are highly predictable, so most of the
              close is confirming this month looks like last month.
            </div>
            <div className="wf-problem wf-problem-warn">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
                <path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
              </svg>
              <strong>Pass-throughs are the trap.</strong> We buy software for clients and bill it back. When this goes
              wrong it goes very wrong: over $5,000 in cleanup fees last year.
            </div>
          </div>
          <div className="wf-loop-note">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
            <span>
              An expense that fits no normal bucket is one of four things: an <strong>AIO cost</strong>, a{' '}
              <strong>non-core activity</strong> (paired Other Income / Other Expense, like the Brett Pica trip), a{' '}
              <strong>pass-through we forgot to bill</strong> (flag it), or{' '}
              <strong>not a business expense at all</strong> (Coiboi never enters QuickBooks).
            </span>
          </div>
        </div>
      </section>

      {/* Pass-through deep dive */}
      <section className="section" style={{ background: 'var(--tint)', padding: '72px 0' }}>
        <div className="container">
          <span className="section-label" style={{ background: 'var(--white)' }}>
            The trap, in detail
          </span>
          <h2 className="section-title" style={{ fontSize: 34 }}>
            Pass-throughs: one rule, three failure modes
          </h2>
          <p className="section-sub" style={{ marginTop: 12 }}>
            The one rule: if we cannot bill someone for it, it is not a pass-through. It is a real expense.
            Pass-throughs are logged as Project Expenses and must match invoices on pass-through income. Those invoices
            come from the <Link href="/workflows/monthly-invoicing">monthly invoicing workflow</Link>, which is a
            separate workflow from expense entry.
          </p>
          <StepCards
            steps={[
              {
                num: '01',
                title: 'We are not billing clients properly',
                actor: 'human',
                actorLabel: 'Flag it',
                body: (
                  <p>
                    Software bought for a client with no matching invoice means the client never got charged. Flag it
                    the month it happens; catching it a year later is what generated the $5,000 cleanup.
                  </p>
                ),
              },
              {
                num: '02',
                title: 'The expense is real but miscategorized',
                actor: 'human',
                actorLabel: 'Recategorize',
                body: (
                  <p>
                    Some Project Expenses turn out to be genuine business costs sitting in the wrong bucket. Dave
                    already fixed a batch of these. When you find one, recategorize it as a real expense.
                  </p>
                ),
              },
              {
                num: '03',
                title: "The vendor charge doesn't say who it's for",
                actor: 'human',
                actorLabel: 'Identify first',
                body: (
                  <p>
                    Wix is the classic case: lots of payments, no client noted, mostly EO, probably under-billed. Never
                    categorize an ambiguous charge; identify the client first.
                  </p>
                ),
              },
            ]}
          />
          <div className="wf-info-grid">
            <div className="wf-info-card" style={{ background: 'var(--white)' }}>
              <h3>What normal looks like</h3>
              <ul>
                <li>Pass-through expenses are roughly flat month to month</li>
                <li>A month at zero is an error (the original Jan/Feb bug, since fixed)</li>
                <li>Income above expense usually means batched billing (March is the known example)</li>
              </ul>
            </div>
            <div className="wf-info-card wf-info-card-mint" style={{ background: 'var(--white)' }}>
              <h3>The EO complication</h3>
              <ul>
                <li>EO is entangled in both directions: we accepted money for them and paid bills for them</li>
                <li>Shared bank use is why checking 2058 stays unlinked in QuickBooks</li>
                <li>Dave is building one single EO reconciliation; in August everything EO moves off our bills</li>
                <li>HubSpot was EO pre-paid in December, final payment August, then canceled. Don&apos;t panic when it disappears</li>
                <li>Until then: flag anything EO-related you can&apos;t confidently categorize</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Judgment + golden habit */}
      <section className="section">
        <div className="container">
          <span className="section-label">Where judgment lives</span>
          <h2 className="section-title" style={{ fontSize: 34 }}>
            AIO is a conversation, not a formula
          </h2>
          <p className="section-sub" style={{ marginTop: 12 }}>
            AIO expense allocation is deliberately more art than science, which is why the workflow schedules a human
            step instead of pretending a rule exists.
          </p>
          <div className="wf-info-grid">
            <div className="wf-info-card">
              <h3>Why AIO can&apos;t be automated</h3>
              <ul>
                <li>No pure staffed AIO employees anymore, except Ethan</li>
                <li>
                  The AI program contractors bucket is defined by subtraction: whatever Vietnam expense remains after
                  staffing, operations, and clear Edge8 expenses
                </li>
                <li>Dave&apos;s speaking fees also flow through here</li>
                <li>
                  The rule: a short monthly conversation with Dave before entering AIO numbers. Do not skip it, do not
                  guess
                </li>
              </ul>
            </div>
            <div className="wf-info-card wf-info-card-mint">
              <h3>The golden habit: P&amp;L first, P&amp;L last</h3>
              <ul>
                <li>First: run the P&amp;L before entering anything. Anything that moved is real or a mistake; find out which</li>
                <li>Last: run it again after all entries and spot-check consistency</li>
                <li>Flag, don&apos;t fix silently. The standard path is a conversation with Dave to identify problem entries</li>
                <li>History shows silent fixes are how the $5,000 cleanup happened</li>
              </ul>
            </div>
          </div>
          <div className="wf-loop-note">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
            <span>
              <strong>One-time caution:</strong> QuickBooks entries for January through July are already filled in, but
              they need triple-checking, not trusting.
            </span>
          </div>
        </div>
      </section>

      {/* Vendor treatments */}
      <section className="section" style={{ background: 'var(--tint)', padding: '72px 0' }}>
        <div className="container">
          <span className="section-label" style={{ background: 'var(--white)' }}>
            Quick reference
          </span>
          <h2 className="section-title" style={{ fontSize: 34 }}>
            Vendor treatments
          </h2>
          <div className="wf-table-wrap">
            <table className="wf-table">
              <thead>
                <tr>
                  <th>Vendor / bill</th>
                  <th>Treatment</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Google Workspace</td>
                  <td><span className="wf-tag wf-tag-expense">Expense</span></td>
                  <td>Three legitimate company accounts: Edge8.co, TalentEdge.io, StartupSuccess.vn (old company name).</td>
                </tr>
                <tr>
                  <td>Claude, Dave</td>
                  <td><span className="wf-tag wf-tag-expense">Expense</span></td>
                  <td>Personal seat, company paid.</td>
                </tr>
                <tr>
                  <td>Claude, Khoa</td>
                  <td><span className="wf-tag wf-tag-expense">Expense</span></td>
                  <td>Personal seat, company paid.</td>
                </tr>
                <tr>
                  <td>Claude, Edge8 team</td>
                  <td><span className="wf-tag wf-tag-expense">Expense</span></td>
                  <td>Team plan.</td>
                </tr>
                <tr>
                  <td>Claude, Hieu</td>
                  <td><span className="wf-tag wf-tag-pass">Pass-through</span></td>
                  <td>UNLOCK. Must be billed back.</td>
                </tr>
                <tr>
                  <td>Claude, Tam / Ngan / Alex</td>
                  <td><span className="wf-tag wf-tag-pass">Pass-through</span></td>
                  <td>EO VN team plan. Must be billed back.</td>
                </tr>
                <tr>
                  <td>HubSpot</td>
                  <td><span className="wf-tag wf-tag-expense">Ends Aug</span></td>
                  <td>Pre-paid by EO in December. Last payment August, then those subscriptions get canceled.</td>
                </tr>
                <tr>
                  <td>Wix</td>
                  <td><span className="wf-tag wf-tag-pass">Check first</span></td>
                  <td>Multiple payments, mostly EO, not noted who they are for. Confirm the client before categorizing; billing was likely missed.</td>
                </tr>
                <tr>
                  <td>N8N</td>
                  <td><span className="wf-tag wf-tag-never">Canceled</span></td>
                  <td>Should be canceled. Any new charge is an error.</td>
                </tr>
                <tr>
                  <td>Coiboi / astrology</td>
                  <td><span className="wf-tag wf-tag-never">Never enter</span></td>
                  <td>Does not go into QuickBooks under any circumstances.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="wf-open">
            <h3>Current open items</h3>
            <p>One-off cleanup, not part of the steady-state close. Remove items as they resolve.</p>
            <ul>
              <li>Verify with Hieu (UNLOCK): Claude subscription, ChatGPT subscription (confirm it exists), Azure</li>
              <li>January and February have project expenses with no matching invoices: resolve</li>
              <li>April was billed incorrectly: Azure is missing</li>
              <li>Figure out what the &quot;MS Bill&quot; charge is</li>
              <li>Review Wix spending and identify who each charge belongs to</li>
              <li>Confirm N8N is canceled</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Onboarding + escalation */}
      <section className="section">
        <div className="container">
          <span className="section-label">Getting started</span>
          <h2 className="section-title" style={{ fontSize: 34 }}>
            First month, and when to escalate
          </h2>
          <div className="wf-info-grid">
            <div className="wf-info-card">
              <h3>First-month checklist</h3>
              <ul>
                <li>
                  Read the <Link href="/workflows/monthly-expenses">expense entry workflow</Link> end to end
                </li>
                <li>
                  Get access: QuickBooks, Vietnam bank transactions, the{' '}
                  <a href="https://edge8company.sg.larksuite.com/wiki/D7KuwVxFEiXHxfkIhj8ldAeegcb?sheet=QAXynP">
                    finance tracking sheet
                  </a>
                  , Dave&apos;s US expense sheet
                </li>
                <li>Run the P&amp;L for the trailing 6 months and study the shape of the business before touching anything</li>
                <li>
                  Understand the <Link href="/workflows/monthly-invoicing">monthly invoicing workflow</Link>: it
                  produces the invoices pass-throughs reconcile against
                </li>
                <li>Schedule the monthly AIO conversation with Dave</li>
                <li>Work through the open items list above with Dave</li>
              </ul>
            </div>
            <div className="wf-info-card wf-info-card-mint">
              <h3>Escalate to Dave when</h3>
              <ul>
                <li>Any P&amp;L line moves and you can&apos;t explain it</li>
                <li>A Project Expense has no matching invoice</li>
                <li>An EO-related charge is ambiguous</li>
                <li>A vendor charge doesn&apos;t match the treatments table (like the unidentified &quot;MS Bill&quot;)</li>
                <li>Anything Brett-Pica-shaped shows up: non-core activity needing paired other income / expense</li>
              </ul>
            </div>
          </div>
          <div className="wf-detail-foot">
            <Link href="/workflows/monthly-expenses" className="wf-back">
              ← The expense entry workflow, step by step
            </Link>
            <Link href="/workflows/monthly-invoicing" className="wf-back">
              Monthly invoicing workflow →
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
