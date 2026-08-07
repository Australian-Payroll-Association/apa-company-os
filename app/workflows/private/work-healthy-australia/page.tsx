import type { Metadata } from 'next'
import Link from 'next/link'
import PrivateGate from '../PrivateGate'
import PrivateLibrary, { type LibraryItem } from '../PrivateLibrary'

export const metadata: Metadata = {
  title: 'Work Healthy Australia Private Workflows | Edge8',
  description:
    'Internal, access-code-gated library of the Work Healthy Australia process set and the OccuSpan product plans.',
  robots: { index: false, follow: false },
}

const BASE = '/workflows/private/work-healthy-australia'

const ITEMS: LibraryItem[] = [
  {
    category: 'workflow',
    href: `${BASE}/L0-Value-Chain-v4.html`,
    title: 'L0 Value Chain, version 4',
    description:
      'Nine processes in five bands, where a band says what kind of work it is: set up once per client, raise the work, schedule it, deliver it, settle it. Processes 01 to 05 and 09 are the core chain from signed agreement to invoice. 06, 07 and 08 are drawn dashed as potential processes, not what WHA does today.',
  },
  {
    category: 'workflow',
    href: `${BASE}/L1-Process-Swimlanes-v4.html`,
    title: 'L1 Process Swimlanes, version 4',
    description:
      'All eleven L1 diagrams on one page, in swimlanes. The full process set from Setup Workplace through to Report to Invoice, with every trigger, decision, alert and employer-wall crossing shown in one view. Start here, then use the per-process pages below when you need one process on its own.',
  },
  {
    category: 'workflow',
    href: `${BASE}/L1-P01-v4.html`,
    title: 'L1 · Process 01 — Setup Workplace',
    description:
      'Triggered when an agreement is signed. Sets up a new client with their known hierarchy: Client organization, Site, Department, Role, and the requirement defaults that later processes read.',
  },
  {
    category: 'workflow',
    href: `${BASE}/L1-P02-v4.html`,
    title: 'L1 · Process 02 — Onboard and offboard clinician, practitioner, employer',
    description:
      'Who gets access to a Site and how that access ends. Requires a valid Organization and Site; Department is optional.',
  },
  {
    category: 'workflow',
    href: `${BASE}/L1-P03-v4.html`,
    title: 'L1 · Process 03 — Define the role requirements',
    description:
      'Triggered when an employer commissions the work, or when the work a Role does changes. Turns a Role into the requirements a service is later measured against.',
  },
  {
    category: 'workflow',
    href: `${BASE}/L1-P04-v4.html`,
    title: 'L1 · Process 04 — Schedule the service',
    description:
      'Runs against a Site Service calendar that carries the Site operating hours and an assigned clinician or practitioner. Includes how the day owner rules on urgent orders.',
  },
  {
    category: 'workflow',
    href: `${BASE}/L1-P05a-v4.html`,
    title: 'L1 · Process 05a — Provide a service: admission, identity and consent',
    description:
      'The door. Locating the Service Order, confirming identity, and recording consent before anything clinical starts.',
  },
  {
    category: 'workflow',
    href: `${BASE}/L1-P05b-v4.html`,
    title: 'L1 · Process 05b — Provide a service: render and determine',
    description:
      'From an admitted patient with consents recorded through to a recorded determination.',
  },
  {
    category: 'workflow',
    href: `${BASE}/L1-P05c-v4.html`,
    title: 'L1 · Process 05c — Provide a service: review and release',
    description:
      'What happens between a complete determination and its release, including who may see what on the way out.',
  },
  {
    category: 'workflow',
    href: `${BASE}/L1-P06-v4.html`,
    title: 'L1 · Process 06 — Manage the unfit case (potential)',
    description:
      'Drawn as a potential process. Not what WHA does today; included because the sweep of comparable providers shows it as standard practice.',
  },
  {
    category: 'workflow',
    href: `${BASE}/L1-P07-v4.html`,
    title: 'L1 · Process 07 — Assess and control workplace risk (potential)',
    description:
      'Drawn as a potential process, on the same basis as 06.',
  },
  {
    category: 'workflow',
    href: `${BASE}/L1-P08-v4.html`,
    title: 'L1 · Process 08 — Track fitness check-ups (potential)',
    description:
      'Drawn as a potential process, on the same basis as 06.',
  },
  {
    category: 'workflow',
    href: `${BASE}/L1-P09-v4.html`,
    title: 'L1 · Process 09 — Report to invoice',
    description:
      'Triggered when a site visit ends. Reports each run on their own cadence, and the chain closes at the invoice.',
  },
  {
    category: 'workflow',
    href: `${BASE}/L2-Subprocesses-v1.html`,
    title: 'L2 subprocesses, version 1',
    description:
      'The drawn subprocesses on one page, each stating the L1 step it sits under and the question it answers. Includes 01-RD, which settles which rule wins when requirement defaults collide.',
  },
  {
    category: 'workflow',
    href: `${BASE}/L2-05a-DR-v1.html`,
    title: 'L2 · 05a-DR — Admit at the door',
    description:
      'Sits under Process 05a. How the door gets from a person standing in front of it to a located Order, a confirmed identity and a held record.',
  },
  {
    category: 'workflow',
    href: `${BASE}/L2-05a-CN-v1.html`,
    title: 'L2 · 05a-CN — Confirm the consents',
    description:
      'Sits under Process 05a, gate 2. How nine separate consents behave as one gate, and what happens when any single one is missing.',
  },
  {
    category: 'workflow',
    href: `${BASE}/L2-04-UR-v1.html`,
    title: 'L2 · 04-UR — Absorb an urgent order',
    description:
      'Sits under Process 04. What happens to a full day when an injured person is on the way in.',
  },
  {
    category: 'plan',
    href: `${BASE}/Methodology-To-Be-Process-Design.html`,
    title: 'How the to-be processes were designed',
    description:
      'The method behind the process set: three passes against three yardsticks, why they ran in that order, and what the order buys the implementation plan. Read this first if you are picking the work up cold.',
  },
  {
    category: 'plan',
    href: `${BASE}/WHA-Process-Set-Findings.html`,
    title: 'Process set: findings and proposals',
    description:
      'A step-by-step comparison of the proposed process design against the capabilities held in IMS, and four proposals put up for sign-off. Prepared 2 August 2026.',
  },
  {
    category: 'plan',
    href: `${BASE}/Fit-Gap-New-Design-Against-IMS.html`,
    title: 'Fit and gap: the process set against IMS',
    description:
      'Rewritten 2 August 2026 to keep only what is genuinely unresolved. The earlier version carried forty-three gaps at mixed altitudes, most already settled or answerable from published practice. Contains no discovery questions.',
  },
  {
    category: 'plan',
    href: `${BASE}/L1-Gap-Check-Against-Industry.html`,
    title: 'The industry sweep: L1 gap check',
    description:
      'Two passes against published practice. Pass one: KINNECT, Jobfit and Sonic HealthPlus. Pass two: the Netherlands, Japan, the United Kingdom, Germany, Finland and the enterprise platforms. Sources are the providers and regulators own material.',
  },
  {
    category: 'plan',
    href: `${BASE}/L2-Candidates-For-Decision.html`,
    title: 'Which L1 steps need an L2 drawn under them',
    description:
      'A working list. Every box in the eleven diagrams tested against one question: could a builder build it from the box alone, or does a sequence with its own decisions and failure modes sit underneath.',
  },
  {
    category: 'plan',
    href: `${BASE}/Master-Product-Plan-Three-Stages.html`,
    title: 'Master product plan: three stages from pilot to industry practice',
    description:
      'The plan that implements the version 4 process set, revised after the fit and gap against IMS closed. Stage 1 proves the service, and the later stages carry it out to industry practice.',
  },
  {
    category: 'plan',
    href: `${BASE}/MVP-Product-Plan.html`,
    title: 'MVP product plan: the pilot, ready to build',
    description:
      'The build authority for phase 1. The implementation plan with every correction from the evaluation already settled into the design, so a building session reads this one document and does not have to reconcile two.',
  },
  {
    category: 'plan',
    href: `${BASE}/MVP-Implementation-Plan.html`,
    title: 'MVP implementation plan: prove the service',
    description:
      'The build plan for stage 1 of the master product plan. Process authority is the version 4 L1 pages, the L2 subprocess pages and the findings document.',
  },
  {
    category: 'plan',
    href: `${BASE}/MVP-Plan-Evaluation.html`,
    title: 'MVP plan evaluation',
    description:
      'Is the implementation plan safe to build from? An evaluating session run against the plan, the master plan, both architecture diagrams, the findings, the fit and gap, the L2 pages and the eleven version 4 sources. Every judgement is proposed; nothing here ran and produced a record.',
  },
  {
    category: 'plan',
    href: `${BASE}/MVP-Functional-Architecture.html`,
    title: 'MVP functional architecture',
    description:
      'Stage 1 drawn as four surfaces, eight processes, six engines and one wall. Each process is specified by its L1 page and each engine by its L2 page.',
  },
  {
    category: 'plan',
    href: `${BASE}/MVP-Technical-Architecture.html`,
    title: 'MVP technical architecture',
    description:
      'How stage 1 is built, tier by tier, with the employer wall enforced by a schema grant. Everything is proposed until the first step lands, and none of it is exotic.',
  },
]

export default function WorkHealthyAustraliaPrivateWorkflowsIndexPage() {
  return (
    <PrivateGate>
      <main>
        <section className="wf-hero">
          <div className="container">
            <div className="wf-hero-inner">
              <div className="wf-breadcrumb">
                <Link href="/workflows">Workflows</Link>
                <span>/</span>
                <Link href="/workflows/private">Private</Link>
                <span>/</span>
                <span>Work Healthy Australia</span>
              </div>
              <h1 className="section-title">Work Healthy Australia private workflows</h1>
              <p className="wf-hero-sub">
                The version 4 process set for Work Healthy Australia and the OccuSpan product plans
                built on it, gated behind an access code. Client material. Not linked from public
                navigation.
              </p>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <PrivateLibrary items={ITEMS} />
          </div>
        </section>
      </main>
    </PrivateGate>
  )
}
