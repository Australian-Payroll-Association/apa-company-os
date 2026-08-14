import type { Metadata } from 'next'
import Link from 'next/link'
import PrivateGate from '../PrivateGate'
import PrivateLibrary, { type LibraryItem } from '../PrivateLibrary'

export const metadata: Metadata = {
  title: 'AI Officer Institute Private Workflows | Edge8',
  description:
    'Internal, access-code-gated library of AI Officer Institute plans, workflows, and data.',
  robots: { index: false, follow: false },
}

const ITEMS: LibraryItem[] = [
  {
    category: 'plan',
    href: '/workflows/private/ai-officer-institute/aio-labs-ux-audit.html',
    title: 'UX Audit — Workflow Documentation',
    description:
      'Current-state workflow documentation and heuristic UX audit of aiolabz.com as learner and team admin: the 33 findings in full, with bottlenecks, missing steps, and severity across the product.',
  },
  {
    category: 'plan',
    href: '/workflows/private/ai-officer-institute/aio-labs-ux-brief.html',
    title: 'UX Audit: Open Questions',
    description:
      'Fifteen open decisions from the live walkthrough of aiolabz.com: what the headline progress % measures, what is required to certify, whether seat buying is self-serve, one source of truth for progress and badges, and more. Companion to the full UX Audit.',
  },
  {
    category: 'plan',
    href: '/workflows/private/ai-officer-institute/aio-pad-styling-plan.html',
    title: 'AIO Pad Styling Plan',
    description:
      'Before and after styling plan for the AIO Pad (Lumiere Riverside, Thao Dien): nine paired angles, room by room, with the exact items and prices behind each, plus the budget and a 12-day sequence.',
  },
  {
    category: 'prototype',
    href: '/workflows/private/ai-officer-institute/hub.html',
    title: 'Learning Hub (unified prototype)',
    description:
      'The unified learning hub, rebuilt so every screen shares one design system: a left-hand nav across Home, Certification, Coaching, Micro Sessions, Videos, Blog, and a locked Leadership track. Home shows progress metrics, the AI Buddy, and certification track cards; Certification has the mission journey with summary cards and accordions; Coaching submits a topic behind a live photo hero; Micro Sessions log the five data points and earn a credit on challenge submit (Tuesdays 4pm GMT+7); Videos is a YouTube-light library with 30-day watch stats; Blog carries a navy hero with functional search, tag filters, sort, and grid/list layouts.',
  },
  {
    category: 'prototype',
    href: '/workflows/private/ai-officer-institute/video-module.html',
    title: 'Video Library',
    description:
      'The front door to the program: one library of full-length sessions, a featured head, faceted filtering (Track, Office, Tools, Length, Status), and a player with watch-time progress, link-outs, and a YouTube-style Up next. Watch time is logged for coaches; certification credit is earned in the challenge.',
  },
  {
    category: 'plan',
    href: '/workflows/private/ai-officer-institute/video-module-plan.html',
    title: 'Video Module — plan',
    description:
      'The video design brief: the general library, the Office × Discipline tag taxonomy and filtering, the player, and how watch time relates to certification (engagement data for coaches, not credit).',
  },
  {
    category: 'prototype',
    href: '/workflows/private/ai-officer-institute/micro-sessions.html',
    title: 'Micro-sessions',
    description:
      'The student experience for the elective unit: a certificate progress spine (Core + Electives, no capstone), a browsable catalog, a guided session (watch → read → challenge), and the AI Buddy submission that earns one elective — with a completion moment that advances the certificate.',
  },
  {
    category: 'plan',
    href: '/workflows/private/ai-officer-institute/micro-sessions-plan.html',
    title: 'Micro-sessions — plan',
    description:
      'The micro-session design brief: what the elective is (one video, one textbook, one short challenge), the learner flow, how credit is earned and applied once, the Office × Discipline tags, the optional live sitting, and how electives count toward a certification with no capstone.',
  },
  {
    category: 'prototype',
    href: '/workflows/private/ai-officer-institute/open-coaching.html',
    title: 'Open Coaching',
    description:
      'Bring a challenge, get coached. The weekly live-coaching experience: an Upcoming view, submitted-challenge voting (max 8 topics per session), and a recorded-session archive with attendees, key learnings, video, and resources. Mirrors caiocoach.com/coaching.',
  },
  {
    category: 'data',
    href: '/workflows/private/ai-officer-institute/aiolabz-db-schema.html',
    title: 'AIO Labz: Database Schema',
    description:
      'Indexed, zoomable map of the live AIO Labz V2 database: 47 tables and 6 views across nine domains — catalog, videos and live events, learning and grading, identity, commerce, company, support, and the agents chat and vector store — with every column, key, and relationship.',
  },
  {
    category: 'plan',
    href: '/workflows/private/ai-officer-institute/coaching-scheduling-video-erd.html',
    title: 'Coaching, Scheduling, Video: V2 ERD delta',
    description:
      'The database delta for the coaching, scheduling, and video model: one generic live_event table with signups and coaching topics, micro-session assignments riding the existing submission and assessment loop, video watch tracking, curated categories, and the superseded-video display rule. Shows 23 of 50+ live tables with NEW, EXTENDED, and EXISTING states.',
  },
  {
    category: 'plan',
    href: '/workflows/private/ai-officer-institute/coaching-module-plan',
    title: 'Coaching Module — build plan',
    description:
      'Turning the Open Coaching prototype into a real product module: surfaces, core flows, the data model, rules and states, architecture fit in aiolabz-fe, and phased delivery.',
  },
  {
    category: 'plan',
    href: '/workflows/private/ai-officer-institute/ai-program-plan',
    title: 'AI Program Plan',
    description:
      'The program design brief: session types (standard, micro-sessions, coaching), the certification tracks, the Office × Discipline tag taxonomy, and the credit model.',
  },
  {
    category: 'plan',
    href: '/workflows/private/ai-officer-institute/certification-data-architecture.html',
    title: 'Certification Data Architecture',
    description:
      'The data model behind a certification: Core missions (Generative then Agentic), elective micro-sessions, the capstone, and how completion is counted. Companion to the AI Program Plan.',
  },
  {
    category: 'plan',
    href: '/workflows/private/ai-officer-institute/ui-redesign-plan',
    title: 'UI Redesign Plan',
    description:
      'Team Dashboard Quick Actions, the Mission Control Grading Outcome card, and the Blog index.',
  },
  {
    category: 'workflow',
    href: '/workflows/private/ai-officer-institute/design-system.html',
    title: 'Design System',
    description:
      'The single source of truth for building AI Officer Institute product and brand surfaces: voice and content rules, the full color system (navy backbone, royal-blue CTA, track color assignments), typography, spacing and radii, shadows and motion, iconography, components (buttons, pills, cards, inputs), layout patterns, and imagery rules. Tokens are pulled from aiolabz-fe globals.css and anchored on the Learning Hub Coaching & Micro Sessions modules.',
  },
  {
    category: 'workflow',
    href: '/workflows/private/ai-officer-institute/agentic-ai-workflows.html',
    title: 'Agentic AI — Mission & Certification Workflows',
    description:
      'The six Agentic AI missions (A01–A06) from plan to production, the shared grading loop, and how the credential is issued automatically.',
  },
  {
    category: 'workflow',
    href: '/workflows/private/ai-officer-institute/gen-ai-workflows.html',
    title: 'Gen AI — Mission & Certification Workflows',
    description:
      'The four Gen AI missions (G01–G04), the capstone, the shared grading loop, and how certification is issued automatically.',
  },
  {
    category: 'workflow',
    href: '/workflows/private/ai-officer-institute/aio-company-admin-workflow.html',
    title: 'Company Admin Workflow',
    description: 'How a company manager receives their company, seats their team, and monitors learning.',
  },
  {
    category: 'workflow',
    href: '/workflows/private/ai-officer-institute/aio-platform-admin-workflow.html',
    title: 'Platform Admin Workflow',
    description:
      'Edge8 staff cross-company back-office and the /platform console, with live / flag-gated / built-unmounted status.',
  },
]

export default function AiOfficerInstitutePrivateWorkflowsIndexPage() {
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
                <span>AI Officer Institute</span>
              </div>
              <h1 className="section-title">AI Officer Institute private workflows</h1>
              <p className="wf-hero-sub">
                Internal AI Officer Institute plans, workflows, and data, gated behind an access
                code. Not linked from public navigation.
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
