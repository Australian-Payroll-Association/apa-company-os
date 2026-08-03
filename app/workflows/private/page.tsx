import type { Metadata } from 'next'
import Link from 'next/link'
import PrivateGate from './PrivateGate'

export const metadata: Metadata = {
  title: 'Private Workflows Library | Edge8',
  description: 'Internal, access-code-gated index of Edge8 private workflow guides.',
  robots: { index: false, follow: false },
}

const BRANDS = [
  {
    href: '/workflows/private/e8',
    title: 'E8',
    description: 'Edge8 internal guides and briefs: team onboarding, private retreats, accounting, and AI Retreat week briefs.',
  },
  {
    href: '/workflows/private/aio-labs',
    title: 'AIO Labs',
    description: 'AIO Labs plans and workflows, built and maintained independently from E8.',
  },
]

export default function PrivateWorkflowsIndexPage() {
  return (
    <PrivateGate>
      <main>
        <section className="wf-hero">
          <div className="container">
            <div className="wf-hero-inner">
              <div className="wf-breadcrumb">
                <Link href="/workflows">Workflows</Link>
                <span>/</span>
                <span>Private</span>
              </div>
              <h1 className="section-title">Private workflows library</h1>
              <p className="wf-hero-sub">
                Internal guides and briefs, gated behind an access code. Not linked from public navigation. Choose a brand.
              </p>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="wf-problems wf-problems-4">
              {BRANDS.map((b) => (
                <Link key={b.href} href={b.href} className="wf-problem" style={{ display: 'block' }}>
                  <strong>{b.title}</strong> {b.description}
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
    </PrivateGate>
  )
}
