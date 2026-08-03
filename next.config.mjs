/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      // The new-member onboarding form is a purpose-driven survey; serve it at a
      // clean top-level URL while it runs on the survey engine underneath.
      { source: '/new-member-onboarding', destination: '/surveys/new-member-onboarding' },
    ]
  },
  async redirects() {
    return [
      // The talent Rank page was renamed to Candidate Pool.
      { source: '/admin/talent/rank', destination: '/admin/talent/candidate-pool', permanent: true },
      // The onboarding deck moved into the private workflows library, now under the E8 brand.
      { source: '/blueprints/team-onboarding', destination: '/workflows/private/e8/team-onboarding', permanent: true },
      // The private workflows library was split into E8 and AIO Labs brands; the
      // existing guides moved under /workflows/private/e8/. Keep shared links working.
      { source: '/workflows/private/team-onboarding', destination: '/workflows/private/e8/team-onboarding', permanent: true },
      { source: '/workflows/private/private-retreats', destination: '/workflows/private/e8/private-retreats', permanent: true },
      { source: '/workflows/private/accounting-training', destination: '/workflows/private/e8/accounting-training', permanent: true },
      { source: '/workflows/private/ai-retreat-work-healthy', destination: '/workflows/private/e8/ai-retreat-work-healthy', permanent: true },
      { source: '/workflows/private/ai-retreat-austpayroll', destination: '/workflows/private/e8/ai-retreat-austpayroll', permanent: true },
      { source: '/workflows/private/vung-tau-leg.html', destination: '/workflows/private/e8/vung-tau-leg.html', permanent: true },
    ]
  },
}

export default nextConfig
