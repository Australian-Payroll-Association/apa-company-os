# Building on `company_os`

**Australian Payroll Association, Engineering plan · Three builds, one schema**

Three teams have three app ideas, and an existing app, Payroll IQ, runs on a database of its own. This is the case for building all three **on the company data structure we already have**, the method for doing it without building separate, duplicate systems, and how Payroll IQ folds into the same database.

- **Who this is for:** the people building Report 360, the PM system & Beryl ROI.
- **The database:** `company_os` · 136 tables, one schema.
- **The one rule:** reference the shared database, never re-create it.

---

## Start here

Getting set up to build your piece.

**What you do**

1. **Get access.** You need the GitHub org (ask Dave) and Claude Code. Node is already installed.
2. **Get your task.** Check with the coordinator for what you're building, so nobody's work clashes.
3. **Add the Supabase credentials.** Dave gives you the values. Save them in a file called `.env.local`. It stays on your machine and is never shared.
4. **Tell Claude Code what you're building.** From here, Claude Code does the technical work; you review what it shows you.

**What you ask Claude Code to do**

- **Clone the repo:** https://github.com/Australian-Payroll-Association/apa-company-os
- **Make a branch** for your work. Never work on `main`.
- **Install and start the app** so you can see it in your browser, and get you a login if your part is behind sign-in.
- **Reuse the existing tables** this plan lists; only add the new ones it calls for. Never rebuild what is already there.
- **Put code in the right place:** pages in `app/`, shared code in `lib/`, database changes as a new file in `supabase/`. Never change live data.
- **Open a Pull Request** into `main` when it works. Once approved and merged, it goes live automatically, with no manual deploy.

---

## 1. Use what's already built

`company_os` is the single Postgres schema behind the APA platform, **136 tables** covering people, clients, deals, surveys, tasks, documents, invoices and pay. Three properties every new build should lean on, not re-invent:

- **One identity, one client list.** Every human is a row in `people`; every client is a row in `companies`. Nothing else keys a person or a client.
- **Locked down by default.** Row-level security denies the browser key everything; all reads flow through a service-role client behind server actions. Pay-adjacent data lives in `*_sensitive` tables gated by `can_view_sensitive`.
- **Derived, not duplicated.** The schema already refuses to store a number it can compute, cost is a view over hours and rates, never a saved column.

Two of the three ideas, the project system and the report engine, already have **70–80% of what they need already in the database**. Building them here means one login, one permission model, and one place a client or a cost lives. Building them as separate apps means re-implementing all of that, then reconciling it forever.

---

## 2. The method

Six moves you run *before* writing a migration. Applies to any new feature, not just these three.

1. **Start from what's already there, not a blank database.** Find the four things your feature connects to: **identity**, **account**, **catalogue**, **money**. If your design invents any of them, stop.
   - In `company_os`: identity `people` · account `companies` · catalogue `service_lines` / `products` · money `compensation_sensitive` / `deals` / `invoices`.
2. **Use the existing tables, don't copy them.** A new table carries a `person_id` / `company_id` FK *into* the shared database. The mistake to avoid is a second `users`/`clients` table that drifts out of sync. (The Beryl plan nearly did this, sending leads only to HubSpot.)
3. **Put the variable shape in `jsonb`, not new columns.** `surveys.metadata`, `survey_fields.config`, `tasks.metadata`, `companies.metadata` already exist, per-team/per-feature variability lives there. That's how the PM plan gets "own types, one roof."
4. **Derive money, never store it.** Compute cost/margin/totals in a **view** at read time. A stored cost column becomes a second truth the moment a rate changes. `project_cost` = Σ hours × the person's *current* rate from `compensation_sensitive`.
5. **Inherit the permission model.** Reads go through the service-role client behind a server action; pay-/PII-adjacent data goes in a `*_sensitive` table gated by `can_view_sensitive`. The PM plan's "only leadership sees cost rates" is *already solved* by that gate.
6. **Use the tables built to attach to anything.** `documents(entity_type, entity_id)` and `tasks(subject_type, subject_id)` already point at whatever you name, attach a report, a file, or a task to any entity without altering a shared table.

---

## 3. The core data to pull in

Every build reads from the same canonical tables. Link to these, seed into these, never keep your own copy.

