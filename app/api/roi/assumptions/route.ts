import { NextResponse } from 'next/server'
import { companyOs } from '@/lib/supabase'
import type { RoiAssumptions, BerylPrice } from '@/lib/roi'

// Public, read-only. Returns the single editable assumptions row plus Beryl's
// price from the products catalogue. The public never touches the DB directly —
// this server route is the only exposure, and it returns no secrets.
export const dynamic = 'force-dynamic'

export async function GET() {
  const [{ data: a, error: aErr }, { data: p, error: pErr }] = await Promise.all([
    companyOs.from('roi_assumptions').select('*').limit(1).maybeSingle(),
    companyOs.from('products').select('amount_cents, currency').eq('slug', 'beryl').maybeSingle(),
  ])

  if (aErr || !a) {
    console.error('roi assumptions read error:', aErr)
    return NextResponse.json({ error: 'assumptions_unavailable' }, { status: 500 })
  }
  if (pErr) console.error('beryl price read error:', pErr)

  const assumptions: RoiAssumptions = {
    timeSavedMinMinutes: a.time_saved_min_minutes,
    timeSavedMaxMinutes: a.time_saved_max_minutes,
    workingHoursYear: a.working_hours_year,
    typicalQueriesPerUser: a.typical_queries_per_user,
    signedOff: a.assumptions_signed_off,
  }

  // Fall back to the known list price if the product row is missing, so the
  // calculator still works rather than showing $0.
  const price: BerylPrice = {
    amountCents: p?.amount_cents ?? 4995,
    currency: p?.currency ?? 'aud',
  }

  return NextResponse.json({ assumptions, price })
}
