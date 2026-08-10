# "My Retreat" — design & build plan

Date: 2026-07-31 (rev. 2026-08-01: agenda moved to structured, admin-editable data)
Pilot: Private Retreat 4 — James & Tracy (`private-retreat-4-james-tracy-2026-07-27`)
Pattern source: `/Users/davepro/code-projects/infinite-leverage` ("Enter My Retreat" → `/workshop` hub)

## Goal

Give a private-retreat guest a single page, "My Retreat", that gathers everything for their
retreat in one place: welcome, day-by-day itinerary, resource links, and their pre/post
surveys. Copy the infinite-leverage (IL) *access + hub* pattern, but store the agenda as
structured, reusable, admin-editable data (not hardcoded like IL), so one agenda drives both
the guest view and the internal work schedule.

## Decisions locked

1. **Access = soft code-gate** (copy IL). A shared per-retreat access code unlocks a signed
   cookie. No login, no portal invite. IL calls this "NOT a login and confers no identity";
   we keep that posture. (2026-07-31)
2. **Identity = email-only, "continue as a Client".** Enter email → match `company_os.people`
   → known clients continue as themselves; unknown email falls back to name capture. (2026-07-31)
3. **Agenda + work schedule = structured in DB, edited in the admin.** One set of agenda blocks
   per event drives two views from a single source: the guest "My Retreat" itinerary and the
   internal ops work schedule. Reusable (clone-a-template) and modifiable (admin, no deploy).
   Supersedes the earlier "hardcoded content" decision. (2026-08-01)
4. **Scope = private retreats only.** Private Retreat 4 is the pilot; everything is keyed by
   event, so more private retreats slot in. (2026-07-31)

## Hard boundary (security)

The soft cookie is a marketing-content gate, nothing more. It **must not** read any protected
`company_os` data (`portalRead`, wages, PII). What the guest hub shows is (a) public fields on
the `events` row, (b) **guest-visible** agenda blocks, and (c) the public survey runner. The
real portal (`/portal`, Supabase auth) stays the only path to protected data. Never bridge the
cookie into `lib/portal-auth.ts` or `lib/portal/data.ts`.

**Staff never reach the guest.** Per-block staff assignments (the work-schedule half) are ops
only. The guest agenda query selects `guest_visible = true` blocks and omits the staff join.
Staff assignments carry no wages (the P&L flat $150/day already covers cost; the leak-guard
rule stands).

## Agenda data model (new)

Two `company_os` tables. Money/wages intentionally excluded.

**`company_os.event_agenda_blocks`** — one row per agenda block.
- `id uuid pk`, `event_id uuid → events(id) on delete cascade`
- `day_index int` (1..N), `day_label text` (e.g. "Day 1 — Arrive & begin")
- `day_date date null` (derived from event start + day_index; editable)
- `period text null` (`morning|afternoon|evening`) and/or `time_label text null` (e.g. "09:00–10:30")
- `title text`, `body text null`, `room text null` (the guide's "every block has a booked room")
- `guest_visible boolean not null default true`
- `sort_order int not null default 0`
- `created_at`, `updated_at`

**`company_os.event_agenda_staff`** — who works each block (the work-schedule half).
- `id uuid pk`, `block_id uuid → event_agenda_blocks(id) on delete cascade`
- `person_id uuid → people(id)`, `role text` (`engineer|driver|maid|lead|other`), `note text null`

Migration must add explicit **service_role grants** on both tables and any helper, or the app
can't see them (known company_os gotcha). RLS on, no browser policies (reads go through the
service-role `companyOs` client, same as the rest of the events module).

**Reuse / templates:** a "Clone agenda from…" admin action copies all blocks (and optionally
staff roles) from a source event into the target, shifting `day_date` by the new start date.
James & Tracy's real agenda becomes the seed for a reusable "4-day" shape; each new retreat
clones and edits. No separate template table in v1 — any past event can be the source.

## Architecture

```
# Admin (internal editor + ops view)
app/admin/(dashboard)/revenue/events/[id]/
  AgendaTab.tsx            New "Agenda" tab alongside Settings / P&L / Roster.
                           CRUD blocks by day, assign staff, reorder, "Clone from event".
  agenda-actions.ts        Server actions (requireAdmin + recordAudit), CRUD + clone.
lib/admin/event-agenda.ts  Service-only data layer (read/insert/update/delete/clone).

# Shared renderer (one component, two views)
components/retreat/RetreatAgenda.tsx   view: 'guest' | 'ops'.
                           guest → title/body/room, staff hidden, guest_visible only.
                           ops   → adds staff + all blocks (the work schedule).

# Guest surface (soft-gated hub)
app/my-retreat/
  page.tsx                 Gate: "Enter My Retreat" (code → email).
  MyRetreatGate.tsx        Client: staged card (code → email) → POST /api/my-retreat/access.
  [slug]/page.tsx          Hub (server): verify cookie == slug, load event + guest agenda,
                           render hero + welcome + <RetreatAgenda view="guest"> + resources
                           + survey cards. robots: noindex.
  [slug]/SurveyCards.tsx   Pre/post survey cards with completion state.
app/api/my-retreat/access/route.ts   Validate code → resolve event → set signed cookie.
lib/my-retreat/access.ts   HMAC sign/verify of the access grant (port of IL access-grant.ts).
lib/my-retreat/content.ts  Small per-retreat copy the DB doesn't hold (welcome text, resources).
```

### Access flow (copy IL)

1. Guest hits `/my-retreat`, clicks "Enter My Retreat", types the retreat's access code.
2. `POST /api/my-retreat/access` validates the code (constant-time) against
   `events.metadata.access_code`, resolves the private `events` row, captures email
   (matched to `people`), and mints an **HMAC-SHA256 signed cookie** `edge8_my_retreat`
   carrying `{ eventSlug, exp, email?, personId?, name? }` (TTL ~120 days, httpOnly, secure,
   sameSite=lax). Modeled on IL `signAccessGrant`.
