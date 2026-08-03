import type { Metadata } from 'next'
import Link from 'next/link'
import PrivateGate from '../PrivateGate'

export const metadata: Metadata = {
  title: 'E8 Private Workflows | Edge8',
  description: 'Internal, access-code-gated index of Edge8 (E8) private workflow guides.',
  robots: { index: false, follow: false },
}

const E8_PAGES = [
  {
    href: '/workflows/private/e8/team-onboarding',
    title: 'Team Onboarding',
    description: 'Onboarding deck for new Edge8 AI team members.',
  },
  {
    href: '/workflows/private/e8/private-retreats',
    title: 'Private Retreats Training Guide',
    description: 'Internal training guide for hosting a private retreat guest end to end.',
  },
  {
    href: '/workflows/private/e8/accounting-training',
    title: 'Accounting Training Guide',
    description: 'Internal training guide for the Edge8 monthly accounting close.',
  },
  {
    href: '/workflows/private/e8/ai-retreat-work-healthy',
    title: 'AI Retreat Week Brief: Work Healthy Australia',
    description: 'Week brief for Dr James Murray: goal, survey results, and the OccuSpan workflows for the 4-day AI Retreat.',
  },
  {
    href: '/workflows/private/e8/ai-retreat-austpayroll',
    title: 'AI Retreat Week Brief: Australian Payroll Association',
    description: 'Week brief for Tracy Angwin: goal, survey results, and the adaptive payroll training workflows for the 4-day AI Retreat.',
  },
  {
    href: '/workflows/private/e8/vung-tau-leg.html',
    title: 'Bánh Mì Ballers: Saigon + Vung Tau Leg',
    description: 'Itinerary for the Saigon and Vung Tau leg.',
  },
]

export default function E8PrivateWorkflowsIndexPage() {
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
                <span>E8</span>
              </div>
              <h1 className="section-title">E8 private workflows</h1>
              <p className="wf-hero-sub">
                Internal Edge8 guides and briefs, gated behind an access code. Not linked from public navigation.
              </p>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="wf-problems wf-problems-4">
              {E8_PAGES.map((p) => (
                <Link key={p.href} href={p.href} className="wf-problem" style={{ display: 'block' }}>
                  <strong>{p.title}</strong> {p.description}
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
    </PrivateGate>
  )
}
