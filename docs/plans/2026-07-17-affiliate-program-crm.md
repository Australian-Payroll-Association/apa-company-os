# Affiliate Program ↔ CRM link — build plan

**Date:** 2026-07-17
**Status:** BUILT 2026-07-17 (branch `feat/affiliate-program-crm`, uncommitted in worktree — Dave drives commit/push). Migration APPLIED to prod. tsc + next build clean.
**Surfaces:** `/admin/revenue/affiliates`, `/admin/revenue/companies` (shelf), `/portal` (new Referrals section)

## What shipped
- Migration `20260717120000_affiliate_program_crm.sql` (applied): redemption columns on affiliate_commissions (rate/commission_cents now nullable = realized-on-choice), consolidated to one active code/person (deactivated TRACY20 + D65N38), archived the dupe David Nilssen person, added BRADGILES, booked James's $2,420 work credit on invoices #1250+#1238, and 8 held portal_members allowlist rows.
- `lib/admin/affiliates.ts` — person-grouped aggregator + 360 (resolves deals.affiliate_id AND deals.referrer_id) + code generator.
- `/admin/revenue/affiliates` rebuilt one-row-per-person + `AffiliatesShelf` (codes, referred deals, commissions with per-commission redemption + send-invite).
- Companies shelf: per-contact "Make affiliate" / "Deactivate" toggle (`activateAffiliate`/`deactivateAffiliate` also pre-authorize held portal access).
- Portal Referrals: `lib/portal/referrals.ts`, `/portal/referrals` page + `Redeem` (20% credit / 10% cash choice, IDOR-checked), sidebar + layout entitlement.

## Still pending on Dave (unchanged)
- Send the held portal invites (button exists on the Affiliates shelf; nothing auto-sends).
- TK + Dru workshop backfill details (event, payment, affiliate relevance) — still no event/order rows for them.

## Model (agreed)

- **One code per person.** No per-code rate tiers. A person is either an active
  affiliate (one active code) or not.
- **Rates are a redemption choice, not a code property.** Commission accrues as
  **gross** referral revenue; when redeemed the affiliate chooses:
  - **Work credit — 20%** of gross
  - **Cash — 10%** of gross
  The choice is made per commission, in the client portal (or recorded by an
  admin for affiliates who haven't logged in).
- **Any client can become an affiliate.** The portal Referrals entitlement is
  driven purely by "this person has an active affiliate code" — no special role.
- **Every affiliate gets client-portal access** (company-scoped membership when
  they belong to a client company, company-less otherwise).
- Referral linkage in the CRM stays as-is: `deals.affiliate_id` (code-tagged)
  and `deals.referrer_id` (person-tagged, e.g. Brad Giles's three deals). The
  affiliate views resolve **both**: a person's referred deals = deals tagged
  with any of their codes OR `referrer_id = their person_id`.

## Current-state facts (verified 2026-07-17)

- `company_os.affiliates` / `affiliate_commissions` / `affiliate_payouts` exist;
  10 affiliate rows, 1 commission row (WORKHEALTHY ← Tracy's April order,
  $6,500 AUD gross → $1,300 credit, manual backfill).
- Duplicate codes: Tracy (`TRACY`, `TRACY20` — same person) and David Nilssen
  (`DAVIDNILSSEN`, `D65N38` — **two different person rows**: david.nilssen@ vs
  dave.nilssen@doxatalent.com — CRM dupe).
- Brad Giles is in the CRM (brad.giles@evolutionpartners.com.au) with 3 open
  referred deals via `referrer_id` (Rentwest $20K, bStore $15K, Westbridge
  $31.2K) but no affiliate row.
- James = Dr James L Murray (`WORKHEALTHY`). AustPayroll has two paid invoices
  with no commission: **#1250 $4,000** (2026-06-23) + **#1238 $8,100**
  (2026-06-30), USD → gross $12,100.
- No affiliate has portal access today (zero `portal_members` rows; only Dave
  has an auth user). Clients: Nilssen → Doxa Talent (primary), Murray → Work
  Healthy Australia (primary), Tracy → AustPayroll (employee).
- TK (tk@gam.gg) and Dru (dru@stw.group): no event registrations, no orders, no
  company links — their workshop attendance was never recorded. **Backfill
  blocked on Dave**: which workshop, paid amount, affiliate relevance.

## Work items

### 1. Data migration + backfill
- Consolidate to one code per person: keep `TRACY` and `DAVIDNILSSEN`,
  deactivate `TRACY20` and `D65N38`.
- Repoint `D65N38` (before deactivation) and dedupe: canonical Nilssen person =
  david.nilssen@doxatalent.com; flag the dave.nilssen@ dupe for archive (never
  delete).
- Add `BRADGILES` affiliate row for Brad Giles (active).
- `affiliate_commissions`: add `redemption_choice` (`work_credit` | `cash` |
  null = pending), `chosen_at`, `credit_cents` (computed at choice time).
  Existing `rate`/`commission_cents` stay for the historical row.
- Global rate constants (0.20 / 0.10) in code, not per-row.
- **James's credit**: two commission rows against invoices #1250 + #1238,
  `source_event: invoice_paid`, `source_ref` = doc number,
  `redemption_choice = work_credit` → **$800 + $1,620 = $2,420** (confirmed).
- Remember: new columns/tables need explicit service_role grants
  (company-os-table-grants).

### 2. Admin — Affiliates page (`/admin/revenue/affiliates`)
- Regroup to **one row per person** (today Tracy/Nilssen show twice).
- Replace the read-only `getRowPreview` shelf with a client-owned
  `AffiliatesShelf` (Vendors pattern — stateful shelves must not go through
  getRowPreview). Per person: code(s) with active state, referred deals live
  from the CRM, accrued gross, per-commission redemption status
  (pending / credit / cash / paid out), unpaid balance.
- Metric cards: referred pipeline, unpaid commission.
- No creation UI here — this page only reflects who's been activated.

### 3. Admin — activate/deactivate from Companies (`/admin/revenue/companies`)
- In the companies shelf, per contact, next to the existing portal-access
  controls: **Affiliate toggle**. Activate = auto-generate code (editable) +
  active affiliates row; deactivate = `active=false` (history kept). Both
  audit-logged. Contact 360 gets the same toggle later only if needed
  (non-client affiliates) — not in this build.

### 4. Client portal — Referrals section (`/portal`)
- Sidebar entitlement: person has an active affiliate code.
- Page (person-scoped, via `requirePortalMember()` + `lib/portal/data.ts`
  scoping): their code, referred deals/invoices, accrued commissions, and a
  per-commission action: **Apply as 20% work credit / Take 10% cash**. Writes
  `redemption_choice`/`chosen_at`/`credit_cents`; admin shelf reflects it.
- Admin can record the choice manually for affiliates who haven't logged in.

### 5. Portal provisioning
- `portal_members` rows for all affiliate persons: company-scoped for
  Nilssen/Murray/Tracy, company-less for Eric, Dru, TK, Brooks, Brad.
- **Auth invite emails HELD** — external sends need Dave's explicit go-ahead.

### 6. Pending on Dave
- TK + Dru workshop backfill details (event, payment, affiliate relevance).
- Go-ahead to send the portal invite emails.

## Out of scope
- Payout execution flow (affiliate_payouts UI) — record-keeping only for now.
- Stripe coupon lifecycle changes.
- Contact-360 affiliate toggle for non-client affiliates.
