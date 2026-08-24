# Marketing Overview v2

**Date:** 2026-08-24
**Status:** Proposed, not started
**Wireframe:** https://claude.ai/code/artifact/c818df43-4f54-46e7-8e58-7b7b80710d15
**Page:** `/admin/revenue/marketing` (`app/admin/(dashboard)/revenue/marketing/page.tsx`)

## The spec, in one paragraph

The overview page predates campaigns, the content calendar, broadcasts, and the leads queue, so today it answers "how many emails did we send" instead of "is the marketing engine producing, and is it turning into leads." v2 reorganizes the page around a funnel (visitors → audience → leads → meetings), surfaces the content engine (calendar pipeline, active campaigns, next broadcast), shows the two Edges year goals marketing drives, and adds social channel traffic monitoring. No new tables, no new collectors: every block reads from libs that already exist. The page stays read-only; every element links into the page that owns it.

## Principles for this build

- Simplest version first. Each PR is independently shippable and leaves the page better than before it.
- Pure functions for anything with logic (channel classifier, UTM appender) so they get real unit tests. Page sections are composition, verified by eye against the wireframe.
- The one genuine unknown (Vercel UTM grouping) gets a 10-minute probe before any code depends on it.
- YAGNI: no short-link service, no new analytics provider, no per-post dashboards. UTMs plus referrer grouping cover the need.

---

## PR 1: Funnel row and honest email defaults

**What it does.** Replaces the four-KPI row with the funnel: Visitors, Newsletter audience, New leads (this window), Meetings booked vs the weekly goal of 8. Flips the Recent email table default from All to Sales & marketing.

**Where the numbers come from.** Visitors and audience are already on the page (`lib/admin/vercel-analytics.ts`, `lib/admin/marketing.ts`). New leads and meetings booked reuse the exact queries the leads page already runs (`app/admin/(dashboard)/revenue/leads/page.tsx`: lead rows with source, meetings this week, `WEEKLY_MEETINGS_GOAL = 8`). Extract those two counts into a small shared helper, `lib/admin/lead-stats.ts`, imported by both pages so the leads page and the overview can never disagree.

**What you'll see.** One row of four cells reading left to right as a funnel. Page views moves out of the KPI row (it returns in PR 3's traffic section). The email table opens on the 5 real emails, with Transactional (190) one tab away.

**Done when:**
- The funnel row renders with live numbers and the meetings cell shows n / 8.
- The leads page still shows identical counts (shared helper, checked side by side).
- The email table defaults to Sales & marketing; the URL param still selects the other tabs.
- `npm run check:design` passes; verified on `https://www.edge8.ai/admin/revenue/marketing` after merge.

## PR 2: Content engine section

**What it does.** New section under the funnel with three parts: this week's calendar entries as a stage strip (idea / drafting / approved / scheduled / published), active campaigns with per-channel asset progress, and the next approved or scheduled broadcast.

**Where the numbers come from.** All three libs exist and already compute what's needed: `listEntries` (`lib/admin/marketing-calendar.ts`), `listCampaigns` with its built-vs-total aggregation (`lib/admin/marketing-campaigns.ts`), and `listCampaigns` for broadcasts (`lib/admin/campaigns.ts`). This PR is pure composition: filter entries to the current week, filter campaigns to active, pick the soonest approved or scheduled broadcast.

**What you'll see.** The stage strip counts, each stage linking to the calendar filtered to that status. Campaign cards with a progress bar (5 of 8 assets built) linking to the campaign hub. The next broadcast with its date, recipient count, and status. Sensible empty states ("Nothing scheduled this week") rather than empty cards.

**Done when:**
- Every count matches its source page (open calendar, campaigns, broadcasts and compare).
- Every element links to the right filtered destination.
- Zero-state renders correctly with no calendar entries and no active campaigns.

## PR 3: Year goals, traffic reshaped, email health compressed

**What it does.** Adds the two year-goal progress bars (Keynote attendees / 1,000 and Documented workflows / 100). Reshapes traffic into three columns: top pages, top referrers, performance by pillar. Collapses Deliverability and Audience from two full-width sections into one three-cell email health row.

**Where the numbers come from.** Year goals read the same sources the Edges collector uses (`scripts/edges/collect-metrics.mjs`): the `company_os` workshop attendees function and `/api/stats` for workflows. Pillar performance is `getPillarPerformance` from `lib/admin/marketing-calendar.ts`, already built for the calendar page. Deliverability and the persona donut are the existing components, resized.

**What you'll see.** Two quiet progress bars, read-only. Traffic in thirds, with pillars answering "what should we make more of." Deliverability keeps its webhook call-to-action cell until Resend webhook data flows.

**Done when:**
- Year-goal numbers match `/admin/edges/metrics` for the same metrics.
- Pillar numbers match the calendar page.
- Nothing that was on the page before is gone: page views, referrers, donut, deliverability all still present, just smaller.

## PR 4: Social channel monitoring (referrers + UTMs)

**Step 0, before any code: the probe.** Confirm with one authenticated curl to the Vercel Web Analytics query API that `visits/aggregate` accepts `by: utm_source` (same endpoint pattern `lib/admin/vercel-analytics.ts` already uses for `referrerHostname`). If yes, build all of this PR. If no, ship only the channel classifier and note the limitation in this doc.

**What it does.**
1. **Channel classifier:** a pure function `channelFor(referrerHostname)` in `lib/admin/vercel-analytics.ts` mapping hostnames to Social / Search / Email / Referral / Direct (linkedin.com, lnkd.in, facebook.com, l.facebook.com, m.facebook.com, fb.me, t.co, twitter.com, x.com, instagram.com, l.instagram.com, youtube.com, reddit.com → Social; google, bing, duckduckgo → Search). Feeds a "Traffic by channel" tile in the traffic section.
2. **UTM breakdown:** group visits by `utm_source` for the window and show it alongside referrers.
3. **Auto-UTM:** a pure function `withUtm(url, { source, medium, campaign })` in a new `lib/admin/utm.ts`, applied wherever the calendar composer and broadcast editor emit edge8.ai links: `utm_source=linkedin|facebook|email`, `utm_medium=social|email`, `utm_campaign=<campaign or entry slug>`. It must not double-tag a link that already carries UTMs, and must leave non-edge8.ai links untouched.
4. **Campaign visits:** once tagged links are live, the campaign card from PR 2 gains a visits count filtered by `utm_campaign`.

**Honest caveat, kept in the UI copy:** referrer-based social counts are a floor, not a total; DMs and some in-app browsers arrive as Direct. UTM-tagged links are the precise signal, and they only start counting from the day this ships.

**Done when:**
- Unit tests pass for `channelFor` (each hostname family, unknown host, empty referrer) and `withUtm` (appends, preserves existing UTMs, skips external links). These are the two testable seams; test them first, red then green.
- A LinkedIn post link generated by the calendar carries correct UTMs, verified by copying one out of the composer.
- The channel tile's Social + Search + Direct + Referral roughly totals the window's visits.

---

## Order and dependencies

1 → 2 → 3 → 4 is the intended order but only PR 4 step 4 has a real dependency (needs PR 2's campaign cards). Each PR ships from its own worktree branched off `origin/main` per the repo ship flow, merges when CI is green, and gets verified on the live page with curl before the next starts.

## Out of scope (deliberately)

- Short-link redirect service (`/l/slug`): UTMs cover the need; revisit only if links go into print or QR codes.
- New analytics providers, cookies, or client-side tracking scripts.
- Editing anything from the overview: it stays a cockpit, not a control panel.
- Backfilling social attribution for traffic before UTMs ship: impossible, not attempted.
