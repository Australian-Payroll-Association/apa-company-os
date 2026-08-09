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
    category: 'prototype',
    href: '/workflows/private/ai-officer-institute/hub.html',
    title: 'Learning Hub (unified prototype)',
    description:
      'One prototype with a left-hand nav pulling Coaching, Micro Sessions, and Videos into a single shell, plus a light Home and Certification. Every section shares one taxonomy: a certification category (AI Officer, AI Engineer, Leadership) and free-flowing topic tags. Coaching submits a coaching topic; Micro Sessions log the five data points and earn a credit on challenge submit (Tuesdays 4pm GMT+7); Videos is a YouTube-light library with a featured video, recently watched, 30-day watch stats, and a Micro-Sessions category.',
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
    href: '/workflows/private/ai-officer-institute/ui-redesign-plan',
    title: 'UI Redesign Plan',
    description:
      'Team Dashboard Quick Actions, the Mission Control Grading Outcome card, and the Blog index.',
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
