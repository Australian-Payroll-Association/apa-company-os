# Admin performance optimizations — development plan

**Date:** 2026-07-19
**Author:** performance review (Karpathy-lens), implemented across 4 batched PRs
**Trigger:** admin tools feel slow.

## Diagnosis (grounded against the live DB)

The database is **not** the bottleneck. Every `company_os` table is under ~650 rows
(people 612, applications 308, deals 130, event_registrations 6), so Postgres
seq-scans everything in microseconds. The 10 "missing indexes" surfaced in review
are schema hygiene for a 10x-larger future, not a current latency source — deferred.

What actually costs wall-clock time is **round-trips and bytes**:

1. Auth is re-validated over the network several times per request and never memoized.
2. The dashboard blocks its first byte on an external Vercel Analytics API call.
3. Detail pages chain independent reads as serial await waves.
4. A drag-and-drop engine + a 1754-line board module ship in the first-load JS of a
   read-mostly landing page.
5. Reordering deals fires one UPDATE per card.
6. The applications list ships all rows with two heavy JSONB/text columns for a
   per-row drawer.

## The four PRs

### PR1 — `perf/request-overhead` (base: main)
- Wrap `getAdminUser` / `getTeamActor` / `findActiveTeamMembership` / `isAdminEmail`
  in React `cache()` so the layout + page + server-component fan-out dedupe the
  identity resolve within a single render pass instead of re-hitting Supabase.
- **Contact 360** (`contacts/[id]/page.tsx` + `lib/admin/contacts.ts`): fold the
  person lookup into the related-reads `Promise.all`, and hoist the portal +
  affiliate reads to run in parallel with it. **3 round-trip waves → 1.**
- **Team member** (`talent/team/[id]/page.tsx`): collapse the survey / assignments /
  avatar / sensitive / signed-in lookups into a single `Promise.all` after the
  directory row is known. **5–6 waves → 2.**
- No change to the security boundary.

### PR2 — `perf/auth-local-session` (base: PR1 — **stacked, merge after PR1**)
- Security-sensitive, isolated for review. Swap the RSC/action gate from
  `auth.getUser()` (network revalidation) to `auth.getSession()` (local), trusting
  the middleware's per-request `getUser()` revalidation. Keeps the `admins`-table
  authorization check and explicit expired/absent-session handling. Removes one
  network round-trip per GET and per autosave action.
- Middleware keeps `getUser()`, so every request still has exactly one network
  revalidation. Tradeoff: a token revoked mid-session (banned/deleted user) stays
  valid until expiry (~1h) — acceptable for a 3-admin internal tool; documented in
  the PR body for sign-off.

### PR3 — `perf/dashboard-streaming` (base: main)
- Remove `getAnalyticsOverview()` from the dashboard's top-level `Promise.all`.
- Render the two analytics tiles (Page views, Visitors) in an async child wrapped
  in `<Suspense>` so the DB-backed shell streams immediately and analytics fills in.
- Fetch only the totals endpoint the dashboard uses, and add an `AbortSignal`
  timeout so a slow/hung Vercel API can never gate render.

### PR4 — `perf/query-bundle-efficiency` (base: main)
- **Deal reorder** (`reorder_deals` RPC + migration): replace the per-card UPDATE
  fan-out in `reorderDeals` (and the bulk reposition) with a single set-based
  `unnest(...) WITH ORDINALITY` RPC. **N round-trips → 1.**
- **Code-split** the revenue cockpit: import `DealCard` as a type-only import and
  lazily (`next/dynamic`) load `DealDetail`, so `@hello-pangea/dnd` + the 1754-line
  `DealsBoard` leave the cockpit's first-load JS.
- **Applications over-fetch**: drop `cover_letter` + `answers` (JSONB) from the list
  query; lazy-load them inside the manage drawer via a new `getApplicationExtras`
  action, mirroring the existing lazy stage/resume loads.

## Verification (no dev server — per project rule)
- `npx tsc --noEmit` on every branch.
- `next build` on the integrated set.
- `reorder_deals` migration applied to the DB and smoke-tested via RPC before the
  code path uses it.

## What to measure (before/after)
- `Server-Timing` header on the admin layout + `/admin` TTFB.
- Auth: `getUser`/`getSession` call count per request (target 3→1 GET, 2→1 action).
- Dashboard: `/admin` TTFB on a cold analytics cache.
- Bundle: first-load JS (kB) for `/admin/revenue` from `next build`.
- Drag: PATCH count on a 30-card column drop (target N→1).

## Explicitly deferred
The 10 missing indexes — revisit when any table crosses ~5–10k rows.
