# Contractor Work Requests & Monthly Payments

**Date:** 2026-07-16
**Status:** Plan — awaiting approval
**Applies to contractors (verified in live DB):**

| Contractor | `people.email` | `people.full_name` | team_members |
|---|---|---|---|
| Ginny | `ginny.vo@edge8.ai` | Võ Quỳnh Chi | ✅ `employment_type='contract'`, active (Client Delivery, AI-Driven Junior Designer & Video Editor) |
| Lan Anh | `anh.pham@edge8.ai` | Phạm Thị Hoàng Lan Anh | ✅ `employment_type='contract'`, active (Client Delivery, Web Designer) |
| Yon | `yon@edge8.ai` | "yon2" (needs fixing) | ❌ none — needs a `team_members` row |

Known duplicate person rows to reconcile later (non-blocking): `ginnyvo.work@gmail.com` (Ginny Vo), `yonavo@gmail.com` (Yon Anh Vo), `yon@smartsalesprocess.com`.

---

## 1. Goal

A closed loop for commissioning, tracking, and paying contract work:

1. Admin creates a **work request** for a contractor.
2. Contractor gets an **email with a login-less link**.
3. On the link, the contractor submits an **estimate + plan**.
4. Admin **approves / rejects / requests more info** — each action emails the contractor.
5. On approval, the contractor does the work and submits **actual hours + explanation + supporting link**.
6. On the **1st of each month**, the system rolls all accepted work per contractor into a **payment request** (hours × rate).
7. Admin has a **payments page** to mark each request **paid / rejected / more info required**.

### v1 decisions (confirmed)
- **Notifications:** email only (Resend, `lib/email.ts`). Lark is deferred; the notification layer is written behind a single helper so Lark can be added later without touching the workflow.
- **Pay calc:** each contractor has a stored **hourly rate + overtime rate**; payment auto-computes as `regular_hours × hourly + overtime_hours × overtime`. Admin can override before paying.
- **Ledger:** standalone tracker. `company_os.expenses` / QuickBooks integration is **out of scope for v1** (a later phase can push a paid request into `expenses`).
- **Identity:** contractors already exist as `company_os.people` + `team_members` rows with `employment_type='contract'` — the roster IS `team_members where employment_type='contract' and status='active'`. No new roster table. **Pay rates live in the separate, existing `company_os.compensation` table** (0 rows today, already shaped for this: `team_member_id`, `comp_type`, `amount_cents`, `currency`, `pay_period`, `effective_from/to`, `is_current`, `approved_by`) so rate data keeps its own access boundary.

---

## 2. How this fits the existing codebase

This feature reuses established patterns — no new infrastructure is invented.

| Need | Existing pattern to copy | Files |
|---|---|---|
| Admin CRUD page + detail drawer | **vendors** | `app/admin/(dashboard)/operations/vendors/*` |
| Status workflow (guarded transitions + badge tones) | **time_off** / **ideas** | `app/admin/(dashboard)/operations/time-off/requests/*`, `lib/admin/time-off.ts` |
| Server actions (`requireAdmin` → validate → write via `companyOs` → `recordAudit` → `revalidatePath`) | vendors `actions.ts` | `lib/admin/audit.ts`, `lib/supabase.ts` |
| Login-less external link (opaque token → service-role lookup, `force-dynamic` + `noindex`) | **event ticket** `/t/[code]` | `app/t/[code]/page.tsx`, `lib/events-server.ts` (`newTicketCode`) |
| Transactional email | Resend helper | `lib/email.ts` (`sendTransactionalEmail`) |
| Monthly scheduled job (Vercel cron + `CRON_SECRET` bearer) | passport cleanup | `vercel.json`, `app/api/trip-passport-cleanup/route.ts` |
| USD/VND money (native `amount_cents` + `currency`, derive USD) | deals/orders + FX | `lib/admin/fx.ts`, `company_os.fx_rates` |
| Nav registration | `NAV` array | `components/admin/AdminSidebar.tsx` |

Security model is unchanged: `company_os` is service-role-only (RLS on, no browser grants); every server action starts with `requireAdmin()`; the public link route reads through the service-role client scoped to a single token.

---

## 3. Data model

Only **three new tables**; roster and rates reuse existing structures. New migrations follow repo convention (`supabase/migrations/<UTCts>_<slug>.sql`, each ending with `enable row level security` + `grant … to service_role`; applied via Supabase MCP). Types are hand-written per feature (no generated `Database` type in this repo).

