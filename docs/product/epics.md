# Edge8 — Epics

**Last updated:** 2026-05-18

Thematic bundles of work. Each has a thesis, what is in the bundle, the mechanism by which it earns its place, and the success criterion that says "this epic is done."

For the strategy these epics serve, read [`product.md`](./product.md).

---

## E1 · Services

**Thesis:** The six service pages are the conversion surface for the consulting business. Each one has to answer one buyer's question in two minutes or less.

**Bundle:**
- `/your-first-ai-hire`
- `/ai-capabilities-audit`
- `/caio-leadership`
- `/global-staffing`
- `/training-and-certification`
- `/ai-programs`

**Mechanism:** Each page is a single offer with a single CTA (Typeform consultation). No multi-step funnels. The page either books a meeting or it doesn't.

**Success criterion:** Each service page produces ≥ 1 booked consultation per month from organic traffic by Q3 2026.

---

## E2 · Case Studies

**Thesis:** Case studies are the credential. Consulting buyers do not buy on framework; they buy on proof.

**Bundle:**
- `/case-studies/` index page (does not exist yet)
- Individual case study pages at `/case-studies/[slug]` (route exists, three live: Kyungbang, Veracity, Wink Hotels)
- Cross-links from every service page to relevant case studies
- Featured-case-studies block on home (already live)

**Mechanism:** Case studies convert when buyers can find them. Today they are only discoverable from the home page. The index page makes them browsable. The cross-links make them contextual.

**Success criterion:** ≥ 6 published case studies; index page live; ≥ 30% of consultation bookings cite a specific case study in the Typeform.

---

## E3 · Culture and About

**Thesis:** Mid-market founders buy from people, not firms. The about page is where Dave's lineage does the trust-building before the consultation.

**Bundle:**
- `/about` (live) — Dave's story, mission, partners, contact
- Lineage callouts (Microsoft, Vinasource, TINYpulse) surfaced where credible
- Partner cards (David Niu, Eric Enriquez, Jeff Hu, Bin Yu)
- Contact surface (VN + US numbers, email, LinkedIn)

**Mechanism:** The buyer reads About before they book. About has to do the work of "do I trust this person with my company's AI strategy?"

**Success criterion:** About is the second-most-visited page after home (behind only one service page) by Q3 2026.

---

## E4 · Careers and Talent Network *(new — added 2026-05-18)*

**Thesis:** The Global Staffing pillar needs a candidate funnel. Today, candidates come through Mai Dang's outbound recruiting. A public careers page turns inbound into a sourcing channel and reinforces Edge8 as a serious staffing operation.

**Bundle:**
- `/careers` landing page — pitch to Vietnam-based AI talent
- "Join Our Talent Network" application form (Typeform or in-house)
- Featured open roles section (sourced from active client placements)
- "Why Edge8 over a local employer" content block
- Cross-link from `/global-staffing` page ("we hire talent through →")

**Mechanism:** A public surface accomplishes three things at once: (1) gives Mai Dang a permanent inbound funnel, (2) signals to clients that Edge8 has bench depth, (3) creates a content asset for LinkedIn recruiting campaigns.

**Success criterion:** ≥ 25 qualified applications within 30 days of launch (by 2026-07-15). ≥ 2 placements traceable to the careers page within Q3 2026.

**Out of scope this epic:**
- ATS integration (manual Typeform → Notion pipeline is fine for v1)
- Internal Edge8 full-time hiring (different audience, different page if ever)
- Multi-language (Vietnamese version is a v2 if v1 validates)

---

## E5 · Content and Insights

**Thesis:** The blog feeds the funnel. It is not the business, but without it organic discovery stalls.

**Bundle:**
- `/blog` index (live)
- `/post/[slug]` individual posts (live)
- 24 posts published; cadence is informal
- Cross-promotion via LinkedIn, partner networks
- SEO targeting around "AI Officer", "Tech-Forward", "global AI staffing"

