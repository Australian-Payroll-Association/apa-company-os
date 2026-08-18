# Revenue → Marketing — development plan

**Date:** 2026-08-18 · **Owner:** Dave · **Status:** built, all three phases (PR #755)
**Branch:** `feat/revenue-marketing` (cut from `origin/main` @ 403ff5d)
**Trigger:** "I have about 600 emails in the system. What is a good way to start up an email
newsletter and send to them" → build the Marketing section first, then send.

## Context

Edge8 has ~640 contacts in the CRM and no way to send them anything but transactional email.
There is no marketing surface in the admin at all: site traffic lives on a separate Operations
page, email sends are only visible as individual CRM interaction rows, and there is no concept
of newsletter consent, no unsubscribe, and no campaign.

This plan builds a Marketing section under Revenue in three phases. Each phase ships on its own
and is useful without the next one.

## Ground truth (verified 2026-08-18 against origin/main and the live DB)

**Already exists and is reused as-is:**

- `lib/admin/vercel-analytics.ts` — `getAnalyticsOverview(range)` and `getAnalyticsTotals()`.
  Returns totals, daily series, top pages, top referrers. Ranges `7d | 30d | 90d | all`.
  Needs `VERCEL_ANALYTICS_TOKEN`. Tracking started 2026-07-11; the daily series is clamped to
  62 days by the upstream API. Powers `/admin/operations/analytics`.
- `lib/email.ts` — Resend wrapper (`resend` ^6.12.4). `sendTransactionalEmail()` returns true
  only when Resend accepted, and logs every accepted send to `company_os.interactions` as
  `kind='email'` with `metadata.to` and a source label. No-ops when `RESEND_API_KEY` is absent.
- `company_os.interactions` — 130 rows of `kind='email'` since 2026-05-01. This is the existing,
  free "emails we sent" history.
- Cron pattern: `app/api/cron/<name>/route.ts`, `GET`, `Bearer ${process.env.CRON_SECRET}` check,
  `runtime = "nodejs"`, `dynamic = "force-dynamic"`, `fetchCache = "force-no-store"`, schedule
  declared in `vercel.json`.
- `npm run check:crons` — **`next.config` sets `trailingSlash: true`**, so every cron path in
  `vercel.json` must end in `/` or Vercel's invoker gets a 308 and the handler never runs. The
  same applies to the Resend webhook URL we register.

**Constraints that bite (verified against the live DB, not the docs snapshot):**

- `company_os.interactions.kind` **has a CHECK constraint**:
  `note | call | email | meeting | message | status_change | system`. A new value such as
  `marketing_email` would fail the insert. Marketing sends log as `kind='email'` with a
  `metadata.source` label; consent changes log as `kind='system'`. No constraint migration needed.
- `company_os.people.persona` also has a CHECK: `vendor | prospect | client | job_seeker |
  employee | student`.
- `people.email` is `citext` and **UNIQUE**, so email lookups are already case-insensitive.
- `company_os.handle_updated_at()` exists and is the shared `updated_at` trigger function.
- The `docs/plans/edge8-company-os.dbml` and `edge8-db-dictionary.html` snapshots lag the
  migration folder. Verify against the live DB, never the snapshot.

**Does not exist (this is the actual work):**

- Any Resend delivery feedback. Opens, clicks, bounces, and complaints are entirely invisible
  today. We only know a send was *accepted*, never whether it *landed*.
- Any consent or suppression concept beyond `people.do_not_contact` (a hard CRM-wide flag,
  set on exactly 2 rows). Nothing distinguishes "don't send marketing" from "don't contact".
- Any unsubscribe link, `List-Unsubscribe` header, or public opt-out page.
- Any campaign entity.

**Empty pre-scaffold tables, deliberately left alone:** `campaigns`, `content_items`,
`content_ideas`, `content_channels`, `content_pillars`, `content_schedules`, `touchpoints`,
`tags`, `taggables`, `subscriptions` — all 0 rows. `campaigns` is a generic multi-channel table
(name/channel/status/budget_cents) with no subject, body, audience, or per-recipient state, so
an email send cannot be modelled on it. We add a purpose-built `email_campaigns` instead and
leave `campaigns` untouched for a future paid-ads/umbrella use.

### The audience is much smaller than 642

Counting `company_os.people where archived_at is null` (634 with an email address):

| persona | count | newsletter-eligible? |
|---|---|---|
| `job_seeker` | 306 | **No.** Applicants gave us their address to be considered for a job. |
| `prospect` | 150 | Yes |
| *(none)* | 93 | Case by case, mostly legacy imports |
| `employee` | 50 | No, internal (49 are `is_team_member`) |
| `client` | 35 | Yes |

By source, 262 are `LINKEDIN` and 120 `thoughtflow_crm`, both bulk imports rather than people
who asked to hear from us. **The realistic first-send list is roughly 200 to 280, not 600**, and
the Marketing page must show that number honestly rather than flattering us with 642.

This is why Phase 3 makes eligibility explicit and opt-out-able rather than deriving "everyone
with an email" at send time.

## Design principles

**Company OS stays the source of truth.** We use Resend's send API, not Resend Audiences or
hosted Broadcasts. Audience, consent, and results live in our own DB so segmentation can use
the CRM (persona, lead stage, client status, deals) and so unsubscribes are visible on the
contact record. The cost is that we build the sender; the benefit is one system, not two.

**Suppression is checked at send time, never baked into a list.** Every recipient is re-checked
against `do_not_contact`, marketing consent, and hard bounces immediately before the send.
A stale list can't leak.

**Approval gates the send.** A campaign cannot leave `draft` without an explicit approve action,
matching the standing rule that email campaigns always require human approval.

**Batching is the default, not an option.** The sending domain has never sent bulk mail. The
sender works a fixed number of recipients per cron tick so reputation builds gradually and a
bad list surfaces on batch one instead of batch none.

**Marketing email and transactional email stay separate.** Transactional keeps going through
`sendTransactionalEmail()` untouched. Marketing gets its own path with unsubscribe headers.
Nothing in this plan changes how an auth or event email sends.

---

## Phase 1 — Marketing overview page

**Ships:** `/admin/revenue/marketing`, the hub. No schema changes, no new env vars.

- New sidebar subheading `Marketing` in the Revenue group (after CRM and Commerce), with the
  hub link. Follows the existing `NavSubsection` shape in `components/admin/AdminSidebar.tsx`.
- **Site traffic** — reuses `getAnalyticsOverview(range)`. Range tabs `7d/30d/90d/all` matching
  the Operations page. Visitors, page views, daily bar chart, top pages, top referrers.
  Degrades to an inline notice when `VERCEL_ANALYTICS_TOKEN` is unset, exactly as today.
- **Email activity** — from `company_os.interactions where kind='email'`. Sends in the window,
  split by `metadata.source`, plus a recent-sends list. This is real data on day one.
- **Audience** — from `people`. Total contactable, the persona breakdown above, and a
  newsletter-eligible count (in Phase 1 this is "not a team member, not `do_not_contact`,
  persona not `job_seeker`"; Phase 3 replaces the derivation with the stored consent state).
- New lib: `lib/admin/marketing.ts` for the interactions + audience aggregates.

**Verification:** `npx tsc --noEmit` and `npm run build` clean; page renders with real counts;
Vercel tiles match `/admin/operations/analytics` for the same range.

The existing Operations → Analytics page stays where it is. The Marketing page presents traffic
in a marketing frame; it does not replace the ops view.

## Phase 2 — Resend delivery stats

**Ships:** real deliverability. This is what makes sending to 250 strangers safe.

Resend has no aggregate stats API; you get delivery data by ingesting webhooks.

- **Migration** `..._email_events.sql` → `company_os.email_events`:
  `id`, `resend_email_id` (text), `event_type` (delivered | bounced | complained | opened |
  clicked | delivery_delayed | sent), `recipient` (text, lowercased), `person_id` (fk people,
  nullable), `campaign_id` (uuid, nullable, forward reference used in Phase 3), `subject`,
  `occurred_at`, `metadata` jsonb, `created_at`. Unique on
  `(resend_email_id, event_type, occurred_at)` so redelivered webhooks are idempotent.
  Indexes on `recipient`, `person_id`, `occurred_at`, `campaign_id`. RLS enabled,
  `grant select, insert` to `service_role`, `grant select` to `supabase_read_only_user`.
- **Route** `app/api/webhooks/resend/route.ts` — `POST`, `runtime = "nodejs"`,
  `dynamic = "force-dynamic"`. Reads the **raw** body (signature is over raw bytes), verifies
  the Svix signature (`svix-id`, `svix-timestamp`, `svix-signature`) with an HMAC-SHA256
  timing-safe compare using `RESEND_WEBHOOK_SECRET`. No new npm dependency: the scheme is
  ~30 lines of `node:crypto`. Rejects timestamps older than 5 minutes (replay guard).
  Matches `recipient` to a `people` row by email, best-effort.
- **Registered URL:** `https://www.edge8.ai/api/webhooks/resend/` — **trailing slash required**
  (`trailingSlash: true`), or every delivery 308s and silently never arrives.
- **Marketing page** gains a Deliverability card: delivered rate, bounce rate, complaint rate,
  open and click rate over the window, and a bounced/complained list that is the cleanup
  worklist. Empty state explains that data starts accruing from webhook setup, the same honest
  framing the Vercel page uses for its 2026-07-11 start.

**New env var:** `RESEND_WEBHOOK_SECRET` (Vercel: Production + Preview + Development).
Until it is set the route returns 503 and ingests nothing, so a half-configured deploy fails
loudly instead of accepting unverified payloads.

**Verification:** replay a signed sample payload locally and assert a row lands; assert an
unsigned/expired payload is rejected 401; re-POST the same event and assert no duplicate.

## Phase 3 — Email marketing (the newsletter engine)

**Ships:** consent, campaigns, approval, batched sending, results.

### 3a. Consent

- **Migration** adds to `company_os.people`: `marketing_consent` text
  (`subscribed | unsubscribed | never_asked`, default `never_asked`),
  `marketing_consent_at` timestamptz, `marketing_consent_source` text.
  Backfill: `subscribed` for `persona in ('prospect','client')` that are not
  `do_not_contact` and not `is_team_member`; everyone else stays `never_asked`.
  `job_seeker` is never backfilled to `subscribed`.
- **Unsubscribe** — signed token (HMAC of person id + secret, no PII in the URL) →
  `app/unsubscribe/page.tsx` public page + `app/api/unsubscribe/route.ts`. Handles both the
  one-click `POST` (RFC 8058, for `List-Unsubscribe-Post`) and the human `GET` confirm page.
  Writes `marketing_consent='unsubscribed'` and logs an interaction.
- Every marketing send carries `List-Unsubscribe` and `List-Unsubscribe-Post` headers plus a
  visible footer link. This is what keeps us out of spam folders.

### 3b. Campaigns

- **Migration** `company_os.email_campaigns`: `id`, `name`, `subject`, `preheader`, `body_md`,
  `body_html`, `status` (`draft | approved | sending | sent | cancelled`), `segment` jsonb
  (the audience rule), `from_email`, `reply_to`, `scheduled_at`, `approved_at`, `approved_by`,
  `sent_at`, `batch_size` int default 150, `created_at`, `updated_at`.
- `company_os.email_campaign_recipients`: `id`, `campaign_id` (cascade), `person_id`, `email`,
  `status` (`pending | sent | skipped | failed`), `skip_reason`, `resend_email_id`, `sent_at`,
  `error`. Unique `(campaign_id, person_id)`.
- Both: RLS enabled, `service_role` grants, `supabase_read_only_user` select.

### 3c. Admin UI

- `/admin/revenue/marketing/campaigns` — list with status chips.
- `/admin/revenue/marketing/campaigns/[id]` — composer (subject, preheader, markdown body),
  audience picker with a live eligible count, HTML preview in the shared branded template,
  **send test to myself**, and the approve gate.
- Server actions in `actions.ts`: create, update (draft only), buildRecipients, sendTest,
  approve, cancel. Every mutation `revalidatePath`s and writes `audit_log`, matching the CRM
  convention.

### 3d. Sending

- `lib/marketing-email.ts` — `sendMarketingEmail()`: separate from `sendTransactionalEmail()`,
  adds unsubscribe headers, renders the branded template, and returns the Resend message id so
  `email_campaign_recipients.resend_email_id` can be correlated with Phase 2's `email_events`.
- `app/api/cron/email-campaign-send/route.ts` — every 15 minutes. Picks the oldest campaign in
  `sending`, takes `batch_size` pending recipients, re-checks suppression per recipient at send
  time (`do_not_contact`, `marketing_consent`, prior hard bounce, prior complaint), sends,
  marks each row, and flips the campaign to `sent` when nothing is pending. Cron path
  **`/api/cron/email-campaign-send/`**, trailing slash.
- Approve sets `status='approved'`; a campaign only enters `sending` when its `scheduled_at`
  arrives (or immediately if unset). Nothing sends without the approve action.

### 3e. Results

Campaign detail gains a results card once sending starts: sent / delivered / bounced / opened /
clicked / unsubscribed, joined from `email_events` on `campaign_id`. The Marketing hub shows
the last few campaigns with the same numbers.

**New env vars:** `UNSUBSCRIBE_SECRET` (HMAC signing key for opt-out links) and
`NEXT_PUBLIC_SITE_URL` (no env var currently holds the public origin; unsubscribe links need an
absolute URL). Both documented in `.env.example`, which the repo grows "by attrition".

### 3f. Privacy policy

Sending marketing email makes three statements in `app/legal/privacy/page.tsx` inaccurate, so the
policy is updated in the same PR:

- Resend is described as "transactional email delivery" only.
- "Your rights and choices" has no mention of unsubscribe or communication preferences.
- There is no physical postal address, which CAN-SPAM requires on commercial email.

This is not optional polish. The current policy reads as opt-in-only ("send you updates you've
asked for"), and a blast to imported CRM contacts would contradict our own published promise.

**Verification:** create a campaign, build recipients against a segment, assert the count matches
a direct SQL count; send a test to Dave only; confirm the unsubscribe link flips consent and that
a subsequent build excludes that person; assert a `do_not_contact` person is skipped with a
`skip_reason`.

## Rollout after the build

1. Set `RESEND_WEBHOOK_SECRET` and register the webhook (trailing slash) in the Resend dashboard.
2. Set `UNSUBSCRIBE_SECRET`.
3. Review the backfilled consent state on the Marketing page before composing anything.
4. First campaign is the re-introduction email, not issue #1: who we are, why they're hearing
   from us, what this will be, and an obvious unsubscribe. Churn on email one is a feature.
5. Send it in batches of ~150/day, watching bounce and complaint rates between batches. Over 5%
   bounce means the list needs cleaning before anything else goes out.
6. Only then settle into a monthly cadence.

## What changed during the build

Findings from the review pass, all fixed before merge. Recorded because each one
was invisible until something specific was checked:

- **`List-Unsubscribe` pointed at a page route.** App Router pages answer GET/HEAD
  only, so every native one-click Unsubscribe press would have returned 405. The
  header now targets `/api/unsubscribe/`; the footer link still goes to the page.
- **Three double-send paths**: no `maxDuration` (batch killed mid-send), no row
  claim (overlapping ticks selecting the same rows), and webhook dedupe keyed on a
  timestamp that fell back to `now()`. Fixed with `maxDuration = 300`, an atomic
  `claim_campaign_batch()` with stale-claim recovery, and `svix_id` as the
  idempotency key.
- **A transient DB error was returned as a suppression reason**, permanently
  marking someone "skipped" over an 8 second statement timeout. Errors and
  suppressions are now distinct outcomes; errors leave the row pending.
- **Aggregates counted fetched rows**, which PostgREST silently caps. One
  185-person campaign emits roughly five events per email, so two campaigns would
  have taken the deliverability card past the cap and quietly understated bounces.
  Moved into SQL functions.
- `linkEvents` pushed every id ever sent into one `.in()` until the URL exceeded
  the gateway header limit, at which point campaign results would read zero
  forever while the UI blamed the webhook secret.
- A future-scheduled campaign blocked every other campaign behind it, because the
  schedule was an early return rather than part of the query filter.

The consent backfill ran as designed: 185 subscribed (150 prospects, 35 clients),
and no job seeker was touched.

## Explicitly out of scope

Visual drag-and-drop email builder, A/B subject testing, drip/automation sequences, per-link
click maps, and a public "subscribe to our newsletter" form on the marketing site. All are
reasonable follow-ups; none are needed to send the first newsletter.
