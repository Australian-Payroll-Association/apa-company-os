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
    category: 'Revenue',
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
]
