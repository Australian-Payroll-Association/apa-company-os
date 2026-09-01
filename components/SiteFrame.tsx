'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import Nav from './Nav'
import Footer from './Footer'

// Routes that render standalone, without the site nav/footer (e.g. full-screen decks, the /admin CRM, the /team portal).
const BARE_ROUTES = ['/blueprints/team-onboarding', '/reserve', '/admin', '/team', '/portal', '/surveys', '/beryl-roi/embed']

export default function SiteFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  // The home route ('/') is the standalone APA entry point — it carries its own
  // header/footer, so it renders bare (exact match, not a startsWith prefix).
  const bare = pathname === '/' || BARE_ROUTES.some((route) => pathname?.startsWith(route))

  return (
    <>
      {!bare && <Nav />}
      {children}
      {!bare && <Footer />}
    </>
  )
}
