import type { Metadata } from 'next'
import Link from 'next/link'
import PrivateGate from '../PrivateGate'
import PrivateLibrary, { type LibraryItem } from '../PrivateLibrary'

export const metadata: Metadata = {
  title: 'Edge8 Consulting Private Workflows | Edge8',
  description: 'Internal, access-code-gated library of Edge8 Consulting plans, workflows, and data.',
  robots: { index: false, follow: false },
}

const ITEMS: LibraryItem[] = [
  {
    category: 'data',
    href: '/workflows/private/e8/company-os-schema.html',
    title: 'Company OS: Database Schema',
    description:
      'Indexed, zoomable map of the Company OS database: 115 tables across the people spine and the Four Offices, with every column, key, and relationship.',
  },
  {
    category: 'data',
    href: '/workflows/private/e8/eo-vietnam-regional-vs-global.html',
    title: 'EO Vietnam: Regional vs Global',
    description:
      'Feature-by-feature comparison of the EO Vietnam Regional and Global HubSpot portals: deal and ticket pipelines, dashboards, and workflows, with expandable detail for each.',
  },
  {
    category: 'plan',
    href: '/workflows/private/e8/eight-edges-product-doc.html',
    title: 'Eight Edges: Product Doc',
    description:
      'The Edge8 operating system for strategy to execution, 50% human and 50% AI: eight layers, the Company to Office to Executor cascade, casting, and the research it is built on.',
  },
  {
    category: 'prototype',
    href: '/workflows/private/e8/eight-edges-prototype.html',
    title: 'Eight Edges: Edge8 OS Prototype',
    description:
      'Interactive mock of the Eight Edges screen: goal cascade for both business lines, casting mix, agent-pulled metrics, auto-filed issues, sync packet, and reviews.',
  },
  {
    category: 'plan',
    href: '/workflows/private/e8/equipment-register',
    title: 'Equipment Register: 5Ds Brief',
    description:
      'Problem, data, workflow, ROI, and the deployment and training plan for tracking company laptops, monitors and accessories in the Company OS.',
  },
  {
    category: 'workflow',
    href: '/workflows/private/e8/team-onboarding',
    title: 'Team Onboarding',
    description: 'Onboarding deck for new Edge8 AI team members.',
  },
  {
    category: 'workflow',
    href: '/workflows/private/e8/private-retreats',
    title: 'Private Retreats Training Guide',
    description: 'Internal training guide for hosting a private retreat guest end to end.',
  },
  {
    category: 'workflow',
    href: '/workflows/private/e8/staffing-contract-renewal',
    title: 'Staffing Contract Renewal',
    description:
      'How a staffing contract renews: the renewal calendar, the CRM deal conventions (type, categories, renewal chain), the agreement draft, and the close-out.',
  },
  {
    category: 'workflow',
    href: '/workflows/private/e8/accounting-training',
    title: 'Accounting Training Guide',
    description: 'Internal training guide for the Edge8 monthly accounting close.',
  },
  {
    category: 'workflow',
    href: '/workflows/private/e8/ai-retreat-work-healthy',
    title: 'AI Retreat Week Brief: Work Healthy Australia',
    description:
      'Week brief for Dr James Murray: goal, survey results, and the OccuSpan workflows for the 4-day AI Retreat.',
  },
  {
    category: 'workflow',
    href: '/workflows/private/e8/ai-retreat-austpayroll',
    title: 'AI Retreat Week Brief: Australian Payroll Association',
    description:
      'Week brief for Tracy Angwin: goal, survey results, and the adaptive payroll training workflows for the 4-day AI Retreat.',
  },
  {
    category: 'workflow',
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
            <PrivateLibrary items={ITEMS} />
          </div>
        </section>
      </main>
    </PrivateGate>
  )
}
