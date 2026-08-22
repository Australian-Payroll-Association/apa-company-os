# Marketing System — Dev Plan

_Written in the spec-first, simplicity-first style: every phase is one shippable PR with a verifiable done-check. No speculative abstractions. Hard unknowns get a throwaway spike before a real build._

**Date:** 2026-08-22
**Branch base:** `main`
**Author context:** extends the marketing calendar + campaign brand/scheduling already built on `email-marketing`.

---

## Status: SHIPPED (2026-08-22)

All phases merged to `main`:

| Phase | What | PR |
|---|---|---|
| 0 | Calendar (Board + Month), brand, campaign scheduling | #801 |
| 1 | Repurposing waterfall | #802 |
| 2 | Content pillars (per-brand list) | #804 |
| 3 | Social posting spike → no-go (`docs/spikes/2026-08-22-social-posting-feasibility.md`) | — |
| 4a | Manual social posting + daily due digest | #805 |
| 4b | Social API posting | **deferred** — reopen per the spike's revisit criteria |
| 5 | Brand-scoped audience + `brand_contacts` (`docs/spikes/2026-08-22-cross-brand-audience.md`) | #806 |
| 6 | Metrics rollup (drawer stats + pillar performance) | #807 |

**Open decision for Dave (blocks nothing):** populate AI Officer's audience — replicate the 40 AIO contacts into `brand_contacts`, or federate against the AIO Supabase project. Until then AIO campaigns safely resolve to zero recipients, never the Edge8 house list.

---

## The one-sentence goal

One planning surface where a single core asset becomes dated, brand-tagged content across blog, email, LinkedIn, and Facebook — and email actually sends itself on schedule.

## What already exists (do not rebuild)

