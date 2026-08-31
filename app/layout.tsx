import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import SiteFrame from '@/components/SiteFrame'

export const metadata: Metadata = {
  metadataBase: new URL('https://apa-company-os.vercel.app'),
  title: 'Australian Payroll Association — Company OS',
  description:
    "The internal operations platform for Australia's leading payroll training, consulting and advisory service.",
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Australian Payroll Association — Company OS',
    description:
      "The internal operations platform for Australia's leading payroll training, consulting and advisory service.",
    url: 'https://apa-company-os.vercel.app',
    siteName: 'Australian Payroll Association',
    type: 'website',
  },
}

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Australian Payroll Association',
  alternateName: 'APA',
  url: 'https://austpayroll.com.au',
  description:
    "Australia's leading payroll training, consulting and advisory service.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <SiteFrame>{children}</SiteFrame>
        <Analytics />
      </body>
    </html>
  )
}
