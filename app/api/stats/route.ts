import { NextResponse } from 'next/server'
import { companyOs } from '@/lib/supabase'

// Public home page stats. Cached at the CDN for 5 minutes.
export const dynamic = 'force-dynamic'
// Without this, Next 14 serves the Supabase RPC response from the Data Cache
// indefinitely, so the counter never reflects DB updates until a redeploy.
export const fetchCache = 'force-no-store'

const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
}

export async function GET() {
  try {
    const { data, error } = await companyOs.rpc('workshop_attendees_total', {
      p_year: new Date().getFullYear(),
    })
    if (error) throw error
    return NextResponse.json(
      { workshopAttendees: typeof data === 'number' ? data : null },
      { headers: CACHE_HEADERS }
    )
  } catch {
    // Fail soft: the client falls back to its baseline number.
    return NextResponse.json({ workshopAttendees: null }, { headers: CACHE_HEADERS })
  }
}
