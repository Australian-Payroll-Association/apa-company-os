# E7 · Native Pricing Engine — Task Checklist (ALL SERVICES)

**Plan:** [`impl-plan.md`](./impl-plan.md) · **Epic:** [E7](../epics.md#e7--native-pricing-engine--front-door-cpq-on-the-deal-new--added-2026-09-01) · **Spec:** [`pricing-model-analysis.md`](../pricing-model-analysis.md)
**Scope:** **ALL services, one delivery** — no Release-1/Release-2 split.
`[P]` = parallelizable · **✓/⚠** = config availability (see impl-plan inventory). **No commits until the operator approves; migrations are additive, applied via Supabase MCP, then recorded in `docs/db/`. No number is ever guessed — a missing rate is a data-gap task, not a filled money field.**

---

## Phase 0: Decisions & blocking inputs (operator)

### Task 0.1: Confirm the pricing config home (H1)
**Description**: Config-as-code (typed TS modules, recommended) vs config-as-data (DB table). Blocks Phase 1/2 file location.
**Acceptance Criteria**:
- [ ] Operator picks A (code) or B (table); default recorded is A.
**Effort**: S · **Dependencies**: None

### Task 0.2 [P]: Confirm proposal-generator scope (H2)
**Description**: In-app token-fill generator (recommended) vs template-only.
**Acceptance Criteria**:
- [ ] Operator picks A or B.
**Effort**: S · **Dependencies**: None

### Task 0.3 [P]: Provide the source pricing workbook (H3 — CRITICAL PATH)
**Description**: The analysis is a logic spec, not a full numeric config; the workbook is **not in the repo**. Supply the OOXML/xlsx (or the missing per-service numbers) so the ⚠ configs can be extracted.
**Acceptance Criteria**:
- [ ] Workbook (or the numbers for each ⚠ service) delivered to the team.
- [ ] Until then, all Phase-2C/2D tasks are BLOCKED.
**Effort**: S (operator) · **Dependencies**: None

### Task 0.4 [P]: Spec the two absent services (⚠⚠)
**Description**: **Leave (review)** and **Super Rem** do not appear in the analysis at all. Provide a product spec (base style, drivers, rates, floor) or confirm they are out of scope.
**Acceptance Criteria**:
- [ ] Each service either specced (→ becomes a config task) or explicitly deferred.
**Effort**: S (operator) · **Dependencies**: None

---

## Phase 1: Pure pricing engine — all base styles (TDD)

### Task 1.1: Define engine types (all styles)
**Description**: `lib/admin/pricing/types.ts` — `ServiceKey` (all services), `BaseStyle` (`banded_per_emp`|`flat`|`day_rate_buildup`|`fixed_by_complexity`), `PricingInputs`, `LineItem`, `PricingResult { memberCents, nonMemberCents, techCents?, breakdown, warnings }`. Cents-only, AUD.
**Acceptance Criteria**:
- [ ] All service keys + all four base styles typed; money is integer cents.
- [ ] `techCents` optional (Remediation tech line). Compiles under `next build`.
**Effort**: M · **Dependencies**: 0.1

### Task 1.2: Failing engine tests from the spec (✓ services + Remediation mechanics)
**Description**: `lib/admin/pricing/engine.test.ts` — vitest fixtures before engine code.
**Acceptance Criteria**:
- [ ] 360: `717×$30=$21,510` base, `MAX(·,$25,000)` floor, modifier stack, NFP −15%, warn entities>5 (no "CHECK", no throw).
- [ ] PayReview: flat $15,000 M / $16,250 NM, $12,500 floor.
- [ ] Award Interpretation: complexity 1–4 → $3,600/$6,000/$12,000/$18,000 M (+ NM).
- [ ] Remediation mechanics: recalc multiplier keys (≤2mo .10 … 24mo+ 1.50 cap) and `tech = months×$3.50×headcount`; `deal_value = fee + tech`.
- [ ] Day-rate build-up shape has a fixture (days × rate). Each test cites its spec value. `npm test` fails (no engine).
**Effort**: L · **Dependencies**: 1.1

### Task 1.3: Implement the engine to green (all styles + Remediation branch)
**Description**: `lib/admin/pricing/engine.ts` — base per style + scope + unit + tiered + `subtotal×(1+Σmodifiers)` + `MAX(floor)`; Remediation branch (multiplier + tech line, deal_value=fee+tech); Member/Non-Member parallel; warn-on-range.
**Acceptance Criteria**:
- [ ] All Task 1.2 tests pass. Pure (no I/O); warns, never throws, never emits "CHECK".
- [ ] Returns integer cents for member, non-member, and (Remediation) tech.
**Effort**: XL · **Dependencies**: 1.2

---

## Phase 2: Per-service config datasets

### Task 2A.1: Encode the ✓ services
**Description**: `lib/admin/pricing/config/{payroll_360,pay_review,award_interpretation}.ts` from the analysis. Explicit member & non-member columns.
**Acceptance Criteria**:
- [ ] Reconcile with Phase-1 tests; 360 floor $25k, PayReview floor $12.5k.
**Effort**: M · **Dependencies**: 1.3

### Task 2B.1: Import the Award Effort Matrix
**Description**: Seed `award_effort_matrix` (122 awards, complexity 1–4) consumed by Award Interpretation. Source = workbook sheet3.
**Acceptance Criteria**:
- [ ] 122 rows loaded (or the real count) with complexity 1–4; Award Interpretation prices from it.
**Effort**: M · **Dependencies**: 0.3, 3.1 (table)

### Task 2C.1: Extract ⚠ partial configs — Compliance Review, Health Check, PayCompliance, Remediation
**Description**: One config-extraction sub-task per service from its named sheet (6/9/8/13). Fill bands, add-ons, per-unit, tiers, modifier subset, floor; Remediation adds the 8-band rates, back-pay base, tech per-month rate.
**Acceptance Criteria**:
- [ ] Each config passes a completeness test (all required fields present) and reconciles against ≥1 worked example.
- [ ] Any still-missing number is left as an explicit `TODO(operator)` gap, not guessed.
**Effort**: L (blocked) · **Dependencies**: 0.3, 1.3

### Task 2D.1: Extract ⚠ day-rate configs — Optimise, BOOT, Tech Procurement, SysImp, STP2, Super, LSL
**Description**: One sub-task per service (sheets 7/11/12/14/15/17/18): the driver→days map and day counts for the `day_rate_buildup` style, member/non-member via the day rates.
**Acceptance Criteria**:
- [ ] Each config reconciles against a worked example from its sheet; missing numbers flagged, not guessed.
**Effort**: L (blocked) · **Dependencies**: 0.3, 1.3

### Task 2E.1: Config the ⚠⚠ services if specced — Leave, Super Rem
**Description**: Only if Task 0.4 specced them: encode configs to the same standard.
**Acceptance Criteria**:
- [ ] Specced services have a passing config; unspecced ones remain out of the "done" gate.
**Effort**: M (blocked) · **Dependencies**: 0.4, 1.3

---

## Phase 3: Schema — CPQ record + Award Matrix + tech line

### Task 3.1: Draft the additive migration SQL
**Description**: `company_os.deal_pricing` (FK → deals, unique deal_id; incl. `tech_total_cents`, override quartet, `engine_version`; `handle_updated_at`) and `company_os.award_effort_matrix` (complexity CHECK 1–4). Additive only.
**Acceptance Criteria**:
- [ ] CPQ holds inputs, breakdown, member/non-member/tech totals, selected figure, currency `'aud'`, warnings, override. FK to deals; no parallel quote table; no new `deals` column.
- [ ] SQL reviewed, **not yet applied**.
**Effort**: M · **Dependencies**: None ([P] with Phase 1)

### Task 3.2: Apply via Supabase MCP + record it
**Description**: Apply via `apply_migration`; record `docs/db/2026-09-01-e7-pricing.sql`; document both tables in `data-dictionary.md`.
**Acceptance Criteria**:
- [ ] Tables exist; migration recorded; dictionary updated.
**Effort**: S · **Dependencies**: 3.1, operator approval to run

---

## Phase 4: Server actions + wiring

### Task 4.1: `saveDealPricing`
**Description**: `revenue/deals/pricing/actions.ts` — run engine, upsert `deal_pricing` (inputs, breakdown, member/non-member/**tech** totals, warnings, engine_version, is_member).
**Acceptance Criteria**:
- [ ] Re-run updates + recomputes; `recordAudit` written; tech line persisted for Remediation.
**Effort**: M · **Dependencies**: 1.3, 3.2

### Task 4.2: `applyPricingToDeal` (incl. Remediation fee+tech)
**Description**: Select member/non-member/override → `deals.amount_cents` via the existing FX path, `currency='aud'`, stamp `pricing_origin='native'`. **Remediation applied value = fee + tech.**
**Acceptance Criteria**:
- [ ] `amount_cents` = selected AUD × 100; `amount_usd_cents`/`fx_rate` refreshed; membership flips the figure; Remediation includes tech.
**Effort**: M · **Dependencies**: 4.1

### Task 4.3: `setPricingOverride`
**Description**: Write override value + reason + "approved by Ross" + timestamp; log attestation; re-apply.
**Acceptance Criteria**:
- [ ] Override persisted + logged; applied value = override when present. No role/workflow added.
**Effort**: S · **Dependencies**: 4.2

---

## Phase 5: Capture UI — Pricing (CPQ) panel, all styles

### Task 5.1: Panel scaffold + service selector (all services)
**Description**: New `admin-card` Pricing panel in `DealManage.tsx` (via `deals/[id]/page.tsx`): all-services selector + membership toggle.
**Acceptance Criteria**:
- [ ] Panel renders; service + membership persist via `saveDealPricing`.
**Effort**: M · **Dependencies**: 4.1

### Task 5.2: Style-aware intake fields + live figures
**Description**: Render drivers by base style (banded headcount / flat / day-rate drivers / complexity picker; Remediation adds recalc-months + WageSafe/headcount). Live Member & Non-Member + tech line + breakdown + warnings.
**Acceptance Criteria**:
- [ ] Changing any field recomputes; warnings non-blocking; figures match the engine for every configured service; Remediation shows the tech line.
**Effort**: XL · **Dependencies**: 5.1

### Task 5.3: Apply + override + legacy state
**Description**: "Use as deal value" (`applyPricingToDeal`), override controls (`setPricingOverride`), legacy flag for deals with no `deal_pricing`/`pricing_origin`.
**Acceptance Criteria**:
- [ ] Apply writes `amount_cents`; override logs; legacy deals flagged, never auto-recomputed.
**Effort**: M · **Dependencies**: 5.2, 4.3

---

## Phase 6: Payroll proposal template + generator

### Task 6.1: Payroll-branded template (with tech line)
**Description**: `docs/templates/proposal-payroll-template.html` — APA-branded `{{TOKEN}}` variant (`austpayroll-brand-guidelines`; `robots noindex`; no em dashes) incl. a Remediation tech-cost token.
**Acceptance Criteria**:
- [ ] Renders standalone with placeholders; APA branding; tech-line token present.
**Effort**: S · **Dependencies**: None ([P])

### Task 6.2: `generateProposal` action (H2-A)
**Description**: Read `deal_pricing`, fill the template, write `public/proposals/<slug>-proposal.html`, set `deals.proposal_url`. (Skip if H2-B.)
**Acceptance Criteria**:
- [ ] Proposal shows the native selected value + line items (+ tech for Remediation); `proposal_url` set.
**Effort**: M · **Dependencies**: 6.1, 4.2

---

## Phase 7: QA, docs & status

### Task 7.1: QA reconciliation pass (qa agent)
**Description**: Per-service reconciliation vs the workbook for every configured service; floors; modifier/NFP; warn-never-block; membership flip; Remediation fee+tech; override log; AUD amounts; legacy untouched. Real (non-sample) data.
**Acceptance Criteria**:
- [ ] Every configured service prices end-to-end in-app; both figures reconcile with the workbook; remaining ⚠/⚠⚠ gaps listed as backlog, not shipped.
**Effort**: M · **Dependencies**: 5.3, 6.2

### Task 7.2 [P]: Docs + status update
**Description**: Confirm migration record + `data-dictionary.md`; **product-manager** updates `epic-status.md` E7 + `project-status.html`, including the ⚠/⚠⚠ backlog.
**Acceptance Criteria**:
- [ ] E7 status reflects shipped services + the outstanding config backlog.
**Effort**: S · **Dependencies**: 7.1
