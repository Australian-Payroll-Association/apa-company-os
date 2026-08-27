// The hand-built entries of the private workflows library, one list per brand.
// Moved out of the three page files so the documented-workflows count in
// app/api/stats can see them. Storage-published docs are NOT here: they are
// listed live from the documents bucket (lib/docs.ts) and never touch the repo.

export type LibraryCategory = 'plan' | 'workflow' | 'prototype' | 'data'

export type LibraryItem = {
  href: string
  title: string
  description: string
  category: LibraryCategory
}

export const e8PrivateItems: LibraryItem[] = [
  {
    category: 'workflow',
    href: '/workflows/private/e8/claude-md-cleanup.html',
    title: 'CLAUDE.md Cleanup: Diagnose and Fix Your Machine',
    description:
      'The problems found auditing all 13 active projects, plus two copy-paste Claude prompts: one to diagnose your own code-projects folder and one to rewrite every CLAUDE.md as a map-first file.',
  },
  {
    category: 'data',
    href: '/workflows/private/e8/talent-edge-acceptance-reports-2026.html',
    title: 'Talent Edge: Monthly Acceptance Reports 2026',
    description:
      'Month-by-month acceptance of work items for Talent Edge LLC, January to August 2026: ThoughtFlow, Travel Buddy, and Edge8 website engineering, with amounts accepted per item.',
  },
  {
    category: 'data',
    href: '/workflows/private/e8/data-atlas.html',
    title: 'Edge8 Data Atlas',
    description:
      'Zoomable ERD of the live Edge8 Company Database: 202 tables across company_os, htt, and agents, grouped by the Four Offices, with every column, key, and the 358 foreign-key relationships. Click a table to trace what it connects to.',
  },
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
    href: '/workflows/private/e8/ai-officer-institute-business-model.html',
    title: 'AI Officer Institute: Business Model',
    description:
      'Forum pitch deck for the AI Officer Institute: the three AI roles nobody has on payroll, the Australia and USA market from 20 to 5,000 people, build the people or borrow a CAIO, and the four products.',
  },
  {
    category: 'plan',
    href: '/workflows/private/e8/8-edges-business-model.html',
    title: '8 Edges: Business Model',
    description:
      'Forum pitch deck for the 8 Edges business model: why AI programs fail, the open source data spine and app, the Australian target market, and the four ways in from free to done for you.',
  },
  {
    category: 'plan',
    href: '/workflows/private/e8/eight-edges-product-doc.html',
    title: '8 Edges: Product Doc',
    description:
      'The Edge8 operating system for strategy to execution, 50% human and 50% AI: eight layers, the Company to Office to Executor cascade, casting, and the research it is built on.',
  },
  {
    category: 'prototype',
    href: '/workflows/private/e8/eight-edges-prototype.html',
    title: '8 Edges: Prototype',
    description:
      'Interactive mock of the 8 Edges screen: goal cascade for both business lines, casting mix, agent-pulled metrics, auto-filed issues, sync packet, and reviews.',
  },
  {
    category: 'prototype',
    href: '/workflows/private/e8/edge8-video-brand-kit.html',
    title: '8 Edges: Video Brand Kit',
    description:
      'Brand kit for the 8 Edges demo video series: interactive previews of the title card, end card, caption style, and thumbnail across all 17 episodes, with specs, brand rules, and ffmpeg handoff. Tokens pulled from the live edge8.ai site.',
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
    href: '/workflows/private/e8/infinite-leverage-stack-governance.html',
    title: 'Infinite Leverage Stack: Management and Testing',
    description:
      'How the setup skill and prompt are owned, versioned, and released: the one product repo, the release train, and the two testing channels (engineer onboardings and the crash rig) that feed one improvement loop.',
  },
  {
    category: 'workflow',
    href: '/workflows/private/e8/vung-tau-leg.html',
    title: 'Bánh Mì Ballers: Saigon + Vung Tau Leg',
    description: 'Itinerary for the Saigon and Vung Tau leg.',
  },
]
export const aioPrivateItems: LibraryItem[] = [
  {
    category: 'data',
    href: '/workflows/private/ai-officer-institute/aio-acceptance-reports-2026.html',
    title: 'AIO: Monthly Acceptance Reports 2026',
    description:
      'Month-by-month acceptance of work items for AI Officer Institute LLC, January to July 2026: AIO Labz platform development with amounts accepted per item.',
  },
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
    category: 'plan',
    href: '/workflows/private/ai-officer-institute/aio-pad-buy-and-work-plan.html',
    title: 'AIO Pad Buy and Work Plan',
    description:
      'Execution plan for the AIO Pad (Lumiere Riverside, Thao Dien): 57 items across 11 sources, who does what, five photo approvals, the full buy list with prices, a 30-day timeline, and payments and handover. Guest-ready on day 12.',
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
    category: 'prototype',
    href: '/workflows/private/ai-officer-institute/coaching-redesign.html',
    title: 'Coaching Redesign',
    description:
      'A redesign of the Open Coaching prototype: the weekly live session (Thursdays, 11:00 GMT+7). Sign up, optionally submit a coaching topic for the group to vote on, and browse the recorded-session archive.',
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
const BASE = '/workflows/private/work-healthy-australia'

export const whaPrivateItems: LibraryItem[] = [
  {
    category: 'workflow',
    href: `${BASE}/L0-Value-Chain-v4.html`,
    title: 'L0 Value Chain, version 4',
    description:
      'Nine processes in five bands, where a band says what kind of work it is: set up once per client, raise the work, schedule it, deliver it, settle it. Processes 01 to 05 and 09 are the core chain from signed agreement to invoice. 06, 07 and 08 are drawn dashed as potential processes, not what WHA does today.',
  },
  {
    category: 'workflow',
    href: `${BASE}/L1-Process-Swimlanes-v4.html`,
    title: 'L1 Process Swimlanes, version 4',
    description:
      'All eleven L1 diagrams on one page, in swimlanes. The full process set from Setup Workplace through to Report to Invoice, with every trigger, decision, alert and employer-wall crossing shown in one view. Start here, then use the per-process pages below when you need one process on its own.',
  },
  {
    category: 'workflow',
    href: `${BASE}/L1-P01-v4.html`,
    title: 'L1 · Process 01 — Setup Workplace',
    description:
      'Triggered when an agreement is signed. Sets up a new client with their known hierarchy: Client organization, Site, Department, Role, and the requirement defaults that later processes read.',
  },
  {
    category: 'workflow',
    href: `${BASE}/L1-P02-v4.html`,
    title: 'L1 · Process 02 — Onboard and offboard clinician, practitioner, employer',
    description:
      'Who gets access to a Site and how that access ends. Requires a valid Organization and Site; Department is optional.',
  },
  {
    category: 'workflow',
    href: `${BASE}/L1-P03-v4.html`,
    title: 'L1 · Process 03 — Define the role requirements',
    description:
      'Triggered when an employer commissions the work, or when the work a Role does changes. Turns a Role into the requirements a service is later measured against.',
  },
  {
    category: 'workflow',
    href: `${BASE}/L1-P04-v4.html`,
    title: 'L1 · Process 04 — Schedule the service',
    description:
      'Runs against a Site Service calendar that carries the Site operating hours and an assigned clinician or practitioner. Includes how the day owner rules on urgent orders.',
  },
  {
    category: 'workflow',
    href: `${BASE}/L1-P05a-v4.html`,
    title: 'L1 · Process 05a — Provide a service: admission, identity and consent',
    description:
      'The door. Locating the Service Order, confirming identity, and recording consent before anything clinical starts.',
  },
  {
    category: 'workflow',
    href: `${BASE}/L1-P05b-v4.html`,
    title: 'L1 · Process 05b — Provide a service: render and determine',
    description:
      'From an admitted patient with consents recorded through to a recorded determination.',
  },
  {
    category: 'workflow',
    href: `${BASE}/L1-P05c-v4.html`,
    title: 'L1 · Process 05c — Provide a service: review and release',
    description:
      'What happens between a complete determination and its release, including who may see what on the way out.',
  },
  {
    category: 'workflow',
    href: `${BASE}/L1-P06-v4.html`,
    title: 'L1 · Process 06 — Manage the unfit case (potential)',
    description:
      'Drawn as a potential process. Not what WHA does today; included because the sweep of comparable providers shows it as standard practice.',
  },
  {
    category: 'workflow',
    href: `${BASE}/L1-P07-v4.html`,
    title: 'L1 · Process 07 — Assess and control workplace risk (potential)',
    description:
      'Drawn as a potential process, on the same basis as 06.',
  },
  {
    category: 'workflow',
    href: `${BASE}/L1-P08-v4.html`,
    title: 'L1 · Process 08 — Track fitness check-ups (potential)',
    description:
      'Drawn as a potential process, on the same basis as 06.',
  },
  {
    category: 'workflow',
    href: `${BASE}/L1-P09-v4.html`,
    title: 'L1 · Process 09 — Report to invoice',
    description:
      'Triggered when a site visit ends. Reports each run on their own cadence, and the chain closes at the invoice.',
  },
  {
    category: 'workflow',
    href: `${BASE}/L2-Subprocesses-v1.html`,
    title: 'L2 subprocesses, version 1',
    description:
      'The drawn subprocesses on one page, each stating the L1 step it sits under and the question it answers. Includes 01-RD, which settles which rule wins when requirement defaults collide.',
  },
  {
    category: 'workflow',
    href: `${BASE}/L2-05a-DR-v1.html`,
    title: 'L2 · 05a-DR — Admit at the door',
    description:
      'Sits under Process 05a. How the door gets from a person standing in front of it to a located Order, a confirmed identity and a held record.',
  },
  {
    category: 'workflow',
    href: `${BASE}/L2-05a-CN-v1.html`,
    title: 'L2 · 05a-CN — Confirm the consents',
    description:
      'Sits under Process 05a, gate 2. How nine separate consents behave as one gate, and what happens when any single one is missing.',
  },
  {
    category: 'workflow',
    href: `${BASE}/L2-04-UR-v1.html`,
    title: 'L2 · 04-UR — Absorb an urgent order',
    description:
      'Sits under Process 04. What happens to a full day when an injured person is on the way in.',
  },
  {
    category: 'plan',
    href: `${BASE}/Methodology-To-Be-Process-Design.html`,
    title: 'How the to-be processes were designed',
    description:
      'The method behind the process set: three passes against three yardsticks, why they ran in that order, and what the order buys the implementation plan. Read this first if you are picking the work up cold.',
  },
  {
    category: 'plan',
    href: `${BASE}/WHA-Process-Set-Findings.html`,
    title: 'Process set: findings and proposals',
    description:
      'A step-by-step comparison of the proposed process design against the capabilities held in IMS, and four proposals put up for sign-off. Prepared 2 August 2026.',
  },
  {
    category: 'plan',
    href: `${BASE}/Fit-Gap-New-Design-Against-IMS.html`,
    title: 'Fit and gap: the process set against IMS',
    description:
      'Rewritten 2 August 2026 to keep only what is genuinely unresolved. The earlier version carried forty-three gaps at mixed altitudes, most already settled or answerable from published practice. Contains no discovery questions.',
  },
  {
    category: 'plan',
    href: `${BASE}/L1-Gap-Check-Against-Industry.html`,
    title: 'The industry sweep: L1 gap check',
    description:
      'Two passes against published practice. Pass one: KINNECT, Jobfit and Sonic HealthPlus. Pass two: the Netherlands, Japan, the United Kingdom, Germany, Finland and the enterprise platforms. Sources are the providers and regulators own material.',
  },
  {
    category: 'plan',
    href: `${BASE}/L2-Candidates-For-Decision.html`,
    title: 'Which L1 steps need an L2 drawn under them',
    description:
      'A working list. Every box in the eleven diagrams tested against one question: could a builder build it from the box alone, or does a sequence with its own decisions and failure modes sit underneath.',
  },
  {
    category: 'plan',
    href: `${BASE}/Master-Product-Plan-Three-Stages.html`,
    title: 'Master product plan: three stages from pilot to industry practice',
    description:
      'The plan that implements the version 4 process set, revised after the fit and gap against IMS closed. Stage 1 proves the service, and the later stages carry it out to industry practice.',
  },
  {
    category: 'plan',
    href: `${BASE}/MVP-Product-Plan.html`,
    title: 'MVP product plan: the pilot, ready to build',
    description:
      'The build authority for phase 1. The implementation plan with every correction from the evaluation already settled into the design, so a building session reads this one document and does not have to reconcile two.',
  },
  {
    category: 'plan',
    href: `${BASE}/MVP-Implementation-Plan.html`,
    title: 'MVP implementation plan: prove the service',
    description:
      'The build plan for stage 1 of the master product plan. Process authority is the version 4 L1 pages, the L2 subprocess pages and the findings document.',
  },
  {
    category: 'plan',
    href: `${BASE}/MVP-Plan-Evaluation.html`,
    title: 'MVP plan evaluation',
    description:
      'Is the implementation plan safe to build from? An evaluating session run against the plan, the master plan, both architecture diagrams, the findings, the fit and gap, the L2 pages and the eleven version 4 sources. Every judgement is proposed; nothing here ran and produced a record.',
  },
  {
    category: 'plan',
    href: `${BASE}/MVP-Functional-Architecture.html`,
    title: 'MVP functional architecture',
    description:
      'Stage 1 drawn as four surfaces, eight processes, six engines and one wall. Each process is specified by its L1 page and each engine by its L2 page.',
  },
  {
    category: 'plan',
    href: `${BASE}/MVP-Technical-Architecture.html`,
    title: 'MVP technical architecture',
    description:
      'How stage 1 is built, tier by tier, with the employer wall enforced by a schema grant. Everything is proposed until the first step lands, and none of it is exotic.',
  },
]
export const allPrivateItems: LibraryItem[] = [
  ...e8PrivateItems,
  ...aioPrivateItems,
  ...whaPrivateItems,
]
