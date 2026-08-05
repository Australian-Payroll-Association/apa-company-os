# Private Workflows Library Redesign + AI Program Plan

**Branch:** `private-repo-redesign`
**Date:** 2026-08-05
**Routes affected:** `/workflows/private`, `/workflows/private/e8`, and the renamed
`/workflows/private/ai-officer-institute` (was `/aio-labs`)
**Status:** Plan — decisions resolved, ready to build on approval

---

## 1. What the user asked for

On the private workflows library (`https://edge8.ai/workflows/private/`):

1. **Create an "AI Program plan"** document (a program **design brief**) in the private library.
2. **Redesign each brand library** into a **Plans | Workflows | Data** tabbed layout with a
   **search box**, modelled on `https://payrolliq.com.au/workflows`.
3. **Scope is both brands.** Corporate structure: **Edge8 AI** is a Vietnamese entity that
   shares resources with two **US** companies — **Edge8 Consulting** and **AI Officer
   Institute**. These are the two peer brands in the library (not parent/subset):
   - **Edge8 Consulting** — the "E8" brand → **relabel to "Edge8 Consulting"**.
   - **AI Officer Institute** — currently **mislabeled "AIO Labs" / "AIOlabz"** → **rename to
     "AI Officer Institute"**, including the route dir. (The product repo `aiolabz-fe` and
     domain `aiolabz.com` are real product names and stay as-is.)

Not built here (deferred): the actual **micro-sessions** and **coaching** features. This plan
only *documents* them in the AI Program Plan brief.

---

## 2. Current state (on `main`)

- **Brand picker** — `app/workflows/private/page.tsx`: two cards, **E8** and **AIO Labs**.
- **E8 library** — `app/workflows/private/e8/page.tsx`: flat grid, 6 guides/briefs.
- **AIO Labs library** — `app/workflows/private/aio-labs/page.tsx`: flat grid, 5 items
  (2 workflow HTMLs in `public/…/aio-labs/`, UI Redesign Plan tsx, 2 admin workflow HTMLs).
- **Redirect precedent** — `next.config.mjs` already has `permanent: true` redirects (used when
  the library was split into `/e8`). Same mechanism applies to the `/aio-labs` rename.
- **Reusable patterns** — `app/proposals/proposals-tabs.tsx` (client tabs + counts + filtered
  grid), `ui-redesign-plan/page.tsx` (plan-as-page), `app/workflows/workflows.css` (`wf-*`).

---

## 3. Proposed design

### 3.1 One shared tabbed + searchable library component
Build a single reusable client component **`PrivateLibrary`** (adapted from `proposals-tabs.tsx`)
used by **both** brand pages.

- **Tabs:** `Plans` · `Workflows` · `Data`, each with a live count. Default: first non-empty tab.
- **Search:** one text input above the tabs; case-insensitive substring on `title` +
  `description`, filtering within the active tab, with an "N results" / empty state.
- **Items:** each entry carries `category: 'plan' | 'workflow' | 'data'`.
- **Styling:** reuses existing `wf-*` classes (payrolliq is the reference for *structure*, not skin).
- **Empty tabs** (e.g. Data on both brands, Plans on E8) render a "coming soon" state.

Each brand page becomes a thin server shell (metadata + `PrivateGate` + hero + breadcrumb) that
passes its typed `items` array to `PrivateLibrary`.

| Brand | Plans | Workflows | Data |
|-------|-------|-----------|------|
| **AI Officer Institute** | **AI Program Plan (new)**, UI Redesign Plan | Agentic AI, Gen AI, Company Admin, Platform Admin | *coming soon* |
| **Edge8 Consulting** | *coming soon* | Team Onboarding, Private Retreats, Accounting Training, 2× AI Retreat Briefs, Vung Tau | *coming soon* |

### 3.2 The AI Program Plan document (native TSX, AI Officer Institute → Plans tab)
New page: `app/workflows/private/ai-officer-institute/ai-program-plan/page.tsx`, behind
`PrivateGate`, native TSX using `wf-*` classes. It is the canonical program design brief. Content:

**Program overview** — AI Officer Institute certifications; the 3 tracks:
**Leadership · AI Engineering · AI Officer**.

