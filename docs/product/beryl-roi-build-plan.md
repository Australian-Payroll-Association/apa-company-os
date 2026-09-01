# Beryl ROI Calculator — Build Plan (locked)

**Australian Payroll Association · Implementation plan for [Build C](building-on-company-os.md) · [Feature spec](project-beryl-roi.md)**

This is the agreed implementation plan for the Beryl ROI Calculator, built **inside `company_os`** (not as a standalone app). It reconciles the original standalone `app-plan` (HubSpot, hardcoded price) with the company OS master-plan rules (one identity, one lead pipeline, price from the catalogue). Every decision below is signed off; the two data assumptions remain pending final sign-off but do not block the build.

---

## 1. What changed from the original app-plan

The original plan was written against the small Day-One CRM. Building on `company_os` changes three things:

| Original app-plan | Company OS build (locked) | Why |
|---|---|---|
| Leads → HubSpot only | Native `lead` (`source='roi_calculator'`) **+** HubSpot mirror | Master plan: never send leads only to HubSpot. Native lead has owner + SLA; HubSpot mirror is additive and gated on a token. |
| Price hardcoded ($49.95) | Read from a `products` row | One price, one place. |
| Salary optional w/ default | **Salary is a required input** | Operator decision — no silently-assumed rate to defend. |
| Standalone page | `app/beryl-roi/` in the OS, admin view under `revenue/` | One login, one permission model, one usage store. |

---

## 2. Locked decisions

