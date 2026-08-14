import { NextRequest, NextResponse } from 'next/server'
import { downloadFresh, isValidSlug } from '@/lib/docs'

export const dynamic = 'force-dynamic'

// Documents published from Supabase Storage, served inside the private
// workflows library so they sit with everything else the team already looks
// for. Publishing one is an upload, not a deploy: this route is the only code
// involved, and it is written once.
//
// Route precedence keeps this safe: the static folders here (equipment-register,
// team-onboarding, ...) and the .html files in public/workflows/private/e8/ both
// win over this dynamic segment, so nothing that exists today changes.
//
// The cookie is the one PrivateGate already sets for /workflows/private, so a
// document unlocks with the same code as the library index, and the check runs
// server side before any content is fetched.
export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params

  if (!isValidSlug(slug)) {
    return new NextResponse('Not found', { status: 404 })
  }

  if (req.cookies.get('edge8_private_ok')?.value !== '1') {
    return NextResponse.redirect(new URL('/workflows/private/e8/', req.url))
  }

  const html = await downloadFresh(`${slug}.html`)
  if (html === null) {
    return new NextResponse('Not found', { status: 404 })
  }

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, must-revalidate',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}