Money is stored in **cents + currency** per contractor (VND or USD). Hours are `numeric(6,2)`.

### 3.1 Roster — existing `team_members` (no new table)
The contractor roster is `team_members where employment_type = 'contract' and status = 'active'` joined to `people` for name/email. Ginny and Lan Anh already qualify.

**Data prep (part of Phase 1, data-only — via MCP, with your confirmation before writing):**
- Fix Yon's person row: `full_name = 'yon2'` → real name on `yon@edge8.ai`.
- Create Yon's `team_members` row (`employment_type='contract'`, `status='active'`, department/position TBD from you).
- (Later, optional) merge duplicate person rows: `ginnyvo.work@gmail.com`, `yonavo@gmail.com`, `yon@smartsalesprocess.com`.

### 3.2 Rates — existing `company_os.compensation` (no new table)
The table is empty and already has the right shape and separation. Convention for contractor rates (two rows per contractor, both `is_current=true`):
```
comp_type = 'contract_hourly'   → hourly rate   (pay_period = 'hour')
comp_type = 'contract_overtime' → overtime rate (pay_period = 'hour')
amount_cents / currency / effective_from / effective_to / is_current / approved_by as designed
```
Rate changes supersede (`is_current=false`, set `effective_to`) rather than mutate — full rate history preserved. Only the rates admin surface and the payment roll-up read this table. Seed rows for all three contractors need the actual rates from Dave (see §8).

### 3.3 `contractor_work_requests` — the core record (new)
```
id                 uuid pk default gen_random_uuid()
person_id          uuid not null references company_os.people(id)   -- contractor
title              text not null
brief              text not null                    -- what admin is asking for
access_token       text not null unique             -- opaque bearer code (Crockford base32, crypto.randomBytes)
status             text not null default 'awaiting_estimate' check (status in (
                     'draft','awaiting_estimate','estimate_submitted','changes_requested',
                     'approved','rejected','work_submitted','completed','cancelled'))
-- estimate (contractor-supplied)
estimated_hours    numeric(6,2)
plan_text          text
estimate_submitted_at timestamptz
-- decision (admin-supplied) — latest decision snapshot; full history in _events
decided_by         text
decided_at         timestamptz
-- work submission (contractor-supplied)
actual_hours          numeric(6,2)                  -- regular hours
actual_overtime_hours numeric(6,2) default 0
work_summary          text
work_link             text
work_submitted_at     timestamptz
accepted_by           text                          -- admin accepts the completed work
accepted_at           timestamptz
-- payment linkage
payment_id         uuid references company_os.contractor_payments(id)
created_by         text not null
created_at         timestamptz not null default now()
updated_at         timestamptz not null default now()
```

**Status machine**
```
draft ─(send)→ awaiting_estimate ─(contractor submits)→ estimate_submitted
estimate_submitted ─(admin approve)→ approved
                   ─(admin reject)→ rejected            [terminal]
                   ─(admin request info)→ changes_requested ─(contractor resubmits)→ estimate_submitted
approved ─(contractor submits work)→ work_submitted
work_submitted ─(admin accept)→ completed   (eligible for month-end payment roll-up)
               ─(admin request info)→ approved (contractor revises submission)
any active ─(admin cancel)→ cancelled       [terminal]
```
> Interpretation of "each response triggers a request for more information": **approve** advances the request; **reject** closes it; **request more info** sends it back to the contractor with a note. Every admin action emails the contractor.