**Mechanism:** Posts that rank for buyer-intent queries drive consultation bookings. Posts that rank for talent-intent queries feed the careers page (E4).

**Success criterion:** ≥ 1 booked consultation per month attributable to organic blog traffic by Q4 2026.

---

## E6 · Lead Conversion

**Thesis:** One CTA, one funnel, measured end-to-end. The Typeform consultation booking is the single conversion event on the entire site.

**Bundle:**
- "Schedule A Consultation" Typeform (live, links from every page)
- Calendar booking after Typeform (Calendly or equivalent)
- Discovery call (Dave personally)
- Post-call follow-up + proposal
- Attribution: which page, which case study, which service drove the booking

**Mechanism:** Single funnel = legible funnel. We can see exactly where prospects drop off and where they convert.

**Success criterion:** ≥ 70% of Typeform submissions become discovery calls; ≥ 30% of discovery calls become signed engagements by Q4 2026.

---

## E7 · Native Pricing Engine — Front Door CPQ on the deal *(new — added 2026-09-01)*

**Status:** ☐ planned — all decisions resolved (2026-09-01); **ready for operator approval → dev-feature-plan / pm-to-issues** (Release-1 slice).

**Thesis:** APA prices every consulting engagement by hand in an Excel calculator, then re-types the number onto the deal — slow, error-prone, and invisible to the audit trail. The logic is fully known: one common engine reused across ~13 services (see [`pricing-model-analysis.md`](./pricing-model-analysis.md)). Bringing it native onto the deal record makes pricing reproducible and auditable, and collapses the spreadsheet round-trip into one in-app step. This is the Front Door's missing pricing spine, built on the deal we already have.

**Bundle:**
- A per-service pricing engine computing deal value from structured drivers: **banded per-employee base fee + flat scope add-ons + per-unit add-ons (awards / EBAs / extra systems) + tiered/stepped lookups (EBA-core, state agreements, entities) + percentage modifiers**, floored at a per-service minimum, with **Member and Non-Member computed in parallel** from the day rates (A$2,400 / A$2,600). Rate tables live as reference **config**, not hard-coded.
- **Dedicated CPQ / quote record, FK to `deals`** (decision, resolved) — the structured pricing lives in its own record linked to the deal, **not** in `deals.metadata`. It holds: the pricing **inputs** (see next bullet), the computed **line-item breakdown**, **both** Member and Non-Member results, the **selected figure**, and the **override** (value + reason + "approved by Ross"). This is the data-dictionary-sanctioned CPQ home ("a future CPQ feature should FK to deals; do not create parallel opportunity or quote tables").
- **New pricing intake fields** captured onto that CPQ record — **membership toggle** (see below), the nine % modifier toggles (in-house, knowledge gap, data quality, manual, ASX, privilege, NFP −15%, NZ, onboarding), and the count drivers (simple/complex award counts, EBA-core, state agreements, entities, pay-code qty, and — Remediation — recalculation-period months). Each field persists on the CPQ record and feeds the engine (changing any field changes the computed value).
- **Membership = manual toggle** (decision, resolved) — the consultant sets a membership flag on the deal's CPQ record; **member → the Member figure becomes the deal value, else the Non-Member figure**. No members-list lookup for now (automated lookup is possible future hardening).
- **Deal value → `deals.amount_cents`** (currency AUD) from the CPQ record's selected Member/Non-Member figure; both figures and the breakdown stay on the CPQ record.
- **Service selection** via `deals.service_line_id` / a service key (Release-1 services below). The **Award Effort Matrix** (122 awards, complexity 1–4) imported as a lookup table — used as the pricing source only for standalone Award Interpretation; **Payroll 360 prices awards by its own simple/complex counts**, not the matrix.
- **Manual-sign-off override** on the CPQ record (override value + reason + "approved by Ross"), a logged attestation — **no new roles, no Ross login, no approval workflow** this epic.
- **Payroll-branded proposal template** (decision, resolved) — **create a payroll variant of `proposal-template.html`** for these proposals (the current one is Edge8/AI-services branded). The priced deal populates it via the `{{TOKEN}}` flow → `public/proposals/` + `deals.proposal_url`.
- **Release-1 slice (the shippable DoD):** Payroll 360 (incl. the A$25,000 floor), PayReview (min A$12,500), Compliance Review, Health Check (min A$25,000).

