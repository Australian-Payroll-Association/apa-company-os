# Retreats P&L — go-live & backfill runbook

**For:** Dave, My, Mai
**Status:** software live (Phases 1–4 merged 2026-07-24). This runbook covers the operational steps that finish the plan (backfills + first real close-out).
**Plan:** docs/plans/2026-07-24-retreats-pnl-build-plan.md

The tool now *replaces* the Excel workbook, so "backfill" means entering the real numbers through the live UI (by the people who know them), not running an import. The workbook's totals and staff/salary cells are unsaved formulas, so there is nothing reliable to auto-import — enter the figures you trust.

## 0. One deploy step (required before Dave/Mai can see wages or PII)

Set this Vercel environment variable (Production + Preview), then redeploy:

```
SENSITIVE_VIEWERS=dave@edge8.ai,mai@edge8.ai
```

Why: wages and PII are gated to Dave and Mai. Mai is already flagged in the database (`admins.can_view_sensitive = true`). Dave is an env-only admin (no `admins` row), so he is cleared through this env var, exactly like `ADMIN_ALLOWLIST` clears him for admin access. Without it, Dave keeps admin access but the Compensation and Sensitive-details sections stay hidden for him. (It is already set in local `.env.local`.)

## 1. Retreat P&L backfill (DoD #4)

For each historical retreat, in `/admin/revenue/events/[id]` → **P&L** tab:

1. Open the retreat (create the event first if it doesn't exist yet: private retreats James, James & Tracy, Doxa, IPP, Saigon 2, James & Tracy 2).
2. **Revenue:** public-retreat card payments already show as the read-only "Stripe registrations (auto)" row. Add manual lines for private-retreat invoices (billed under the **Infinite Leverage** product in QuickBooks), Human Tokens, and Mac Mini sales.
3. **Expenses:** add each line with its classification (accommodation, staff cost, venue, transportation, food & beverage, equipment, visa, commission). Enter the native amount and pick the currency (USD / VND / AUD) — totals convert to USD automatically.
4. **Staff lines:** pick the person and enter days; the amount fills at $150/day (override if needed). This is a deliberate flat rate so real wages never appear here.
5. Set each line's payment status (unpaid / to be paid / paid).
6. Check the footer: Total Revenue, Total Expenses, Profit — estimated and actual. Confirm it matches your workbook figure for that retreat.

The six retreat events already in the system: Saigon (Jun 19, completed), Sydney (Aug 27), Melbourne (Aug 24), Saigon (Aug 8 & 9), EO Melbourne (Sep 30).

## 2. Salary backfill — CONFIDENTIAL (DoD #5)

Dave or Mai only. For each active employee, in `/admin/talent/team/[id]` → **Compensation**:

1. **Add change** → enter the monthly salary in VND (from MasterList). The USD field fills automatically at the fixed 25,500 VND/USD; override either field if needed.
2. Set the effective date (use the employee's start date for the first row).
3. Save. Every later change adds a new dated row — history is never overwritten.

Salary values live only in the database. They are never written to the repo, logs, or commit messages, and are hidden from the admin AI assistant.

## 3. First real close-out (DoD #9)

My and Mai run the **Sydney (Aug 27)** retreat P&L entirely in the app: enter costs as they land, mark payment status, read profit the day it ends. Once done, mark the Excel workbook read-only and retire it.

## Verification checklist (Definition of Done)

- [ ] `SENSITIVE_VIEWERS` set in Vercel; Dave sees Compensation + Sensitive details.
- [ ] A non-cleared admin (e.g. My, Quan) sees "Restricted — visible to Dave and Mai only" and no wage/PII data.
- [ ] Each backfilled retreat's P&L footer matches the workbook total.
- [ ] Every active employee has a current salary row (VND + USD) with history.
- [ ] Sydney retreat closed out in-app; workbook retired.

## What shipped (software, done)

- `event_pnl_lines` table + dual-currency `compensation` columns + `admins.can_view_sensitive` (migration).
- Retreat P&L tab (revenue auto + manual, expenses, estimated vs actual, profit).
- Confidential Compensation section (dual-currency, append-only history, Dave & Mai only).
- Server-side sensitive gate over compensation, `people_sensitive`, ID images, and emergency contacts; compensation hard-excluded from the NL→SQL assistant.
