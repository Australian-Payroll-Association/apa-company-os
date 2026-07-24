# Handoff — Infinite Leverage Retreats P&L (2026-07-24)

Paste this into a new Claude Code chat to continue. The software is built and merged; what remains is mostly operational + optional polish.

## What this is

A retreat P&L system on the edge8-web admin: per-retreat revenue/expense tracking on the Events module, plus confidential dual-currency employee salaries. Plan: `docs/plans/2026-07-24-retreats-pnl-build-plan.md`. Runbook: `docs/operations/retreats-pnl-backfill-runbook.md`.

## Shipped and merged (PRs #380–#387)

- **Schema** (`supabase/migrations/20260724130000_*` + `20260724170000_*`): `company_os.event_pnl_lines`; `compensation.salary_vnd` + `salary_usd_cents`; `admins.can_view_sensitive`; `events.registered_count_override`.
- **P&L tab** on `/admin/revenue/events/[id]` — `PnlTab.tsx` + `pnl-actions.ts`; add/edit/delete revenue & expense lines, auto Stripe revenue (read-only), estimated vs actual, profit. Data layer `lib/admin/event-pnl.ts` (+ `-shared`).
- **Compensation section** on `/admin/talent/team/[id]` (Dave & Mai only) — `CompensationSection.tsx`; dual VND/USD at fixed 25,500, append-only history. Data layer `lib/admin/compensation.ts` (+ `-shared`).
- **Sensitive gate** — `canViewSensitive(email)` in `lib/admin-auth.ts` (env `SENSITIVE_VIEWERS` + `admins.can_view_sensitive`, fail closed). Gates `people_sensitive`, ID-image route, emergency contacts, compensation. Compensation hard-excluded from the NL→SQL assistant.
- **Operations → Retreats** overview at `/admin/operations/retreats` — every retreat's revenue/expense/profit, links to each P&L tab. Nav entry in `components/admin/AdminSidebar.tsx`.
- **Events list** (`/admin/revenue/events`) — sortable column headers + `registered_count_override` display.

## Data populated (in production DB, project `wwchefrgkkxmhlkntufm`, schema `company_os`)

- **23 employee salaries** backfilled from MasterList.xlsx (comp_type `base_salary`, VND + USD at 25,500).
- **Retreat P&L** for 4 completed retreats (44 lines): Saigon Jun 19 (existing event) + 3 NEW private events created via SQL:
  - James Murray `06b0720f-d8b8-4e18-a336-28ee869a62b4`
  - James & Tracy `4f81925a-57f3-4a1a-9461-ee19e20197e9`
  - DOXA `2f40df91-a83a-40c3-9aeb-197877dfb9cb`
- **DOXA Talent keynote** (`15c2d33c-...`): $6,000 revenue, no expense.
- **registered_count_override** = round(attended × 1.1) on 6 completed keynote/workshop events.
- **Env:** `SENSITIVE_VIEWERS=dave@edge8.ai,mai@edge8.ai` set in Vercel (prod/preview/dev) + local `.env.local`.

## Where to see all retreats

- **`/admin/operations/retreats`** — the dedicated "all retreats" view (all 9 retreats incl. the 3 private ones, with P&L). This is the answer to "how do I see all the retreats."
- Or the events list (`/admin/revenue/events`) filtered to Type = Retreat.
- Per-retreat editing: open the retreat → **P&L** tab.

## Gotchas (bit us; don't repeat)

- Salary `comp_type` MUST be `'base_salary'` (allowed enum), NOT `'salary'`. `pay_period='monthly'`.
- `compensation.approved_by` is a **uuid** column — never write an email into it (leave null; approver is in `audit_log`).
- Money storage: `event_pnl_lines` amounts are **major × 100** in the line's currency (VND stored ×100, so `formatCents`/`convertToUsdCents` work). But `compensation.salary_vnd` is **whole VND** (not ×100); `salary_usd_cents` is USD cents.
- P&L USD normalization uses `convertToUsdCents` (live fx, `lib/admin/fx.ts`); **wages** use the fixed 25,500, never live fx.
- New `company_os` tables need explicit `service_role` grants; RLS-on-no-policy keeps them out of the NL→SQL assistant.

## Delivery conventions (this repo)

- **Shared checkout is churned by other agents** — always work in an isolated git worktree off `origin/main`; symlink `node_modules`; stage files explicitly (never `git add .`); squash-merge PRs; remove the worktree after.
- **Never run a dev server.** Verify with `npx tsc --noEmit` + `npx next build`.
- Schema changes via the Supabase MCP `apply_migration` (+ commit the `.sql` under `supabase/migrations/`); data ops via `execute_sql`.
- No secrets/salary values in the repo, logs, or commit messages.

## Remaining / optional

- **DoD #9 (operational):** My & Mai close out a real retreat (Sydney, Aug 27) live in the app, then retire the Excel workbook.
- August retreats (Sydney/Melbourne/Saigon Aug 8–9) P&L: entered via the P&L tab as they happen (Stripe revenue auto-shows).
- Optional polish: automatic Stripe fee capture in the webhook; auto-pull private-retreat revenue from QuickBooks (billed under the "Infinite Leverage" product); real wage-based staff costing (must stay leak-guarded — ops-visible cost lines only ever show the flat $150/day or blended rates).