> `person_id` keys the request (the contractor's email lives on `people`); the payment roll-up joins `people → team_members → compensation` for rates.

### 3.4 `contractor_work_events` — timeline / thread (new)
One row per meaningful event so the drawer shows the full back-and-forth (and admin↔contractor notes).
```
id            uuid pk default gen_random_uuid()
request_id    uuid not null references company_os.contractor_work_requests(id) on delete cascade
actor_type    text not null check (actor_type in ('admin','contractor','system'))
actor         text                       -- admin email, or 'contractor'
type          text not null check (type in (
                'created','estimate_submitted','approved','rejected','info_requested',
                'estimate_resubmitted','work_submitted','accepted','message','cancelled'))
body          text                       -- note / message text
meta          jsonb not null default '{}'  -- e.g. {hours, overtime_hours, link}
created_at    timestamptz not null default now()
```

### 3.5 `contractor_payments` — monthly payment request (new)
Line items are the `contractor_work_requests` rows pointing at this payment (no separate line table needed).
```
id                uuid pk default gen_random_uuid()
person_id         uuid not null references company_os.people(id)
period_month      date not null                 -- first day of the covered month
status            text not null default 'pending' check (status in ('pending','paid','rejected','info_requested'))
total_regular_hours  numeric(8,2) not null default 0
total_overtime_hours numeric(8,2) not null default 0
amount_cents      bigint not null default 0     -- computed at roll-up; overridable
currency          text not null
summary           text
decided_by        text
decided_at        timestamptz
paid_at           timestamptz
note              text                          -- admin note on reject / more-info
created_at        timestamptz not null default now()
updated_at        timestamptz not null default now()
-- unique (person_id, period_month)
```

---

## 4. Public contractor link (login-less)

- **Route:** `app/work/[token]/page.tsx` — `export const dynamic = "force-dynamic"`, `robots: { index: false }` (copy `/t/[code]` conventions). Verify `/work` doesn't collide before building.
- **Token:** generated with the `newTicketCode`-style helper (`crypto.randomBytes` → Crockford base32), stored on `contractor_work_requests.access_token`. One token per request = a stable private workspace for that job across the whole back-and-forth.
- **Behaviour (state-driven):** the page loads the request via service-role `.eq("access_token", token).maybeSingle()`, `notFound()` on miss, and renders by status:
  - `awaiting_estimate` / `changes_requested` → **estimate form** (hours + plan textarea), plus any admin "more info" note from `_events`.
  - `estimate_submitted` → read-only "submitted, awaiting review".
  - `approved` → **work-submission form** (regular hours, overtime hours, summary, supporting link).
  - `work_submitted` / `completed` / `rejected` / `cancelled` → read-only status with the timeline.
- **Submissions** are handled by server actions in the route (not the admin gate) that re-validate the token, write the request + a `_events` row, and email the admin/ops that a response arrived. Honeypot field on the forms (matches the surveys anti-bot pattern).

---

## 5. Admin UI

Registered in `components/admin/AdminSidebar.tsx` under the **Operations** office, new subheading **Contractors**:

| Leaf | Route | Purpose |
|---|---|---|
| Work Requests | `/admin/operations/contractor-requests` | List + create + drawer with the full workflow |
| Contractors | `/admin/operations/contractors` | Roster view (contract `team_members` + `people`) + rate editor over `compensation` |
| Payments | `/admin/operations/contractor-payments` | Monthly payment requests + paid/reject/more-info |

**Work Requests** (`page.tsx` server component → `DataTable`; drawer is client):
- Create form: pick contractor, title, brief → creates request in `draft`, then **Send** transitions to `awaiting_estimate` and emails the link.
- Drawer (`DetailDrawer`): brief, the estimate (hours + plan), a **timeline** from `_events`, and action buttons by state — **Approve / Reject / Request more info** (with a note), and after work: **Accept work / Request revision**. Each button is a guarded server action.
- Badge tones via a `statusTone()` map (copy `lib/admin/time-off.ts`).

**Contractors**:
- Roster table (name/email/position/status from `people` + `team_members` where `employment_type='contract'`). Read-mostly — employment data is managed by the existing team pages.
- Rate editor writes `compensation` rows (`contract_hourly` + `contract_overtime`, currency, effective-dated; supersede the prior `is_current` row rather than mutating it). This is the only surface that reads/writes rates.

**Payments**:
- List of `contractor_payments` (contractor, month, hours, amount, status).
- Drawer: the linked work requests as line items + computed total; **Mark paid / Reject / Request more info** (guarded actions, `recordAudit`, email the contractor).

All server actions follow the repo pattern: `requireAdmin()` → validate → `companyOs.from(...)` → `recordAudit(...)` → `revalidatePath(...)`, returning `{ ok: true } | { ok: false; error }`.

---

## 6. Notifications (email v1, Lark-ready seam)

A single module, e.g. `lib/contractor-notify.ts`, wraps every outbound message so the transport is swappable:
```ts
notifyContractor(personId, kind, payload)  // v1: sendTransactionalEmail(...); later: + Lark
notifyOpsAdmins(kind, payload)             // v1: notifyOps(...) channel + optional admin email
```
Contractor-facing emails (inline HTML templates in `lib/email.ts` style, from `Edge8 <notifications@edge8.ai>`):
- **New work request** → link to `/work/[token]`.
- **Decision**: approved / rejected / more-info-requested (includes the admin note + link).
- **Payment**: monthly request created (optional) and payment marked paid.

Admin/ops-facing (best-effort, existing `notifyOps` channel): contractor submitted an estimate; contractor submitted work; month-end roll-up ran.

> When Lark is chosen later, store a Lark target per contractor (e.g. `people.metadata.lark_webhook_url` or a dedicated column) and extend `notifyContractor` only — no workflow changes.

---

## 7. Month-end roll-up (cron)

- **Route:** `app/api/cron/contractor-payments/route.ts` (`runtime = 'nodejs'`, `GET`, `CRON_SECRET` bearer guard — copy passport-cleanup).
- **Schedule (`vercel.json`):** `{ "path": "/api/cron/contractor-payments", "schedule": "0 6 1 * *" }` (06:00 UTC on the 1st).
- **Logic (idempotent):** for each active contractor, find `completed` work requests whose `payment_id is null` and whose `accepted_at` falls in the **prior** month. If any exist:
  - create one `contractor_payments` row for that `(person_id, period_month)` (skip if it already exists — the unique constraint + a pre-check make re-runs safe),
  - `amount_cents = Σ(regular_hours × hourly_rate + overtime_hours × overtime_rate)` using the contractor's `is_current` `compensation` rows (`contract_hourly` / `contract_overtime`) and their currency,
  - stamp `payment_id` back onto each linked work request,
  - email the ops channel (and optionally the contractor).
- Manual trigger: a "Run roll-up now" button on the Payments page calling the same code path (guarded) for testing / off-cycle runs.

---

## 8. Open design points to confirm during build (non-blocking)

1. **Overtime capture** — v1 has the contractor enter regular vs overtime hours separately on the work-submission form (OT defaults to 0). Alternative: single hours field + admin flags OT at payment. *Assumption: contractor-entered split, admin can adjust.*
2. **Work acceptance step** — plan includes an admin "Accept work" gate (`work_submitted → completed`) so only accepted work is payable. If you'd rather auto-complete on submission, drop that step.
3. **Route name** `/work/[token]` — confirm no collision; fallback `/c/[token]`.
4. **Actual rates needed from Dave** — hourly + overtime rate and currency for Ginny, Yon, and Lan Anh, to seed `compensation`.
5. **Yon's details** — real full name for `yon@edge8.ai` (currently "yon2"), plus department/position for the new `team_members` row.
6. **Duplicate people** — `ginnyvo.work@gmail.com`, `yonavo@gmail.com`, `yon@smartsalesprocess.com` should eventually be merged/archived so notifications can't hit a stale row (non-blocking; feature keys on the canonical `@edge8.ai` rows).

---

## 9. Build phases (each independently shippable, batched into PRs per repo norm)

**Phase 1 — Schema + data prep + rates**
- Migrations for the three new tables (`contractor_work_requests`, `contractor_work_events`, `contractor_payments` + indexes/RLS/grants).
- Data prep (confirmed with Dave first): fix Yon's name, create Yon's contract `team_members` row, seed `compensation` rates for all three.
- Contractors admin page: roster view + secured rate editor.
- *Verify:* `tsc` + `next build`; rate editor writes/supersedes correctly; `audit_log` rows appear. (No dev server per project convention.)

**Phase 2 — Work request workflow (admin side)**
- Work Requests list + create + **Send**, drawer with timeline and Approve/Reject/Request-info/Accept actions.
- `contractor-notify` module (email transport) + templates in `lib/email.ts`.
- *Verify:* each transition guards correctly, writes `_events`, and triggers the right email.

**Phase 3 — Public contractor link**
- `/work/[token]` route + estimate form + work-submission form + token-validated submit actions + honeypot.
- *Verify:* full happy path token-side (submit estimate → admin approves → submit work), plus more-info round-trips.

**Phase 4 — Payments + month-end cron**
- Payments page + drawer + paid/reject/more-info actions.
- `/api/cron/contractor-payments` route + `vercel.json` entry + manual "Run roll-up" button.
- *Verify:* roll-up computes hours × rate (incl. overtime), is idempotent on re-run, links work requests, and payment status actions email the contractor.

**Later (out of v1 scope):** Lark delivery; push a `paid` payment into `company_os.expenses` for P&L; USD reporting conversion.

---

## 10. Env / config
- Reuse existing: `RESEND_API_KEY`, `EMAIL_FROM`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `CRON_SECRET` (set in Vercel for the new cron).
- No new secrets for v1 (Lark vars only when that phase lands).
