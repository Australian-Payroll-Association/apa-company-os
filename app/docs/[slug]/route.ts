import { NextRequest, NextResponse } from 'next/server'
import { DOCS_COOKIE, downloadFresh, isValidSlug } from '@/lib/docs'

export const dynamic = 'force-dynamic'

// Serves a document straight out of Storage. The access cookie is checked here,
// server side, before the file is fetched: unlike a file in public/, an
// unlocked URL alone is not enough to read the contents.
export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params

  if (!isValidSlug(slug)) {
    return new NextResponse('Not found', { status: 404 })
  }

  if (req.cookies.get(DOCS_COOKIE)?.value !== '1') {
    return NextResponse.redirect(new URL('/docs/', req.url))
  }

  const html = await downloadFresh(`${slug}.html`)
  if (html === null) {
    return new NextResponse('Not found', { status: 404 })
  }

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Documents are overwritten in place, so never serve a stale copy.
      'Cache-Control': 'no-store, must-revalidate',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}
