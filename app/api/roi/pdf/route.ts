import { NextRequest, NextResponse } from 'next/server'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { renderToBuffer } from '@react-pdf/renderer'
import { computeRoi } from '@/lib/roi'
import { loadModel, BERYL_CTA_URL } from '@/lib/roi-server'
import { BerylRoiPdf } from '@/lib/roi-pdf'

// Render-only. This route ONLY generates the manager-ready PDF from the
// calculator numbers. It creates no lead and makes no HubSpot call — lead
// capture is handled entirely by the APA HubSpot form embedded in the widget.
// The name fields are used solely to personalise the PDF; nothing is stored.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function POST(req: NextRequest) {
  try {
    const b = await req.json()
    const firstname = String(b.firstname ?? '').trim()
    const lastname = String(b.lastname ?? '').trim()
    const jobtitle = String(b.jobtitle ?? '').trim()
    const t = Number(b.teamSize), q = Number(b.queriesPerUser), sal = Number(b.salary)

    if (![t, q, sal].every(n => Number.isFinite(n) && n > 0)) {
      return NextResponse.json({ error: 'invalid_inputs' }, { status: 400 })
    }

    const model = await loadModel()
    if (!model) return NextResponse.json({ error: 'model_unavailable' }, { status: 500 })
    const result = computeRoi({ teamSize: t, queriesPerUser: q, annualSalary: sal / t }, model.assumptions, model.price)

    const logoPath = join(process.cwd(), 'public', 'beryl', 'apa-logo.png')
    const preparedOn = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
    const buffer = await renderToBuffer(
      BerylRoiPdf({
        contact: { firstname, lastname, jobtitle, email: '' },
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
    console.error('[beryl-roi] pdf render error:', err)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
