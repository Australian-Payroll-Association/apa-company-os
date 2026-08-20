import { NextResponse } from 'next/server'
import { companyOs } from '@/lib/supabase'
import { listDocs } from '@/lib/docs'
import { allWorkflows } from '@/lib/workflowsData'
import { allPrivateItems } from '@/lib/privateLibraryData'

// Public home page stats. Cached at the CDN for 5 minutes.
export const dynamic = 'force-dynamic'
// Without this, Next 14 serves the Supabase RPC response from the Data Cache
// indefinitely, so the counter never reflects DB updates until a redeploy.
export const fetchCache = 'force-no-store'

const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
}

async function attendeesTotal(): Promise<number | null> {
  try {
    const { data, error } = await companyOs.rpc('workshop_attendees_total', {
      p_year: new Date().getFullYear(),
    })
    if (error) throw error
    return typeof data === 'number' ? data : null
  } catch {
    return null
  }
}

// One number for "documented workflows", public and private: the public
// /workflows directory, the workflow-category entries of the private library
// (all brands), and docs published to Storage via scripts/docs/publish.mjs.
// Only a count crosses this endpoint; private titles never do.
async function documentedWorkflowsTotal(): Promise<number | null> {
  try {
    const docs = await listDocs()
    const docHrefs = new Set(docs.map((d) => `/workflows/private/e8/${d.slug}`))
    const privateWorkflows = allPrivateItems.filter(
      (i) => i.category === 'workflow' && !docHrefs.has(i.href)
    )
    return allWorkflows.length + privateWorkflows.length + docs.length
  } catch {
    return null
  }
}

export async function GET() {
  const [workshopAttendees, documentedWorkflows] = await Promise.all([
    attendeesTotal(),
    documentedWorkflowsTotal(),
  ])
  // Fail soft per number: the client falls back to its baseline.
  return NextResponse.json({ workshopAttendees, documentedWorkflows }, { headers: CACHE_HEADERS })
}
