# Lead Satellite Refactor — Implementation Plan

**Date:** 2026-07-07
**Status:** Decisions confirmed by Dave 2026-07-07 — ready to build
**Owner:** TBD

## 1. Problem

Lead-funnel state lives directly on `company_os.people` — the universal person table
that also holds employees (`team_members`), candidates, and vendor contacts. So every
human carries five sales columns that are meaningless for most of them:

| column | type | default |
|---|---|---|
| `lifecycle_stage` | text | `'none'` |
| `lead_status` | text | null |
| `lead_sla_due_at` | timestamptz | null |
| `lead_attempt_count` | int | `0` |
| `disqualified_reason` | text | null |

This is inconsistent with the codebase's own pattern: employment extends a person via the
`team_members` satellite, recruiting via `candidates`. Lead is the one role that got
inlined. The fix is a **`lead` satellite** (only lead-people get a row) plus splitting the
fields by grain: contact-chasing mechanics stay person-level, account journey moves to the
company, opportunity value/stage stays in `deals`.

## 2. Decisions (confirmed 2026-07-07)

| # | Decision | Confirmed |
|---|---|---|
| D1 | Lead grain | **1 lead per person, only** — `unique(person_id)`; history stays in `lifecycle_transitions`. |
| D2 | `lifecycle_stage` home | **Company** (`companies.lifecycle_stage`). |
| D3 | Field split | `lead_status`→`lead.status`, `lead_sla_due_at`→`lead.sla_due_at`, `lead_attempt_count`→`lead.attempt_count`, `disqualified_reason`→`lead.disqualified_reason`; `lifecycle_stage`→`companies.lifecycle_stage`; opportunity stays in `deals`. |
| D4 | Lead↔company link | **None.** No `company_id` on `lead` — a lead's company association is derived through `person_companies`, same as any other person. |

Remaining open item: the **company lifecycle backfill rank** (§5) — defaulted to the code's
own stage order; flag if wrong.

## 3. Target model

New table:

```sql
create table company_os.lead (
  id            uuid primary key default gen_random_uuid(),
  person_id     uuid not null references company_os.people(id) on delete cascade,
  status        text not null default 'new',      -- was people.lead_status
  sla_due_at    timestamptz,                       -- was people.lead_sla_due_at
  attempt_count integer not null default 0,        -- was people.lead_attempt_count
  disqualified_reason text,                        -- was people.disqualified_reason
  owner_id      uuid references company_os.people(id),  -- matches people/companies owner_id convention
  source        text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint lead_person_unique unique (person_id) -- D1: 1:1 grain
);
alter table company_os.lead enable row level security;
-- Grants: new tables need explicit service_role grants or the app can't see them.
grant select, insert, update, delete on company_os.lead to service_role;
```

No `company_id` on `lead` (D4): company association derives through `person_companies`.

Company lifecycle (currently absent on `companies`):

```sql
alter table company_os.companies
  add column lifecycle_stage text not null default 'none';
```

**Value sets — unchanged, taken from `lib/lifecycle.ts`** (keeping the existing vocabulary
means zero remapping in the UI):

- `lead.status` = the existing `LeadStatus` enum: `new / attempting / connected /
  meeting_booked / open_deal / unqualified / nurture`.
- `companies.lifecycle_stage` = the existing `LifecycleStage` enum: `none / subscriber /
  lead / mql / sql / opportunity / customer / evangelist`.

**`lifecycle_transitions` addendum:** the transition log is person-scoped
(`person_id`, `from_stage`/`to_stage`, `from_status`/`to_status`). With stage moving to the
company, add a nullable `company_id` column: status transitions keep `person_id`, stage
transitions carry `company_id` (either may be null). Funnel history stays in one table.

```sql
alter table company_os.lifecycle_transitions
  add column company_id uuid references company_os.companies(id);
```

## 4. Blast radius (measured)

**DB objects:** only the `people_with_deals` view references the five columns.
No triggers or functions — SLA/attempt logic is entirely in app code (`lib/lifecycle.ts`).

**App code (~9 files + 1 skill):**

