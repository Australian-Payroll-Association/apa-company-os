import type { Metadata } from 'next'
import Link from 'next/link'
import PrivateGate from '../PrivateGate'

export const metadata: Metadata = {
  title: 'AIO Labs Private Workflows | Edge8',
  description: 'Internal, access-code-gated index of AIO Labs private plans and workflow guides.',
  robots: { index: false, follow: false },
}

const AIO_PAGES: { href: string; title: string; description: string }[] = [
  {
    href: '/workflows/private/aio-labs/ui-redesign-plan',
    title: 'UI Redesign Plan',
    description: '— Team Dashboard Quick Actions, the Mission Control Grading Outcome card, and the Blog index.',
  },
  {
    href: '/workflows/private/aio-labs/aio-company-admin-workflow.html',
    title: 'Company Admin Workflow',
    description: 'How a company manager receives their company, seats their team, and monitors learning.',
  },
  {
    href: '/workflows/private/aio-labs/aio-platform-admin-workflow.html',
    title: 'Platform Admin Workflow',
    description: 'Edge8 staff cross-company back-office and the /platform console, with live / flag-gated / built-unmounted status.',
  },
]

export default function AioLabsPrivateWorkflowsIndexPage() {
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
                <span>AIO Labs</span>
              </div>
              <h1 className="section-title">AIO Labs private workflows</h1>
              <p className="wf-hero-sub">
                Internal AIO Labs plans and briefs, gated behind an access code. Not linked from public navigation.
              </p>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            {AIO_PAGES.length === 0 ? (
              <p className="wf-hero-sub">Nothing here yet. AIO Labs plans and workflows will be listed here as they are built.</p>
            ) : (
              <div className="wf-problems wf-problems-4">
                {AIO_PAGES.map((p) => (
                  <Link key={p.href} href={p.href} className="wf-problem" style={{ display: 'block' }}>
                    <strong>{p.title}</strong> {p.description}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </PrivateGate>
  )
}