**Decisions locked** (full detail + rationale in `pricing-model-analysis.md`): 360 minimum floored at $25k · day rates $2,400/$2,600 · 360 EBA/State inputs feed the total · Remediation recalc multiplier keyed on months, capped at 1.50 for ≥24mo · out-of-range inputs **warn, do not block** (never write "CHECK") · Remediation deal value = professional fee **+ WageSafe tech costs** · no GST, only the NFP −15% discount · interim manual-sign-off override · Release-1 = 360 / PayReview / Compliance / Health Check.

**Build-shaping decisions resolved (2026-09-01) — folded into the Bundle above.** No open items remain before build.
1. Pricing record home → **dedicated CPQ/quote record FK to `deals`** (not deals.metadata).
2. Membership source → **manual toggle** on the CPQ record (member → Member pricing; automated members-list lookup deferred as future hardening).
3. Payroll proposal template → **yes, build a payroll-branded variant** of `proposal-template.html`.

**Mechanism:** The deal is already the revenue spine (`amount_cents`, `service_line_id`, `proposal_url`). Pricing becomes structured data in a CPQ record hung off that spine instead of an external workbook, so the value is defensible, the proposal fills from it, and nothing is re-keyed. Reference config keeps a rate change to a config edit; the CPQ record FKs to deals per the "no parallel quote tables" rule.

**Success criterion:** For the four Release-1 services, a consultant prices a live deal end-to-end in-app (no Excel), `deals.amount_cents` auto-populates from the drivers, both Member and Non-Member figures reconcile against `pricing-model-analysis.md`, and the proposal renders the native value — by **2026-10-01**. Legacy Excel-priced deals keep their hand-entered value untouched, flagged "priced in Excel — not natively reproducible."

**Out of scope this epic:**
- The day-rate-only services (Optimise, BOOT, Tech Procurement, SysImp, STP2, Super, LSL) and the Remediation variant (recalc multiplier + WageSafe tech costs) — Release 2, post-Oct.
- Any role/approval workflow for overrides (interim manual sign-off only).
- Recomputing legacy deals (preserved + flagged, never recomputed).
- GST handling (model is ex-GST; a display-time decision, not the engine).

---

## E8 · Speed-to-Deal SLA and Time-in-Stage — Front Door tracking *(new — added 2026-09-01)*

**Status:** ☐ planned — all decisions resolved; **dev-feature-plan done** ([`e8-sla/impl-plan.md`](./e8-sla/impl-plan.md)), which corrected the "derive-only" assumption (see Mechanism). **Ready for operator approval → pm-to-issues.**

**Thesis:** The Front Door promises a fast first call after an enquiry, then a deal that keeps moving. apa-company-os already models speed-to-lead (`lead.sla_due_at`, 4h default) and shows an "SLA overdue" tile on the revenue cockpit — but there is no **24h first-call compliance %**, and no **time-in-stage / stalled** view on the deal pipeline. This epic adds the missing orchestration metrics on top of the SLA machinery that already exists.

