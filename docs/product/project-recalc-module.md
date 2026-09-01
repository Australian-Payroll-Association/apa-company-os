# Payroll Recalculation Module

**Australian Payroll Association · Project detail**

Take a client's real timesheet and pay data — APA's own "Pay Review data gathering" workbook — apply the real MA000019 (Banking, Finance and Insurance Award 2020) interpretation rules, and surface the variance: what should have been paid vs what was, per employee per pay period.

- **Day-one user:** consultants (internal only)
- **The one action:** upload the workbook, see the variance
- **Status:** v2 — real award, real intake template, standalone (not wired into Report 360 yet)

> Not one of the three builds in [Building on company_os](building-on-company-os.md) — this predates that plan and is deliberately standalone. Revisit whether it should join that plan once the engine is validated on a real engagement.

---

## 1. What it is

Report 360 (see [project-report-360.md](project-report-360.md)) drafts the *narrative* half of a compliance review — process, controls, systems. It never checks whether people were actually paid correctly. This module is the other half: recompute what MA000019 says a client should have paid, from their own timesheet, and diff it against what they actually paid.

v1 proved the loop with synthetic CSVs and one illustrative, made-up rule set. v2 replaces that entirely with:
- **The real intake workbook** — `Pay Review data gathering template.xlsx`, the actual spreadsheet APA consultants already fill in by hand, across 9 `DATA#...` tabs.
- **The real award** — MA000019, generated programmatically from APA's own Award Interpretation Library (a `payrates` sheet of ~600 real dollar figures and an `Award` sheet of ~45 pay-affecting clauses), not hand-typed.

---

## 2. How it works

1. **Consultant uploads one workbook** — the real template, filled in as usual. No CSV export step.
2. **The engine recalculates.** For every worked shift, it resolves the employee's classification/employment-type/shiftworker status *as of that date* (these can change over time), classifies the day (weekday/Saturday/Sunday/public-holiday, by the shift's own region), splits ordinary vs overtime hours (properly splitting a shift that straddles the ordinary-span boundary, not just accepting/rejecting the whole shift), and applies the matching rate from the real MA000019 rate tables (Adult/Junior × age band × Full-time-Part-time/Casual × Level 1–6).
3. **It folds in everything else the workbook supports:** allowances (First Aid, Stand-by, Higher Duties, Vehicle — real per-employee records, not assumptions), call-back shifts, leave payments (with the "greater of 17.5% or the weekend/shift penalty" annual leave loading test), and break/rest-period compliance findings.
4. **It diffs.** Expected (computed) vs actual (`DATA#payslip data`), per employee/pay-period/component. Anything more than $1 out is flagged.
5. **The consultant reviews** a variance table, plus a fixed list of clauses the engine can't evaluate at all (see §5) and any compliance findings that aren't dollar variances.

---

## 3. The real data model — 9 input tabs, one workbook

| Tab | What it gives the engine |
|---|---|
| `DATA#employee static attributes` | DOB (for junior/adult rate banding), employment dates |
| `DATA#employee dynamic attribute` | Classification, employment type, shiftworker flag, contracted hours — **time-bounded**, resolved by date |
| `DATA#pay periods` | Canonical period boundaries (not derived from payslip rows) |
| `DATA#public holidays` | Real per-region calendar |
| `DATA#payslip data` | Actual pay, itemized (`cost_category` free text) |
| `DATA#rostered shifts` | The plan — used as the shiftworker overtime baseline |
| `DATA#worked shifts` | What actually happened — the basis for expected pay; carries `leave` for paid absences |
| `DATA#allowances` | Who gets First Aid / Stand-by / Higher Duties / Vehicle, and when |
| `DATA#callback shifts` | Actual recall-to-work blocks |

Every tab follows the same convention: column A carries instruction text for the human filling it in; the real header row is the one reading "1st row of CSV >>>", with field names from column B onward.

---

## 4. MA000019 clauses implemented

