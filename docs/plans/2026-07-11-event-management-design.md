# Event Management System — Design Plan

**Date:** 2026-07-11
**Status:** Draft — awaiting Dave's answers to the open questions at the bottom
**Prior art:** eo-vietnam events module (`~/code-projects/eo-vietnam`), edge8-web Public Retreats (Revenue → Commerce)

---

## 1. Problem

Edge8 runs several kinds of events — private/public retreats, public workshops, private trips planned for clients, and internal company events/trips — but only "public retreats" have first-class management, and even that is a workaround:

- A "retreat" today is not a record. It's a *group of `products` rows* sharing a `cohort_slug`, with shared fields (location, dates) duplicated onto every tier row. Edits fan out to every row (`app/admin/(dashboard)/revenue/public-retreats/actions.ts`), and the `public_retreats` view re-derives the event by aggregation.
- Private client trips (Vietnam Adventure) live in a completely separate, un-migrated model (`public.trip_families`, `public.trip_members`). These are revenue events planned for a client — a different animal from internal company trips.
- Workshops have marketing copy (`app/training-and-certification/`) but no data model at all.
- Registrations have only two statuses (`confirmed`/unconfirmed) — no pending-payment, waitlist, attended, or no-show.
- Stripe Checkout exists but **there is no webhook**: orders are written as `pending` at session-create time and payment completion is never confirmed.
- No capacity enforcement, no attendee communications, no post-event feedback link (surveys have an unused `cohort_slug` column, descoped pending design).

eo-vietnam solved most of this well and its lessons are directly transferable — including the things it *didn't* finish (reminder emails, CSV export, auto-waitlist promotion) and the bug it hit (capacity counting that ignored guest counts).

## 2. Design principles (carried over from repo conventions + eo-vietnam lessons)

1. **Event is a first-class row**, not an aggregation. Tiers/prices hang off it.
2. **Attendees are CRM people.** Every registration resolves to `company_os.people` via get-or-create by email — events feed the CRM, never a silo.
3. **Additive migrations only.** External writers exist (surveys, caio-coach mirror); never rename/drop. Every new table/view/function gets explicit `service_role` grants (including `delete`).
4. **Money in integer cents, `timestamptz`, ISO currency** — matches both codebases.
5. **Fail-soft email:** all sends no-op without `RESEND_API_KEY` (already how `lib/email.ts` works).
6. **Admin follows the playbook:** `docs/engineering/admin-consistency-playbook.md`, one-client-tree manage shelf, `admin.css` scoped tokens, audit every mutation, verify with `tsc --noEmit` + `next build` (no dev server).
7. **Every event gets a canonical signup URL + QR.** `/events/[slug]` always exists, shows the ticket options with prices (or "Free"), and takes registrations. Bespoke marketing pages (saigon-private, the-vietnam-experience) remain the hand-crafted brand layer on top and link/deep-link into the same signup flow — they are optional; the signup page is not.
8. **Every registration is a ticket.** A `ticket_code` is stamped at insert, so a confirmed seat always resolves to a ticket page/QR — even if door-scanning isn't built yet (eo-vietnam's best structural decision).

## 3. Data model (`company_os`, all additive)

Five entities carry the whole system. Two are new (`events`, the `register_for_event` RPC); three are existing tables extended additively (`products`, `event_registrations`, `orders`). Surveys are linked, never modified.

```
people ──< event_registrations >── products (ticket types) >── events
              │        │                                          │
              └── orders (payment)              surveys ──────────┘ (feedback_survey_id)
                                                   └─ survey_responses.cohort_slug = events.slug
```

### 3.1 New table: `events`