| Canonical entity | What it is | Read / link by | Never duplicate |
|---|---|---|---|
| `people` | Every human, staff, client contact, prospect (`email`, `auth_user_id`, `is_team_member`) | `person_id` | a users / contacts table |
| `companies` | The client account (`industry`, `size_band`, `client_types[]`, `lifecycle_stage`) | `company_id` | clients keyed by name string |
| `person_companies` | Who works where, contact ↔ employer (`role`, `is_primary`) | `person_id + company_id` | an employer text field |
| `service_lines` | What APA sells: consulting, training, advisory (`business_unit`) | `service_line_id` | a hardcoded product list |
| `products` | Sellable items with price, Beryl sub, courses (`amount_cents`, `stripe_*`) | product slug / id | a price hardcoded in the app |
| `compensation_sensitive` | The cost-rate source (`amount_cents`, `pay_period`, `is_current`), permissioned | the sensitive gate only | a rate copied onto a project |
| `surveys` + fields + responses + answers | The whole intake / assessment engine | `survey_id` / `response_id` | a bespoke form + answers table |
| `documents` | Polymorphic file store (`storage_path` + `entity_type/entity_id`) | `entity_type + entity_id` | a feature-specific files table |
| `deals` | An engagement / opportunity and its value (`company_id`, `amount_cents`, `service_line_id`) | `deal_id` | an engagements table |
| `lead` | Inbound with a workflow (`status`, `sla_due_at`, `owner_id`, `source`) | `person_id` | a leads spreadsheet / silo |
| `assistant_conversations` | Stored AI threads, reuse for any drafting feature | `id` + entity ref | a new chat-history table |

---

## 4. The three builds

Same anatomy for each: what it **reuses** from the shared database, what's genuinely **new**, the core data to pull in, derived views, and permissions.

### Build A · Payroll 360 Report Engine, *medium, cleanest fit*

**Full detail: [project-report-360.md](project-report-360.md)**

A client survey becomes a structured, house-style compliance-report *draft*, consultants review and sharpen instead of writing from a blank page.

- **Reuses:** `surveys`, `survey_fields`, `survey_responses`, `survey_answers`, `companies`, `people`, `person_companies`, `deals`, `service_lines`, `documents`, `assistant_conversations`. The survey engine *is* the intake tool; the 35-question Knowledge Assessment is just a scored survey.
- **New tables:**
  - `report`, `company_id → companies`, `deal_id → deals`, `environment_response_id → survey_responses`, `assessment_response_id → survey_responses`, `status draft|review|sent`, `house_style_version`, `created_by`
  - `report_section`, `report_id → report`, `position`, `kind context|observation|recommendation`, `body_html`, `source_refs jsonb`, `is_placeholder bool` (placeholders double as the evidence checklist)
  - assessment scores, `response_id → survey_responses`, `competency`, `raw_score`, `benchmark` (or fold onto `survey_responses.metadata`)
- **Core data to pull in:** client as a `companies` row + primary contact via `people`/`person_companies`; engagement as a `deals` row on the consulting `service_line`; both intake layers as `surveys` (environment + 35-Q assessment) with competency and client/consultant view in `survey_fields.config`; the evidence pack as `documents` attached to the report; the 12-part house style seeded as a config document.
- **Derived & permissions:** a `report_coverage` view (sections × required inputs → placeholders) and an assessment profile; reports are internal, the client only touches their own survey via the existing survey path.
- **Where the value lives:** house-style fidelity and **citations**, store evidence provenance on `documents`/answers so the AI cites, never invents.

### Build B · Unified Project System, *larger, biggest win*

**Full detail: [project-unified-pm.md](project-unified-pm.md)**

One system for ~24 people to replace Kantata, ClickUp & Infinity. The loop: create a project → log time → cost rolls up against budget.

- **Reuses:** `boards`, `board_columns`, `board_members`, `sprints`, `tasks`, `task_comments`, `task_stage_log`, `staff_assignments`, `availability_blocks`, `people`, `team_members`, `compensation_sensitive`, `deals`, `invoices`, `expenses`. The board system already covers projects/tasks/sprints/allocation; the leadership-only cost-rate requirement is pre-solved by `compensation_sensitive`'s gate.
- **New, mostly one table:**
  - `time_entry` **(the real gap)**, `person_id → people`, `board_id → boards`, `task_id → tasks` (nullable), `work_date`, `hours numeric`, `note`. No staff timesheet exists today (`contractor_work_events` is contractor-only).
  - `checklist_template` + items, per-team recurring-task checklists
  - column adds, `people.weekly_capacity_hours`; `boards.team` / `project_type` / `budget_cents` (or in `boards.metadata`)
- **Core data to pull in:** staff already are `people` + `team_members`; each person's cost rate into `compensation_sensitive`; live projects migrated into `boards`, tagged by team & type, linked via `boards.client_company_id`; budgets onto the board (actuals flow from `invoices`/`expenses`).
- **Derived & permissions:** `project_cost` = Σ `time_entry.hours` × current comp rate per board/team vs `budget_cents`; a workload view of allocated vs `weekly_capacity_hours`. Everyone logs time; only leadership reads cost, reuse the sensitive gate.
- **Two things to get right:** adoption (build `time_entry` + a ≤10-second logging screen first); one source of truth for hours (reconcile `tasks.human_tokens` vs real `time_entry`).

