import Link from 'next/link'

export type Actor = 'ai' | 'human' | 'system' | 'contractor'

const ACTOR_LABELS: Record<Actor, string> = {
  ai: 'AI',
  human: 'Human',
  system: 'System',
  contractor: 'Contractor',
}

export function ActorChip({ actor, label }: { actor: Actor; label?: string }) {
  return <span className={`wf-actor wf-actor-${actor}`}>{label ?? ACTOR_LABELS[actor]}</span>
}

export function CategoryChip({ category }: { category: string }) {
  return <span className={`wf-cat wf-cat-${category.toLowerCase()}`}>{category}</span>
}

export function WorkflowHero({
  category,
  title,
  tldr,
  meta,
}: {
  category: string
  title: string
  tldr: string
  meta?: { label: string; value: string }[]
}) {
  return (
    <section className="wf-hero">
      <div className="container">
        <div className="wf-hero-inner">
          <div className="wf-breadcrumb">
            <Link href="/workflows">Workflows</Link>
            <span>/</span>
            <span>{category}</span>
          </div>
          <h1 className="section-title">{title}</h1>
          <p className="wf-hero-sub">{tldr}</p>
          {meta && meta.length > 0 && (
            <div className="wf-hero-meta">
              {meta.map((m) => (
                <span key={m.label} className="wf-meta-chip">
                  {m.label} <strong>{m.value}</strong>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export type RailStep = {
  num: string
  title: string
  cadence: string
  actor: Actor
  actorLabel?: string
}

export function FlowRail({ steps, repeatNote }: { steps: RailStep[]; repeatNote?: string }) {
  return (
    <div>
      <div className="wf-rail">
        {steps.map((s) => (
          <div key={s.num} className="wf-rail-step">
            <span className={`wf-rail-num wf-rail-num-${s.actor}`}>{s.num}</span>
            <span className="wf-rail-cadence">{s.cadence}</span>
            <div className="wf-rail-title">{s.title}</div>
            <ActorChip actor={s.actor} label={s.actorLabel} />
          </div>
        ))}
      </div>
      {repeatNote && (
        <div className="wf-rail-repeat">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 2l4 4-4 4" />
            <path d="M3 11v-1a4 4 0 014-4h14" />
            <path d="M7 22l-4-4 4-4" />
            <path d="M21 13v1a4 4 0 01-4 4H3" />
          </svg>
          {repeatNote}
        </div>
      )}
    </div>
  )
}

export type DetailStep = {
  num: string
  title: string
  cadence?: string
  actor: Actor
  actorLabel?: string
  body: React.ReactNode
}

export function StepCards({ steps }: { steps: DetailStep[] }) {
  return (
    <div className="wf-steps">
      {steps.map((s) => (
        <div key={s.num} className="wf-step">
          <div className="wf-step-num">{s.num}</div>
          <div>
            <div className="wf-step-head">
              <span className="wf-step-title">{s.title}</span>
              <ActorChip actor={s.actor} label={s.actorLabel} />
              {s.cadence && <span className="wf-step-cadence">{s.cadence}</span>}
            </div>
            <div className="wf-step-body">{s.body}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function DetailFooter() {
  return (
    <div className="wf-detail-foot">
      <Link href="/workflows" className="wf-back">
        ← All workflows
      </Link>
      <Link href="/contact" className="btn btn-secondary">
        Build this with Edge8 →
      </Link>
    </div>
  )
}