| File | What changes |
|---|---|
| `lib/lifecycle.ts` | Core. Lifecycle/lead transition + SLA/attempt logic → read/write `lead` and `companies.lifecycle_stage`. |
| `app/admin/(dashboard)/revenue/leads/page.tsx` | Leads list/filters → query `lead` (join `people`, `companies`). |
| `app/admin/(dashboard)/revenue/leads/actions.ts` | Advance status / log attempt / set SLA / disqualify → write `lead`. |
| `app/admin/(dashboard)/revenue/deals/actions.ts` | Repoint any lifecycle/lead reads. |
| `app/admin/(dashboard)/revenue/page.tsx` | Revenue dashboard lead/lifecycle counts. |
| `app/admin/(dashboard)/contacts/page.tsx` | Contact list columns that surface lead/lifecycle. |
| `app/admin/(dashboard)/contacts/[id]/page.tsx` | Contact detail lead panel. |
| `app/admin/(dashboard)/contacts/[id]/PromoteButton.tsx` | "Promote to lead" now inserts a `lead` row instead of setting `people.lifecycle_stage`. |
| `lib/admin/contacts.ts` | Contact queries that join lead/lifecycle. |
| `.claude/skills/crm-lead/SKILL.md` | Manual lead capture writes the `lead` table (and company link). |

Plus: regenerate Supabase TS types after the schema change.

## 5. Data migration / backfill

**Who becomes a lead:** any person currently carrying lead state.

```sql
insert into company_os.lead (person_id, status, sla_due_at,
                             attempt_count, disqualified_reason, owner_id, created_at)
select p.id,
       coalesce(p.lead_status, 'new'),
       p.lead_sla_due_at, p.lead_attempt_count, p.disqualified_reason,
       p.owner_id, p.created_at
from company_os.people p
where p.lead_status is not null
   or p.lifecycle_stage <> 'none'
   or p.lead_attempt_count > 0
   or p.lead_sla_due_at is not null
   or p.disqualified_reason is not null;
```

**Company lifecycle backfill:** company `lifecycle_stage` = the *most-advanced* stage among
its linked people (via `person_companies`), using the stage order already defined in
`lib/lifecycle.ts`: `none < subscriber < lead < mql < sql < opportunity < customer <
evangelist`. Companies with no staged contacts stay `'none'`. Dry-run the counts per stage
before committing. *(Default rank — flag before build if a different rule is wanted.)*

**Archive originals (reversibility):**

```sql
create table company_os_archive.people_lead_fields as
select id, lifecycle_stage, lead_status, lead_sla_due_at,
       lead_attempt_count, disqualified_reason
from company_os.people
where lead_status is not null or lifecycle_stage <> 'none'
   or lead_attempt_count > 0 or lead_sla_due_at is not null
   or disqualified_reason is not null;
```

## 6. Phased implementation (expand → migrate → contract)

Same two-phase discipline as the brand/legal-entity drop — never a window where deployed
code reads columns that are gone.

**Phase 1a — DB expand (no drops yet) (~half day)**
1. Create `company_os.lead` (+ RLS + service_role grants).
2. `alter companies add lifecycle_stage`.
3. Run backfill (§5) + archive.
4. Rebuild `people_with_deals` to drop the 5 columns from its SELECT; `LEFT JOIN lead`
   if the leads UI reads through the view.
5. Commit as one migration; apply. Old `people` columns still present.

**Phase 2 — App refactor (~1–2 days)**
6. Rework `lib/lifecycle.ts` (the hub), then the leads + contacts + deals + revenue
   files per §4, then the `crm-lead` skill.
7. Regenerate Supabase types (`generate_typescript_types` → `lib/database.types.ts`).
8. Verify (Phase 3), then deploy.

**Phase 1b — DB contract (~15 min, after Phase 2 is live & verified)**
9. `alter table company_os.people drop column lifecycle_stage, lead_status,
   lead_sla_due_at, lead_attempt_count, disqualified_reason;` (separate migration).

**Phase 3 — Verify (~few hours).** No dev server — verify via `tsc --noEmit` + `next build`,
then exercise on prod after deploy: create a lead via the `crm-lead` skill → appears in the
leads list → advance status → SLA/attempt update → disqualify → promote a contact → revenue
counts still correct.

## 7. Risks & mitigations

- **Live CRM plumbing** (lead follow-up/SLA in active use). → Expand/migrate/contract; the
  drop only happens after new code is verified live.
- **Backfill correctness** (company lifecycle rank). → Defaulted to the code's stage order;
  dry-run row counts before commit; archive table makes it reversible.
- **Type drift** after schema change. → Regenerate types in the same PR as the code.

## 8. Rollback

Phase 1a/2 are additive — revert code, the `lead` table is harmless. After Phase 1b, restore
columns from `company_os_archive.people_lead_fields` and re-run backfill in reverse. Keep the
archive until the change has been stable for a sprint.

## 9. Effort

**~2–3 focused days**, split: Phase 1a ½ day · Phase 2 1–2 days · verify + Phase 1b ½ day.
Well-bounded (one view, no triggers, lifecycle logic centralized in `lib/lifecycle.ts`); the
weight is the ~9-file app refactor, not the schema.
