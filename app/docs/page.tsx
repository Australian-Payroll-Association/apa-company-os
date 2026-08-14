import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import Link from 'next/link'
import DocsGate from './DocsGate'
import { DOCS_COOKIE, listDocs } from '@/lib/docs'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Documents | Edge8',
  description: 'Internal, access-code-gated documents.',
  robots: { index: false, follow: false },
}

function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function DocsIndexPage() {
  const unlocked = (await cookies()).get(DOCS_COOKIE)?.value === '1'
  if (!unlocked) return <DocsGate />

  const docs = await listDocs()

  return (
    <main>
      <section className="wf-hero">
        <div className="container">
          <div className="wf-hero-inner">
            <div className="wf-breadcrumb">
              <Link href="/">Edge8</Link>
              <span>/</span>
              <span>Documents</span>
            </div>
            <h1 className="section-title">Documents</h1>
            <p className="wf-hero-sub">
              Internal documents, gated behind an access code. Each one keeps the same link when it
              is updated, so the latest version is always at the address you already have.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          {docs.length === 0 ? (
            <p className="wf-hero-sub">Nothing published yet.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {docs.map((doc) => (
                <li key={doc.slug} style={{ borderTop: '1px solid var(--border, #ddd)', padding: '18px 0' }}>
                  <Link href={`/docs/${doc.slug}`} style={{ fontWeight: 600, fontSize: 18 }}>
                    {doc.title}
                  </Link>
                  <div style={{ fontSize: 14, opacity: 0.65, marginTop: 4 }}>
                    /docs/{doc.slug}
                    {doc.publishedAt ? ` · updated ${formatDate(doc.publishedAt)}` : ''}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  )
}
