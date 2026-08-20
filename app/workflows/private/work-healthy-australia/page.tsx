import type { Metadata } from 'next'
import Link from 'next/link'
import PrivateGate from '../PrivateGate'
import PrivateLibrary from '../PrivateLibrary'
import { whaPrivateItems } from '@/lib/privateLibraryData'

export const metadata: Metadata = {
  title: 'Work Healthy Australia Private Workflows | Edge8',
  description:
    'Internal, access-code-gated library of the Work Healthy Australia process set and the OccuSpan product plans.',
  robots: { index: false, follow: false },
}


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
            <PrivateLibrary items={whaPrivateItems} />
          </div>
        </section>
      </main>
    </PrivateGate>
  )
}
