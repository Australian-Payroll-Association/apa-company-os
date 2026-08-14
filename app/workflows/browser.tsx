'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { Workflow } from '@/lib/workflowsData'
import { CategoryChip } from './ui'

const OFFICE_ORDER = ['Revenue', 'Talent', 'Operations', 'Innovation'] as const

const OFFICE_TAGLINES: Record<(typeof OFFICE_ORDER)[number], string> = {
  Revenue: 'How money gets made, invoiced, and reconciled.',
  Talent: 'How people get hired, coached, and grown.',
  Operations: 'How the machine runs day to day.',
  Innovation: 'How ideas become plans and skills become proof.',
}

type View = 'offices' | 'newest' | 'alphabetical'

const VIEWS: { key: View; label: string }[] = [
  { key: 'offices', label: 'Four Offices' },
  { key: 'newest', label: 'Newest' },
  { key: 'alphabetical', label: 'Alphabetical' },
]

function WorkflowCard({ w }: { w: Workflow }) {
  return (
    <Link href={`/workflows/${w.slug}`} className="wf-card">
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
  )
}

export default function WorkflowsBrowser({ workflows }: { workflows: Workflow[] }) {
  const [view, setView] = useState<View>('offices')
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const matches = useMemo(
    () =>
      workflows.filter(
        (w) =>
          q === '' ||
          w.title.toLowerCase().includes(q) ||
          w.excerpt.toLowerCase().includes(q) ||
          w.category.toLowerCase().includes(q),
      ),
    [workflows, q],
  )

  const sorted = useMemo(() => {
    if (view === 'newest') return [...matches].sort((a, b) => b.date.localeCompare(a.date))
    return [...matches].sort((a, b) => a.title.localeCompare(b.title))
  }, [matches, view])

  const visibleOffices = OFFICE_ORDER.map((office) => ({
    office,
    workflows: matches.filter((w) => w.category === office),
  })).filter((g) => g.workflows.length > 0)

  return (
    <>
      <section style={{ padding: '36px 0 0' }}>
        <div className="container">
          <div className="wf-controls">
            <div className="wf-views" role="tablist" aria-label="View workflows by">
              <span className="wf-views-label">View by</span>
              {VIEWS.map((v) => (
                <button
                  key={v.key}
                  role="tab"
                  aria-selected={view === v.key}
                  className={`wf-view-tab${view === v.key ? ' active' : ''}`}
                  onClick={() => setView(v.key)}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <input
              type="search"
              className="wf-search"
              placeholder="Search workflows…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search workflows"
            />
          </div>
        </div>
      </section>

      {matches.length === 0 ? (
        <section style={{ padding: '48px 0 72px' }}>
          <div className="container">
            <p className="wf-empty">No workflows match &ldquo;{query}&rdquo;. Try a different word, or clear the search.</p>
          </div>
        </section>
      ) : view === 'offices' ? (
        visibleOffices.map(({ office, workflows: officeWorkflows }, i) => (
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
                {officeWorkflows.map((w) => (
                  <WorkflowCard key={w.slug} w={w} />
                ))}
              </div>
            </div>
          </section>
        ))
      ) : (
        <section className="section" style={{ padding: '48px 0 72px' }}>
          <div className="container">
            <div className="wf-grid">
              {sorted.map((w) => (
                <WorkflowCard key={w.slug} w={w} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  )
}
