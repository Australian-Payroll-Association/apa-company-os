# Payroll Recalculation Module (proof of concept)

**Australian Payroll Association · Project detail**

Take a client's pay data (what was actually paid) and timesheet (hours actually worked), apply an interpretation rule set (an award/EA's pay clauses), and surface the variance — what should have been paid vs what was, per employee per pay period.

- **Day-one user:** consultants (internal only)
- **The one action:** upload two CSVs, see the variance
- **Size:** small proof of concept, standalone
- **Status:** v1 shipped as a prototype — CSV input, one illustrative example rule set, not wired into anything else yet

> Not one of the three builds in [Building on company_os](building-on-company-os.md) — this predates that plan and is deliberately standalone. Revisit whether it should join that plan once the engine is validated on a real engagement.

---

## 1. What it is

Report 360 (see [project-report-360.md](project-report-360.md)) drafts the *narrative* half of a compliance review — process, controls, systems. It never checks whether people were actually paid correctly. This module is the other half: recompute what a client's award/agreement says they should have paid, from their own timesheet, and diff it against what they actually paid.

**What v1 builds**
- Two CSV templates (timesheet, pay data) a consultant can fill in from a client's payroll exports.
- One interpretation rule set, expressed as data (JSONB), not hardcoded award logic — customer-specific by design, even though v1 ships with only one illustrative example.
- A calculation engine that classifies every worked day (weekday / Saturday / Sunday / public holiday), splits ordinary vs overtime hours, applies penalty rates and a meal allowance trigger, and estimates superannuation.
- A variance view: expected vs actual, per employee, per pay period, per pay component, flagged where they differ by more than $1.

**What v1 skips (Phase 2)**
- Excel and PDF input (CSV only for now).
- A rule-set editor UI (edit the JSONB directly for now).
- Any link to Report 360, `companies`, or `deals` — this is intentionally standalone until the engine is proven.

---

## 2. How it works

1. **Consultant uploads two CSVs** — a timesheet export and a pay data export, matched by `employee_id`. See §3 for the exact column templates.
2. **The engine recalculates.** For each day an employee worked, it derives ordinary/overtime hours and the day type from the timesheet, prices them against the rule set, and rolls the result up by pay period (pay-period boundaries come from the pay data file — the timesheet only records days worked).
3. **The engine diffs.** Expected (computed) vs actual (from the pay data file), per employee/pay-period/component. Anything more than $1 out is flagged.
4. **The consultant reviews.** A variance table, sortable by employee, with a running total of over/underpayment.

---

## 3. Input templates (CSV, v1)

**Timesheet** — one row per shift:
`employee_id, employee_name, classification, work_date, start_time, end_time, unpaid_break_minutes`

**Pay data** — one row per paid component per pay period (itemized, long format — matches how a payroll system's pay register export reads):
`employee_id, employee_name, pay_period_start, pay_period_end, component, amount, hours`
— `component` ∈ `ordinary | overtime | saturday_penalty | sunday_penalty | public_holiday_penalty | meal_allowance | leave | superannuation`

Day type and overtime hours are **derived** by the engine from the timesheet, never trusted from the input — that is the whole point of recalculating rather than re-summarizing what the client already believes.

---

## 4. The interpretation rule set

A rule set is a JSONB config on `company_os.recalc_rule_sets.rules` (see `lib/recalc/types.ts`'s `RuleSet` type and `supabase/02-recalc.sql`'s seeded example): ordinary hours per day/week, hourly rates per classification, a casual loading %, overtime tiers, weekend/public-holiday penalty multipliers, a meal allowance trigger, a public holiday date list, and a superannuation %.

**This is what makes rule sets customer-specific** — the schema, not any particular example's numbers. The seeded example is explicitly illustrative and flagged as such in the UI; it is not a certified award interpretation, and shouldn't be presented to a client as one.

**v1 simplifications, on the record:**
- Weekend/public-holiday hours are paid entirely at the day's penalty rate — they don't also split into an overtime tier.
- The casual loading % applies to every classification, because the timesheet template has no employment-type (casual/permanent) field yet.
- Superannuation is estimated as a % of ordinary + overtime + penalty pay (an approximation of ordinary time earnings; allowances are excluded).
- Overtime is decided by a single daily-hours threshold — no weekly-hours check yet.

---

## 5. On company_os

Deliberately standalone for v1 — no FK into `companies`, `deals`, or `documents`. Two new tables only:

- `recalc_rule_sets`: `id`, `name`, `description`, `rules jsonb`, `created_by`, timestamps.
- `recalc_runs`: `id`, `label`, `rule_set_id → recalc_rule_sets`, filenames, `status`, `results jsonb` (the full computed variance output), `created_by`, timestamps.

Same security posture as `compensation_sensitive`: RLS enabled with no policies; all access is through the service-role client, gated in application code by `requireAdmin()` + `canViewSensitive()` — payroll dollar data is sensitive.

**Where it lives:** `app/admin/(dashboard)/innovation/recalc/` (nav: Innovation → Payroll Recalc, super-admin only), engine + parsing + data access in `lib/recalc/`.

---

## 6. To settle before a real engagement

- **[Data] A real client's rule set.** The seeded example is a placeholder for proving the engine, not a certified award interpretation — a payroll consultant needs to build and sign off on the real one before this touches real client data.
- **[Decision] Standalone vs Report 360.** Revisit once the engine has been run against a real engagement — should flagged variances feed Report 360 as evidence, or stay a separate tool?
- **[Data] Format coverage.** Real client exports will often be Excel or PDF, not CSV — Phase 2.

---

*See also: [Payroll 360 Report Engine](project-report-360.md) · [Master plan](building-on-company-os.md)*
