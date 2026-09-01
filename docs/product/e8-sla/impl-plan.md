# E8 · Speed-to-Deal SLA + Time-in-Stage — Implementation Plan

**Epic:** [E8 · Speed-to-Deal SLA and Time-in-Stage — Front Door tracking](../epics.md#e8--speed-to-deal-sla-and-time-in-stage--front-door-tracking-new--added-2026-09-01)
**Status source:** [epic-status.md](../epic-status.md) (E8 · ☐ 0%)
**Author:** Developer (dev-feature-plan)
**Date:** 2026-09-01
**Target:** revenue cockpit shows all four surfaces on real data by 2026-10-01

> Planning artifact only. No application code is written by this plan.

---

## Summary of what E8 delivers

Four surfaces on the **revenue cockpit** (`/admin/revenue`), all derived from data
already modelled, presented as **two distinctly-labelled SLA tiles that are never
merged**:

1. **Speed-to-lead (4h response)** — the *existing* `lead.sla_due_at` SLA, unchanged
   and not retuned; surfaced as its own labelled tile (today it is only a Band note +
   per-row overdue badge).
2. **Front Door first call (24h)** — a *new, separate* compliance % measured from
   `inquiries.created_at` to the moment the inquiry first reaches `contacted`-or-later
   (calendar hours), vs the prior window, plus a breach count.
3. **Breached list** — each breached enquiry with contact, `created_at`, time-to-first-
   contact (or "never contacted"), and current status.
4. **Time-in-stage + 7-day stalled flag** — per-open-deal time since last stage change,
   with any open deal untouched for 7+ days flagged in the cockpit attention list.

---

## Phase 0 — Outline, research & pre-planning decisions

### What is already in place (verified in code)

| Concern | Ground truth |
|---|---|
| 4h speed-to-lead SLA | `lead.sla_due_at` (default now+4h). Cockpit computes `overdueRes` count in `revenue/page.tsx` and shows it in the Sales `Band` note (`{n} SLA overdue`) and as a per-row `err` badge in "Leads to work". **No dedicated tile today.** Untouched by E8. |
| Inquiry status machine | `inquiries.status` CHECK allows `new_lead → contacted → qualified → discovery_call → proposal → won / lost / nurture / no_action / spam / archived`. Written by `moveInquiryStatus` and `promoteInquiryToLead` in `revenue/inquiries/actions.ts`. |
| Deal pipeline | `deals.stage_id` + `pipeline_stages` (`is_won`/`is_lost`). Stage moves go through `moveDealStage` in `revenue/deals/actions.ts`. |
| Activity log | `interactions` (kind incl. `status_change`; `subject_type`/`subject_id` free-text, `occurred_at`). Cockpit deals already reuse `CockpitDeals.tsx` + `DealDetail`. |
| Stage accent colours | `lib/admin/stageColors.ts` (`STAGE_WON`/`STAGE_LOST`/`STAGE_NEUTRAL`, etc.). |
| Cockpit helpers | `lib/admin/dashboard-helpers.ts` (`vsPrior`, `MS_DAY`), `lib/admin/lead-stats.ts` — the pattern new SLA math should follow. |

### HIGH finding — the stated data source is **not currently persisted** (resolved here)

The epic assumes time-in-stage derives from `interactions` (`kind='status_change'`,
`subject_type='deal'`) and that the 24h first-call metric derives "from existing
columns … no schema change." Code review shows the **transition history those metrics
need does not exist yet**:

- **No code anywhere writes `status_change` interaction rows.** Repo-wide, the only
  `interactions` inserts are: an SDR call (`kind:'call'`), unsubscribe (`system`), and
  two email paths (`email`). `moveDealStage` updates `deals.stage_id` but writes **no**
  stage-change event. The "hide the automatic `status_change` rows" comment in
  `revenue/deals/actions.ts` and the data-dictionary line are **defensive/aspirational**
  — nothing produces those rows. There are **no** stage-change DB triggers (only
  `handle_updated_at` triggers exist).
- **`inquiries` has no timestamp for reaching `contacted`.** The table has only
  `created_at` (+ `updated_at` via trigger). `moveInquiryStatus` sets `status` with no
  history and no `recordTransition` call, so *when* an inquiry was first contacted is not
  recoverable from existing columns.
- `deals.updated_at` is bumped on **any** update (FX, next-step edits, notes copy), so it
  is **not** a valid proxy for "time since last stage change."

**Resolution (no schema migration required):** instrument the two transition writes to
emit the history the metrics read — this uses columns/kinds that already exist, so it is
**not** a schema change, but it *is* new application code inside this epic (the epic's "no
new writes / derive only" assumption does not hold):

- **P0.a — Deal stage moves:** in `moveDealStage`, on every successful stage change insert
  one `interactions` row `{ kind:'status_change', subject_type:'deal', subject_id:dealId,
  occurred_at:now, metadata:{ from_stage, to_stage } }`. Time-in-stage = `now − MAX(occurred_at)`
  of that deal's `status_change` rows; stalled = that gap ≥ 7 days. This exactly matches the
  spec's stated source and lights up going forward.
- **P0.b — Inquiry first contact:** in `moveInquiryStatus` / `promoteInquiryToLead`, when an
  inquiry **first** reaches `contacted`-or-later, stamp the moment once into
  `inquiries.metadata.first_contacted_at` (jsonb already present, single-read, no extra join,
  no schema change) — **confirmed home, decision #1 below.**

### Backfill / "real data by 2026-10-01"

Because history starts accruing only once instrumentation ships, historical deals and
inquiries have no transition record. Settled fallbacks so the cockpit is not empty on day one:

- **Time-in-stage / stalled:** for a deal with no `status_change` row yet, fall back to
  `deals.created_at` as the "in current stage since" anchor (documented interim approximation).
  This makes stalled reasonable from launch without a backfill job.
- **24h first-call compliance:** computed only for inquiries that transition **after**
  instrumentation ships — **start clean, no backfill** (decision #2 below). The tile labels
  its measurement window so the thin early window reads honestly.

### Phase 0 decisions — CONFIRMED (operator, 2026-09-01)

All three took the recommended defaults. No open operator flags remain.

1. **First-call timestamp home = `inquiries.metadata.first_contacted_at`** — *CONFIRMED.*
   jsonb, no migration. Instrument the write in `moveInquiryStatus` / the promote path when
   the inquiry first reaches `contacted`-or-later; idempotent (never overwrite an existing
   stamp). The `status_change`-interaction alternative is dropped.
2. **Historical first-call compliance = start clean from go-live** — *CONFIRMED.* No backfill
   job. Compliance is computed only over inquiries created/transitioned after instrumentation;
   the 24h SLA tile labels its measurement window. The `deals.created_at` fallback anchor for
   time-in-stage stays as the documented interim.
3. **4h SLA presentation = add a presentation-only 4h tile** — *CONFIRMED, firm.* Two distinctly
   labelled cockpit tiles — "Speed-to-lead (4h response)" (reads the existing `slaOverdue`
   count) and "Front Door first call (24h)". The existing 4h SLA logic/threshold stays
   untouched.

### Risks & assumptions

| Risk | Mitigation |
|---|---|
| **Stated "derive-only, no new writes" is not achievable** — the history must be instrumented first. | Resolved in P0.a/P0.b with no schema change; scoped as the first build phase so metrics have a source before tiles ship. |
| **Thin data on launch** (history only from go-live). | Fallback anchors (deal `created_at`) + operator decision #2 on backfill; label tile windows honestly. |
| **Calendar-hours vs business-hours** ambiguity for the 24h SLA. | Spec is explicit: **calendar** hours. Compute in UTC millis; no business-calendar logic. |
| **Merging the two SLAs** by accident. | Two separate tiles, distinct labels ("Speed-to-lead · 4h response" / "Front Door first call · 24h"), separate queries; 4h logic literally not touched. |
| **`deals.updated_at` misused** as stage proxy. | Explicitly forbidden in the plan; only `status_change.occurred_at` (or `created_at` fallback) is used. |
| **No test harness exists** (no vitest/jest, no `test` script). | Isolate all SLA math in a pure `lib/admin/sla.ts`; verify via `next build` typecheck + `next lint` + QA manual pass. Optional: add vitest for the pure module (S) — recommend, not require. |
| **`inquiries.status` includes non-sales types** (retreat/checkout/newsletter). | Reuse the existing `NON_SALES_INQUIRY_TYPES` filter from `revenue/page.tsx` so first-call compliance counts only inbound sales inquiries. |
| **Sample data pollution** (`source_site='sample_seed'` style rows exist in sibling projects; confirm here). | Success criterion requires real data — compute on non-sample rows; QA verifies against a cleared/real dataset. |

---

## Phase 1 — Instrumentation (make the history exist) · Effort: **M**

Delivers the data source both metrics read. No UI yet.

- **Deal stage-change events** — `moveDealStage` writes a `status_change` interaction on
  every successful move (P0.a). Keeps the existing "hide status_change from note threads"
  filter honest (it already excludes them from `getDealCommunications`).
- **Inquiry first-contact stamp** — `moveInquiryStatus` + `promoteInquiryToLead` stamp
  `first_contacted_at` (or interaction, per decision #1) the first time status reaches
  `contacted`-or-later; idempotent (never overwrites an existing stamp).
- **(Decision #2 dependent)** optional one-off backfill note/script for historical rows.

**Delivers spec reqs:** the data foundation for time-in-stage, stalled, and 24h first-call.

## Phase 2 — SLA calculation module · Effort: **S**

- New `lib/admin/sla.ts` — pure, no I/O:
  - `firstCallCompliance(inquiries, windowStart, windowEnd)` → `{ met, total, pct, breaches[] }`
    using `created_at` and the first-contact timestamp; `met` = first-contact within 24
    calendar hours; `breaches` carries contact + created_at + hoursToContact|null + status.
  - `timeInStage(deal, lastStageChangeAt)` → ms/hours; `isStalled(gapMs)` → `gap ≥ 7d`.
  - Reuse `MS_DAY` and mirror `vsPrior` from `dashboard-helpers.ts` for the prior-window delta.

**Delivers spec reqs:** first-call % vs prior window; per-deal time-in-stage; 7-day stalled rule.

## Phase 3 — Cockpit surfaces · Effort: **M**

- `revenue/page.tsx`:
  - Add queries: (i) sales inquiries in the reporting + prior window with their first-contact
    stamp; (ii) latest `status_change.occurred_at` per open deal (single grouped read, fall
    back to `created_at`).
  - Add **two distinct SLA tiles** to the Sales KPI grid: "Speed-to-lead · 4h response"
    (reads existing `slaOverdue`, presentation only) and "Front Door first call · 24h"
    (`pct` vs prior via `vsPrior`, breach count in `sub`).
  - Add a **Breached first-call** card (mirrors the "Leads to work" / "Inquiries to triage"
    list card markup) linking each breached enquiry to `/admin/contacts/[id]`.
- `CockpitDeals.tsx` + its `cockpitDeals` mapping in `revenue/page.tsx`:
  - Extend `CockpitDeal` with `timeInStage` + `stalled`; add a "In stage" column and a
    stalled `Badge` (tone `warn`/`err`, colour via `stageColors` conventions); ensure stalled
    open deals surface in the attention list even when they have no gap fields missing.

**Delivers spec reqs:** all four cockpit surfaces, two-tile separation, breached list.

## Phase 4 — Verification & docs · Effort: **S**

- QA pass (hand to **qa** agent): two tiles never merge; 24h math on boundary cases
  (23h59 met / 24h01 breach, never-contacted breach); stalled at exactly 7d; non-sales
  inquiries excluded; real-data (non-sample) check.
- Update `docs/db/data-dictionary.md` interactions/inquiries notes to record the new
  `status_change`(deal) writer and `first_contacted_at` usage.
- PM updates `epic-status.md` / `project-status.html` (product-manager agent).

---

## Effort roll-up

| Phase | Scope | Effort |
|---|---|---|
| 0 | Decisions + research (this doc) | — (done — all 3 decisions CONFIRMED) |
| 1 | Instrumentation writes | M |
| 2 | Pure SLA module | S |
| 3 | Cockpit tiles + breached list + time-in-stage/stalled | M |
| 4 | QA + docs | S |
| **Total** | | **~M+ (roughly 2–3 focused dev days + QA)**; **2×M + 2×S** |

Cross-phase dependency: **1 → 2 → 3**; 4 follows 3. Phase 1 must land first — without the
instrumented history, Phases 2–3 have nothing real to render.

## Testing strategy

No unit harness exists in-repo (no `test` script, no vitest/jest). Therefore: keep all math
in pure `lib/admin/sla.ts`; gate with `next lint` + `next build` (typecheck) in CI; QA does
the boundary + real-data verification in Phase 4. **Optional (recommended, S):** add vitest
scoped to `lib/admin/sla.ts` for the compliance/stalled boundary cases — call before build if
the operator wants automated coverage of the SLA math.

## Explicitly out of scope (per epic)

Email/Slack breach alerting; per-stage SLA targets; removing/retuning the 4h speed-to-lead SLA.
