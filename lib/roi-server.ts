import { companyOs } from '@/lib/supabase'
import type { RoiAssumptions, BerylPrice } from '@/lib/roi'

export const BERYL_CTA_URL = process.env.BERYL_CTA_URL || 'austpayroll.com.au/beryl'
export const BERYL_PAGE_URI = 'https://austpayroll.com.au/beryl'

// Reads the single editable assumptions row + Beryl's price from the catalogue.
export async function loadModel(): Promise<{ assumptions: RoiAssumptions; price: BerylPrice } | null> {
  const [{ data: a }, { data: p }] = await Promise.all([
    companyOs.from('roi_assumptions').select('*').limit(1).maybeSingle(),
    companyOs.from('products').select('amount_cents, currency').eq('slug', 'beryl').maybeSingle(),
  ])
  if (!a) return null
  return {
    assumptions: {
      timeSavedMinMinutes: a.time_saved_min_minutes,
      timeSavedMaxMinutes: a.time_saved_max_minutes,
      workingHoursYear: a.working_hours_year,
      typicalQueriesPerUser: a.typical_queries_per_user,
      signedOff: a.assumptions_signed_off,
    },
    price: { amountCents: p?.amount_cents ?? 4995, currency: p?.currency ?? 'aud' },
  }
}