### Build C · Beryl ROI Calculator, *small, days*

**Full detail: [project-beryl-roi.md](project-beryl-roi.md)**

A public, ungated calculator that turns a prospect's own query volume into a dollar figure, optional PDF becomes a lead.

- **Reuses (optional but recommended):** `products`, `people`, `lead`, `deals`, `companies`. A PDF request is a `person` + a `lead` with owner and SLA, richer than a bare HubSpot contact; price comes from the `products` row, not a constant.
- **New tables:**
  - `roi_assumptions`, one editable row: `time_saved_min_low`, `time_saved_min_high`, `working_hours_year`, `typical_queries`, `updated_by` (tune with no redeploy)
  - `roi_usage_events`, `team_size`, `queries_per_user`, `salary`, `result_low_cents`, `result_high_cents`, `pdf_requested bool` (anonymous, no PII)
- **Core data to pull in:** Beryl's price from the `products` row; the two sign-off assumptions seeded into `roi_assumptions`; optionally the PDF lead written as `people` + `lead` (`source = 'roi_calculator'`).
- **Derived & permissions:** a usage rollup off `roi_usage_events`; the public never touches `company_os` directly, a server route returns only the assumptions row; writes go through a service-role route.
- **The decision:** HubSpot or the native `lead` pipeline? The OS pipeline already has SLA/owner/source, recommend routing leads there (or both).

---

## 5. Folding Payroll IQ into the same database

The fourth track is different in kind, not a new feature, but an existing app with its own database. The same rule holds (one central DB), but here it means *combining* the tables that describe the same things, not parking two apps side by side.

**Two facts that make this low-risk:** **no users yet**, identity consolidation is a *design*, not a migration (no rows to merge, no UUID surgery); **no clients yet**, no live tenants or transactions to move. What's left is schema design plus rewiring, done before anyone is on the platform.

### 5.1 What combines, what coexists

| Concern | Payroll IQ (`public`) | company_os | Verdict |
|---|---|---|---|
| Person / identity | `users` (id = auth.uid) | `people` + `team_members` | **merge → people** |
| Client org | `organisations` | `companies` | **merge → companies** |
| Membership + role | `users.org_id` + `role` | `person_companies` | **merge** |
| Platform admin / staff | `role = 'admin'` | `admins` / `team_members` | **merge** |
| Billing customer | Stripe cust. per org | Stripe cust. on `orders`/`subscriptions` | **merge → people/companies** |
| Product catalogue | `plans`, `seat_tiers` | `products` (+ stripe ids) | **one catalogue** |
| Seat + entitlement billing | `seat_tiers`, `billing_entitlement` | none | **keep, fills a gap** |
| One-off product orders | none | `orders`, `token_purchases` | **keep** |
| Training content | `modules`, `questions`, `quiz_*`, mastery | none | **keep in public** |
| Everything else |, | the other 130-odd tables | **untouched** |

### 5.2 Identity: one person, one row

`people` becomes the source of truth for every human. `users` becomes a view over it, so Payroll IQ's code barely changes.

- `public.users` **(now a VIEW):** `id = people.auth_user_id`, `email`, `full_name`, `role` (derived), `org_id = person_companies.company_id`, + learner attrs from `learner_profiles`. PIQ's reads and RLS (`u.id = auth.uid()`) keep working; the few write paths repoint to the real tables (or get `INSTEAD OF` triggers).
- `public.learner_profiles` **(new):** `person_id → people`, `content_track`, `weekly_minutes`, `diagnostic_completed_at`, `preferences`, `status`, the training-only attributes that don't belong on the shared person.

**The one structural bridge:** Payroll IQ *conflates person and login* (`users.id = auth.uid()`); company_os separates them (a `people` row may have no login yet). Set `people.auth_user_id = auth.users.id` and leave every PIQ `learner_id` column as the auth uid, so all 13 of them, and their `auth.uid()` RLS, don't change at all.

### 5.3 The client model: one company, many employees

A client org has many employees; each may, or may not yet, have a login.

```
companies                 the client org · client_types[] can be training + consulting
   │  1 ──< many · role: manager | learner
person_companies          the membership · role lives here, per (person, company) · is_primary
   │
people                    one row per employee · auth_user_id = login (optional)
   │  1 ── 1
learner_profiles          training attributes (public schema)
```

