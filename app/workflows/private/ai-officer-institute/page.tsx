import type { Metadata } from 'next'
import Link from 'next/link'
import PrivateGate from '../PrivateGate'
import PrivateLibrary, { type LibraryItem } from '../PrivateLibrary'

export const metadata: Metadata = {
  title: 'AI Officer Institute Private Workflows | Edge8',
  description:
    'Internal, access-code-gated library of AI Officer Institute plans, workflows, and data.',
  robots: { index: false, follow: false },
}

const ITEMS: LibraryItem[] = [
  {
    category: 'plan',
    href: '/workflows/private/ai-officer-institute/ai-program-plan',
    title: 'AI Program Plan',
    description:
      'The program design brief: session types (standard, micro-sessions, coaching), the certification tracks, the Office × Discipline tag taxonomy, and the credit model.',
  },
  {
    category: 'plan',
    href: '/workflows/private/ai-officer-institute/ui-redesign-plan',
    title: 'UI Redesign Plan',
    description:
      'Team Dashboard Quick Actions, the Mission Control Grading Outcome card, and the Blog index.',
  },
  {
    category: 'workflow',
    href: '/workflows/private/ai-officer-institute/agentic-ai-workflows.html',
    title: 'Agentic AI — Mission & Certification Workflows',
    description:
      'The six Agentic AI missions (A01–A06) from plan to production, the shared grading loop, and how the credential is issued automatically.',
  },
  {
    category: 'workflow',
    href: '/workflows/private/ai-officer-institute/gen-ai-workflows.html',
    title: 'Gen AI — Mission & Certification Workflows',
    description:
      'The four Gen AI missions (G01–G04), the capstone, the shared grading loop, and how certification is issued automatically.',
  },
  {
    category: 'workflow',
    href: '/workflows/private/ai-officer-institute/aio-company-admin-workflow.html',
    title: 'Company Admin Workflow',
    description: 'How a company manager receives their company, seats their team, and monitors learning.',
  },
  {
    category: 'workflow',
    href: '/workflows/private/ai-officer-institute/aio-platform-admin-workflow.html',
    title: 'Platform Admin Workflow',
    description:
      'Edge8 staff cross-company back-office and the /platform console, with live / flag-gated / built-unmounted status.',
  },
]

export default function AiOfficerInstitutePrivateWorkflowsIndexPage() {
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
                <span>AI Officer Institute</span>
              </div>
              <h1 className="section-title">AI Officer Institute private workflows</h1>
              <p className="wf-hero-sub">
                Internal AI Officer Institute plans, workflows, and data, gated behind an access
                code. Not linked from public navigation.
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
