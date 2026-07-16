'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { allWorkflows } from '@/lib/workflowsData'

const ATTENDEES_FALLBACK = 645

const STATS = [
  {
    target: allWorkflows.length,
    label: 'Documented Workflows',
    sub: 'live AI workflows running our business, step by step',
    href: '/workflows',
  },
  {
    target: 16,
    label: 'Leadership Teams',
    sub: 'certified to run AI on their own',
  },
  {
    target: 46,
    label: 'Applications Launched',
    sub: 'launched by 11 clients in the last 3 months',
  },
  {
    target: ATTENDEES_FALLBACK,
    label: 'Workshop Attendees',
    sub: 'on the road to 1,000 leaders trained in 2026',
  },
]

export default function HeroStats() {
  const [counts, setCounts] = useState(STATS.map(() => 0))
  const [visible, setVisible] = useState(false)
  const [attendees, setAttendees] = useState(ATTENDEES_FALLBACK)
  const countsRef = useRef(counts)
  countsRef.current = counts
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/stats')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (typeof d?.workshopAttendees === 'number' && d.workshopAttendees > 0) {
          setAttendees(d.workshopAttendees)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!ref.current) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect() }
    }, { threshold: 0.4 })
    obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return
    const targets = STATS.map((s, i) => (i === 3 ? attendees : s.target))
    const from = countsRef.current
    const duration = 1800
    const start = Date.now()
    let raf = 0
    const tick = () => {
      const t = Math.min((Date.now() - start) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      setCounts(targets.map((v, i) => Math.round(from[i] + (v - from[i]) * ease)))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [visible, attendees])

  return (
    <section className="hero-stats" aria-label="Edge8 program results to date" ref={ref}>
      <div className="container">
        <div className="hero-stats-grid">
          {STATS.map((stat, i) => {
            const body = (
              <>
                <div className="hero-stat-number">{counts[i]}</div>
                <div className="hero-stat-label">{stat.label}</div>
                <div className="hero-stat-sub">{stat.sub}</div>
              </>
            )
            return stat.href ? (
              <Link className="hero-stat reveal" key={stat.label} href={stat.href}>
                {body}
              </Link>
            ) : (
              <div className="hero-stat reveal" key={stat.label}>
                {body}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