- `email_campaigns` engine: consent gating, Resend send, webhooks, 15-min cron (PR #755).
- `company_os.marketing_calendar` table + `/admin/revenue/marketing/calendar` (Board + Month), brand picker, email-entry → campaign spawn, `scheduled_at` UI. **This is Phase 0, done, on `email-marketing`.**

## Principles for this plan

1. **Each phase is one PR.** If a PR can't state its own done-check in one line, it's too big — split it.
2. **Spike before building anything with an external API or another database.** Delete the spike.
3. **No new abstraction until the second caller exists.** Social channels share code only after LinkedIn *and* Facebook both work.
4. **The calendar table is the spine.** Everything hangs off a `marketing_calendar` row; nothing gets its own parallel store.

---

## Phase 0 — Calendar + brand + scheduling ✅ (built, uncommitted)

**Done-check:** build clean, migration applied, email entry spawns a scheduled campaign. → **PR #1** (merge what's on `email-marketing`).

---

## Phase 1 — Repurposing waterfall (no external deps, do this first)

The cheapest, highest-leverage piece. Pure DB + UI, already have `parent_id`.

- **1a. Spawn derivatives from a core asset.** On any entry, a "Repurpose →" action creates child entries (LinkedIn, Facebook, Email) pre-linked via `parent_id`, dates offset from the parent (parent+1d, +2d, +4d — the waterfall). One server action, reuse `createEntry`.
- **1b. Parent/child visibility.** Board card shows a "↳ from {parent title}" line; drawer already has the parent select. Month view groups a parent's children visually (same row tint).

**Done-check:** click Repurpose on a blog entry → 3 dated child entries appear on the board, each linked back. No new table.

---

## Phase 2 — Pillars as first-class (small, removes free-text drift)

Today `pillar` is free text. Make it a short controlled list per brand so reporting later is possible.

- **2a.** `company_os.marketing_pillars` (id, brand_id, name, active). Seed 3–4 per brand.
- **2b.** Pillar becomes a select in the entry drawer + new-entry form, filtered by the entry's brand.
- **2c.** Board/Month filter chips by pillar.

**Done-check:** create entry → pillar dropdown shows only that brand's active pillars; filter narrows the board.
**Risk:** don't over-model. No pillar hierarchy, no per-pillar targets yet. One table, one join.

---

## Phase 3 — SPIKE: social posting feasibility (throwaway, 1 day)

Before any social build, answer the unknowns. Delete the code after.

- LinkedIn: does the org page allow API posting under the current app? Scopes, review process, token lifetime.
- Facebook: Page access token flow, review requirements, image upload.
- **Deliverable:** a 1-page findings note (`docs/spikes/...`) answering: can we post programmatically without Meta/LinkedIn app review we don't have? If review is required and slow → social stays **manual-post with reminders** (Phase 4a) and API posting is deferred.

**Done-check:** written go/no-go per platform. No production code merged.

---

## Phase 4 — Social channel activation (shape depends on Phase 3)

- **4a. Manual path (always ship this).** Entry gets "Mark posted" + a paste field for the live URL. A daily digest (reuse existing cron pattern) lists "due today, not posted." No API.
- **4b. API path (only if the spike said go).** `lib/social/{linkedin,facebook}.ts` behind a shared `postToChannel(entry)` interface — created only when both exist. `scheduled_at` + status `scheduled` → cron posts it, writes back the URL. Mirror the email cron's claim-a-batch safety.

**Done-check (4a):** an unposted entry due today shows in the digest; marking posted clears it.
**Done-check (4b):** a `scheduled` LinkedIn entry auto-posts within one cron tick and stores its URL.

---

## Phase 5 — SPIKE + build: cross-brand (AIO) audience

Biggest architectural unknown. AI Officer contacts live in a **separate Supabase project** ("AI Officer CRM"). An AIO campaign today still mails Edge8 `people`.

- **5a. SPIKE:** can the send path resolve recipients from a second project (read-only cross-project client) cleanly, or do we sync AIO contacts into `company_os.people` with a brand/source tag? Decide: federate vs replicate.
- **5b. Build the chosen path.** Most likely: brand-scoped audience resolution — `resolveAudience(segment, brandId)` filters by a brand/source marker. Keep the consent + suppression gates identical; brand only narrows the pool.

**Done-check:** building recipients for an AIO campaign yields AIO contacts only, with the same consent gating. Zero Edge8 contacts leak into an AIO send (assert in a test).
**Risk:** this is the one place a bug mails the wrong list. Test-first, non-negotiable.

---

## Phase 6 — Metrics rollup onto the calendar

Close the loop: per-entry / per-channel / per-pillar performance.

- Email: already have `email_events`. Join campaign stats back to the linked calendar entry.
- Social: only what the API returns (4b) or manual entry (4a) — likely just "posted" + link at first.
- Surface: a "Performance" strip on the entry drawer; a monthly view: best/worst pillar by clicks-per-send.

**Done-check:** an entry with a sent campaign shows delivered/opened/clicked in its drawer, pulled from `email_events`.

---

## Sequence & rationale

```
PR#1 Phase 0  (merge built work)      ─ no deps
PR#2 Phase 1  (waterfall)             ─ no deps, highest leverage
PR#3 Phase 2  (pillars)               ─ no deps
     Phase 3  (social spike)          ─ gate, no PR
PR#4 Phase 4a (manual social + digest)─ always ships
PR#5 Phase 4b (social API)            ─ only if spike = go
     Phase 5a (audience spike)        ─ gate, no PR
PR#6 Phase 5b (cross-brand audience)  ─ test-first
PR#7 Phase 6  (metrics rollup)        ─ after email + social exist
```

Do 1→2→3 first: all internal, all cheap, all compounding. The two spikes (3, 5a) sit in front of the two genuinely risky builds so we never build blind against an external API or a second database.

## Explicitly NOT in this plan (yet)

Drip/automation sequences, A/B subject testing, a visual email builder, public newsletter signup form, paid-ads tracking. Each is its own future spec; none blocks the above.

## Global done-check

A blog post planned Monday auto-produces dated LinkedIn/FB/email children, the email sends itself Wednesday to the right brand's audience, and by Friday the entry shows its open/click numbers — all from one calendar.
