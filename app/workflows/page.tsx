import Link from 'next/link'
import { allWorkflows } from '@/lib/workflowsData'
import { CategoryChip } from './ui'

export default function WorkflowsPage() {
  const workflows = [...allWorkflows].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <main>
      <section className="wf-hero">
        <div className="container">
          <div className="wf-hero-inner">
            <span className="section-label" style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)' }}>
              Operations, in the open
            </span>
            <h1 className="section-title">Workflows</h1>
            <p className="wf-hero-sub">
              The operating workflows we run Edge8 on. Real systems documented end to end: who does what, when it
              happens, and where AI does the heavy lifting.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="wf-grid">
            {workflows.map((w) => (
              <Link key={w.slug} href={`/workflows/${w.slug}`} className="wf-card">
                <div className="wf-card-top">
                  <CategoryChip category={w.category} />
                  <span className="wf-card-date">
                    {new Date(w.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
                <h2 className="wf-card-title">{w.title}</h2>
                <p className="wf-card-excerpt">{w.excerpt}</p>
                <div className="wf-card-foot">
                  <span className="wf-card-steps">{w.steps} steps</span>
                  <span className="wf-card-read">View workflow →</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
