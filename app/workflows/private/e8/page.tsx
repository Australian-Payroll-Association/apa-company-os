import type { Metadata } from 'next'
import Link from 'next/link'
import PrivateGate from '../PrivateGate'
import PrivateLibrary, { type LibraryItem } from '../PrivateLibrary'
import { e8PrivateItems } from '@/lib/privateLibraryData'
import { listDocs } from '@/lib/docs'

// Published documents are read from Storage at request time, so adding one
// never touches this file.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Edge8 Consulting Private Workflows | Edge8',
  description: 'Internal, access-code-gated library of Edge8 Consulting plans, workflows, and data.',
  robots: { index: false, follow: false },
}


export default async function E8PrivateWorkflowsIndexPage() {
  // Documents published via scripts/docs/publish.mjs, listed alongside the
  // hand-built pages above. Storage is the source; no entry is added here.
  const published: LibraryItem[] = (await listDocs()).map((doc) => ({
    category: 'workflow' as const,
    href: `/workflows/private/e8/${doc.slug}`,
    title: doc.title,
    description: doc.publishedAt
      ? `Published document, updated ${new Date(doc.publishedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}.`
      : 'Published document.',
  }))
  const items = [...published, ...e8PrivateItems]

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
                <span>Edge8 Consulting</span>
              </div>
              <h1 className="section-title">Edge8 Consulting private workflows</h1>
              <p className="wf-hero-sub">
                Internal Edge8 Consulting guides and briefs, gated behind an access code. Not
                linked from public navigation.
              </p>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <PrivateLibrary items={items} />
          </div>
        </section>
      </main>
    </PrivateGate>
  )
}
