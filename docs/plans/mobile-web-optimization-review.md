# Mobile Web Optimization: Code Review and Fix Plan

*Review of `origin/main` at 9bada10, 2026-08-17. Scope: the three Edge8 OS surfaces (Team `/team`, Client `/portal`, Admin `/admin`) plus the shared shell they render through. Method: 9 surface-by-dimension reviewers + 1 shared-shell reviewer, every finding adversarially verified against source (one verifier per surface). 61 findings confirmed, 0 refuted. Written in the voice requested: blunt, first-principles, allergic to speculative complexity.*

---

## The one-paragraph verdict

This codebase was written on a 27-inch monitor and it shows. The desktop work is genuinely good: tokens, a real design system, server components, tight CSS. But mobile was never a *target*, it was an afterthought expressed as 26 scattered `@media` blocks in a 4,025-line stylesheet, and the single block that matters (the shell's 880px block) ships a mobile nav bar that has never once rendered correctly on a phone. Meanwhile the people this OS serves are exactly the people on phones: staff in Vietnam opening `/team` every morning on mobile data, clients checking `/portal` from a phone, the founder running `/admin` while traveling. The good news: the 61 confirmed findings collapse into **7 root causes**, most fixable in one CSS file, and the worst ones are one-line fixes. You do not need a mobile rewrite. You need about four focused PRs.

---

## The 7 root causes

The individual findings are listed per surface below, but do not fix them individually. Fix the *causes*. Every bug here is an instance of one of these:

### RC1. The mobile shell is structurally broken and nobody ever looked (CRITICAL)

`.admin-shell` is `display: flex` (a **row**) at every width (admin.css:94), and it never switches to column. The hamburger bar `.admin-mobilebar` is rendered as a flex **sibling** of `<main>` (AdminSidebar.tsx:295, TeamSidebar.tsx:137, PortalSidebar.tsx:127), not above it. Its `margin: -28px -32px 20px` (admin.css:2374) assumes it lives inside `.admin-main`'s desktop padding box. It does not.

Verified with a headless render at 390px: the "top bar" paints as a **full-height white strip ~110-150px wide on the left**, hamburger half off-screen (pulled by `margin-left: -32px`), "8 Edges" vertically centered mid-page, content squeezed to ~280px with page titles clipped ("Cockpit" renders as "ockpit"). Every one of the ~130 pages across all three surfaces is broken below 880px.

The fix is two lines in the existing 880px block:

```css
.admin-shell { flex-direction: column; }
.admin-mobilebar { margin: 0; }
```

(The sidebar is already `position: fixed` there, so main takes full width below the bar.)

The lesson is bigger than the fix: **this code was written to be correct in theory and never rendered at 390px even once.** Any of the plan's fixes must end with an actual small-viewport render, or we are writing more of the same.

### RC2. The safe behavior is opt-in and the dangerous one is the default

`.admin-table-wrap` is `overflow: hidden` (admin.css:1479). Horizontal scrolling is a *separate, opt-in* inner div, `.admin-table-scroll` (1483), whose own comment says it exists "so no columns get clipped." DataTable uses it. Almost nobody else does. Result: **~20 hand-rolled tables silently amputate their trailing columns on a phone**, and the trailing column is where this codebase puts the actions:

- `/team/reviews`: the only link into a review is clipped. Reviews cannot be opened from a phone at all (critical).
- `/team/time-off`: the Cancel button is unreachable, and Status is cut. No other cancel path exists.
- `/team/my-work-boards`: the Done button and Due column are gone. You can see your tasks but not complete them.
- `/admin/operations/time-off/requests`: Approve/Reject unreachable. Manual leave approval is desktop-only.
- Portal invoices: the Amount column (the money column) clips on expanded line items.
- Plus coaching roster, ideas, probation, retreats, affiliates, P&L, compensation, client roadmaps.

Do not patch 20 call sites. Change the default: make `.admin-table-wrap` itself `overflow-x: auto`. When nothing overflows, it clips rounded corners exactly like `hidden`; when something does, you get a scroll instead of data loss. One line kills the whole bug class and immunizes future call sites. (One consequence to handle: DataTable's pagination row also lives inside the wrap and needs `flex-wrap: wrap`, see RC7.)

### RC3. There is no coarse-pointer story at all

Zero occurrences of `@media (pointer: coarse)` or `@media (hover: none)` in 10,274 lines of CSS. The codebase *knows* the 44px rule; it cites WCAG 2.5.5 in a comment and applies it in exactly one place (`.sap-card-handoff`, admin.css:2226). Everywhere else:

- **Hover-only controls are invisible on touch**: the inline-edit pencil (`opacity: 0` until `:hover`, admin.css:3968) is the *only* edit trigger for LinkedIn/Portfolio fields on ATS profiles; on a phone a tap hits the adjacent `target=_blank` link and navigates away. Assistant chat history rename/delete (admin.css:2833) are invisible but still hit-testable, an invisible Delete button is the worst of both worlds. Profile avatar upload affordance, same pattern.
- **Drag-only mutations with no tap fallback**: the shared BoardView card drawer literally tells the user "(drag the card to move)" (BoardView.tsx:612) while offering no select. On a phone showing 1.4 columns inside nested scrollers, moving a card to an off-screen column is effectively impossible. (The deals drawer already has a Stage select and ATS routes to a full page, so the model exists, BoardView just never got it.) The portal roadmap reorder handle is a ~20px glyph (`.cbp-handle`, BacklogPortalView.tsx:35) that a finger cannot reliably long-press.
- **Sub-44px everything**: drawer close ~24px with a 23px backdrop sliver and Escape as the third path (phones have no Escape); hamburger ~30px; avatar/view-switcher 28px; search clear 20px; `admin-btn--sm` ~26-30px carrying Done/Cancel/Approve; pagination buttons ~30px; referral cash-vs-credit choice (an actual money decision) two ~26px buttons 8px apart; priority pills ~25px in a row of four that write immediately on tap.
- **Whole-card drag handles fight scrolling**: KanbanBoard spreads `dragHandleProps` over the entire card (KanbanBoard.tsx:73) inside nested scroll containers, so a resting finger (~120ms) lifts a card instead of panning, and releasing it over the next column silently rewrites a deal stage.

One `@media (pointer: coarse)` block fixes 80% of this: reveal the hover-hidden controls, give the six shared small controls a 44px hit area, done.

### RC4. Every input triggers iOS zoom, and the fix already exists but loses the cascade

`.admin-input/.admin-select/.admin-textarea` are 14px (admin.css:1600); search inputs 14px; some variants 13px; one inline 12px. iOS Safari zooms the page on focusing anything under 16px and leaves it zoomed after blur. The comedy: globals.css:2491 *ships the standard fix* (`input, select, textarea { font-size: 16px }` at ≤768px), but its element selector (0,0,1) loses to the admin class (0,1,0) every time. So every field on every surface, starting with the **client portal login screen**, zooms the page and the user pinches back out, per field, forever. Fix: the same 16px rule with class selectors, inside the mobile block. Also fix the login action row while in there (`.admin-form-actions` has no `flex-wrap`, so three buttons crush into slivers inside the 380px auth card, the first screen every client sees).

### RC5. Phones download originals to paint thumbnails

There is **no image resizing anywhere in the entire pipeline**: `next.config.mjs` sets `images: { unoptimized: true }`, zero uses of `next/image` across all three surfaces, no Supabase render/transform URLs, no resize at upload, no `loading="lazy"` anywhere in components/admin. So:

- `/portal/team`: original phone-camera selfies (up to 5MB each, lib/avatars.ts:22) painted into 48px circles. A 4-person team page is 12-20MB, on the page clients open to find a phone number.
- `/team` home collage: 4 random full-res photos + full-res avatars, re-randomized every load so the cache never helps. The staff daily landing page is the single biggest recurring data cost in the portal.
- `/team/gallery` and `/admin/operations/gallery`: every original, eagerly, unbounded query, no dimensions (so the masonry reflows as each image lands).
- `/team/directory`: 20+ original selfies for 28px table avatars.

Fix at the source, once: downscale at upload (the file already passes through a server action; write a ~256px avatar and a ~800px gallery rendition) and/or point `src` at Supabase's render/image endpoint. Add `loading="lazy"` + dimensions. Every consumer inherits the fix.

### RC6. TTFB is spent on serial round trips, and the portal shows a dead screen while it happens

- `app/portal` has **no `loading.tsx` at all** while every page is `force-dynamic`. Admin and team both have one, whose own comment explains exactly why it must exist. A client taps Invoices and the old page just sits there for 1-3s. Copy the file. (S)
- `requirePortalMember` runs 4 sequential DB round trips, is not `cache()`-wrapped (its admin sibling is), and runs **twice** per request (layout + page). Wrap in `cache()`, parallelize the two independent lookups. (S)
- `/team` home awaits 5+ independent fetches sequentially (~8 serial round trips inside them); every sibling page already uses `Promise.all`. This one page regressed. (S)
- `getBoardBySlug` stacks 6 avoidable serial queries and fetches the *entire* stage-move history and *every comment on every card* on each board open, shipping all comment bodies in the flight payload before first paint. Parallelize; fetch comments when the drawer opens; `DISTINCT ON` the stage log. (M)
- `/admin/talent/applications` ships up to 2,000 fully-joined rows (email, phone, LinkedIn, ~22 fields) to the client to render 25; candidate-pool serializes the AI text of every candidate **twice** (two copied arrays defeat Flight dedup). Server-side paging exists in the codebase (listEntity + DataTable); use it. (M)
- Roadmap statically bundles @hello-pangea/dnd for viewers who can never drag; applications list view bundles the kanban library the same way. CockpitDeals already solved this with `next/dynamic` and left a comment explaining why. Mirror it. (S)

### RC7. Small structural drift that defeats the responsive rules that do exist

- Company 360 inlines `gridTemplateColumns: "340px minmax(0,1fr)"` (companies/[id]/page.tsx:224), which outranks the stylesheet's own 880px collapse; at 390px the main column is a 0px track. The contacts page uses the bare class and collapses fine. Delete the inline style. Same disease in vendor/job/survey form grids (inline `1fr 1fr 1fr` cannot carry a media query).
- `.admin-pagination` and `.admin-form-actions` have no `flex-wrap`, so Next and Sign in get clipped or crushed.
- The sidebar drawer is `100vh` with no `dvh` fallback or safe-area padding, so the last nav group hides behind iOS Safari's bottom chrome.
- globals.css strips `appearance` from every `<select>` and its replacement chevron is then wiped by `.admin-select`'s `background` shorthand, so **every dropdown on all three surfaces renders with no dropdown indicator**. The identical leak was found and patched for checkboxes (the comment at admin.css:2496 documents it); selects never got the same treatment.
- Drawers never lock body scroll and nothing sets `overscroll-behavior`, so drawer scrolling chains to the page behind it.

---

## Findings by surface (confirmed, with citations)

Severity from the phone user's point of view. Every item verified against source by an independent adversarial pass; file:line references are to `origin/main` @ 9bada10.

### Shared shell (hits all three surfaces at once)

| # | Sev | Finding | Where |
|---|-----|---------|-------|
| S1 | CRIT | Mobile top bar renders as broken full-height left strip; all ~130 pages unusable <880px | admin.css:94, 2364-2374; AdminSidebar.tsx:295 |
| S2 | HIGH | All form controls 13-14px; iOS zooms on every focus; globals.css fix loses specificity | admin.css:1600, 1470; globals.css:2491 |
| S3 | HIGH | BoardView cards move only by drag; drawer says "(drag the card to move)"; off-screen columns unreachable on touch | BoardView.tsx:612; KanbanBoard.tsx:32-41; admin.css:2085/2121 |
| S4 | MED | Every `<select>` has no dropdown indicator (globals appearance leak, chevron wiped by background shorthand) | globals.css:1946-1950; admin.css:1602 |
| S5 | MED | Core shared controls 20-29px tall (drawer close, pagination, search clear, btn--sm); zero pointer:coarse rules | admin.css:2406, 1531, 1471, 1583 |
| S6 | MED | Drawers never lock body scroll; no overscroll-behavior anywhere; scroll chains to page | DetailDrawer.tsx:36; admin.css:1585 |
| S7 | LOW | Nav drawer 100vh; last nav group behind iOS bottom chrome; no dvh/safe-area | admin.css:119, 2351-2358 |

### Team `/team` (staff daily driver)

| # | Sev | Finding | Where |
|---|-----|---------|-------|
| T1 | CRIT | Reviews table clips its only action link; reviews cannot be opened on a phone | reviews/page.tsx:52; also [id]/page.tsx:81 |
| T2 | HIGH | Time-off history clips Cancel + Status; leave cannot be cancelled from a phone | TimeOffPanel.tsx:171 |
| T3 | HIGH | My Work Boards clips Done + Due; tasks visible but not completable | MyTasks.tsx:94, 126 |
| T4 | HIGH | Home stacks 5+ independent fetches sequentially (~8 serial round trips); every sibling page uses Promise.all | (dashboard)/page.tsx:113-137 |
| T5 | HIGH | Gallery renders every full-res photo eagerly, unbounded, no lazy, no dimensions (CLS) | GalleryBrowser.tsx:46; lib/gallery.ts:39-44 |
| T6 | HIGH | Home collage: 4 random full-res photos + full-res avatars per visit, cache-defeating by design | TeamCollage.tsx:26, 37 |
| T7 | MED | Coaching roster + Ideas tables silently hide trailing columns (Attention flags, Status badges) | coaching/page.tsx:48; ideas/page.tsx:213 |
| T8 | MED | Board payload ships every comment of every card up front; full stage-log scanned per load | lib/boards/data.ts:243-261 |
| T9 | MED | Ideas feed renders full AI summaries for up to 200 entries in one document | ideas/page.tsx:81-97; lib/team/data.ts:422-439 |
| T10 | MED | Avatar pipeline stores raw 5MB selfies, serves them into 28px directory circles | lib/avatars.ts:30; DirectoryTable.tsx:149 |
| T11 | MED | Drawer close ~30x24px, backdrop a 23px sliver, Escape is the only other path | admin.css:1583, 1565 |
| T12 | MED | Assistant history rename/delete `opacity:0` on touch; invisible but tappable Delete | admin.css:2833-2841; ConversationHistory.tsx:254 |
| T13 | MED | Chip-remove / search-clear / untag controls 15-20px | admin.css:1351, 1185, 1471 |
| T14 | MED | `admin-btn--sm` ~30px tall carries Done/Cancel/Clear-filters row actions | admin.css:2406 |
| T15 | LOW | Avatar upload affordance hover-only; profile photo looks static on touch | admin.css:1101-1108 |
| T16 | LOW | Mobilebar margin drift (subsumed by S1) | admin.css:2374 |
| T17 | MED | Nav drawer 100vh (same as S7) | admin.css:119 |

### Client `/portal` (paying customers)

| # | Sev | Finding | Where |
|---|-----|---------|-------|
| C1 | HIGH | iOS zoom on every field starting at the login screen (same root as S2) | LoginForm.tsx:100; BacklogPortalView.tsx:57 (13px) |
| C2 | HIGH | No loading.tsx: every nav tap is 1-3s of frozen screen; admin and team both have one | app/portal/(dashboard)/ (missing file) |
| C3 | HIGH | Team page downloads up to 5MB originals per person for 48px circles | team/page.tsx:43; lib/avatars.ts:9 |
| C4 | HIGH | Roadmap reorder handle ~20px; the page's headline interaction is nearly ungrabbable | BacklogPortalView.tsx:35, 160 |
| C5 | MED | Time Off + invoice line-item tables clip last column (Status; Amount) | time-off/page.tsx:104; invoices/page.tsx:69 |
| C6 | MED | Login action row can't wrap; 3 buttons crushed in the 380px auth card | admin.css:1610; LoginForm.tsx:112-133 |
| C7 | MED | requirePortalMember: 4 serial round trips, uncached, runs twice per request | lib/portal-auth.ts:141-214 |
| C8 | MED | Roadmap ships the DnD library to viewer roles who can never drag | BacklogPortalView.tsx:5-10 |
| C9 | MED | Priority pills ~25px in a tight row of four; mis-taps write immediately | BacklogPortalView.tsx:41-42, 179 |
| C10 | MED | Board columns: nested scrollers fight touch gestures (same family as S3) | admin.css:2082-2126; board/page.tsx:42-52 |
| C11 | MED | Referral cash-vs-credit money decision on two ~26px buttons 8px apart | Redeem.tsx:43-48 |
| C12 | LOW | Password eye 30x30 in the forced first-login change-password flow | admin.css:1706; PasswordField.tsx:36 |
| C13 | LOW | Program brief 70vh iframe captures vertical swipes; page feels stuck | BriefViewer.tsx:38 |
| C14 | LOW | Mobilebar (subsumed by S1; verifier confirmed the fuller S1 mechanism here) | admin.css:2364 |

### Admin `/admin` (the founder on the road)

| # | Sev | Finding | Where |
|---|-----|---------|-------|
| A1 | CRIT | Mobile bar breaks all 71 admin pages <880px (S1, verified here with headless render) | admin.css:2364; layout.tsx:24-26 |
| A2 | HIGH | 12 hand-rolled tables clip columns/actions: time-off Approve/Reject unreachable, probation dates, invoice amounts, P&L figures invisible | TimeOffBoard.tsx:92 + 11 more files |
| A3 | HIGH | Company 360 inline grid defeats the 880px collapse; main column is a 0px track on phones | companies/[id]/page.tsx:224 |
| A4 | HIGH | Applications ships up to 2,000 fully-joined rows (PII incl.) to render 25 | applications/page.tsx:91-98, 190 |
| A5 | HIGH | Candidate Pool serializes overlapping 2,000-row arrays; AI text crosses the wire twice | candidate-pool/page.tsx:45-50, 101-137 |
| A6 | HIGH | Hover-only pencil is the sole edit path for ATS link fields; tap navigates away instead | admin.css:3968; InlineEdit.tsx:203; ApplicationManage.tsx:820 |
| A7 | HIGH | iOS zoom (S2), plus inline `fontSize: 12` on the handoff select directly beside the codebase's own 44px WCAG rule | DealsBoard.tsx:532; admin.css:2226 |
| A8 | MED | Pagination can't wrap and clips: Next unreachable on 9 list pages, page 2+ inaccessible | admin.css:1520; DataTable.tsx:131-169 |
| A9 | MED | Kanban cards are 100% drag handle in nested scrollers; slow pans become accidental stage moves with optimistic writes | KanbanBoard.tsx:73 |
| A10 | MED | Gallery admin loads every original eagerly to paint 150px crops | GalleryManager.tsx:254 |
| A11 | MED | getBoardBySlug: 6 avoidable serial round trips; unbounded stage-log scan | lib/boards/data.ts:200-298 |
| A12 | MED | Drawer close ~24px; the most frequent gesture in the app is a precision shot (S5) | admin.css:1583 |
| A13 | MED | Mobile chrome undersized: hamburger ~30px, avatar 28px, search clear 20px | admin.css:2376, 152, 1471 |
| A14 | LOW | Inline 3-col form grids never collapse (~100px inputs) | VendorForm.tsx:174; JobReqManage.tsx:271; SurveyBuilder.tsx:110 |
| A15 | LOW | Lead pin star ~24px inside a row that toggles on tap | admin.css:2295; LeadQueue.tsx:145-185 |
| A16 | LOW | Applications list view statically bundles the DnD library; CockpitDeals shows the fix | ApplicationsView.tsx:6; CockpitDeals.tsx:16 |
| A17 | LOW | Sidebar 100vh (S7) | admin.css:119 |

---

## The fix plan

Four PRs, ordered by (user pain x effort). PR 1 and PR 2 are almost entirely one CSS file and are the difference between "broken" and "works". PR 3 makes it *good* on touch. PR 4 makes it fast. Each PR ends with the same verification gate.

**A note on philosophy before the list.** The instinct will be to fix the 61 findings. Resist it. Fix the 7 causes, and prefer the fix that changes a *default* over the fix that patches call sites: `overflow-x: auto` on the wrap beats 20 scroll-layer insertions; resize-at-upload beats lazy-loading attributes sprinkled across 6 components; one `pointer: coarse` block beats 15 per-control bumps. Fewer diffs, and the next page someone writes is safe by construction instead of by vigilance.

### PR 1: Unbreak the shell (all S effort, ~30 lines of CSS, hits all 3 surfaces)

1. `.admin-shell { flex-direction: column }` + `.admin-mobilebar { margin: 0 }` in the 880px block (S1). This alone takes the OS from unusable to usable on a phone.
2. 16px form controls in the mobile block: `.admin-input, .admin-select, .admin-textarea, .admin-search input, .chatw-composer input { font-size: 16px }` (S2), and remove the inline `fontSize: 12` at DealsBoard.tsx:532.
3. `flex-wrap: wrap` on `.admin-form-actions` (C6) and `.admin-pagination` (+ `row-gap: 8px`) (A8).
4. `height: 100dvh` after the 100vh on `.admin-sidebar`, `padding-bottom: env(safe-area-inset-bottom)` (S7).
5. Restore the select chevron on `.admin-select` (SVG data URI background + padding-right), mirroring the checkbox restoration block at 2496 (S4).
6. `overscroll-behavior: contain` on `.admin-drawer-body` and `.admin-sidebar`; body scroll lock while drawer/nav is open (S6).

**Gate:** `tsc --noEmit`, `next build`, `npm run check:design`, plus a 390px screenshot of `/admin` cockpit, `/team` home, `/portal` login rendered from the built output. That last step is non-negotiable; it is the step whose absence caused S1.

### PR 2: Stop amputating data and actions (S-M)

1. Change `.admin-table-wrap` to `overflow-x: auto` (RC2, one line, fixes ~20 tables: T1, T2, T3, T7, C5, A2). Verify DataTable's pagination and rounded corners survive; keep `.admin-table-scroll` as a no-op for compatibility.
2. Delete the inline `gridTemplateColumns` on Company 360, add an `.admin-360--wide` modifier above the media collapse (A3).
3. Replace the inline `1fr 1fr 1fr` form grids with `repeat(auto-fit, minmax(140px, 1fr))` (A14).
4. Drop the fixed `th` widths in MyTasks so columns compress before scrolling (T3).

**Gate:** same as PR 1, screenshots of `/team/reviews`, `/team/time-off`, `/admin/operations/time-off/requests` at 390px showing the action column reachable.

### PR 3: A real touch story (S-M)

1. One `@media (pointer: coarse)` block: reveal `.admin-editable-pencil`, `.chatw-history-actions`, `.team-avatar-edit` (`opacity: 1`); give `.admin-drawer-close`, `.admin-btn--sm`, `.admin-pagebtn`, `.admin-search-clear`, `.admin-mobile-toggle`, `.admin-avatarbtn`, `.admin-input-eye`, `.team-chip-x`, `.phototag-x`, `.lead-pin-btn` a 44px effective hit area (min sizes or `::after` inset expansion) (S5, T11-T15, A6, A12, A13, A15, C12).
2. BoardView drawer: render Column as an `<select className="admin-select">` calling the existing `move()`; delete the "(drag the card to move)" hint (S3). The deals drawer's Stage select is the model. Consider the same tap path in the inquiries drawer.
3. Roadmap: enlarge `.cbp-handle` to a 44px box (keep `touch-action: none` on the enlarged box), bump `.cbp-pill` padding + gap on small screens, 16px on the propose form (C4, C9, C1-part).
4. On coarse pointers, move KanbanBoard's `dragHandleProps` off the card body onto a visible grip (A9), following DealsBoard's list-mode handle isolation.
5. Referrals: drop the `--sm` modifier on the money-decision buttons (C11).

**Gate:** same, plus tap-path check: card moved via drawer select on a 390px render.

### PR 4: Make it fast on a phone (S-M, split if needed)

1. `app/portal/(dashboard)/loading.tsx` cloned from admin's (C2). Five minutes, biggest perceived-speed win in the portal.
2. `cache()`-wrap `getPortalActor`, parallelize its independent lookups (C7). Promise.all the `/team` home fetches (T4). Parallelize `getBoardBySlug`'s six queries; `DISTINCT ON` the stage log; fetch comments on drawer open (T8, A11).
3. Images at the source: downscale avatars to ~256px and gallery uploads to ~800px at upload time (server actions already touch the bytes); or point rendering at Supabase render/image URLs. Add `loading="lazy" decoding="async"` + dimensions to gallery/collage/directory/admin-gallery `<img>`s (C3, T5, T6, T10, A10). Backfill existing originals with a one-off script if desired; new uploads fixed immediately.
4. Applications + Candidate Pool: server-side paging via the existing listEntity/DataTable pattern; stop double-serializing the pool arrays; trim row shape to rendered fields (A4, A5).
5. `next/dynamic` the DnD imports on Roadmap (viewer roles get plain markup) and ApplicationsBoard, mirroring CockpitDeals (C8, A16). Truncate the Ideas feed cards, link to detail (T9).

**Gate:** same, plus payload eyeball: applications page flight payload before/after.

### Explicitly not in scope (and why)

- **Card-per-row mobile tables, bottom navigation, PWA/offline, gesture libraries.** All speculative until the basics above ship and someone actually uses the OS on a phone for a week. The cheapest information is usage after PR 1-2.
- **A breakpoint consolidation project.** Yes, 520/640/720/760/860/880/900/960/980/1100 is a zoo (RC7-adjacent). But renormalizing breakpoints is a diff-everything change with zero user-visible payoff. Adopt a rule going forward (880 for shell, 640 for content) and migrate opportunistically.
- **Replacing @hello-pangea/dnd.** It supports touch; the problems are handle size, handle placement, and missing tap alternatives, all fixed above at 1% of the cost.

---

## Scorecard

| | Team | Client | Admin | Shared |
|---|---|---|---|---|
| Critical | 1 | 0 | 1 | 1 |
| High | 5 | 4 | 6 | 2 |
| Medium | 8 | 7 | 6 | 3 |
| Low | 2 | 3 | 4 | 1 |

61 confirmed findings, 0 refuted after adversarial verification, 2 upgraded during verification (the mobile-bar bug was first filed as a 16px cosmetic overhang; the verifier's render proved the shell-level break). Root-cause compression: 7. Estimated effort to "genuinely good on a phone": PR 1 in an hour, PR 2 in a morning, PR 3 in a day, PR 4 in 1-2 days.

The single most important process change costs nothing: **no shell or table change merges again without a 390px render of the built output.** That one habit would have prevented roughly half of this document.
