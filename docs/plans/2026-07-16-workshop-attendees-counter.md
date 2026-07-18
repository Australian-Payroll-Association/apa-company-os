# Workshop Attendees counter + keynote/workshop catalog

**Date:** 2026-07-16
**Goal:** A 4th home page hero stat, "Workshop Attendees," counting 2026 attendees toward a goal of 1,000. Backed by the existing events module so admins update it in one place, and the four keynote/workshop talks become first-class tags for reporting.

**Decisions (confirmed with Dave):**
- Counter scope: 2026 only (all event types count, retreats included).
- Talks are topic tags on events, kept in a small admin-editable lookup.
- Attendee number per event: aggregate from real registrations when they exist, overridable by a manual count for engagements with no signups (EO, DOXA, Georgetown).
- Home page shows the raw animated number plus goal subtext.

Running total from known 2026 numbers: 241 + 59 + 47 + 64 + 27 + 207 = **645**.

---

## Phase 1 — Schema (one migration)

`supabase/migrations/2026xxxx_workshop_attendees.sql`

1. **Add `keynote` to the event type enum.** `company_os.events.type` check constraint gains `'keynote'` (superset change, safe on live data).
2. **`events.attendee_count_override integer`** — manual attendee count. Null means "derive from registrations."
3. **`company_os.talks`** lookup: `id, slug, title, active, sort_order`. Seed the four talks:
   - `four-offices-of-the-future` — The Four Offices of the Future
   - `the-other-50` — The Other 50%
   - `agentic-ai-in-business` — Agentic AI In Business
   - `leadership-in-the-ai-era` — Leadership in the AI Era
4. **`company_os.event_talks`** join: `event_id, talk_id`, PK on the pair. One event can tag multiple talks (EO Perth tags two).
5. **Effective-attendees function** `company_os.event_attendees_2026()` (or a view): per event, `coalesce(attendee_count_override, count of registrations where status in ('confirmed','registered','attended') + guest_count)`; summed where `starts_at` falls in 2026 and status is not `cancelled` and `archived_at is null`.
6. **Grants** — per the standing rule, explicit `grant` to `service_role` on the new table(s) and `execute` on the function, plus RLS enable + policies matching the other events tables. Function pins `search_path = company_os, extensions, pg_catalog`.
7. **Post-apply smoke test** via Supabase MCP: call the function, confirm it returns 645-ish once seed data is in.

## Phase 2 — Seed 2026 engagements

Insert as `company_os.events` rows (type `keynote`, `visibility 'private'` so they never appear in public listings; past ones `status 'completed'`, future ones `'published'`), with talk tags and overrides:

| Date | Event | Talk(s) | Attendees |
|---|---|---|---|
| Jan 1 | EO Perth (12 sessions) | Leadership in the AI Era, Agentic AI In Business | 241 |
| Jun 14 | Georgetown Dubai | Leadership in the AI Era | 59 |
| Jun 20 | EO Vietnam | Leadership in the AI Era | 47 |
| Jul 9 | Georgetown DC | Leadership in the AI Era | 64 |
| Jul 14 | DOXA Philadelphia | Four Offices of the Future | 27 |
| Jul 16 | DOXA Talent | Agentic AI In Business | 207 |
| Jul 17 | DOXA Denver | Four Offices of the Future | — |
| Jul 20 | DOXA Dallas | Four Offices of the Future | — |
| Jul 22 | DOXA Seattle | Four Offices of the Future | — |
| Jul 24 | DOXA San Francisco | Four Offices of the Future | — |
| Oct 1 | EO Melbourne — Infinite Leverage Retreat | (retreat) | — |
| Oct 18 | EO South Pacific Ignite Conference | Four Offices of the Future | — |

EO Perth's 12 sessions recorded in `metadata.sessions_count = 12`. The Aug 31 Sydney retreat already exists in the DB: tag it, leave override null so its count flows from registrations.

Seeding runs as a data script via Supabase MCP (not a schema migration), same pattern as prior backfills.

## Phase 3 — Admin UI (`/admin/revenue/events`)

1. **EventSettings**: add "Attendee count (override)" numeric field with helper text "Leave blank to use registrations"; add talk-tag multi-select fed from `talks`; add `keynote` to the type dropdown.
2. **EventsTable**: show effective attendees per row; add a header tile "2026 attendees: 645 / 1,000".
3. Talks CRUD is out of scope for v1 — the four rows are seeded; a new talk is one SQL insert.

## Phase 4 — Home page counter

1. **API route** `app/api/stats/route.ts`: server-side service-role client (never a browser client at render, per the Preview-env rule), calls the function, returns `{ workshopAttendees2026 }` with `Cache-Control: public, s-maxage=300, stale-while-revalidate=3600`. Fails soft: on error return the last-known baseline (645) so the home page never breaks.
2. **HeroStats.tsx**: add the 4th stat. Fetch `/api/stats` on mount; animate to the live number, falling back to the 645 baseline if the fetch fails. Copy (tight, no em dashes):
   - Number: live total
   - Label: "Workshop Attendees"
   - Sub: "on the road to 1,000 leaders trained in 2026"
3. **CSS**: `.hero-stats-grid` goes `repeat(4, 1fr)` desktop, likely `repeat(2, 1fr)` tablet, existing `1fr` mobile stays.

## Phase 5 — Verification

- `tsc --noEmit` + `next build` (no dev server, per project rule).
- MCP smoke test of the function post-apply (extensions search_path bit us before).
- Confirm `/api/stats` JSON and that the admin events list shows all seeded engagements with correct totals.

## Out of scope / later

- The other three hero stats stay hardcoded (could move to DB later).
- Talks admin CRUD, per-talk revenue reporting, public "past engagements" page.
- Signup/attendance flows for keynote audiences — the registration path already exists when needed.