**Bundle:**
- **Instrument two lightweight transition writes first** (the metrics' data source does not exist today — code review confirmed nothing writes `status_change` interaction rows and `inquiries` has no timestamp for reaching `contacted`). This is **new application code, not pure dashboard math**, and it is the epic's first build phase — but it needs **no database migration** (it uses columns/kinds already present): (1) stamp `inquiries.metadata.first_contacted_at` the first time an inquiry reaches `contacted`-or-later (idempotent, never overwritten); (2) write a `status_change` `interactions` row (`subject_type='deal'`, `metadata.from_stage/to_stage`, `occurred_at`) on every successful deal stage move.
- **First-call 24h SLA compliance** on the intake record: **met** when the inquiry first reaches `contacted` (or any later status — `qualified` / `won`) within **24 calendar hours** of `inquiries.created_at`, measured against the stamped `first_contacted_at`; breach otherwise. Cockpit shows **compliance % = met ÷ total** over the reporting window, vs the prior window, plus the breach count.
- **Breached list** on the revenue cockpit — each breached enquiry with enough detail to action it (contact, created_at, time-to-first-contact or "never contacted", current status).
- **Time-in-stage** on the deal pipeline: per-deal time since last stage change, from the newly-written `status_change` `interactions` rows (falling back to `deals.created_at` for deals with no stage-change row yet — see history note below). `deals.updated_at` is **not** a valid proxy (it bumps on any edit).
- **Stalled flag:** any **open** deal with no stage change for **7+ days** (single blanket threshold across all stages), surfaced in the cockpit's attention list.
- **Two DISTINCT SLA metrics, side by side** (decision, resolved) — the existing **4-hour speed-to-lead RESPONSE SLA** (`lead.sla_due_at`) stays **exactly as-is**, unchanged and not retuned; E8 adds a **presentation-only 4h tile** that reads the existing `slaOverdue` count (no change to the 4h logic/threshold). The new **24-hour Front Door FIRST-CALL SLA** is a **separate** metric. Both render as **distinctly labelled tiles** — "Speed-to-lead (4h response)" and "Front Door first call (24h)" — so they are never confused or merged.

**Mechanism:** The anchor timestamps exist (`inquiries.created_at`, the inquiry status machine, the deal pipeline), but the **transition history the metrics read is not persisted yet** — so E8 first instruments the two writes above, then derives the metrics from that history. **No schema migration** (reuses the existing `interactions.status_change` kind and `inquiries.metadata` jsonb), but explicitly new application code, sequenced as Phase 1 so a data source exists before the tiles ship. History accrues only **from go-live**: past first-calls are not backfilled, and time-in-stage falls back to `deals.created_at` until a deal's first instrumented stage move.

**Success criterion:** The revenue cockpit shows the 24h first-call compliance % (vs prior window) as a **separate, distinctly labelled** tile from the existing 4h speed-to-lead SLA, a breached list the team can action, per-deal time-in-stage, and a 7-day stalled flag — running on **real (non-sample) data** — by **2026-10-01**. Because the metrics accrue history only from go-live (no backfill), this criterion **depends on shipping the instrumentation soon**; the `deals.created_at` fallback anchor is the interim stopgap so the cockpit is not empty on day one.

**Build-shaping decisions resolved (2026-09-01) — folded into the Bundle above.** No open items remain before build.
1. **SLA reconciliation = distinct metrics** — keep the 4h `lead.sla_due_at` response SLA as-is; **add** a separate 24h Front Door first-call SLA (from `inquiries.created_at` to first `contacted`-or-later, calendar hours). Two independently labelled cockpit tiles; do not merge or retune the 4h one.
2. **First-call timestamp home = `inquiries.metadata.first_contacted_at`** (jsonb, no migration).
3. **Historical first-call compliance = start clean from go-live** — the 24h tile labels its measurement window; past first-calls are **not** backfilled. (Time-in-stage / stalled uses the deal `status_change` history with a `deals.created_at` fallback.)

**Out of scope this epic:**
- Email/Slack breach alerting — in-app cockpit only, until a sending domain is verified.
- Per-stage SLA targets — one 24h first-call SLA and one 7-day stalled threshold only.
- Replacing the existing 4h speed-to-lead SLA (reconciled and surfaced coherently, not removed).

---

## What we are not bundling

- No "social product" epic (we are a services firm, not a community)
- No "SaaS product" epic (AI Officer Institute is the adjacent productized brand, not Edge8)
- No "mobile app" epic (the site is the surface)
- No "internal hiring page" epic (different audience; revisit only if Edge8 needs to scale its own headcount)

If a feature is being designed and it would fit better in one of those bundles, we are drifting.
