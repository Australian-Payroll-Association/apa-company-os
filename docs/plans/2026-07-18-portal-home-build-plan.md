# Portal Home Page — Build Plan

Planned 2026-07-18. Replaces the placeholder at `app/portal/(dashboard)/page.tsx`
("Your portal is being set up") with a real dashboard. Design context:
`docs/plans/2026-07-11-client-portal-design.md` (Home spec, line ~312), updated
for what actually shipped since: Team, Time Off, Invoices, Events, Referrals,
Work Requests (client-decided), Tokens.

## Goal

The home page answers "does anything need my attention?" in five seconds, then
routes into the modules. Read-only, no schema changes, no new tables. Every
section renders only when the client has data for it; a brand-new client sees
the welcome header, quick actions, and module cards — never an empty shell.

## Page layout (top to bottom)

### 1. Needs your attention (conditional)

Cards for items blocked on the client, in priority order:

- **Work requests awaiting a decision** — status `estimate_submitted`
  ("Estimate ready — approve or decline") or `work_submitted` ("Work delivered
  — review and accept"). Card shows title, contractor name, estimated/actual
  hours. Links to `/portal/requests/[id]` (the DecisionPanel).
- **Invoices with a balance** — `balanceCents > 0`. Shows doc number, amount
  due, due date (flag "overdue" when `dueDate < today`). "Pay" button when
  `paymentLink` exists, else links to `/portal/invoices`.

Below the cards, one muted line when applicable: "N request(s) in progress with
Edge8" (statuses `awaiting_estimate`, `changes_requested`, `approved`), linking
to `/portal/requests`. Decision made here: in-progress items get a count, not
cards — they need no client action, but the line shows "we're on it".

Whole section omitted when there is nothing actionable — no empty state.

### 2. This week (staffing clients only — gated on `hasStaff`)

- "Out now / out this week" from `getAssignedTimeOff()` filtered to entries
  overlapping today..+7 days, statuses already limited to
  requested/approved/taken by the helper. Name, leave type, date range,
  half-day marker.
- Team summary line: "N people on your team" → links to `/portal/team`.
- If nobody is out: "Your full team is in this week." (section still renders —
  for staffing clients this is the recurring reason to open the portal).

### 3. Next event (conditional)

First registration from `getMyEvents()` with `startsAt >= today` and status not
cancelled. Event title, dates, location, tier, registration status. Links to
`/portal/events`. Omitted when none.

### 4. Tokens + quick actions (always rendered)

- Token balance stat (`getTokenBalance()`): `balanceTokens`, with pending
  tokens noted if `pendingTokens > 0`. Balance is a short number, so the
  MetricCard/stat-tile treatment is safe here (unlike company/email — see the
  comment in the current page.tsx about mid-word wraps).
- Quick-action buttons: **Request work** → `/portal/requests/new`,
  **Estimate a full-time hire** → `/portal/requests/hire`,
  **Buy tokens** → `/portal/tokens`,
  **Refer someone** → `/portal/referrals` (only when `hasAffiliateCode`).

### 5. Module cards (always rendered)

Entitlement-driven card grid mirroring the sidebar: Requests, Tokens (always);
Team, Time Off (`hasStaff`); Invoices, Events, Referrals (their existing
gates). Each card: module name, one-line description, small live stat where
free (team count, open-invoice count, upcoming-event count — all derivable
from data already fetched for sections 1–3, no extra queries).

### Removed from the current page

- The "Your account" card (company + email) — company already shows in the
  PageHead sub and the sidebar; this is settings material, not prime real
  estate.
- The "being set up" placeholder copy.
- Nothing from the never-shipped Projects module (design doc's "latest project
  update" slot waits until Projects exists).

## Data plan

All existing helpers; **no new lib functions needed** except one small pure
util. Page-level `Promise.all` (App Router layouts can't pass props to pages,
so the page fetches its own data; these are cheap indexed reads):

| Section | Helper | Notes |
|---|---|---|
| Attention: requests | `listWorkRequestsForActor()` (lib/portal/work-requests.ts) | filter statuses client-side |
| Attention: invoices | `getInvoicesForActor()` (lib/portal/invoices.ts) | filter `balanceCents > 0` |
| This week | `getAssignedTeam()` + `getAssignedTimeOff()` (lib/portal/team.ts, time-off.ts) | `hasStaff` ≡ `team.length > 0` — replaces the boolean check with the same query |
| Next event | `getMyEvents()` (lib/portal/events.ts) | first upcoming |
| Tokens | `getTokenBalance()` (lib/portal/tokens.ts) | |
| Referrals gate | `hasAffiliateCode()` (lib/portal/referrals.ts) | cheap existence check; full referrals fetch not needed on home |

New util: `overlapsWindow(entry, from, to)` date filter for the this-week
strip — plain date math, lives with the page or in lib/portal/time-off.ts.

Security posture is inherited: every helper is already scoped to
`actor.companyScope` / assignment scope, and `PORTAL_REQUEST_SELECT` already
withholds `access_token` and contractor emails. The home page adds no new
queries, so no new scoping surface. Assume mode works unchanged (read-only
page; banner comes from the layout).

## Implementation steps (one PR)

1. **Components** — small server-rendered pieces under `components/portal/`:
   `AttentionCard`, `HomeQuickActions`, `HomeModuleCard` (or inline JSX in the
   page where a piece is used once — prefer inline until reuse appears).
   Styling: existing `admin.css` classes (`admin-card`, `admin-card-title`,
   `admin-kv`, button classes) — the shipped portal uses the admin design
   system, not the marketing treatment the original design doc proposed;
   follow shipped reality. Check `/admin/patterns` for available primitives
   before adding CSS.
2. **Rewrite `app/portal/(dashboard)/page.tsx`** — `Promise.all` the six
   fetches, derive section visibility, render sections 1–5. Keep
   `force-dynamic` and `requirePortalMember()`.
3. **Copy pass** — tight, no em dashes, certification-never-negative rules
   don't apply here but the general voice does.

## Verification

- `npx tsc --noEmit` and `npx next build` (no dev server — repo rule).
- Manual check on prod after merge via admin Assume mode against each client
  archetype: a staffing client (EO / On Target / Unlock / Wareease — sections
  2, attention-invoices), an AI Program client with events + tokens (sections
  1, 3, 4), and a fresh contact with no data (header + quick actions + module
  cards only, nothing empty-looking).
- Confirm a request in `estimate_submitted` surfaces as an attention card and
  its link lands on the decision panel.

## Decisions taken (flag if wrong)

1. **Attention strip = client-blocked only** (estimate_submitted,
   work_submitted, unpaid invoices). In-progress-with-Edge8 requests appear
   as a one-line count, not cards.
2. **"This week" always renders for staffing clients**, even when nobody is
   out — it is their recurring check-in surface.
3. **Account info card dropped** from home; revisit if/when a portal settings
   page exists.
4. **No Projects content** until the Projects module ships.

## Out of scope

- Projects module and its home-page slot.
- Company switcher UI for multi-company contacts (design doc mention) — the
  helpers already aggregate across `companyScope`; a switcher is a separate
  feature.
- Any write action from the home page (decisions happen on the request page).
- `.ics` downloads, survey links, and other Events fast-follows.
