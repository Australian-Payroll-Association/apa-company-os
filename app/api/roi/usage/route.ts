import { NextRequest, NextResponse } from 'next/server'
import { companyOs } from '@/lib/supabase'
import { computeRoi } from '@/lib/roi'
import { loadModel } from '@/lib/roi-server'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// POST — log one anonymous run (no PII). Server recomputes the result.
export async function POST(req: NextRequest) {
  try {
    const { teamSize, queriesPerUser, salary } = await req.json()
    const t = Number(teamSize), q = Number(queriesPerUser), s = Number(salary)
    if (![t, q, s].every(n => Number.isFinite(n) && n > 0)) {
      return NextResponse.json({ error: 'invalid_inputs' }, { status: 400 })
    }
    const model = await loadModel()
    if (!model) return NextResponse.json({ error: 'model_unavailable' }, { status: 500 })

    const r = computeRoi({ teamSize: t, queriesPerUser: q, annualSalary: s / t }, model.assumptions, model.price)
    const { data, error } = await companyOs.from('roi_usage_events').insert({
      team_size: t,
      queries_per_user: q,
      salary_cents: Math.round(s * 100),
      hourly_rate_cents: r.hourlyRateCents,
      monthly_saving_low_cents: r.monthlySavingLowCents,
      monthly_saving_high_cents: r.monthlySavingHighCents,
      pdf_requested: false,
    }).select('id').single()
    if (error) { console.error('[beryl-roi] usage insert error:', error); return NextResponse.json({ error: 'insert_failed' }, { status: 500 }) }
    return NextResponse.json({ id: data.id })
  } catch (err) {
    console.error('[beryl-roi] usage POST error:', err)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}

// PATCH — mark an existing run as converted to a PDF.
export async function PATCH(req: NextRequest) {
  try {
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 })
    const { error } = await companyOs.from('roi_usage_events').update({ pdf_requested: true }).eq('id', id)
    if (error) { console.error('[beryl-roi] usage patch error:', error); return NextResponse.json({ error: 'update_failed' }, { status: 500 }) }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[beryl-roi] usage PATCH error:', err)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
