# Event Management — Build Plan (PR breakdown)

Date: 2026-07-11
Status: Proposed
Extends: `2026-07-11-event-management-design.md` (the locked design — data model,
type taxonomy, survey linkage rules all binding). Related:
`2026-06-28-forms-to-company-os-schema.md` (products/orders/registrations
mappings), `2026-07-08-surveys-design.md` (external writer caveat),
`docs/engineering/admin-consistency-playbook.md` (admin page standard).

Worktree: `.claude/worktrees/event-management-system` (branch
`feature/event-management-system` off origin/main). Each PR gets its own branch
off latest main; this worktree is the base camp.

## Where we are

- Retreats = `products` rows grouped by `cohort_slug` + the `public_retreats`
  view; admin manage-shelf at `revenue/public-retreats` is the canonical
  pattern to extend.
- `event_registrations`, `orders`, `people` exist and are wired; Stripe
  Checkout exists **without a webhook** (orders stay `pending` forever).
- Surveys are live with an external writer (additive-only constraint);
  `survey_responses.cohort_slug` exists, unused, waiting for this feature.
- eo-vietnam is the reference implementation for the RPC, ticket codes, QR
  rendering, and webhook shape.

## PR sequence

| PR | Deliverable | Depends on | Ship test |
|---|---|---|---|
| 1 | Schema: `events` + ticket/registration columns + RPC + backfill | — | Backfilled events visible via SQL; existing admin unaffected |
| 2 | Admin Events hub (list + manage shelf + nav rename) | 1 | Public Retreats fully replaced; old URL redirects |
| 3 | Admin event detail page (roster, attendance, revenue, CSV, QRs) | 2 | Roster check-in + CSV export work on a backfilled retreat |
| 4 | Public signup page + free registration + ticket page | 1 | Register free on preview → row + email + `/t/[code]` works |
| 5 | Stripe webhook + paid registration path | 4 | Test-mode paid signup flips `pending_payment` → `registered` |
| — | **Checkpoint: first workshop** created via admin, sold via `/events/[slug]` | 3, 5 | Zero new code required |
| 6 | Feedback wiring (survey link, cohort stamp, trend view) | 3 | Existing 6 saigon responses appear on the event; trend renders |
| 7 | Roster broadcast messaging | 3 | Segment send via Resend with opt-out footer |
| 8 (opt) | Reminder cron | 5 | T-1 email sends once, idempotent |
| 9 (opt) | Vietnam Adventure fold-in as `private_trip` (**after the trip ends** — Dave) | 2 | Trip visible in Events hub, `public.trip_*` untouched |

PRs 2 and 4 are independent after PR 1 and can run in parallel worktrees.

---

## PR 1 — Schema + backfill

**Model: Fable 5** — live-data backfill, concurrency-sensitive RPC, and the
grants/additive rules where a mistake is expensive.

