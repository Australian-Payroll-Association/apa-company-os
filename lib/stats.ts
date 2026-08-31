import { companyOs } from '@/lib/supabase'
import { listDocs } from '@/lib/docs'
import { allWorkflows } from '@/lib/workflowsData'

// Year-goal source numbers, shared by the public /api/stats endpoint and the
// admin Marketing overview so the two always report the same figure.

// Annual targets. The canonical source is scripts/edges/collect-metrics.mjs
// (YEAR_GOALS); mirrored here as constants for the UIs that draw progress bars.
export const KEYNOTE_ATTENDEES_GOAL = 1000
export const DOCUMENTED_WORKFLOWS_GOAL = 100

export async function getWorkshopAttendeesTotal(): Promise<number | null> {
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
// Only a count is ever exposed; private titles never leave this function.
export async function getDocumentedWorkflowsTotal(): Promise<number | null> {
  try {
    const docs = await listDocs()
    // The private library (lib/privateLibraryData) is client-confidential and is
    // removed by the allowlist sync that generates this filtered snapshot, so it
    // contributes nothing here. Upstream adds its workflow-category items.
    return allWorkflows.length + docs.length
  } catch {
    return null
  }
}
