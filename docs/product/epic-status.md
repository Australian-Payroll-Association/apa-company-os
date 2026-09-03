# Edge8 — Epic Status Dashboard

**Last updated:** 2026-09-01
**Phase in flight:** Front Door on the deal spine — native pricing (E7) and SLA/time-in-stage tracking (E8)

Status glyphs: 🔄 in flight · ✅ done · ⏳ partially done · ☐ planned · 🛑 paused

---

## At a glance

| Epic | Status | % done (est) | Notes |
|---|---|---|---|
| [E1 · Services](./epics.md#e1--services) | ✅ | 90% | All 6 service pages live; missing case-study cross-links and per-page conversion tracking |
| [E2 · Case Studies](./epics.md#e2--case-studies) | ⏳ | 40% | 3 case studies live; `[slug]` route works; no `/case-studies/` index page; need ≥ 3 more published |
| [E3 · Culture and About](./epics.md#e3--culture-and-about) | ✅ | 85% | About page live with story, partners, mission, contact; could add lineage callouts on service pages |
| [E4 · Careers and Talent Network](./epics.md#e4--careers-and-talent-network--new--added-2026-05-18) | ☐ | 0% | **Today's new epic.** Page does not exist. Target launch 2026-06-15. |
| [E5 · Content and Insights](./epics.md#e5--content-and-insights) | ✅ | 80% | Blog live, 24 posts published; no editorial calendar; SEO not instrumented |
| [E6 · Lead Conversion](./epics.md#e6--lead-conversion) | ⏳ | 60% | Typeform CTA live on every page; no end-to-end funnel measurement; no attribution by source page |
| [E7 · Native Pricing Engine](./epics.md#e7--native-pricing-engine--front-door-cpq-on-the-deal-new--added-2026-09-01) | ☐ | 0% | **New (2026-09-01), re-based onto apa-company-os.** ALL decisions resolved (7 pricing + 4 grill + 3 build-shaping). CPQ record FK to deals; membership = manual toggle; payroll proposal template variant. Release-1 slice (360/PayReview/Compliance/Health Check) target 2026-10-01. **Ready for operator approval → dev-feature-plan / pm-to-issues.** |
| [E8 · Speed-to-Deal SLA + Time-in-Stage](./epics.md#e8--speed-to-deal-sla-and-time-in-stage--front-door-tracking-new--added-2026-09-01) | ☐ | 0% | **New (2026-09-01). dev-feature-plan done.** ALL decisions resolved. SLA reconciliation = **distinct metrics** (keep 4h `lead.sla_due_at` as-is, ADD a separate 24h first-call SLA; two labelled tiles). Plan corrected the "derive-only" assumption: needs **two instrumentation writes** (stamp `inquiries.metadata.first_contacted_at`; write `status_change` on deal moves) — new code, **no migration**. History accrues from go-live. **Ready for operator approval → pm-to-issues.** |

---

## Drilldown

### E1 · Services — ✅ 90%

**What's done:** All six service pages live at their canonical routes. Nav dropdown groups them. Each page has a Typeform CTA.

**What's missing:** Per-page conversion tracking. Cross-links from service pages to relevant case studies (e.g., AI Programs page should link to Wink Hotels / Veracity / Kyungbang case studies).

**Definition of done:** Each page produces ≥ 1 booked consultation per month from organic traffic by Q3 2026.

---

### E2 · Case Studies — ⏳ 40%

**What's done:** Three case studies (Kyungbang, Veracity, Wink Hotels) featured on home. `/case-studies/[slug]` dynamic route exists and renders.

**What's missing:**
- `/case-studies/` index / listing page — does not exist
- Additional case studies — only three published
- Cross-links from service pages
- "Cite which case study brought you" field on the Typeform

**Definition of done:** ≥ 6 case studies live; index page exists; ≥ 30% of consultation bookings cite a specific case study.

---

### E3 · Culture and About — ✅ 85%

**What's done:** `/about` page live with Dave's story, mission, four partner cards, contact section (email, VN phone, US phone, LinkedIn).

**What's missing:** Lineage callouts (Microsoft, TINYpulse) surfaced on service pages where relevant. Optional: short video intro on About.

**Definition of done:** About is the second-most-visited page after home (behind one top service page) by Q3 2026.

---

### E4 · Careers and Talent Network — ☐ 0%

**Today's new epic.** Page does not exist.

**What's missing:** Everything.

**Definition of done:** Page live by 2026-06-15. ≥ 25 qualified applications within 30 days of launch. ≥ 2 placements traceable to the careers page within Q3 2026.

**Open questions before build:**
1. Application form: Typeform or in-house? (Recommend Typeform v1.)
2. Open roles: hard-coded list or sourced from a Notion / Airtable? (Recommend Notion → JSON for v1.)
3. Brand voice: English-only v1 or Vietnamese version at launch? (Recommend English-only v1; revisit after first 25 applications.)

---

### E5 · Content and Insights — ✅ 80%

**What's done:** `/blog` and `/post/[slug]` live. 24 posts published. Posts are linked from home page footer block.

**What's missing:** Editorial calendar. SEO instrumentation. Tracking which posts drive consultations vs. which drive talent applications.

**Definition of done:** ≥ 1 booked consultation per month attributable to organic blog traffic by Q4 2026.

---

### E6 · Lead Conversion — ⏳ 60%

**What's done:** "Schedule A Consultation" Typeform linked from nav, hero, service pages, and footer. Single CTA across the site.

**What's missing:** End-to-end measurement (Typeform → calendar → discovery call → signed engagement). Source-page attribution. No CRM of record (Notion? HubSpot? TBD).

**Definition of done:** ≥ 70% of Typeform submissions become discovery calls; ≥ 30% of discovery calls become signed engagements by Q4 2026.

---

### E7 · Native Pricing Engine — ☐ 0%

**New epic (2026-09-01).** Re-based onto apa-company-os from the demo-sydney drafts. The pricing business logic is portable and unchanged; every acceptance criterion that referenced demo-sydney specifics was re-mapped onto apa-company-os's real architecture:

| Demo-sydney reference | apa-company-os equivalent |
|---|---|
| typed deal value | `deals.amount_cents` / `amount_usd_cents` (AUD) |
| post-call checklist + `people.attributes` | new pricing intake fields on `deals.metadata` jsonb, or a CPQ record FK to deals |
| service scope | `deals.service_line_id` / service key + reference config tables |
| `/admin/proposal/[contactId]` | `{{TOKEN}}` proposal template → `public/proposals/` + `deals.proposal_url` |
| activity_log audit | `interactions` (kind='status_change', subject_type='deal') |

**What's done:** Planning only. All 7 pricing decisions and 4 grill items resolved (see `pricing-model-analysis.md`).

**What's missing:** Everything (no code). Schema/field additions confirmed: per-service pricing **config** (reference tables); a per-deal **CPQ/quote record FK to `deals`** (holds inputs, breakdown, both Member/Non-Member, selected figure, override); the new intake fields on that CPQ record; the Award Effort Matrix lookup; and a **payroll-branded variant of the proposal template**. Legacy deals flagged, not recomputed.

**Definition of done:** Release-1 services (Payroll 360, PayReview, Compliance Review, Health Check) priced end-to-end in-app, `deals.amount_cents` auto-populated, Member/Non-Member reconciling against the spec, payroll proposal rendering the native value — by 2026-10-01.

**Decisions resolved (2026-09-01) — no open items before build:**
1. Pricing record home → **dedicated CPQ/quote record FK to `deals`** (not deals.metadata).
2. Membership source → **manual toggle** on the CPQ record (member → Member pricing; members-list lookup deferred).
3. Payroll proposal template → **build a payroll-branded variant** of `proposal-template.html`.

**Gate:** Ready for operator approval → dev-feature-plan / pm-to-issues (Release-1 slice).

---

### E8 · Speed-to-Deal SLA + Time-in-Stage — ☐ 0%

**New epic (2026-09-01).** Extends the revenue cockpit, which already renders an "SLA overdue" note off `lead.sla_due_at` (4h speed-to-lead). **dev-feature-plan complete** — see [`e8-sla/impl-plan.md`](./e8-sla/impl-plan.md).

**What's done:** Planning + dev-feature-plan. SLA rules resolved (first call = reaching `contacted`-or-later within 24 calendar hours; 7-day blanket stalled threshold); three build decisions resolved.

**What's missing (corrected by the plan):** The metrics do **not** derive from existing columns as first assumed — code review found nothing writes `status_change` interaction rows and `inquiries` has no first-contact timestamp. E8 must first **instrument two lightweight transition writes** (stamp `inquiries.metadata.first_contacted_at`; write a `status_change` interaction on deal stage moves) — **new application code, still NO database migration** — then build the 24h compliance %, breached list, per-deal time-in-stage, and 7-day stalled flag on the cockpit. Metrics accrue history only from go-live and must exclude non-real/sample data.

**Definition of done:** Cockpit shows the 24h first-call compliance % (vs prior window) as a **distinct tile from the existing 4h speed-to-lead SLA**, an actionable breached list, per-deal time-in-stage, and a 7-day stalled flag on real data — by 2026-10-01. Because history accrues only from go-live (no backfill), this **depends on shipping the instrumentation soon**; `deals.created_at` is the interim fallback anchor so the cockpit is not empty on day one.

**Decisions resolved (2026-09-01) — no open items before build:**
1. SLA reconciliation → **distinct metrics**. Keep the 4h `lead.sla_due_at` response SLA **as-is** (E8 adds a presentation-only 4h tile reading the existing `slaOverdue` count); **add** a separate 24h Front Door first-call SLA. Two independently labelled cockpit tiles — do not merge or retune the 4h one.
2. First-call timestamp home → **`inquiries.metadata.first_contacted_at`** (jsonb, no migration).
3. Historical first-call compliance → **start clean from go-live** (no backfill of past first-calls; the 24h tile labels its window). Time-in-stage / stalled measured on the **deal pipeline** via the new `status_change` history, with a `deals.created_at` fallback.

**Gate:** Ready for operator approval → pm-to-issues (dev-feature-plan already done).

---

## How to update this file

When an epic moves status (☐ → 🔄 → ⏳ → ✅), update the row in the table and the drilldown section. Do not delete drilldown sections for completed epics — leave them with the closing date so we keep institutional memory.