- Migration (in `supabase/migrations/`, applied via Supabase MCP with explicit
  operator confirmation, mirrored in `docs/db/`):
  - `company_os.events` table per design §3.1 (check constraints on
    type/status/visibility; type allows retreat, workshop, webinar,
    micro_session, dinner, private_trip, company_event per design decision #2).
  - `products`: add `event_id`, `description`, `tier_capacity`, `sort_order`.
  - `event_registrations`: add `event_id`, `guest_count`, `waitlist_position`,
    `ticket_code` (unique), `checked_in_at`, `confirmation_sent_at`,
    `cancelled_at`, `notes`. Widen the status check additively — legacy
    `confirmed` stays valid and is read as `registered`; never rewritten.
  - `register_for_event()` RPC: `security definer`, `FOR UPDATE` on the event
    row, held seats = `sum(1 + guest_count)` over
    registered/attended/pending_payment (+ `confirmed`), per-tier
    `tier_capacity` check, execute grant to `service_role` only.
  - Backfill: one `events` row per distinct `cohort_slug`
    (`products.type='event'`), slug = cohort_slug; stamp `products.event_id` +
    `event_registrations.event_id`; generate `ticket_code` for existing rows.
    Idempotent (`on conflict do nothing` / guarded updates).
  - Explicit `service_role` grants on the table and RPC, **including `delete`**.
- Code: `lib/events.ts` — types, `getEventBySlug`, ticket-code generator
  (Crockford base32, port from eo-vietnam `lib/tickets.ts`), price-display
  helper ("Free" / "From $X").
- Sharp edges: touch nothing in survey tables; do not modify or drop the
  `public_retreats` view yet (PR 2 consumes it until cutover); `cohort_slug`
  on products stays forever (caio-coach mirror reads it).
- Verify: `tsc --noEmit` + `next build`; SQL spot-checks via MCP (counts per
  cohort before/after, unique ticket codes).

## PR 2 — Admin Events hub

**Model: Sonnet 5** — pattern-following on established rails; the canonical
example (`revenue/public-retreats`) sits one directory over.

- `app/admin/(dashboard)/revenue/events/`: list page per the consistency
  playbook — KPI strip, `DataTable` with search + type filter + status filter,
  manage shelf.
- Manage shelf: edit event fields (single-row write — delete the fan-out
  logic), tier list with prices/Free, status transitions, **signup QR + copy
  link**, danger-zone archive (blocked while registrations/orders reference a
  tier — keep current guard).
- QR rendering helper (`lib/qr.ts`, `qrcode` package, inline SVG + PNG data
  URL for download) — built here, reused by PRs 3–6.
- Nav: rename "Public Retreats" → "Events"; `revenue/public-retreats` becomes
  a redirect (same pattern as `revenue/registrations`).
- Sharp edges: rows + shelf in **one client-owned tree** (`getRowPreview`
  shelf clicks are silently dead — bit us twice); `requireAdmin()` +
  `recordAudit()` on every action (event slug in audit `context`); read from
  `events` directly, drop the `public_retreats` view dependency here.
- Verify: `tsc` + `next build`; screenshot via Vercel preview.

## PR 3 — Admin event detail page

**Model: Sonnet 5** — larger surface but all repo-standard components; review
the roster mutations for audit coverage.

- `app/admin/(dashboard)/revenue/events/[id]/`: tabs —
  - **Overview:** KPIs (registered/capacity, paid vs pending, checked-in,
    revenue), signup + feedback QRs with PNG download.
  - **Roster:** statuses, manual add (get-or-create person by email),
    check-in toggle (`attended` + `checked_in_at`), bulk "mark remaining
    no-show", per-row link to `/admin/contacts/[personId]`, waitlist promote.
  - **Revenue:** orders joined through registrations, paid vs pending.
- CSV export of the roster (server action, streamed; eo-vietnam's most-missed
  gap).
- Sharp edges: manual-add must use the shared get-or-create person helper
  (`lib/company-os.ts`), not a raw insert; bulk no-show only touches
  `registered`/`confirmed` rows for that event.
- Verify: `tsc` + `next build`; roster actions exercised on a backfilled
  retreat in preview.

## PR 4 — Public signup page + free registration + ticket page

**Model: Fable 5** — public-facing, concurrent registration path, and the
Vercel-preview prerender trap.

- `app/events/[slug]/page.tsx`: marketing-styled signup page — title, dates,
  location, description, ticket cards (price or "Free" badge), register form
  (name/email/phone, ticket picker). Status-aware: `open` → live form;
  `published`/`closed` → visible, signup disabled; `draft`/archived → 404.
  `visibility='private'` resolves but is never listed/indexed (noindex).
  JSON-LD `Event` + OG image.
- Registration server action: get-or-create person → `register_for_event` RPC
  → free path confirms immediately (`registered`), sends confirmation email
  (fail-soft Resend, guarded by `confirmation_sent_at`), returns ticket URL.
  Full event → `waitlisted` + position messaging. Paid tiers render but the
  Stripe leg lands in PR 5 — until then paid tiers deep-link to the existing
  bespoke checkout when `landing_path` is set, else show "contact us".
- `app/t/[code]/page.tsx`: public ticket page with QR (port of eo-vietnam's
  `/t/[code]`).
- Sharp edges: **no browser Supabase clients during render** (Preview builds
  lack the public env vars — prerender crash); all data via server components
  / actions. RPC-missing fallback (deploy-before-migrate). Record the signup
  as an inquiry→lead like `recordRetreatSignup` does so CRM flow is preserved.
- Verify: `tsc` + `next build`; register on Vercel preview end-to-end.

## PR 5 — Stripe webhook + paid path

**Model: Fable 5** — payments correctness and idempotency; run `/code-review`
before merge.

- `app/api/stripe/webhook/route.ts`: signature verification
  (`STRIPE_WEBHOOK_SECRET`), `checkout.session.completed` → flip registration
  `pending_payment` → `registered`, mark order `paid`, stamp
  `amount_paid`/`paid_at`, send confirmation once
  (`confirmation_sent_at` guard). `checkout.session.expired` → release the
  seat (`cancelled`), free capacity. Idempotent on redelivery.
- Wire paid tiers on `/events/[slug]`: reserve via RPC as `pending_payment`,
  create Checkout session (30-min expiry, `event_id`/`registration_id` in
  metadata), redirect.
- Re-point `app/api/checkout/saigon-private/route.ts` at the event row + RPC
  so bespoke and generic paths share one source of truth. Offline/bank-transfer
  path unchanged.
- Env: `STRIPE_WEBHOOK_SECRET` added via Vercel + recorded in env docs;
  webhook endpoint registered in the Stripe dashboard (operator step, in PR
  description).
- Sharp edges: webhook must tolerate events for non-event payments (existing
  `dues`-style metadata patterns — switch on `metadata.type`); never trust
  amounts from the client, read them from the session.
- Verify: `tsc` + `next build`; Stripe test-mode end-to-end on preview
  (complete + expire), webhook replay for idempotency.

## Checkpoint — first workshop (no PR)

Create a workshop via the admin, add a per-seat tier, open it, register + pay
in test mode, check in, export CSV. **The model passes only if this needs zero
new code.** Anything missing becomes a fast-follow before Phase 5 PRs.

## PR 6 — Feedback wiring

**Model: Sonnet 5** — small, but the external-writer constraint makes the
diff-discipline matter; additive only.

- Admin: survey picker on the event form (`feedback_survey_id`), feedback QR
  on Overview, **Feedback tab** on the event page (`survey_responses where
  cohort_slug = events.slug` + answers; response rate = responses ÷ attended).
- Public: survey submit handler accepts `?cohort=<event-slug>` and stamps
  `survey_responses.cohort_slug` + `person_id` when resolvable. No survey
  table changes; no change to the existing no-cohort flow.
- Trend view: on the survey results page, group responses by `cohort_slug`,
  join to events, order by `starts_at` — per-question trend line across
  events sharing the survey.
- Ship test: the 6 existing `saigon-2026-06-20` responses appear on the
  backfilled event with zero data movement.
- Verify: `tsc` + `next build`; submit a cohort-stamped response on preview.

## PR 7 — Roster broadcast messaging

**Model: Sonnet 5** — port of eo-vietnam's `sendParticipantMessage`, repo
conventions apply.

- Messages tab on the event page: segment picker (all / registered /
  checked-in / no-show / waitlist), compose, send via Resend batch
  (recipients resolved server-side, individual To, opt-out footer), log a
  send record (audit + per-person `interactions` row so sends show on
  Person-360).
- Sharp edges: admin-triggered sends only — no scheduling here; batch ≤100
  per Resend call; fail-soft without `RESEND_API_KEY`.
- Verify: `tsc` + `next build`; send to a one-person test segment on preview.

## PR 8 (optional) — Reminder cron

**Model: Sonnet 5** — the thing eo-vietnam never built; keep it boring.

- Vercel cron → route handler: T-7 / T-1 / day-of emails to `registered`
  attendees, idempotent via an `event_reminders_sent`-style unique key
  (`event_id, person_id, kind`). Migration for the idempotency table
  (+ grants). Fail-soft on email.

## PR 9 (optional) — Vietnam Adventure fold-in

**Model: Fable 5** — cross-schema data migration with a live client's data;
only with explicit go-ahead.

- **Timing per Dave: not before the trip is over.** Do not touch `public.trip_*`
  while the trip is live.
- Create a `private_trip` event row linked to the client's deal; registrations
  per traveler from `public.trip_members`. `public.trip_*`, passports, and
  flights stay as satellites — nothing dropped.

---

## Standing rules for every PR

- Branch off latest main; PR to `main`; never merge with failing CI; QA
  verification before operator merge.
- Migrations: additive only, explicit `service_role` grants (incl. `delete`),
  file in `supabase/migrations/` + record in `docs/db/`, applied via Supabase
  MCP with explicit confirmation.
- Admin work follows `docs/engineering/admin-consistency-playbook.md`; scoped
  `admin.css` tokens only — never edit `globals.css`.
- No dev server — verify via `tsc --noEmit` + `next build` + Vercel preview.
- `requireAdmin()` + `recordAudit()` on every admin mutation.
- No commits without explicit instruction; no force-push; no `git add .`.
