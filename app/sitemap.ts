import type { MetadataRoute } from 'next'
import { allPosts } from '@/lib/postData'
import { allCaseStudies } from '@/lib/caseStudies'
import { allWorkflows } from '@/lib/workflowsData'

const BASE = 'https://www.edge8.ai'

// Site uses trailingSlash: true in next.config.mjs, so every canonical URL
// must end in '/'. Without this, Google does a 308 hop on every URL and
// burns crawl budget.

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const staticRoutes: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
    { path: '/', priority: 1.0, changeFrequency: 'weekly' },
    { path: '/about/', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/contact/', priority: 0.9, changeFrequency: 'monthly' },
    { path: '/ai-programs/', priority: 0.9, changeFrequency: 'weekly' },
    { path: '/caio-leadership/', priority: 0.9, changeFrequency: 'monthly' },
    { path: '/global-staffing/', priority: 0.9, changeFrequency: 'monthly' },
    { path: '/training-and-certification/', priority: 0.9, changeFrequency: 'monthly' },
    { path: '/your-first-ai-hire/', priority: 0.9, changeFrequency: 'monthly' },
    { path: '/blog/', priority: 0.8, changeFrequency: 'daily' },
    { path: '/careers/', priority: 0.7, changeFrequency: 'weekly' },
    { path: '/workflows/', priority: 0.7, changeFrequency: 'monthly' },
    { path: '/workflows/method/', priority: 0.7, changeFrequency: 'monthly' },
    { path: '/legal/privacy/', priority: 0.3, changeFrequency: 'yearly' },
    { path: '/legal/eula/', priority: 0.3, changeFrequency: 'yearly' },
  ]

  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map(({ path, priority, changeFrequency }) => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }))

  const caseStudyEntries: MetadataRoute.Sitemap = allCaseStudies.map((cs) => ({
    url: `${BASE}/case-studies/${cs.slug}/`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.8,
  }))

  const postEntries: MetadataRoute.Sitemap = allPosts.map((p) => ({
    url: `${BASE}/post/${p.slug}/`,
    lastModified: p.date ? new Date(p.date) : now,
    changeFrequency: 'monthly',
    priority: 0.7,
  }))

  const workflowEntries: MetadataRoute.Sitemap = allWorkflows.map((w) => ({
    url: `${BASE}/workflows/${w.slug}/`,
    lastModified: new Date(w.date),
    changeFrequency: 'monthly',
    priority: 0.6,
  }))

  return [...staticEntries, ...caseStudyEntries, ...postEntries, ...workflowEntries]
}
