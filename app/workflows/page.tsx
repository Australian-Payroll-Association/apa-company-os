import Link from 'next/link'
import { allWorkflows } from '@/lib/workflowsData'
import { CategoryChip } from './ui'

const OFFICE_ORDER = ['Revenue', 'Talent', 'Operations', 'Innovation'] as const

const OFFICE_TAGLINES: Record<(typeof OFFICE_ORDER)[number], string> = {
  Revenue: 'How money gets made, invoiced, and reconciled.',
  Talent: 'How people get hired, coached, and grown.',
  Operations: 'How the machine runs day to day.',
  Innovation: 'How ideas become plans and skills become proof.',
}

export default function WorkflowsPage() {
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
              The operating workflows we run Edge8 on, organized around our four offices: Revenue, Talent, Operations,
              and Innovation. Real systems documented end to end: who does what, when it happens, and where AI does the
              heavy lifting. Everything here is running in production today, and everything here is something we can
              build for you.
            </p>
          </div>
        </div>
      </section>

      {OFFICE_ORDER.map((office, i) => {
        const workflows = allWorkflows.filter((w) => w.category === office)
        if (workflows.length === 0) return null
        return (
          <section
            key={office}
            className="section"
            style={{ padding: '64px 0', background: i % 2 === 1 ? 'var(--tint)' : undefined }}
          >
            <div className="container">
              <span className="section-label" style={i % 2 === 1 ? { background: 'var(--white)' } : undefined}>
                {office} office
              </span>
              <h2 className="section-title" style={{ fontSize: 32, marginBottom: 8 }}>
                {office}
              </h2>
              <p className="section-sub" style={{ marginBottom: 32 }}>
                {OFFICE_TAGLINES[office]}
              </p>
              <div className="wf-grid">
                {workflows.map((w) => (
                  <Link key={w.slug} href={`/workflows/${w.slug}`} className="wf-card">
                    <div className="wf-card-top">
                      <CategoryChip category={w.category} />
                      <span className="wf-card-date">
                        {new Date(w.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                    <h3 className="wf-card-title">{w.title}</h3>
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
        )
      })}

      <section className="section" style={{ background: 'var(--dark)', padding: '72px 0' }}>
        <div className="container">
          <span className="section-label" style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)' }}>
            The method
          </span>
          <h2 className="section-title" style={{ fontSize: 32, color: 'var(--white)' }}>
            One method behind every page
          </h2>
          <p className="wf-hero-sub" style={{ marginTop: 12 }}>
            Every workflow here was planned with a 5D program brief, documented in seven elements, mapped step by step
            to humans and machines, tested with the New Hire Test, and shipped through three stage gates. It is the
            same method we teach in the AI Officer certification.
          </p>
          <div className="wf-hero-meta" style={{ marginBottom: 28 }}>
            <span className="wf-meta-chip">Plan <strong>5D Brief</strong></span>
            <span className="wf-meta-chip">Document <strong>7 elements</strong></span>
            <span className="wf-meta-chip">Assign <strong>Centaur Map</strong></span>
            <span className="wf-meta-chip">Ship <strong>3 stage gates</strong></span>
          </div>
          <Link href="/workflows/method" className="btn btn-mint">
            See how we design workflows →
          </Link>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 64 }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <h2 className="section-title" style={{ fontSize: 30, marginBottom: 12 }}>
            Want workflows like these in your company?
          </h2>
          <p className="section-sub" style={{ margin: '0 auto 28px' }}>
            Every system on this page was designed, built, and put into production by Edge8. We do the same for our
            clients.
          </p>
          <Link href="/contact" className="btn btn-secondary">
            Talk to Edge8 →
          </Link>
        </div>
      </section>
    </main>
  )
}
