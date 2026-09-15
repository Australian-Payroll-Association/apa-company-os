# Payroll IQ consolidation — ticket set and blocking edges

The **canonical tracker is the APA Company OS board** (`company_os.tasks`, 16 cards, 54 HT),
where each card already carries acceptance criteria. This file records the dependency graph,
which the board does not model, plus the status of each ticket. Ticket 01 has its own file
because it was written before the board was reconciled; the rest map 1:1 to board cards.

Scope ends **before** the production env flip. Everything here runs while payroll-iq keeps
serving its own database, so the two projects are live replicas throughout and aborting at any
point costs nothing.

| # | Ticket | Blocked by | HT | Status |
|---|---|---|---|---|
| 00 | Auth collision report | — | 2 | **done** — 7 collisions, reversed D3 |
| 01 | Prepare target to receive `payroll_iq` | — | 2 | **done** — applied + committed `96669096` |
| 02 | Transform script, dump → `payroll_iq` | 01 | 5 | **done** — committed `7431163f`, counts verified |
| 03 | Apply the schema to `nubxrrzwcbhgpvvmbioh` | 02 | — | **blocked** — see below |
| 04 | Merge auth users (33 verbatim + 7 collisions) | 03 | 5 | ready |
| 05 | Copy 9,389 data rows in FK order | 04 | — | ready |
| 06 | Copy storage objects (3 buckets) | 01 | 2 | ready |
| 07 | Move password reset onto Resend | — | 5 | ready — independent of everything |
| 08 | Payroll IQ client factory, schema scoping, types | 03 | 8 | ready after 03 |
| 09 | `app_access` + `has_app_role()` | 01 | 3 | ready |
| 10 | Fold `company_os.admins` into grants | 09 | 2 | ready after 09 |
| 11 | Seed grants + `people` rows for the 5 PIQ admins | 09, 04 | — | ready after 04 |
| 12 | Delegate `payroll_iq.is_admin()` — 88 policies | 11 | 3 | **grants must be seeded first or admins lock out** |
| 13 | Collapse role to `manager \| learner \| staff` | 12 | 3 | ready after 12 |
| 14 | Grants screen + no-access page | 10, 12 | 2 | ready after 12 |
| 15 | Migration ledger baselines | 03 | 2 | ready after 03 |
| 16 | End-to-end verification against the target | 05, 06, 08, 13 | — | final gate before any flip |

**Out of scope, human-gated:** the production env flip (site down, `NEXT_PUBLIC_SUPABASE_URL`
changed, redeploy). Khoa emails the APA manager; that step is his.

## Ticket 03 is blocked on a credential

The transformed schema file is built and audited — 201 CREATE/ALTER statements, every one
targeting `payroll_iq.`, zero DROP/DELETE/TRUNCATE, and the only other schema referenced is
`auth.` for `auth.uid()` and the `users.id → auth.users(id)` FK. It is purely additive into an
empty schema.

Applying it through `supabase db query -f` is refused by the permission classifier as a blind
apply, which is a reasonable guard on a 3,850-line DDL file against a production database. The
repo's own runbook prescribes a different tool anyway:

> Apply with `psql` and `-v ON_ERROR_STOP=1`, on port 5432 — 6543 is the transaction pooler and
> cannot do schema work.

That needs the target database password, which `.env.local` does not have — its `SUPABASE_PW`
authenticates against a different project. Same fix as payroll-iq: reset it in the Supabase
dashboard for `nubxrrzwcbhgpvvmbioh` (Settings → Database) and add it to
`apa-company-os/.env.local` as `APA_COMPANY_OS_DB_PW`.