**Session types**
- **Standard session** — the existing full session.
- **Micro-session (elective)** — small: **a video + a textbook + a small challenge**.
  - **UI is identical to a normal session** (same screens/flow) — just smaller.
  - **Live option:** the micro-session screen shows the **upcoming live**; a learner can
    **sign up**, gets a **Zoom link**, and joins. Builds a learning community around topics.
  - **Credit is earned the same way as a normal session:** complete the challenge in the
    **AI buddy** and **submit** it.
  - **Two independent tag axes:**
    - **Office:** Revenue · Talent · Operations · Innovation.
    - **Discipline:** Leadership · AI Engineering · AI Officer (i.e. which certification it
      most applies to). More tag types later (e.g. Claude, ChatGPT).
  - **Credit / application rule (important):** a learner can apply **any** micro-session to the
    certification they're **currently** working on (like electives in college — a Leadership
    class can count toward an AI Officer certification). It applies to the **current**
    certification **once**; it **cannot be applied twice** later. Marked in the database.
- **Coaching (Open Coaching)** — partially built already; mirror what was built for coaching
  (ref `caiocoach.com/coaching`) into AI Officer Institute:
  - **Cadence:** every **Thursday 11:00 AM GMT+7** (a second US time to be added later).
  - Anyone can **sign up**; learners **submit a challenge** they're having with AI and get
    coached that day; attendees can **listen and ask questions**.
  - Sessions are **recorded** and **auto-published** afterward so others can learn.
  - Like micro-sessions, coaching has an **Upcoming** view and an **Archive**.

**Note:** UI build for micro-sessions/coaching is a separate session (tomorrow). This page is
the reference spec, not the implementation.

### 3.3 Rename `/aio-labs` → `/ai-officer-institute`
- `git mv app/workflows/private/aio-labs → .../ai-officer-institute` (route + `ui-redesign-plan`).
- `git mv public/workflows/private/aio-labs → .../ai-officer-institute` (the 4 workflow HTMLs);
  update in-page links to the new `/ai-officer-institute/*.html` paths.
- Add `permanent: true` redirects in `next.config.mjs` for the old paths:
  `/workflows/private/aio-labs`, `/…/aio-labs/ui-redesign-plan`, and each `/…/aio-labs/*.html`.
- Relabel UI strings "AIO Labs" → "AI Officer Institute" (brand card, breadcrumbs, hero,
  metadata). Brief-internal `aiolabz-fe` / `aiolabz.com` product strings stay.

---

## 4. Implementation steps

1. **[done]** Branch `private-repo-redesign` off `origin/main`.
2. `PrivateLibrary.tsx` (`'use client'`) — tabs + search + filtered grid + empty state.
   → verify: three tabs with counts, live search, "coming soon" on empty tabs.
3. `git mv` the `aio-labs` app dir and public HTML dir → `ai-officer-institute`; fix HTML links.
4. Add `permanent: true` redirects for all old `/aio-labs` paths in `next.config.mjs`.
5. Refactor `e8/page.tsx` and `ai-officer-institute/page.tsx` to server shells feeding typed
   `items` (with `category`) into `PrivateLibrary`; relabel brands (E8 → "Edge8 Consulting",
   AIO Labs → "AI Officer Institute"). → verify: every existing link resolves; counts correct.
6. Create `ai-officer-institute/ai-program-plan/page.tsx` (content §3.2); add to Plans tab.
7. Dev server → unlock gate → screenshot both brands, all tabs, a search query, and confirm the
   old `/aio-labs` URL 308-redirects. → verify: no console errors, responsive, search + empty
   states + redirects all work.
8. Report; commit + PR to `main` **only when explicitly instructed** (repo git rules).

---

## 5. Decisions — RESOLVED

- **D1 — AI Program plan content:** program **design brief**, containing the micro-session +
  coaching specs in §3.2. ✅
- **D2 — Format:** native TSX with `wf-*` classes. ✅
- **D3 — Data tab:** empty **"coming soon"** on both brands for now. ✅
- **D4 — Route rename:** rename dir `/aio-labs` → `/ai-officer-institute` **with** permanent
  redirects. ✅
- **D5 — E8 tabs:** show all three tabs (empty Plans/Data as "coming soon"). ✅
- **E8 label:** **"Edge8 Consulting"**. ✅

---

## 6. Files touched

- `app/workflows/private/page.tsx` — relabel both brand cards; point AIO card to new route.
- `app/workflows/private/PrivateLibrary.tsx` — **new** shared tabs + search component.
- `app/workflows/private/e8/page.tsx` — refactor to shell + `PrivateLibrary`; relabel.
- `app/workflows/private/ai-officer-institute/**` — **renamed** from `aio-labs/`; refactor
  index + relabel; keep `ui-redesign-plan`.
- `app/workflows/private/ai-officer-institute/ai-program-plan/page.tsx` — **new** plan document.
- `public/workflows/private/ai-officer-institute/*.html` — **moved** from `aio-labs/`; links updated.
- `next.config.mjs` — **new** permanent redirects for old `/aio-labs` paths.
- No changes to `PrivateGate` or public navigation.