- **Role lives on the membership, not the person.** "Manager *of* company X" is a per-`person_companies` fact. One person can be a manager at one org and a learner at another.
- **An employee can exist before a login.** A manager adds 40 staff as `people` + `person_companies(role:'learner')` today; each gets `auth_user_id` only on accepting the invite. Seat-billing can then count *provisioned* vs *activated*.
- **One company, many service lines.** `client_types[]` lets the same org be a training client and a consulting client, one client record across all of APA.
- **Many-to-many is allowed** *(decided)*, a person may belong to more than one client company; the `users` view exposes the `is_primary` membership as `org_id` so PIQ's manager-scoped RLS is unchanged.

**Invite flow:** manager invites employees → create `people` + `person_companies(role:learner)` now → send invite → on accept, set `auth_user_id`. Seat consumption = count of the company's `person_companies` where `role = 'learner'`.

### 5.4 Commerce: one Stripe account, two engines

company_os isn't empty here, it has a Stripe-wired stack too, a different shape. They model different sales, so combining means reconciling, not deleting.

| | company_os | Payroll IQ |
|---|---|---|
| Model | person-based one-off + subs | org / seat-based subscriptions |
| Tables | `products`, `orders`, `subscriptions`, `token_purchases` | `plans`, `seat_tiers`, `billing_entitlement`, `invoice_records` |
| Sells | events, courses, token packs | training **seats** to an org, entitlement-gated |

- **One Stripe account, one webhook owner, the main risk.** Two apps, one DB, each with its own `/api/webhooks/stripe` is where split-brain lives. Consolidate to one account; each app's webhook handles only *its own* product/price ids.
- **Shared customer + catalogue** fall out of the identity merge: the Stripe customer lives on unified `people`/`companies` (a client org is one customer, not two); link PIQ's `plans`/`seat_tiers` to `products` + `service_lines` for one catalogue.
- **Keep both engines:** PIQ's seat + entitlement billing is a capability company_os lacks; company_os's one-off orders stay. Both key off the unified core tables.
- **Reconcile the two invoice tables:** company_os `invoices` (QBO-synced AR) vs PIQ `invoice_records` (Stripe-side), set a clear record-of-truth per transaction type.

### 5.5 What it takes

No data migration (no users, no clients). Design + rewiring, done before launch.

- Build the unified core tables additions: `learner_profiles`, the `users` view, `client_types` tagging; land PIQ's `public` + `app_security` schemas in the one project (its `public` schema is empty and already PostgREST-exposed).
- Repoint PIQ's few write paths (signup, profile, role change) at the real tables; rewrite `app_security.is_admin()` / `is_learner()` to resolve via the unified model.
- Consolidate to one Stripe account + webhook ownership; link catalogue.
- Re-point PIQ's `website/` env at the central project, migrate storage buckets, add its domain to the project's auth redirect URLs, regenerate DB types.
- Smoke-test each role (admin / manager / learner) end-to-end against the central DB.

**Effort:** ~1–2 weeks, dominated by the `users`-view / write-path rework and the Stripe reconciliation, *not* data movement. The no-users, no-clients window is the moment to do it.

---

## 6. Sequence & sign-offs

Recommended order (the three builds), plus the decisions that are data or policy, not code.

1. **Beryl ROI**, ship in parallel, any time. Smallest, isolated, two tables; proves the "new tables + service route on the shared schema" pattern. *(days)*
2. **Report 360**, highest reuse, clearest payoff. Intake engine already exists; net-new is the report model, scoring, drafting prompt. *(medium)*
3. **Unified PM**, the consolidation play. Biggest win and biggest change; start with `time_entry` + fast logging, pilot Consulting, then roll out. *(larger)*
- ▹ **Payroll IQ merge**, separate track, independent of the three builds. No users/clients yet, so it's design + rewiring; the pre-launch window is the moment. *(~1–2 wks)*

**Sign-offs & decisions**

- **[Data] Beryl assumptions.** Time-saved per query (20–45 min) and typical queries per user need sign-off before the page claims "based on our data."
- **[Data] Assessment rubric.** The 6-competency scoring + benchmark must be agreed before scores print on a client report.
- **[Decision] Who is "leadership".** The cost-rate gate needs a definition of who may read rates and `project_cost`, a config choice on `can_view_sensitive`.
- **[Decision] Hours, one source of truth.** Reconcile `tasks.human_tokens` with the new `time_entry`.
- **[Decision] Beryl leads: HubSpot or native.** Pick where ROI inbound lands.
- **[Decided] Payroll IQ tenancy: many-to-many.** A person may belong to more than one client company; the `users` view exposes the `is_primary` membership as `org_id`.
- **[Decision] One Stripe account + webhook ownership.** Consolidate the account and split event ownership by product/price id.
- **[Decision] Invoice record-of-truth.** company_os `invoices` (QBO AR) vs PIQ `invoice_records` (Stripe), set which owns which transaction type.
