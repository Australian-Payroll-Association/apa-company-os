# E8 · Speed-to-Deal SLA + Time-in-Stage — Task Checklist

Dependency-ordered. Each task is startable without re-reading the spec. `[P]` = can run in
parallel with its siblings. See [impl-plan.md](./impl-plan.md) for rationale, decisions, and
risks.

**Phase 0 decisions are CONFIRMED (operator, 2026-09-01) — no open flags. Build may start at
Phase 1.** Settled: (1) first-call timestamp home = `inquiries.metadata.first_contacted_at`;
(2) historical first-call = **start clean, no backfill**; (3) add a presentation-only 4h tile
(firm). Full detail in impl-plan.md Phase 0.

---

## Phase 1: Instrumentation — make the transition history exist

### Task 1.1: Emit a `status_change` interaction on deal stage moves
**Description**: In `app/admin/(dashboard)/revenue/deals/actions.ts` `moveDealStage`, after a
successful stage update, insert one `interactions` row `{ kind:'status_change',
subject_type:'deal', subject_id:dealId, person_id, company_id, occurred_at:now,
metadata:{ from_stage, to_stage } }`. No schema change (kind + subject_type already valid).
**Acceptance Criteria**:
- [ ] Every successful `moveDealStage` writes exactly one `status_change` row with `occurred_at=now`
- [ ] The row does NOT appear in `getDealCommunications` (already filtered via `AUTO_INTERACTION_KINDS`)
- [ ] A failed/blocked move (won without amount, lost without reason) writes no row
- [ ] `next build` typechecks; `next lint` clean
**Effort**: S
**Dependencies**: None