Generated once from APA's Award Interpretation Library by `scripts/build-ma000019-ruleset.mjs` into `lib/recalc/rule-sets/ma000019-2026-07-01.json`, then seeded into the database (`supabase/03-recalc-ma000019-ruleset.sql`).

- **Hours & rates**: classification base rates (Level 1–6, Adult + 5 Junior age bands), ordinary span, overtime (Mon–Sat first 3h/after 3h, Saturday beyond weekly hours, Sunday all hours), public holiday (worked + minimum 4h top-up), casual loading (via the award's own casual rate columns) + minimum 2h engagement, shiftworker loadings (early morning/afternoon/night, using the *permanent*-shiftwork rate columns).
- **Allowances & call-backs**: First Aid (FT weekly flat / PT-casual hourly-capped), Stand-by (weekday vs weekend rate), Higher Duties (rate differential), Vehicle, meal allowance (auto-triggered from overtime), call-back minimum engagement.
- **Leave**: ordinary-equivalent payment from the worked-shift `leave` column, annual leave loading (greater of 17.5% flat or the weekend/shift penalty foregone).
- **Break/rest-period compliance**: day-worker unpaid-break-under-30-min → finding; shiftworker paid 20-minute break → dollar addition; <10h/<8h rest-period breach → finding.
- **Superannuation**: a separate statutory %, not an award clause, computed on ordinary-time earnings.

**Stated simplifications** (documented in code, not hidden):
- One-week overtime-threshold buckets, not the award's optional 2/3/4-week averaging cycle (no cycle-length field exists in the intake workbook).
- A `shift`-flagged employee is always treated as a *permanent* shiftworker (no ad-hoc-vs-permanent distinction in the source data).
- Stand-by and call-back day-type pricing don't check the public-holiday calendar (no region field on those tabs).
- Higher duties pays the ordinary-rate differential only, not a full re-derived overtime/penalty split.
- Rest-period violations are reported as findings, not priced (the 200%-until-released remedy needs an operational fact — when the employee was released — that isn't in any input tab).

**Not modeled at all** (no data exists anywhere to compute these): make-up time (13.5), RDO banking (13.6), TOIL banking (20.5), stand-by call-back travel reimbursement (18.3(b)), travelling time/expense reimbursement (18.4(b)), redundancy (32). Listed in every run's results, not silently dropped.

---

## 5. On company_os

Still deliberately standalone — no FK into `companies`, `deals`, or `documents`.

**Tables** (unchanged from v1, `supabase/02-recalc.sql`): `recalc_rule_sets` (`rules jsonb` — now holding the real MA000019 config), `recalc_runs` (`results jsonb`). Same security posture as `compensation_sensitive`: RLS enabled with no policies, all access through the service-role client, gated by `requireAdmin()` + `canViewSensitive()`.

**Where it lives**: `app/admin/(dashboard)/innovation/recalc/` (nav: Innovation → Payroll Recalc, super-admin only); parsing (`parse-workbook.ts`) and the engine (`engine.ts` + `engine/*.ts`) in `lib/recalc/`.

**Regenerating the rule set** if the award updates: re-run `node scripts/build-ma000019-ruleset.mjs --award <new source xlsx>` then `node scripts/build-recalc-ruleset-sql.mjs`, and apply the resulting SQL.

---

## 6. To settle before a real engagement

- **[Decision] Standalone vs Report 360.** Revisit once the engine has been run against a real engagement — should flagged variances feed Report 360 as evidence, or stay a separate tool?
- **[Data] Sign-off on the stated simplifications above**, particularly the permanent-shiftworker assumption and the one-week averaging bucket — a payroll consultant should confirm these don't distort results for the specific client being reviewed.
- **[Format] Excel/PDF beyond this one template.** The engine is built against APA's own intake workbook's exact tab/column layout — a client whose raw exports need transforming into that layout first.

---

*See also: [Payroll 360 Report Engine](project-report-360.md) · [Master plan](building-on-company-os.md)*
