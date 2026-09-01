# E7 · Native Pricing Engine — Front Door CPQ on the deal — Implementation Plan

**Epic:** [E7 · Native Pricing Engine — Front Door CPQ on the deal](../epics.md#e7--native-pricing-engine--front-door-cpq-on-the-deal-new--added-2026-09-01)
**Status source:** [epic-status.md](../epic-status.md) (E7 · ☐ 0%)
**Spec:** [`pricing-model-analysis.md`](../pricing-model-analysis.md) (the reverse-engineered engine)
**Author:** Developer (dev-feature-plan)
**Date:** 2026-09-01
**Scope (RE-SCOPED 2026-09-01):** **ALL services, one delivery — no Release-1/Release-2 split.** Every service tab in `pricing-model-analysis.md` (§4), including the Remediation variant.

> Planning artifact only. **No application code and no migration is written or executed by this plan.** Effort is T-shirt (S/M/L/XL). This pass covers the **full engine and every service**; because the engine is config-driven, each service is a **config dataset**, and producing every service's config is the bulk of the work.

---

## Summary of what E7 (all services) delivers

A **native pricing spine on the deal record** covering **every APA consulting service**. A consultant picks any service, enters structured drivers, the config-driven engine computes **Member and Non-Member prices in parallel** (day rates A$2,400 / A$2,600, per-service rate tables, minimum floor), the selected figure lands on `deals.amount_cents` (AUD), and a **payroll-branded proposal** renders the native value. Structured pricing lives in a dedicated **CPQ record FK'd to `deals`**, holding inputs, line-item breakdown, both results, the selected figure, and the manual-sign-off override. The **Remediation** service adds a recalc-period multiplier and a **separate WageSafe tech-cost line** (deal value = fee + tech). No Excel round-trip.

**The central re-scope reality:** `pricing-model-analysis.md` documents the engine **logic** and the **resolved decisions**, but it is **not a complete numeric config for all services**. It fully specifies only **Payroll 360, PayReview, and Award Interpretation**. Every other service has partial numbers (a floor, one band, the mechanics) or none. **The source pricing workbook is not in the repo.** So the largest workstream — and the top risk — is **extracting each service's rate table**, which is **gated on getting the workbook (or operator-supplied numbers)**. The ✓/⚠ inventory below drives the task list.

---

## Service inventory — config availability in the analysis

Legend: **✓** config fully extractable from `pricing-model-analysis.md` today · **⚠** numbers missing or partial → data-gap task (needs the workbook or operator data; **do not guess**).

| Service (sheet) | Base style | Status | What the analysis gives / what is missing |
|---|---|---|---|
| **Payroll 360** (5) | banded /emp (7 bands) | **✓** | Full: bands 90/48/30/18/14/12/12, scope add-ons, per-unit ($18k/$24k awards), EBA/State/Entity tiers, 9-modifier stack, **$25k floor** (resolved). Reference engine. |
| **PayReview** (10) | flat | **✓** | Full: $15,000 M / $16,250 NM (≤500 emps), **$12,500 floor**, modifiers In-house +15% / Knowledge +10% / Data +15%. |
| **Award Interpretation** (16) | fixed by complexity 1–4 | **✓** | Full: complexity→fee table (§2) $3,600/$6,000/$12,000/$18,000 M (+ NM). Consumes the **Award Effort Matrix** (now in scope). |
| **Compliance Review** (6) | banded /emp (7 bands) | **⚠** | Partial: only one band rate ($30/emp for 0–200), Simple award $24k, EBA `IF`-tier shape. **Full 7-band table + remaining per-unit + min not extracted.** |
| **Health Check** (9) | banded /emp | **⚠** | Only the **$25,000 floor**. Bands, award prices, modifier subset **not extracted**. |
| **PayCompliance** (8) | banded /emp, award-effort driven | **⚠** | Only the **$15,000 floor** + "EA effort defined by Award". Bands + effort mapping **not extracted**. |
| **Remediation** (13) | banded /emp (8 bands) + variant | **⚠** | Mechanics resolved: recalc multiplier (≤2mo .10 / 3mo .25 / 6mo .50 / 12mo 1.00 / 24mo+ capped 1.50), WageSafe = months×$3.50×headcount (tech line), 8 band breakpoints, back-pay `MIN(count×20%,1000%)`. **Missing: full 8-band /emp rates (only $60 first band), back-pay base, tech per-month licence rate, modifier rates.** |
| **Optimisation Review** (7) | day-rate build-up | **⚠** | "Smaller calculator", day-rate family confirmed. **No day counts / drivers / numbers.** |
| **BOOT Evaluation** (11) | day-rate build-up + awards | **⚠** | Family confirmed, "Awards, subset". **No numbers.** |
| **Technology Procurement** (12) | day-rate build-up | **⚠** | Family confirmed. **No numbers.** |
| **System Implementation Support** (14) | day-rate build-up | **⚠** | Family confirmed. **No numbers.** |
| **STP2 Review** (15) | day-rate build-up | **⚠** | Family confirmed. **No numbers.** |
| **Super Review** (17) | day-rate build-up | **⚠** | Family confirmed. **No numbers.** |
| **LSL Review** (18) | day-rate build-up | **⚠** | Family confirmed. **No numbers.** |
| **Leave (review)** | unknown | **⚠⚠** | **Not present in the analysis at all.** Needs a full spec (workbook sheet or operator). |
| **Super Rem** | remediation-family (assumed) | **⚠⚠** | **Not present in the analysis at all.** Likely a Remediation-style variant; needs a full spec. |

**Tally: 3 ✓ · 11 ⚠ (partial/day-rate) · 2 ⚠⚠ (absent from the analysis).** Only 3 services can be built config-complete from the docs in hand today.

---

## Phase 0 — Outline, research & pre-planning decisions

### Ground truth verified in code (unchanged from the first pass)

| Concern | Ground truth (file) |
|---|---|
| Deal value | `deals.amount_cents` (int8) in `deals.currency` (text, default `'usd'`) + derived `amount_usd_cents`/`fx_rate`. Money is **cents, never floats** (`data-dictionary.md:18`). |
| Setting the amount | `updateDeal` / `setDealAmount` in `revenue/deals/actions.ts` — writes `amount_cents`, then re-fetches FX (`convertToUsdCents`, `lib/admin/fx.ts`) best-effort. **Reused** so AUD deals get correct USD reporting. AUD deal = `currency='aud'`, `amount_cents` = AUD × 100. |
| Service selection | `deals.service_line_id` → `company_os.service_lines`. All E7 services map to a service key + (optionally) a `service_lines` row. |
| CPQ home (sanctioned) | `data-dictionary.md:167` — "do not create parallel opportunity or quote tables; a future CPQ feature should FK to deals." → `deal_pricing` FK to `deals`. |
| Deal record UI | `DealManage.tsx` (deal detail, `admin-card admin-section-card` sections) via `deals/[id]/page.tsx`; `DealFields.tsx` editors. |
| Proposal today | `deals.proposal_url` is a **hand-typed URL**; `docs/templates/proposal-template.html` is an **Edge8-branded** `{{TOKEN}}` file copied by hand. **No in-app generator exists.** |
| Test harness | **vitest installed** (`"test": "vitest run"`) and used (`lib/admin/sla.test.ts`). → engine built **TDD**. |
| Migration convention | No `supabase/migrations/` dir. Migrations applied via **Supabase MCP** (`apply_migration`), **additive-only**, recorded as a dated `docs/db/*.sql`, documented in `docs/db/data-dictionary.md`. |
| **Source workbook** | **Not in the repo** (no `.xlsx` anywhere). The analysis was reverse-engineered from an OOXML extract that is not committed. **Required input to close the ⚠ data-gaps.** |

### Engine shape — must support ALL base styles

The one engine is now config-driven across **four base styles** plus the Remediation variant:

```
base = { banded_per_emp | flat | day_rate_buildup | fixed_by_complexity }   # per service config
+ scope_addons (flat, "Yes" toggles)
+ unit_addons  (count × price; first-system-free; pay-code bands)
+ tiered       (EBA-core / state / entities stepped lookups)
= subtotal
× (1 + Σ percentage_modifiers)                       # per-service subset; NFP −15%
= fee
fee = MAX(fee, minimum_floor)                        # where a floor applies
--- Remediation only ---
fee = fee × recalc_period_multiplier(months)         # ≤2mo .10 … 24mo+ capped 1.50
tech_line = months × $3.50 × headcount (+ licence per-month)   # separate total
deal_value = fee + tech_line                         # tech shown as its own breakdown line
```

Every service computes **Member ($2,400/day column)** and **Non-Member ($2,600/day column)** in parallel; **non-member flat/unit prices are stored explicitly** (not ×1.083). Out-of-range → **WARN**, never block, never "CHECK". The **Award Effort Matrix** (122 awards, complexity 1–4) is imported and consumed by **Award Interpretation** (and available to any award-effort-driven service, e.g. PayCompliance).

### HIGH finding H1 — pricing **config home** (operator nod; recommendation set)

Config-as-code (typed TS modules, **recommended** — pure/testable engine, git-reviewed rate changes, no migration per rate edit) vs config-as-data (DB table). **With ~13 service configs and ongoing rate edits, code keeps the engine unit-testable against the spec and every change reviewed.** Recommend **config-as-code**; DB-table option kept as later hardening. One operator nod unblocks Phase 1.

### HIGH finding H2 — proposal generator is **net-new** (scope decision)

No code fills the proposal today. Recommend a **minimal in-app token-fill generator** (reads `deal_pricing`, fills a payroll-branded template, writes `public/proposals/…`, sets `proposal_url`); down-scope path is template-only/manual fill. Recommend the generator.

### HIGH finding H3 (NEW, dominant) — the analysis is **not a full numeric config**; the **workbook is required**

Only 3 of ~16 services are config-complete from the docs. The rest need rate-table extraction from the **source workbook**, which **is not in the repo**. This is the critical-path dependency and the biggest schedule risk. **Resolution:** treat every ⚠ service as an explicit **config-extraction task** with a named source (workbook sheet N), and **block those tasks on the operator providing the workbook (or the numbers)**. The engine and the 3 ✓ services proceed immediately; ⚠ configs land as the data arrives. The two ⚠⚠ services (Leave, Super Rem) are **absent from the analysis** and need a product spec before any config work.

### Legacy deals

Native pricing applies only to new/re-priced deals. Legacy Excel-priced deals **keep their hand-typed `amount_cents`**, flagged **"priced in Excel — not natively reproducible"** via `deals.metadata.pricing_origin` (jsonb, no migration). Never recomputed.

### Risks & mitigations

| Risk | Mitigation |
|---|---|
| **⚠ configs are un-extractable without the workbook (H3)** — 11 partial + 2 absent services. | Each ⚠ service is its own task, blocked on the workbook/operator; the build ships the engine + 3 ✓ services first, then adds configs as data lands. **No number is guessed** — a missing value fails the service's config-completeness test, not the money field. |
| **Two services (Leave, Super Rem) not in the analysis.** | Flagged ⚠⚠; require a product spec from the operator before any config task; excluded from the engine's "done" gate until specced. |
| **Day-rate build-up style undefined numerically** for 7 services. | New `day_rate_buildup` config shape (driver→days map × day rate); each such service's day counts come from the workbook. Engine supports the style; the numbers are data-gap tasks. |
| **Remediation variant complexity** — multiplier + separate tech line + deal value = fee + tech. | Mechanics are resolved in the spec; engine models the tech line as a first-class breakdown item and `deal_pricing` stores fee and tech separately; only the band rates/back-pay base are data-gaps. |
| **Non-member ≠ member × 1.083** for flat/unit prices. | Config stores explicit member & non-member columns everywhere. |
| **360 floor** (Excel omitted the `MAX`; resolved to enforce). | Engine applies `MAX(subtotal,$25k)` for 360; pinned by a test. |
| **AUD FX on save** (flaky/offline). | Reuse the existing best-effort/non-blocking FX path; `amount_cents` in AUD is the source of truth. |
| **Config home (H1)** unresolved before Phase 1. | Recommendation set; one nod unblocks. |
| **No migration tooling.** | Follow the `docs/db/` convention: additive, MCP-applied, dated record, dictionary update. No DROP/TRUNCATE/DELETE. |

---

## Phase 1 — Pure pricing engine, all base styles (TDD) · Effort: **XL**

The config-driven core supporting **all four base styles + the Remediation variant**, built test-first against the 3 fully-specified services. No DB, no UI. Depends on **H1**.

- `lib/admin/pricing/types.ts` — `ServiceKey` (all services), `BaseStyle` (`banded_per_emp` | `flat` | `day_rate_buildup` | `fixed_by_complexity`), `PricingInputs`, `LineItem`, `PricingResult { memberCents, nonMemberCents, techCents?, breakdown, warnings }`.
- `lib/admin/pricing/engine.ts` — pure `priceService(serviceKey, inputs, config)`: base (per style) + scope + unit + tiered + `subtotal×(1+Σmodifiers)` + `MAX(floor)`; Remediation branch (recalc multiplier + tech line, `deal_value = fee + tech`); Member/Non-Member parallel; warn-on-range; integer cents.
- `lib/admin/pricing/engine.test.ts` — vitest reconciliation for the 3 ✓ services: 360 (`717×$30=$21,510`, $25k floor, modifier stack, NFP −15%, warn entities>5), PayReview (flat $15k/$16.25k, $12.5k floor), Award Interpretation (complexity 1–4 table); plus a Remediation **mechanics** test (multiplier keying + tech-line formula) using the resolved numbers even before its bands land.

**Delivers:** the universal engine; all four base styles + Remediation mechanics, verified numerically on every service whose numbers exist.

## Phase 2 — Per-service config datasets (the bulk) · Effort: **XL** (operator-gated)

Produce a config entry for **every** service. Split by availability.

- **2A — ✓ services (encode now):** `lib/admin/pricing/config/{payroll_360,pay_review,award_interpretation}.ts` from the analysis; each covered by Phase-1 tests.
- **2B — Award Effort Matrix import:** `award_effort_matrix` table + seed (122 awards, complexity 1–4) — needed by Award Interpretation. Source data required (workbook sheet3); if unavailable, a data-gap task.
- **2C — ⚠ partial services (extract from workbook):** Compliance Review, Health Check, PayCompliance, Remediation — one config-extraction task each, sourced from the named sheet; blocked on the workbook/operator. Each ships with a completeness test; a missing number blocks that service only.
- **2D — ⚠ day-rate services (extract driver→day maps):** Optimise, BOOT, Tech Procurement, SysImp, STP2, Super, LSL — one task each; blocked on the workbook.
- **2E — ⚠⚠ absent services:** Leave, Super Rem — **need a product spec first** (operator); no config until specced.

**Delivers:** a config for every service that has data; an explicit, itemised list of what is still blocked.

## Phase 3 — Schema: CPQ record + Award Matrix + tech line · Effort: **M**

Additive migration via Supabase MCP; recorded `docs/db/2026-09-01-e7-pricing.sql`; documented in `data-dictionary.md`.

- **`company_os.deal_pricing`** (CPQ, **FK → deals**, unique `deal_id`): `service_key` (CHECK across all E7 keys), `is_member`, `inputs jsonb`, `breakdown jsonb`, `member_total_cents`, `non_member_total_cents`, **`tech_total_cents`** (Remediation tech line), `selected_total_cents`, `currency` default `'aud'`, `warnings jsonb`, override quartet (`override_cents/reason/approved_by/at`), `engine_version`, `created_at`/`updated_at` (`handle_updated_at`).
- **`company_os.award_effort_matrix`**: `award_code` unique, `award_name`, `complexity` CHECK 1–4, `note`, `interpreted` — imported (Phase 2B), consumed by Award Interpretation.
- **No new `deals` column**; legacy flag on `deals.metadata.pricing_origin`.

## Phase 4 — Server actions + wiring (incl. Remediation tech) · Effort: **M**

`revenue/deals/pricing/actions.ts`: `saveDealPricing` (run engine, upsert row incl. `tech_total_cents`); `applyPricingToDeal` (select member/non-member/override → `deals.amount_cents` via the reused FX path, `currency='aud'`, stamp `pricing_origin='native'`; **for Remediation the applied value = fee + tech**); `setPricingOverride` (logged attestation, re-apply).

## Phase 5 — Capture UI: Pricing (CPQ) panel, all styles · Effort: **XL**

A Pricing `admin-card` panel on the deal record (`DealManage.tsx` / `deals/[id]/page.tsx`, reusing `DealFields.tsx`): service selector (**all services**) + membership toggle; **style-aware driver fields** (banded headcount / flat / day-rate drivers / complexity picker; Remediation adds recalc-period months + WageSafe/headcount → tech line); live Member & Non-Member + tech line + breakdown + warnings; "Use as deal value" and override; legacy-deal flag state.

## Phase 6 — Payroll proposal template + generator · Effort: **M**

`docs/templates/proposal-payroll-template.html` (APA-branded via `austpayroll-brand-guidelines`, `robots noindex`, no em dashes) + pricing tokens incl. a **tech-cost line** for Remediation; `generateProposal(dealId)` fills it → `public/proposals/…` → `deals.proposal_url` (H2-A).

## Phase 7 — QA, docs & status · Effort: **M**

Per-service reconciliation vs the workbook for **every** service that has a config; floor boundaries; modifier/NFP; warn-never-block; membership flip; Remediation fee+tech; override log; AUD amounts; legacy untouched. Record the migration + update `data-dictionary.md`; **product-manager** updates `epic-status.md` / `project-status.html`, including the remaining ⚠/⚠⚠ backlog.

---

## Effort roll-up & realistic estimate

| Phase | Scope | Effort |
|---|---|---|
| 0 | Decisions + inventory (this doc) | — (done; **H1 nod + H3 workbook needed**) |
| 1 | Engine, all base styles (TDD) | **XL** |
| 2 | Per-service configs (3 ✓ now; 11 ⚠ + 2 ⚠⚠ operator-gated) | **XL** (mostly operator-gated) |
| 3 | Schema (deal_pricing + matrix + tech line) | **M** |
| 4 | Server actions + wiring (incl. tech) | **M** |
| 5 | Capture UI, all styles | **XL** |
| 6 | Payroll proposal + generator | **M** |
| 7 | QA + docs | **M** |

**Realistic total ≈ 3×XL + 4×M ≈ 20–30 focused dev days**, and the schedule is **gated on data, not code**: the engine + infra + UI + the 3 ✓ services are ~2–2.5 weeks; the remaining **~13 service configs are bounded by workbook access and operator confirmations** (each config is small once the numbers exist, but there is no shipping them without the numbers). A same-day "all services live" is not achievable while the workbook is missing and two services are unspecified.

**Dependencies:** `1 → {2,3}`; `4` needs `1+2+3`; `5` needs `4`; `6` needs `4`; `7` last. Phase 2's ⚠/⚠⚠ tasks are blocked on H3 (workbook) and the Leave/Super-Rem specs. Recommended path: ship engine + 3 ✓ services + full infra/UI first, then land each ⚠ config behind it as data arrives (the config-driven design makes each addition incremental).

## Testing strategy

vitest, test-first (`dev-tdd`). Each engine test cites the spec value it reconciles. Every service config carries a completeness test (all required fields present) and a reconciliation test once its numbers exist; a missing number fails that service's test rather than emitting a bad price. Phases 4–6 gate on `next lint` + `next build`; Phase 7 QA reconciles per service on real (non-sample) deals.

## Kept resolved decisions (unchanged by the re-scope)

CPQ record FK to deals · manual membership toggle · payroll-branded proposal template · warn-on-range (never "CHECK") · legacy flag "priced in Excel — not natively reproducible" · Member/Non-Member $2,400/$2,600 · 360 $25,000 floor · Remediation recalc multiplier (capped 1.50 at 24mo+) and deal value = fee + WageSafe tech · interim manual-sign-off override (no role/login/workflow) · GST out (ex-GST model).