### Task 1.2: Stamp inquiry first-contact time into `inquiries.metadata.first_contacted_at`
**Description**: In `app/admin/(dashboard)/revenue/inquiries/actions.ts`, when
`moveInquiryStatus`/`promoteInquiryToLead` moves an inquiry to `contacted`-or-later for the
first time, set `inquiries.metadata.first_contacted_at = now` (jsonb merge, no schema change,
confirmed decision #1). Idempotent — never overwrite an existing stamp.
**Acceptance Criteria**:
- [ ] First transition to `contacted`/`qualified`/`discovery_call`/`proposal`/`won` sets `metadata.first_contacted_at` once
- [ ] A second/later transition does not overwrite the original stamp
- [ ] Moves to non-contacted terminal states (`spam`/`no_action`/`archived`) do not stamp
- [ ] Satisfies spec: first-call SLA measurable from `created_at` → `metadata.first_contacted_at`
**Effort**: M
**Dependencies**: None

> **Backfill task removed** — operator confirmed **start clean, no backfill** (decision #2).
> Compliance is computed only from go-live forward; the 24h tile labels its window (Task 3.2).
> The `deals.created_at` fallback anchor for time-in-stage (Task 3.4) is the documented interim.

---

## Phase 2: SLA calculation module

### Task 2.1: Create pure `lib/admin/sla.ts`
**Description**: Add a pure (no-I/O) module: `firstCallCompliance(inquiries, windowStart,
windowEnd)` → `{ met, total, pct, breaches[] }` (met = first-contact within 24 calendar hours
of `created_at`); `timeInStage(nowMs, lastStageChangeMs)`; `isStalled(gapMs)` → `gap ≥ 7*MS_DAY`.
Reuse `MS_DAY` from `lib/admin/dashboard-helpers.ts`.
**Acceptance Criteria**:
- [ ] 23h59 after create counts as met; 24h01 counts as breach (calendar hours, UTC millis)
- [ ] "Never contacted" inquiries count as breach with `hoursToContact = null`
- [ ] `isStalled` true at exactly 7 days and beyond, false below
- [ ] `breaches[]` carries contact, `created_at`, `hoursToContact|null`, current status
- [ ] Module imports nothing from `next`/supabase (pure)
**Effort**: S
**Dependencies**: None (can start alongside Phase 1; wired in Phase 3)

### Task 2.2 `[P]`: (Optional) Vitest coverage for `sla.ts`
**Description**: If operator wants automated coverage, add vitest + a `test` script and cover
the boundary cases in Task 2.1. Otherwise rely on typecheck + QA.
**Acceptance Criteria**:
- [ ] Boundary tests (met/breach/never-contacted/stalled) pass, OR task closed as "deferred"
**Effort**: S
**Dependencies**: Task 2.1

---

## Phase 3: Cockpit surfaces

### Task 3.1: Query first-call + stage-change data in the cockpit
**Description**: In `app/admin/(dashboard)/revenue/page.tsx`, add to the `Promise.all`: sales
inquiries (reuse `NON_SALES_INQUIRY_TYPES` filter) across reporting + prior windows with their
first-contact stamp; and latest `status_change.occurred_at` per open deal (fall back to
`deals.created_at` where none exists).
**Acceptance Criteria**:
- [ ] Non-sales inquiry types excluded from first-call counts
- [ ] Each open deal gets a `lastStageChangeAt` (real or `created_at` fallback)
- [ ] Existing `slaOverdue` / deals queries and behaviour unchanged
**Effort**: M
**Dependencies**: Task 1.1, Task 1.2, Task 2.1

### Task 3.2: Add the two distinct SLA tiles (both firm)
**Description**: In the Sales KPI grid of `revenue/page.tsx`, render two `MetricCard`s:
"Speed-to-lead (4h response)" — **firm, presentation-only** tile that reads the existing
`slaOverdue` count (confirmed decision #3; the 4h SLA logic/threshold stays untouched) — and
"Front Door first call (24h)" (`pct` with `vsPrior` delta, breach count in `sub`, and a label
naming the measurement window since compliance is measured from go-live forward).
**Acceptance Criteria**:
- [ ] Two separate, distinctly-labelled tiles; neither merges the other's number
- [ ] 4h tile changes no SLA threshold/logic (still `lead.sla_due_at`); presentation only
- [ ] 24h tile shows compliance % vs prior window + breach count, and labels its window (spec req)
**Effort**: S
**Dependencies**: Task 3.1

### Task 3.3: Add the breached first-call list card
**Description**: Add a cockpit card (mirror "Leads to work" list markup) listing breached
enquiries: name/email, `created_at`, time-to-first-contact or "never contacted", current status;
each links to `/admin/contacts/[id]`.
**Acceptance Criteria**:
- [ ] Every breached enquiry in-window is actionable from the card
- [ ] "Never contacted" rendered distinctly from a late-but-contacted breach
- [ ] Empty state when there are no breaches
**Effort**: S
**Dependencies**: Task 3.1

### Task 3.4: Surface time-in-stage + stalled on the deal attention list
**Description**: Extend `CockpitDeal` (in `revenue/page.tsx` mapping) and `CockpitDeals.tsx`
with `timeInStage` + `stalled`; add an "In stage" column and a stalled `Badge` (tone via
`lib/admin/stageColors.ts` conventions). Ensure stalled open deals appear in the attention list
even if they have no missing owner/value/next-step/date gap.
**Acceptance Criteria**:
- [ ] Each open deal shows human time-in-stage (e.g. "6d")
- [ ] Any open deal with no stage change for 7+ days shows a stalled badge and is in the attention list
- [ ] `deals.updated_at` is NOT used as the stage anchor (only `status_change`/`created_at`)
**Effort**: M
**Dependencies**: Task 3.1, Task 2.1

---

## Phase 4: Verification & docs

### Task 4.1: QA pass (qa agent)
**Description**: Verify two-tile separation, 24h boundary cases, never-contacted breach,
stalled at exactly 7 days, non-sales exclusion, and that numbers reflect real (non-sample) data.
**Acceptance Criteria**:
- [ ] All spec success-criterion surfaces present and correct on the cockpit
- [ ] Boundary cases behave per Task 2.1 criteria
- [ ] Verified against a real/non-sample dataset
**Effort**: S
**Dependencies**: Task 3.2, Task 3.3, Task 3.4

### Task 4.2 `[P]`: Update data dictionary + epic status
**Description**: Record the new `status_change`(subject_type='deal') writer and
`inquiries.metadata.first_contacted_at` usage in `docs/db/data-dictionary.md`; PM updates
`epic-status.md` / `project-status.html`.
**Acceptance Criteria**:
- [ ] Data dictionary reflects the new writers/fields
- [ ] E8 status/progress updated by product-manager
**Effort**: S
**Dependencies**: Task 4.1
