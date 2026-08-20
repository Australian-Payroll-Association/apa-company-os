import type { Metadata } from 'next'
import Link from 'next/link'
import PrivateGate from '../PrivateGate'
import PrivateLibrary from '../PrivateLibrary'
import { aioPrivateItems } from '@/lib/privateLibraryData'

export const metadata: Metadata = {
  title: 'AI Officer Institute Private Workflows | Edge8',
  description:
    'Internal, access-code-gated library of AI Officer Institute plans, workflows, and data.',
  robots: { index: false, follow: false },
}


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
            <PrivateLibrary items={aioPrivateItems} />
          </div>
        </section>
      </main>
    </PrivateGate>
  )
}