**Architecture**
- **Lead routing:** native `lead` pipeline **and** HubSpot mirror. HubSpot write runs only when `HUBSPOT_ACCESS_TOKEN` is set (graceful no-op + log otherwise, matching the repo's Resend/Stripe pattern). Native lead always writes.
- **PDF engine:** `@react-pdf/renderer` (pure-JS, Vercel-serverless friendly, brand fonts). Net-new dependency.
- **Public URL:** `/beryl-roi`.
- **Delivery:** two PRs — **B1** (prove the loop) then **B2** (make it real).

**Data & privacy**
- **Price:** create a Beryl `products` row now (`slug='beryl'`, `amount_cents=4995`, inc GST, `currency='aud'`, `active=true`); the calculator reads price from it. *(Confirm `type` against the `products` type check — likely `membership`.)*
- **Usage logging:** store raw `salary_cents` in `roi_usage_events`. No name, email, or IP — the event stays anonymous.
- **Consent:** an unticked opt-in checkbox on the PDF form. Ticked → `people.marketing_consent='subscribed'`; unticked → `'never_asked'` (lead still workable, just not added to marketing sends). Governed by the Spam Act 2003.
- **Company:** person + lead only in v1. No company inference from email domain.
- **Salary:** required input; the page won't compute until team size, queries, and salary are all present.

**Kick-off**
- Plan doc first (this file + the branded version), then build B1 on a feature branch → PR into `main`.

---

## 3. The benchmark (typical queries per user / month)

**Seeded value: 15/user/month** — data-backed, pending formal sign-off.

Provenance: Beryl Chat dashboard, **July 2026**, internal excluded (APA staff + SSW test traffic removed): **2,734 questions ÷ 292 active users = 14.9/user/month**. This single-month cut is the correctly-aligned figure (numerator and 30-day-active denominator cover the same ~30 days). Multi-month "questions per user" readings cluster at the same level (15.4 Apr–Aug, 15.6 May–Jul, 14.9 Jul), confirming it's a monthly rate.

Caveats to revisit (non-blocking, editable in one row):
- **July is peak Australian payroll season** (post-30 June EOFY: STP finalisation, new tax tables, super changes), so this may be a seasonal high. Revisit with a 12-month average when available.
- Median is uncomputable from totals; 15 is a mean. Power-law skew means a true typical could be marginally lower.

Page/PDF caption: *"typical Beryl user asks ~15 questions/month (Beryl Chat, July 2026, internal excluded) — adjust to your team,"* flagged as an estimate pending sign-off until the assumptions are formally agreed.

---

## 4. Data model (two net-new tables + one product seed)

Conventions: `company_os` schema, `uuid` PKs, `_cents` money, `created_at`/`updated_at`, RLS enabled with **no app policies** (the service-role client bypasses RLS; the public never touches the DB directly). New file `supabase/02-roi-calculator.sql` — **not** `supabase/migrations/`.

```
roi_assumptions            -- single editable row; tune with no redeploy
  id uuid pk
  time_saved_min_minutes int   default 20      -- pending sign-off
  time_saved_max_minutes int   default 45      -- pending sign-off
  working_hours_year     int   default 1800
  typical_queries_per_user int default 15      -- pending sign-off (benchmark)
  assumptions_signed_off bool  default false
  updated_by text
  updated_at timestamptz default now()

roi_usage_events           -- anonymous, one row per calculation run
  id uuid pk
  team_size int
  queries_per_user int
  salary_cents int                              -- raw (per decision); no PII
  hourly_rate_cents int
  monthly_saving_low_cents  bigint
  monthly_saving_high_cents bigint
  pdf_requested bool default false
  created_at timestamptz default now()
  metadata jsonb default '{}'::jsonb
```

Price is **not** stored in `roi_assumptions` — it comes from the Beryl `products` row so there is one source of truth.

---

## 5. The formula

Runs **in-browser** for instant feedback and is **recomputed server-side** for the PDF and the logged event (so logged numbers can't be tampered with).

```
total_queries = team_size × queries_per_user
hourly_rate   = annual_salary ÷ working_hours_year      (salary is required)
saving_low    = total_queries × (time_saved_min ÷ 60) × hourly_rate
saving_high   = total_queries × (time_saved_max ÷ 60) × hourly_rate
annual        = monthly_saving × 12
beryl_cost    = product.amount_cents/100 × team_size
net_benefit   = monthly_saving − beryl_cost
roi_multiple  = monthly_saving ÷ beryl_cost
```

Worked example (5 users · 15 q/user · $75k salary): monthly saving **$1,042–$2,344**; Beryl cost $249.75; net **+$792 to +$2,094**; ROI **~4.2×–9.4×**.

---

## 6. File map

**Net-new**
- `app/beryl-roi/page.tsx` — public client page + form (pattern: `app/contact/page.tsx`)
- `app/api/roi/assumptions/route.ts` — GET assumptions row + Beryl price
- `app/api/roi/usage/route.ts` — POST: server recompute + insert `roi_usage_events`
- `app/api/roi/pdf/route.ts` — POST: render PDF + native lead write + gated HubSpot mirror
- `lib/roi.ts` — shared formula + types (client + server)
- `lib/roi-pdf.tsx` — `@react-pdf/renderer` document
- `lib/roi-hubspot.ts` — gated HubSpot contact upsert
- `lib/admin/roi-stats.ts` — usage rollup (pattern: `lib/admin/lead-stats.ts`)
- `app/admin/(dashboard)/revenue/roi-calculator/page.tsx` — admin usage view
- `supabase/02-roi-calculator.sql` — two tables + Beryl product seed

**Reused (never re-created)**
- `lib/supabase.ts` → `companyOs` service-role client
- `lib/company-os.ts` → `getOrCreatePerson`
- `lib/lifecycle.ts` → `promotePersonToLead`
- `lib/admin-auth.ts` → `requireAdmin`
- `components/admin/*` (DataTable, PageHead, DonutChart, Badge, FilterBar)

**Edited**
- `components/admin/AdminSidebar.tsx` — add "ROI Calculator" to the Revenue nav group
- `.env.local` + `README.md` — document `HUBSPOT_ACCESS_TOKEN` (optional, gated)

---

## 7. Build slices

### B1 — Prove the loop *(PR 1)*
Schema (`roi_assumptions` + Beryl product seed) · GET assumptions route · public page with three **required** inputs (team size, queries, salary) · in-browser range calc reading defaults · result shows monthly + annual saving beside the Beryl price · live on the real domain. No usage log, no PDF, no styling polish.

**Done when:** live on domain; inputs return a low–high monthly + annual range; range comes from `roi_assumptions`; no login/gate; price shown beside saving; verified once on the live URL.

### B2 — Make it real *(PR 2)*
Brand styling (Montserrat + Source Sans, APA blue/gold, no gradients) · "how we calculate this" note stating the assumptions · anonymous `roi_usage_events` on every run · optional PDF (name + work email + opt-in consent) via `@react-pdf/renderer` · native `people`+`lead` write (`source='roi_calculator'`, deduped by email) · gated HubSpot mirror · admin usage view (runs, PDF conversions, common team sizes) + nav item · mobile-legible.

**Done when:** matches the design system; result shows hours + dollars, monthly + annual, cost beside; assumptions note visible; PDF requires name + work email and stands alone; PDF request creates/updates a lead (and HubSpot contact when the token is set); every run writes one anonymous event with `pdf_requested` flagged; admin view answers "how many runs, how many PDFs, what team sizes" without touching the DB; usable on a phone.

---

## 8. Before external launch (sign-offs, not blockers)

- **[Data] Time saved per query (20–45 min)** — validate against Beryl helpdesk data before the page claims "based on our data."
- **[Data] Typical queries (15/user/month)** — formal sign-off; revisit with a 12-month average (July is seasonally high).
- **[Runtime] `HUBSPOT_ACCESS_TOKEN`** — add when ready to activate the HubSpot mirror. Native lead works without it.
- **[Confirm] `products.type`** value for the Beryl row against the schema's type check.

Until the two data figures are signed off, the page carries the honest "estimate, pending validation" caption so no number is presented as a fact.