The first-class entity. One row per event of any type.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | `gen_random_uuid()` |
| `slug` | text unique not null | e.g. `saigon-2026-06-20`; equals today's `cohort_slug` for backfilled retreats; drives the public URL + QR |
| `type` | text not null | `retreat` \| `workshop` \| `webinar` \| `micro_session` \| `dinner` \| `private_trip` \| `company_event` (check constraint, extensible) |
| `status` | text not null default `draft` | `draft` \| `published` \| `open` \| `closed` \| `completed` \| `cancelled` — only `open` accepts registrations; `published` shows the page with signup disabled |
| `visibility` | text not null default `public` | `public` \| `private` (unlisted — page works, never listed) \| `internal` |
| `title` | text not null | display name (today derived from location — becomes explicit) |
| `blurb` | text | one-liner for cards/OG |
| `description` | text | longer copy for the signup page |
| `location` | text | |
| `starts_at` / `ends_at` | timestamptz | replaces per-tier `date_start`/`date_end` duplication |
| `timezone` | text not null default `Asia/Ho_Chi_Minh` | |
| `capacity` | int null | null = uncapped; enforced by the RPC (3.5) |
| `cover_image_url` | text null | signup page hero + OG image |
| `owner_person_id` | uuid null FK `people` | internal champion (eo-vietnam's `champion`) |
| `landing_path` | text null | optional bespoke marketing page, e.g. `/saigon-private` |
| `feedback_survey_id` | uuid null FK `surveys` | post-event feedback hook (see 3.6) |
| `notes` | text | internal admin notes |
| `metadata` | jsonb not null default `{}` | escape hatch |
| `archived_at`, `created_at`, `updated_at` | timestamptz | repo conventions |

Type semantics: `retreat`, `workshop`, `webinar`, `micro_session`, and `dinner` are open-enrollment events (public or private cohorts) — retreats are the primary focus; lighter formats (webinar, micro-session, dinner) are often free-with-capacity, which the model handles natively (no tiers = free). `private_trip` is a bespoke revenue event planned for one client (Vietnam Adventure) — visibility `private`, tied to a deal/order rather than open registration. `company_event` covers internal team events/trips — visibility `internal`, no revenue, roster is team members. Revenue types live under Revenue → Commerce; internal events would surface under Operations if/when built.

### 3.2 Ticket types = `products` rows (extended)

No new ticket table — the existing `products` catalog already sells tiers (`type='event'`, `title`, `tier`, `amount_cents`, `amount_usd_cents`, `currency`, `active`) and `orders`/`event_registrations` already reference it. Additive columns turn a product row into a proper ticket type:

| New column | Type | Notes |
|---|---|---|
| `event_id` | uuid null FK `events` | tiers become children of the event; `cohort_slug` stays untouched for back-compat (view, caio-coach mirror) |
| `description` | text null | what the ticket includes, shown on the signup page |
| `tier_capacity` | int null | per-ticket-type cap (e.g. 5 early-bird seats), independent of `events.capacity` |
| `sort_order` | int not null default 0 | display order on the signup page |

**Pricing display rules (signup page + admin):**
- Event with active tiers → tier cards, each with name, description, formatted price (`formatCents`, currency-aware).
- A tier with `amount_cents = 0` → renders **"Free"**, skips Stripe entirely, registration confirms immediately.
- Event with **no** tiers → the whole event is free: single "Free — Register" button, same immediate-confirm path.
- Event card/list price summary: "Free" or "From $X" (min active tier).

### 3.3 Registrations = tickets (`event_registrations`, extended)

One row per attendee seat. Existing columns: `id`, `product_id` (which ticket type), `order_id`, `person_id`, `attendee_name`, `attendee_email`, `status`.

| New column | Type | Notes |
|---|---|---|
| `event_id` | uuid null FK `events` | denormalized for direct roster queries; backfilled from `product_id` |
| `guest_count` | int not null default 0 | extra seats under one registration; counted by the capacity RPC |
| `waitlist_position` | int null | set when capacity is full |
| `ticket_code` | text unique null | Crockford base32, generated at insert for every new registration — powers `/t/[code]` ticket page + QR |
| `checked_in_at` | timestamptz null | attendance timestamp |
| `confirmation_sent_at` | timestamptz null | email idempotency guard |
| `cancelled_at` | timestamptz null | |
| `notes` | text null | admin-only |

**Status lifecycle** (widened additively; legacy `confirmed` is read as `registered`, never rewritten):

```
pending_payment ──paid──▶ registered ──check-in──▶ attended
      │                       │
   expired                 no-show ──▶ no_show
      ▼                       │
  cancelled ◀────cancel───────┘        waitlisted ──promote──▶ registered
```

**Attendance** is first-class: check-in (roster checkbox in v1, QR scan later — `ticket_code` already exists) sets `status='attended'` + `checked_in_at`; a post-event bulk action marks remaining `registered` rows `no_show`. This feeds per-event attendance rate and, via `person_id`, a person's full event history on their CRM Person-360 page.

### 3.4 Orders — unchanged

`orders` already carries `person_id`, `product_id`, `stripe_session_id`, `amount_cents`/`amount_usd_cents`, `currency`, `status`, `metadata`. The Stripe webhook (Phase 3) finally flips `status` to `paid` reliably. Revenue per event = orders joined through registrations/products.

### 3.5 Capacity enforcement (steal eo-vietnam's RPC, including its bug fix)

`company_os.register_for_event(...)` — `security definer`, `SELECT ... FOR UPDATE` on the event row, counts held seats as `sum(1 + guest_count)` over `registered`/`attended`/`pending_payment` (also checks `tier_capacity` for the chosen ticket type), inserts atomically, returns `registered` or `waitlisted` + position. Execute grant to `service_role` only. App code falls back gracefully if the RPC is missing (deploy-before-migrate posture).

### 3.6 Survey linkage (respecting the surveys external-writer constraint)

**Zero changes to survey tables.** The link lives entirely on the events side plus one already-existing, purpose-built column:

- `events.feedback_survey_id` → `company_os.surveys.id`. **Deliberately many-to-one: one survey spans many events.** All retreats point at the same "Post-Event NPS" survey; every workshop reuses one workshop survey. Identical questions across events is what makes answers comparable over time.
- Feedback URL: `/surveys/[survey-slug]?cohort=<event-slug>`. The public survey submit handler writes `survey_responses.cohort_slug` (exists today, unused — this was its intended purpose) and `person_id` when resolvable. The cohort stamp is what keeps responses attributable per event even though the survey is shared.
- Admin event Feedback tab: `survey_responses where cohort_slug = events.slug`, joined to answers. Response rate = responses ÷ attended.
- **Trends across events:** because the survey (and its fields) are constant, survey results group by `cohort_slug` → a per-question trend line across events ordered by `events.starts_at` (e.g. avg rating per retreat over time). Surfaced on the survey results page (grouped-by-event view) and/or the Events hub. This is the payoff of NOT creating one survey per event — per-event surveys would fragment the data and kill trend tracking. Admin guidance follows: reuse a survey per event *type*, don't clone.
- The feedback QR (see 3.7) encodes this URL — same dual-QR pattern eo-vietnam projects at the end of an event.

Note the existing data already conforms: the external writer's 6 responses are stamped `cohort_slug='saigon-2026-06-20'` against the shared Post-Event NPS survey — the backfilled `saigon-2026-06-20` event row will pick them up with zero data movement.

### 3.7 QR codes + signup links (derived, not stored)

QR codes are rendered server-side from URLs (`qrcode` package, inline SVG — same as eo-vietnam's `lib/tickets.ts`); nothing to store or migrate. Every event exposes:

| URL | Purpose |
|---|---|
| `/events/[slug]` | canonical public signup page — tickets, prices or "Free", register form |
| `/t/[code]` | per-registration ticket page (QR = the attendee's ticket) |
| `/surveys/[survey-slug]?cohort=[slug]` | feedback survey |

Admin shows the **signup QR** and (when a survey is linked) the **feedback QR** on the event's manage shelf/detail page, each with copy-link + downloadable PNG for print/slides.

### 3.8 Backfill migration

One additive migration creates `events` rows from the current `public_retreats` view groups (distinct `cohort_slug` where `products.type='event'`), stamps `products.event_id` and `event_registrations.event_id`, and generates `ticket_code` for existing registrations. The `public_retreats` view is kept until the admin page migrates, then superseded by an `events_overview` view (explicit `service_role` grants on everything new).

### 3.9 Private client trips — fold in later (Phase 6, optional)

Vietnam Adventure's `public.trip_*` tables stay as-is for now (owner decision to keep them out of `company_os` stands). When folded in: a `private_trip` event row + registrations per traveler, linked to the client's deal/order; passports/flights remain trip-specific satellites. Not a blocker for anything else. Internal `company_event` rows need nothing special — the base model already covers them (zero-price, internal visibility) whenever they're wanted.

## 4. Admin surface

Under **Revenue → Commerce**, replace "Public Retreats" with **Events** (redirect the old path, same pattern as `revenue/registrations` → `public-retreats`).

- **`/admin/revenue/events`** — list page per the consistency playbook: KPI strip (upcoming events, registrations this month, collected revenue), `DataTable` with search, **type filter** (retreat/workshop/trip) and status filter, one-client-tree manage shelf.
- **Manage shelf per event:** edit event fields (single row now — no more fan-out writes), ticket-type list (products) with prices/Free, status transitions, **signup QR + copy link** front and center, danger-zone archive (delete blocked while registrations/orders reference it — keep current guard).
- **`/admin/revenue/events/[id]`** (full page, eo-vietnam "ops console" lite): overview tab (KPIs, signup + feedback QRs with PNG download), roster tab (statuses, manual add, check-in toggle, bulk no-show sweep, link to `/admin/contacts/[personId]`), revenue tab (orders per registration, paid vs pending), feedback tab (survey responses for the event's cohort), messages tab (Phase 5).
- **CSV export** of the roster — eo-vietnam's most-missed gap; trivial to add (server action streaming CSV).
- All mutations `requireAdmin()` + `recordAudit()` (event slug in `context` for cohort-level ops).

## 5. Public signup, registration & payment flow

- **`/events/[slug]`** — canonical public signup page for every event (marketing-styled, not admin): title, dates, location, description, ticket cards showing each price or a "Free" badge, and the register form (name/email/phone, ticket picker). Status-aware: `open` → form live; `published`/`closed` → page visible, signup disabled with an explanatory note; `draft`/archived → 404. `visibility='private'` events resolve by slug but are never listed. JSON-LD `Event` schema + OG image for shareability.
- **Registration:** form posts to a generic server action keyed by event slug: get-or-create person by email → reserve seat via the RPC. Free ticket (or no tiers) → `registered` immediately, confirmation email with ticket link. Paid ticket → `pending_payment` + Stripe Checkout session (30-min expiry) with `event_id`/`registration_id` in metadata. Full event → `waitlisted` with position, honest messaging.
- Existing bespoke checkout (`app/api/checkout/saigon-private/route.ts`) is re-pointed at the same event row + RPC so both paths share one source of truth. Offline/bank-transfer path unchanged.
- **New: Stripe webhook** (`app/api/stripe/webhook/route.ts`) — the single biggest plumbing gap today. On `checkout.session.completed`: flip registration `pending_payment` → `registered`, mark order `paid`, stamp `amount_paid`/`paid_at`, send confirmation email once (guarded by `confirmation_sent_at`). On session expiry: release the held seat. Requires `STRIPE_WEBHOOK_SECRET` env var (record in env docs).
- Confirmation email via existing `lib/email.ts` Resend wrapper, inline HTML template, fail-soft.

## 6. Phasing

| Phase | Deliverable | Depends on |
|---|---|---|
| **1. Data model** | `events` table + ticket/registration columns + backfill (incl. ticket codes) + grants + audit; `register_for_event` RPC | — |
| **2. Admin Events hub** | List + manage shelf (with signup QR) + event detail page (overview/QRs, roster + attendance, revenue) + CSV export; retire `public_retreats` view dependency; nav rename | 1 |
| **3. Public signup + payment truth** | `/events/[slug]` signup page (tickets, prices/Free) + generic registration action + `/t/[code]` ticket page; Stripe webhook; bespoke checkout re-pointed; confirmation email | 1 |
| **4. Workshops** | First workshop event created via admin, sold through the generic signup page — should require zero new code | 2, 3 |
| **5. Comms & feedback** | Broadcast message to roster segments (Resend batch, opt-out footer); feedback survey wiring (`feedback_survey_id` + cohort param + feedback QR); per-question trend view across events sharing a survey; optional reminder cron (Vercel cron + idempotency table) | 2, 3 |
| **6. Private client trips (optional)** | Fold `public.trip_*` into events as `private_trip`, linked to the client's deal | 1–2 |

Each phase is a separate PR, independently shippable; code always tolerates the next phase's migration not existing yet (fail-soft, eo-vietnam style).

## 7. Explicitly out of scope (v1)

- Camera QR **check-in scanner** (eo-vietnam has it; Edge8 events are small — a roster checkbox suffices). Note: ticket QRs themselves ARE in scope (`/t/[code]`); only door-scanning is deferred, and `ticket_code` makes it a pure add-on later.
- Auto-waitlist promotion (manual promotion from the roster; eo-vietnam never resolved auto-promotion either).
- A public `/events` **listing** page (each event's detail/signup page ships in v1; a browsable index can come when there's a calendar worth browsing).
- Group registrations with per-attendee detail collection (add when a real event needs it; `guest_count` covers plus-ones).
- Touching survey tables, `cohort_slug` on products, or the caio-coach mirror.

## 8. Decisions (Dave, 2026-07-11)

1. **PR slicing:** Claude's call — clean, sensible PRs. Resolved in
   `2026-07-11-event-management-build-plan.md` (PRs 1–9).
2. **Event types:** add `webinar`, `micro_session`, `dinner` to the check
   constraint alongside retreat/workshop/private_trip/company_event.
3. **Nav rename approved:** "Public Retreats" → "Events". **Retreats remain
   the primary focus** — build and verify against retreats first; other types
   ride the same rails.
4. **Vietnam Adventure stays separate for now** — fold into the model only
   after the trip is over (PR 9 timing, not before).
5. **Waitlist stays in scope** — RPC + waitlist UI ship as planned.
