import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import TeamOnboardingDeck from './TeamOnboardingDeck'
import './team-onboarding.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Edge8 AI · Team Onboarding',
  description: 'Onboarding deck for new Edge8 AI team members.',
  robots: { index: false, follow: false },
}

export default function TeamOnboardingPage() {
  return <TeamOnboardingDeck fontClassName={inter.className} />
}