3. Redirect to `/my-retreat/<eventSlug>`; the hub re-verifies the cookie matches the slug.

**Access code:** `events.metadata.access_code` (data, no schema change). Private Retreat 4 =
`Retreat42026` (already stored).
**Cookie secret:** new env var `MY_RETREAT_COOKIE_SECRET` (record in env docs, never commit
the value).

### Identity — email-only, "continue as a Client"

Single email field (IL "returning" path). Look it up in `people`; a known client (James &
Tracy both are) continues as themselves, survey attribution keying off `person_id`. Unknown
email → capture name (IL "first-time") and upsert a CRM `people`/`inquiries` row via the
existing signup helper. Email match only on this soft surface; it never touches
`people.auth_user_id` or grants any protected read.

## Hub sections

Styled with the existing `the-vietnam-experience` `xp-*` classes to match the edge8 look.

1. **Hero** — event `title`, `formatEventDates`, `location`, `cover_image_url` via
   `getEventBySlug` (`lib/events-server.ts`).
2. **Welcome** — short per-retreat copy from `lib/my-retreat/content.ts` (or the event
   `description`).
3. **Itinerary** — `<RetreatAgenda view="guest">` reading the event's `event_agenda_blocks`
   (guest-visible), server-side via the service-role client. Timeline layout ported from IL
   `RetreatAgenda` (`180px 1fr` block rows).
4. **Resources** — grid of `{ eyebrow, title, description, href }` cards (deck, build prompts,
   the 18 protocols, the stack). Small editable config in v1; can graduate to an event-attached
   table later if needed.
5. **Survey cards** — the pre/post links already wired for Private Retreat 4:
   - **Pre — AI Journey:** `/surveys/ai-journey?cohort=<event.slug>`
   - **Post — AI Capability Pulse:** `/surveys/ai-capability-pulse?cohort=<event.slug>`
   Completion read server-side from `survey_responses` where `cohort_slug = event.slug` and
   (if known) `person_id`/`respondent_email`. Completed → "done" state, echoing IL.

## Reuse map

| Need | Reuse |
|---|---|
| Event basics | `getEventBySlug`, `formatEventDates` (`lib/events-server.ts`, `lib/events.ts`) |
| Admin tab shell | The existing `[id]/` event tabs (Settings / PnL / Roster) + `recordAudit` |
| Agenda data layer | New `lib/admin/event-agenda.ts`, patterned on `lib/admin/event-pnl.ts` |
| Signed cookie | New `lib/my-retreat/access.ts`, ported from IL `src/lib/access-grant.ts` |
| Gate UI | Port IL `EnterMyRetreat.tsx` + `WorkshopGate.tsx` state machine |
| Agenda timeline | Port IL `RetreatAgenda.tsx` into the shared `view`-aware component |
| Survey links | Existing `?cohort=<event-slug>` mechanism (live for PR4) |
| Styling | `xp-*` classes + marketing globals |

## Build phases (PR-sized, each independently verifiable)

- **PR1 — Agenda model + admin editor + ops work-schedule view.** Migration (2 tables +
  grants), `lib/admin/event-agenda.ts`, `AgendaTab.tsx` + `agenda-actions.ts`, shared
  `RetreatAgenda` (ops view). **This unblocks the agenda content: Dave enters the real James &
  Tracy agenda directly in the admin.** Verify: add blocks + staff, reorder, clone; ops view
  renders the work schedule; `tsc` + `next build`.
- **PR2 — My Retreat gate + hub shell + guest agenda.** Access cookie, gate, hub with hero +
  welcome + `RetreatAgenda view="guest"` reading PR1's blocks. Verify: right code → hero +
  itinerary; wrong/no code → bounced; staff never appear in the guest view.
- **PR3 — Resources + survey cards.** Resource grid + pre/post survey cards with completion.
  Verify: links resolve; a submitted response flips the card to done.
- **PR4 (optional) — "Enter My Retreat" bar + polish.** Reveal bar on relevant pages; survey
  pre-fill from the cookie identity.

Verification per repo rule: no dev server — `tsc --noEmit` + `next build`, then preview.

## Open inputs from Dave

1. ~~**Access code.**~~ **DONE** — `Retreat42026` on the event's metadata.
2. **Resources** — which handouts/decks/links James & Tracy should see (URLs, or "reuse the
   private-retreat guide / blueprints").
3. **Agenda content** — approach decided (enter in the admin, PR1). Still need the actual 4-day
   agenda + work schedule to seed it. Note: **your "here is the agenda and the work schedule"
   message arrived with no attachment/text.** Resend by pasting it, giving a repo path, or a
   Lark doc link (I can pull Lark directly), and I'll seed the blocks — or enter it yourself in
   the admin once PR1 ships.
4. ~~**Identity step.**~~ **DONE** — email-only, continue as a Client.

## Notes

- Two James & Tracy retreats exist (#2 May, #4 July). Everything is keyed by event, so each
  has its own code, agenda, and hub; no collision. #4 is the pilot; #2 can clone #4's agenda.
- Worktree note (2026-08-01): the original session worktree was auto-cleaned mid-build; this
  plan was rescued to `admin-playbook` and work continues in the `edge8-web-my-retreat`
  worktree on branch `claude/my-retreat-feature`. All DB changes (event, surveys, access code)
  live in Supabase and were unaffected.
- If a retreat ever needs protected data (invoices, personal deliverables), move that guest to
  the real `/portal` (Supabase invite) rather than the soft gate; the two systems stay separate.
