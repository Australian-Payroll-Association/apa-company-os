import { NextRequest, NextResponse } from 'next/server'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { renderToBuffer } from '@react-pdf/renderer'
import { companyOs } from '@/lib/supabase'
import { computeRoi } from '@/lib/roi'
import { loadModel, BERYL_CTA_URL, BERYL_PAGE_URI } from '@/lib/roi-server'
import { getOrCreatePerson } from '@/lib/company-os'
import { promotePersonToLead } from '@/lib/lifecycle'
import { submitBerylLeadToHubSpot } from '@/lib/roi-hubspot'
import { BerylRoiPdf } from '@/lib/roi-pdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

export async function POST(req: NextRequest) {
  try {
    const b = await req.json()
    const firstname = String(b.firstname ?? '').trim()
    const lastname = String(b.lastname ?? '').trim()
    const jobtitle = String(b.jobtitle ?? '').trim()
    const email = String(b.email ?? '').trim().toLowerCase()
    const t = Number(b.teamSize), q = Number(b.queriesPerUser), sal = Number(b.salary)
    const usageId: string | undefined = b.usageId

    if (!firstname || !lastname || !jobtitle || !emailOk(email)) {
      return NextResponse.json({ error: 'invalid_contact' }, { status: 400 })
    }
    if (![t, q, sal].every(n => Number.isFinite(n) && n > 0)) {
      return NextResponse.json({ error: 'invalid_inputs' }, { status: 400 })
    }

    const model = await loadModel()
    if (!model) return NextResponse.json({ error: 'model_unavailable' }, { status: 500 })
    const result = computeRoi({ teamSize: t, queriesPerUser: q, annualSalary: sal / t }, model.assumptions, model.price)

    // ── Side effects: best-effort, must never block the PDF ──────────────────
    // 1) Native CRM: person + lead (source='roi_calculator'), consent + job title.
    try {
      const person = await getOrCreatePerson({ email, name: `${firstname} ${lastname}`, source: 'roi_calculator' })
      if (person.ok) {
        const { data: existing } = await companyOs
          .from('people').select('marketing_consent, do_not_contact, metadata').eq('id', person.id).maybeSingle()
        const patch: Record<string, unknown> = {
          first_name: firstname,
          last_name: lastname,
          metadata: { ...(existing?.metadata ?? {}), jobtitle },
        }
        // Submitting = informed consent (the form states they join the mailing
        // list) — but never override a prior unsubscribe / do-not-contact.
        if (existing && existing.marketing_consent !== 'unsubscribed' && !existing.do_not_contact) {
          patch.marketing_consent = 'subscribed'
          patch.marketing_consent_at = new Date().toISOString()
          patch.marketing_consent_source = 'beryl_roi_calculator'
        }
        await companyOs.from('people').update(patch).eq('id', person.id)

        const promoted = await promotePersonToLead(person.id, { reason: 'beryl_roi_pdf' })
        if (!promoted.ok) console.error('[beryl-roi] lead promote:', promoted.error)
        await companyOs.from('lead').update({ source: 'roi_calculator' }).eq('person_id', person.id)
      } else {
        console.error('[beryl-roi] person error:', person.error)
      }
    } catch (e) { console.error('[beryl-roi] native lead side-effect failed:', e) }

    // 2) HubSpot mirror via Forms API (no token needed).
    try { await submitBerylLeadToHubSpot({ firstname, lastname, jobtitle, email, pageUri: BERYL_PAGE_URI }) }
    catch (e) { console.error('[beryl-roi] hubspot side-effect failed:', e) }

    // 3) Flag the usage row as converted (or log one now if none was created).
    try {
      if (usageId) {
        await companyOs.from('roi_usage_events').update({ pdf_requested: true }).eq('id', usageId)
      } else {
        await companyOs.from('roi_usage_events').insert({
          team_size: t, queries_per_user: q, salary_cents: Math.round(sal * 100),
          hourly_rate_cents: result.hourlyRateCents,
          monthly_saving_low_cents: result.monthlySavingLowCents,
          monthly_saving_high_cents: result.monthlySavingHighCents,
          pdf_requested: true,
        })
      }
    } catch (e) { console.error('[beryl-roi] usage flag failed:', e) }

    // ── Render the PDF ───────────────────────────────────────────────────────
    const logoPath = join(process.cwd(), 'public', 'beryl', 'apa-logo.png')
    const preparedOn = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
    // BerylRoiPdf returns a <Document>; call it directly so the element type is
    // the document element renderToBuffer expects.
    const buffer = await renderToBuffer(
      BerylRoiPdf({
        contact: { firstname, lastname, jobtitle, email },
        inputs: { teamSize: t, queriesPerUser: q, totalSalary: sal },
        assumptions: model.assumptions,
        price: model.price,
        result,
        preparedOn,
        ctaUrl: BERYL_CTA_URL,
        logoSrc: existsSync(logoPath) ? logoPath : undefined,
      }),
    )

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Beryl-ROI-${lastname || 'estimate'}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[beryl-roi] pdf route error:', err)
    // TEMP: ?debug=1 surfaces the real error to diagnose the Vercel-only 500.
    const debug = new URL(req.url).searchParams.get('debug') === '1'
    return NextResponse.json(
      debug ? { error: 'failed', detail: String(err), stack: (err as Error)?.stack?.split('\n').slice(0, 6) } : { error: 'failed' },
      { status: 500 },
    )
  }
}
