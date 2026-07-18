# Client Work Requests in the Portal (+ QBO invoicing + Human-Token Packs)

Built 2026-07-18. Portal clients can request work three ways:

1. **General request** → CRM inquiry (`company_os.inquiries`, `source: 'portal'`, no lead promotion — they're already customers).
2. **Project request to a contractor** → the existing `contractor_work_requests` workflow with the **client as decider**: client briefs a contractor → contractor estimates via the bearer-token `/work/[token]` page → client approves in `/portal/requests` → work → client accepts → **QuickBooks invoice created automatically** at the contractor's billable rate (100% markup default) via the live QBO API, emailed to the client by QBO, accountant notified. Contractor pay (monthly `contractor_payments` roll-up at the internal rate) is unchanged.
3. **Human-token packs** → Stripe Checkout: 1 pack = 40 tokens (1 token = 1 hour), $2,000/pack, 1–4 packs. Standalone purchase; balance = company-scoped sum of paid `token_purchases`. No draw-down against work billing yet (deliberate).

## Key design points

- **Shared state machine** `lib/work-requests.ts`: one status guard / event write / contractor email per transition; admin actions and `lib/portal/work-requests.ts` both call it with a `WorkDecider` (`actorType: 'admin' | 'client'`). Admin is a visible backstop, never a required gate.
- **Schema**: `contractor_work_requests` + `client_company_id`, `requested_by_person_id`, `origin` ('admin'|'portal'), and billing columns (`billing_status` invoiced|failed|manual_required, `billed_*`). `contractor_work_events.actor_type` gained `'client'`. New: `qbo_connection` (single row, token rotation-safe), `token_purchases`. `compensation` gained `comp_type 'billable'` (always USD; backfilled 2× hourly for USD contractors).
- **Portal security**: `PORTAL_REQUEST_SELECT` never includes `access_token` (contractor's bearer credential) or contractor emails; every query scoped to `actor.companyScope`; Assume mode stamps `assumed_by` on events/audit and cannot buy tokens.
- **Billing never blocks acceptance** (`lib/admin/work-billing.ts`): missing rate / company / QBO mapping / connection → `manual_required` + accountant email + Lark; QBO failure → `failed` likewise. Success mirrors the invoice into `company_os.invoices` (upsert on source+external_id) so the portal shows it before the weekly sync.
- **QBO OAuth** (`lib/qbo.ts`): refresh-token rotation persisted via conditional update on the token used (concurrency-safe); weekly keepalive cron `/api/cron/qbo-refresh`; connect UI at `/admin/settings/quickbooks`.

## Operator setup (one-time)

- Intuit developer app for Talent Edge LLC → `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`, `QBO_REDIRECT_URI` (= `https://www.edge8.ai/api/qbo/callback`), `QBO_ENV` (sandbox first).
- "Contractor Services" service item in QBO → `QBO_SERVICE_ITEM_ID`.
- `ACCOUNTING_EMAIL` for invoice/receipt notices.
- Map client companies to QBO customers (companies.metadata.qbo_customer_ids — already done for the 38 synced customers).
- Stripe webhook already covers `checkout.session.*`; token packs ride the same endpoint (`metadata.type = 'token_pack'`).

## Open items

- Overtime hours are billed at the same billable rate (flagged; change in `lib/admin/work-billing.ts` if OT should differ).
- Token draw-down against work billing: future phase.
- QBO sales receipts for token purchases: deferred (Stripe payouts reconcile via existing sync; accountant email is the bridge).
