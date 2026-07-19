export type Workflow = {
  slug: string
  title: string
  category: 'Talent' | 'Operations' | 'Revenue' | 'Innovation'
  excerpt: string
  date: string
  steps: number
}

export const allWorkflows: Workflow[] = [
  {
    slug: 'one-on-one',
    title: '1-1 Leadership Workflow',
    category: 'Talent',
    excerpt:
      'A biweekly coaching cadence where AI prepares every meeting, a human runs it, and AI captures every commitment.',
    date: '2026-04-14',
    steps: 5,
  },
  {
    slug: 'blog-publishing',
    title: 'How We Publish',
    category: 'Operations',
    excerpt:
      'The four-stage pipeline behind every post on this site. A human creates and approves, Claude builds and logs.',
    date: '2026-04-12',
    steps: 4,
  },
  {
    slug: 'monthly-invoicing',
    title: 'Monthly Invoicing',
    category: 'Operations',
    excerpt:
      'One billing cycle, four dates, zero chasing. Created on the 31st, dated to the 1st, due on the 20th, escalated after.',
    date: '2026-03-20',
    steps: 5,
  },
  {
    slug: 'contractor-payments',
    title: 'Contractor Hours + Payment',
    category: 'Operations',
    excerpt:
      'Every piece of contractor work moves through one loop: request, estimate, approval, delivery, and a monthly payment run.',
    date: '2026-07-16',
    steps: 7,
  },
  {
    slug: 'ai-resume-screen',
    title: 'AI Resume Screen + Talent Rank',
    category: 'Talent',
    excerpt:
      'Every application is read and scored by AI, stack-ranked per role family, then rated by a human recruiter. Two gates, no resume unread.',
    date: '2026-07-16',
    steps: 6,
  },
  {
    slug: 'time-off',
    title: 'Time Off',
    category: 'Operations',
    excerpt:
      'Leave requests move from the team portal to an admin decision to an updated balance without a single chat message.',
    date: '2026-07-16',
    steps: 5,
  },
  {
    slug: 'lead-capture',
    title: 'Lead Capture to CRM',
    category: 'Revenue',
    excerpt:
      'From a form submission to a customer record: a spam gate filters the noise, and every real inquiry becomes a tracked lead.',
    date: '2026-07-16',
    steps: 6,
  },
  {
    slug: 'event-registration',
    title: 'Event Registration',
    category: 'Revenue',
    excerpt:
      'Admin creates an event, the public signs up, Stripe takes payment, a webhook confirms the seat. No human in the middle.',
    date: '2026-07-16',
    steps: 5,
  },
  {
    slug: 'invoice-sync',
    title: 'QuickBooks Invoice Sync',
    category: 'Operations',
    excerpt:
      'A weekly sync pulls every invoice out of QuickBooks and maps it to the CRM, so revenue truth lives in one place.',
    date: '2026-07-16',
    steps: 4,
  },
  {
    slug: 'monthly-expenses',
    title: 'Monthly Expense Entry',
    category: 'Operations',
    excerpt:
      'Bank transactions become a categorized finance sheet, the sheet becomes QuickBooks entries, and the P&L confirms the month. Every expense entered, every pass-through billed.',
    date: '2026-07-18',
    steps: 8,
  },
  {
    slug: 'monthly-pnl',
    title: 'Monthly P&L',
    category: 'Operations',
    excerpt:
      'Invoices and expenses sync from QuickBooks all month, then close into a published P&L days after month end.',
    date: '2026-07-16',
    steps: 4,
  },
  {
    slug: 'surveys',
    title: 'Survey Collection',
    category: 'Operations',
    excerpt:
      'Create a survey, share one link, and watch responses land in the admin in real time. Feedback without the spreadsheet.',
    date: '2026-07-16',
    steps: 4,
  },
  {
    slug: 'ideas-backlog',
    title: 'Ideas Backlog',
    category: 'Innovation',
    excerpt:
      'Anyone on the team submits an idea through the 5D framework, AI turns it into a full product plan, and admins triage a ready backlog.',
    date: '2026-07-16',
    steps: 5,
  },
  {
    slug: 'sales-call-intelligence',
    title: 'Sales Call Intelligence',
    category: 'Revenue',
    excerpt:
      'Every discovery and closing call is classified, structured into the CRM as JSON, summarized for the client and the rep, and rolled up monthly for the manager. The deal moves stage on the outcome.',
    date: '2026-07-16',
    steps: 7,
  },
  {
    slug: 'certification',
    title: 'Challenge-Based Certification',
    category: 'Innovation',
    excerpt:
      'Certification earned through submitted proof of real work, challenge by challenge. Attendance proves nothing; artifacts do.',
    date: '2026-07-16',
    steps: 5,
  },
  {
    slug: 'client-work-requests',
    title: 'Client Work Requests',
    category: 'Revenue',
    excerpt:
      'Clients brief a contractor in the portal, approve the estimate, and accept the finished work. The invoice sends itself the moment they do.',
    date: '2026-07-18',
    steps: 6,
  },
]
