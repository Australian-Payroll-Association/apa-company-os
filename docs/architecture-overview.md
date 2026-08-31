# Architecture Overview — Website vs. Core Application

**Repo:** `edge8-web` (single Next.js app, App Router)
**Last updated:** 2026-08-28

This repo ships two logically distinct products from one codebase: the public **marketing
website** (edge8.co) and the internal **core application** (Company OS admin/CRM, Team Portal,
and the client-facing tools that back them). There is no folder-level separation enforcing this
today — both live side by side under `app/` — so this doc exists to make the split explicit.

---

## Website

Public, unauthenticated, SEO- and lead-gen-oriented pages. Anyone can reach these without
logging in.

| Route | Purpose |
|---|---|
| `app/page.tsx` (root) | Homepage |
| `app/about` | Company/about page |
| `app/ai-programs` | AI programs marketing |
| `app/blog`, `app/post/[slug]` | Blog listing and article pages |
| `app/caio-leadership` | CAIO leadership program marketing |
| `app/careers` | Careers/job listings |
| `app/case-studies` | Case study pages |
| `app/contact` | Contact form (public) |
| `app/events` | Events listing |
| `app/global-staffing` | Global staffing marketing |
| `app/legal` | Terms, privacy, legal pages |
| `app/team` | Team/about-the-people page |
| `app/the-vietnam-experience`, `app/saigon-private`, `app/vietnam-adventure-flight-info`, `app/vietnam-adventure-info-form` | Retreat/event marketing and public intake forms |
| `app/training-and-certification` | Certification program marketing |
| `app/work` | Portfolio/work page |
| `app/your-first-ai-hire` | Campaign landing page |
| `app/reserve` | Public event reservation/booking pages |
| `app/unsubscribe` | Email unsubscribe page |
| `app/docs` | Public-facing documentation pages served from the docs API |

Characteristics: no auth required, optimized for SEO (`sitemap.ts`, `robots.ts`,
`opengraph-image.tsx` at the root), primarily content and lead capture.

---

## Core application

Internal tools and client-facing gated products that sit behind the marketing site — the
"Company OS." These are logged-in, transactional, or generated-and-shared-by-staff surfaces
rather than organic public traffic.

| Route | Purpose |
|---|---|
| `app/admin` (`(auth)` + `(dashboard)` route groups) | Company OS admin/CRM — the internal operations app |
| `app/portal` (`(auth)` + `(dashboard)` route groups) | Team Portal for staff |
| `app/checkout` | Transactional checkout flow (Stripe) |
| `app/proposals` | Client-facing proposal pages generated from the CRM |
| `app/surveys` | Survey forms tied to CRM data collection |
| `app/my-retreat` | Auth-gated retreat hub for clients (`MyRetreatGate`) |
| `app/private` | Private, client-specific portal instances (e.g. `private/bstore`) |
| `app/plans` | Internal planning/finance pages (e.g. retreats P&L) |
| `app/workflows` | Internal workflow documentation library (onboarding, invoicing, coaching programs, etc.), published for the team |
| `app/t/[code]` | Internal tracked-link redirector |

Characteristics: most routes are behind auth (`(auth)` route groups, portal gates), or are
generated/shared by staff rather than discovered organically, and read from or write to the same
backend (Supabase `company_os`) that powers the admin CRM.

---

## Shared infrastructure

- **`app/api`** — backend for *both* halves. Some routes are website-facing (`contact`,
  `careers`, `unsubscribe`, `vietnam-adventure-*`, `checkout`, `stripe`, `surveys`), others are
  core-application-only (`admin`, `portal`, `htt`, `qbo`, `cron`, `webhooks`, `ingest`,
  `assistant`). Don't assume a route under `app/api` belongs to one side just because a sibling
  page does — check what it's called from.
- **`app/layout.tsx`, `app/globals.css`** — shared root layout and design tokens used by both
  the marketing site and the core application.
- **`app/robots.ts`, `app/sitemap.ts`** — website-only, but live at the app root since Next.js
  requires them there.

## Notes on the split

A few routes are hybrid by nature and don't fit cleanly:

- **`app/reserve`** is public-facing (booking pages) but writes into the same CRM backend as the
  core application — categorized as website here because its audience is the public.
- **`app/docs`** serves documentation content publicly; it's grouped with the website because it
  has no auth, but the content it serves may originate from internal workflow docs.

This document reflects the routing structure as of 2026-08-28 (`app/` top-level listing). If new
top-level routes are added, extend the relevant table above rather than creating a new doc.
