# Client Portal (/portal) — Design and Build Plan

Date: 2026-07-11
Status: Draft for review (nothing built, no migrations applied)
Builds on: `2026-07-05-team-portal-design.md` (the /team architecture is the
template), `2026-07-11-team-portal-build-plan.md` (PR conventions; its PR 1
provisioning shipped as #194 and is adapted here),
`docs/db/parked-schema-2026-07-07-projects-ai-ip.sql` (projects tables to
selectively revive).

## What this is

A third authenticated surface where external client contacts log in:

- `/admin` — Edge8 admins (Company OS console)
- `/team` — Edge8 employees and managers (HR self-service)
- `/portal` — client contacts (this plan)

Same Supabase auth system, same magic-link login, same security posture:
browser key reaches nothing, all data flows server-side through the
service-role client behind an auth gate and one mandatory scoped helper.

## Who this is for: the eight current customers

v1 is built for and rolled out to the current customer list, nobody else.
Event attendees as a standalone audience are explicitly deferred.

**Staffing clients** (get Team + Time Off):

| Company | Primary contact | CRM state (2026-07-11) |
|---|---|---|
| Entrepreneurs Organization (EO) | TBD | company exists (name typo), customer |
| On Target by Abound Health | TBD | company exists, customer |
| Unlock Venture Partners | TBD | company exists, customer |
| Wareease | TBD | still named "Qualicious" in CRM, customer |

**AI Program clients** (get Project Updates):

| Company | Primary contact | CRM state (2026-07-11) |
|---|---|---|
| Work Healthy Australia | Dr James L Murray | company + contact linked, evangelist |
| Grady Golf | Ed Yue (edmond@grady.golf) | company + contact linked, customer |
| Australian Payroll (AustPayroll) | Tracy Angwin | contact exists but NOT linked to the company; lifecycle "none" |
| DOXA Talent | David Nilssen | duplicate person rows (david.nilssen@ linked, dave.nilssen@ orphan); lifecycle "none" |

CRM cleanup bundled into Slice 0 provisioning: link Tracy Angwin to
AustPayroll via `person_companies`, merge the David Nilssen duplicate, and
bump AustPayroll + Doxa Talent lifecycle to `customer` (they have active
engagements). Staffing-side cleanup is listed under `staff_assignments`.

Entitlement rules, derived at request time (no config to maintain):

- **Team**: visible iff any company in scope has an active `staff_assignments`
  row.
- **Time Off**: visible iff Team is visible (same scope source).
- **Project Updates**: visible iff any company in scope has a non-archived
  `projects` row.
- **Invoices**: visible iff any company in scope has `invoices` rows. All
  eight customers qualify from day one (see the QuickBooks findings below).
- **My Events**: self-scoped (`event_registrations.person_id`), shown when the
  logged-in contact has registrations (several of these customers attend
  retreats). Deferred to the last slice; it is not why these eight log in.

A client that is both (e.g. an AI Program client who later takes dedicated
staff) just sees both module sets. No type enum anywhere.

## Identity and access model

Ground truth (verified in exploration):

- `people.auth_user_id` (UNIQUE, real FK to `auth.users.id`) is the only
  identity bridge, and `/team` already resolves identity by it, never by email.
- `person_companies` links contacts to companies, but it is CRM data with
  hundreds of rows. It must NOT auto-grant portal access.
- No table links a client company to the Edge8 staff serving it. That relation
  is new (below).

Portal access is an explicit allowlist, one new table:

```
company_os.portal_members
  id            uuid pk default gen_random_uuid()
  person_id     uuid not null -> people(id)
  company_id    uuid null     -> companies(id)   -- null = person-only access (event attendees)
  role          text not null default 'member'   -- 'member' | 'owner' (future: per-module perms)
  status        text not null default 'active'   -- 'active' | 'revoked'
  invited_by    text                             -- admin email
  invited_at    timestamptz not null default now()
  revoked_at    timestamptz
  created_at/updated_at
  unique (person_id, company_id)
```

- Portal access = at least one `active` row for the person.
- Company scope = the set of `company_id`s on active rows (a person can be a
  contact at more than one client; the UI gets a company switcher only if
  scope > 1).
- A row with `company_id null` grants login + My Events only. Kept in the
  model for the deferred event-attendee audience; v1 provisioning always
  sets a company.

`lib/portal-auth.ts` mirrors `lib/team-auth.ts`:

1. `createSessionClient().auth.getUser()` (revalidates the JWT).
2. Resolve `people` by `auth_user_id = user.id`, never by email.
3. Require at least one active `portal_members` row, else deny.
4. Admins and active team members are redirected to their own surface, same as
   the /team rule. A portal actor is never an admin or an employee.
5. Return `{ authUserId, personId, companyScope[], memberships[] }`.

`requirePortalMember()` redirects to `/portal/login` when there is no actor.
Every `/portal` page and server action calls it first.

## Security posture (same as /team, restated as the ship gate)

`company_os` stays locked to the browser key. No RLS policies, no grants to
`anon`/`authenticated`. All portal reads go through the service-role client
behind `requirePortalMember()` and one scoped helper. This matters more here
than on /team: portal users are external parties reading data about Edge8
employees.

No `/portal` screen ships until all of these exist:

1. **Provisioning first.** Admin "Invite to client portal" action (behind
   `requireAdmin()`), on the company 360 page and the person 360 page. Reuses
   the `inviteToPortal()` mechanics from `talent/team/actions.ts`: email-match
   check against `people.email`, link to an existing auth user instead of
   minting a duplicate, refuse `ADMIN_ALLOWLIST`/`admins` emails, refuse
   people with an active `team_members` row. Writes `audit_log`.
2. **One scoped helper.** `lib/portal/data.ts` with a hard allowlist mapping
   table -> scope filter (below). A table not in the allowlist is refused.
   Extend the existing lint rule so `/portal` code never imports the
   service-role `companyOs` directly.
3. **IDOR closed.** v1 is read-only except trivial self-writes, but any future
   id-taking action re-derives the actor and asserts the target row is in
   scope before acting.
4. **Callback allowlist extended.** `safeNext()` in
   `app/api/auth/callback/route.ts` becomes `^/(admin|team|portal)(/|$)`.
5. **Middleware matcher** gains `/portal/:path*`, bypassing `/portal/login`.
   `SiteFrame` BARE_ROUTES += `/portal`.
6. **Grants.** Every new table and view gets an explicit
   `grant ... to service_role` (new company_os objects do not inherit grants;
   this has bitten before).
7. **Deprovision is immediate.** Revoking the last active membership bans the
   auth user and revokes sessions in the same flow (unless the same auth user
   is a team member, which provisioning already prevents).
8. **Rate-limit the magic-link request**, neutral "if an account exists" copy,
   `shouldCreateUser: false`. Same as /team.

### Scope allowlist (table -> filter)

| Table / view | Scope filter |
|---|---|
| `staff_assignments` | `company_id in companyScope`, `status = 'active'` |
| `team_directory` (view) | `id in assignedTeamMemberIds` (derived from assignments) |
| `time_off` | `team_member_id in assignedTeamMemberIds` |
| `holidays` | read-only reference (calendar rendering) |
| `projects` | `company_id in companyScope` |
| `project_updates` | `project_id in scopedProjectIds`, `published_at is not null` |
| `invoices` | `company_id in companyScope` |
| `event_registrations` | `person_id = actor.personId` |
| `products` | only via join from own registrations |
| `people` | `id = actor.personId` (own profile row) |

Columns are also filtered: the helper selects explicit column lists, never
`*`. What clients must never receive: `time_off.reason`, `manager_note`,
anything from `compensation`, `people` PII of staff beyond directory fields,
leave balances (see privacy rules).

## New schema

Four additions beyond `portal_members`. All in `company_os`, all
`grant select/insert/update to service_role`, RLS on with no policies (house
pattern).

### 1. staff_assignments (the missing client-company -> staff relation)

```
company_os.staff_assignments
  id              uuid pk
  company_id      uuid not null -> companies(id)
  team_member_id  uuid not null -> team_members(id)
  role_title      text            -- what the client sees, e.g. "AI Engineer"
  start_date      date
  end_date        date
  status          text not null default 'active'   -- 'active' | 'ended'
  notes           text            -- admin-only, never sent to the portal
  created_at/updated_at
  unique (company_id, team_member_id, status) deferrable-ish via partial unique on active
```

This is useful to /admin on its own (today the client-staff mapping lives
only in Dayoff team names). Admin UI: an "Assignments" block on
Talent > Team > [member] and an "Assigned staff" card on the company 360.

Backfill (confirmed by Dave, 2026-07-11, against the live DB):

| Client company | Assigned staff |
|---|---|
| On Target by Abound Health | Lê Minh Tân, Lê Vinh, Nguyễn Minh Tâm, Nguyễn Văn Đức, Trần Nhật Thanh, Trần Thanh Bình, Vũ Trần Minh, Loi Nguyen (8) |
| Entrepreneurs Organization (EO) | Ha Nguyen, Lê Tấn Khôi, Nguyễn Hữu Thành, Quang Van (4) |
| Unlock Venture Partners | Nguyễn Chí Hiếu (1) |
| Wareease | Lê Minh Quân (1) |

Data cleanup bundled with the backfill migration:
- Rename the `companies` row "Qualicious" to "Wareease" (Wareease is the
  new name of Qualicious; same company, keep the id). Rename the
  "Qualicious" department to match.
- Fix the company name typo "Entrepreneurs Organizaztion".
- Set the missing `department_id` for Loi Nguyen (OnTarget) and Quang Van
  (EO) so departments and assignments agree.

### 2. projects + project_updates (slim revival, not the 18-table subsystem)

Revive only `projects` from the parked schema, trimmed, plus a new
`project_updates` table. Do not revive tasks/epics/milestones/apps/etc.

```
company_os.projects
  id, name, slug unique, company_id not null -> companies(id),
  deal_id -> deals(id), status text default 'active'
    ('active' | 'paused' | 'completed' | 'archived'),
  summary text,            -- client-visible one-liner
  start_date, target_date, completed_at,
  owner_team_member_id -> team_members(id),
  metadata jsonb, created_at/updated_at

company_os.project_updates
  id, project_id not null -> projects(id),
  title text not null,
  body_markdown text not null,
  author_team_member_id -> team_members(id),
  published_at timestamptz,       -- null = draft, invisible to portal
  created_at/updated_at
```

Named `company_id` (not `client_company_id`) to match current house style
after the brand/legal-entity cleanup. Admin UI: a "Projects" tab on the
company 360 with an update composer (markdown, draft -> publish). The portal
only ever sees published updates.

### 3. invoices (synced from QuickBooks)

One local table mirrors QBO invoices so the portal never calls QuickBooks at
request time and /admin gets an invoice ledger per client for free.

```
company_os.invoices
  id             uuid pk default gen_random_uuid()
  company_id     uuid not null -> companies(id)
  source         text not null default 'quickbooks'
  external_id    text not null       -- QBO invoice id (stable)
  doc_number     text                -- client-visible number, e.g. "1186"
  txn_date       date not null
  due_date       date
  currency       text not null default 'usd'
  amount_cents   bigint not null
  balance_cents  bigint not null default 0
  status         text not null       -- derived: 'paid' | 'open' | 'overdue' | 'voided'
  memo           text                -- QBO private memo, admin-only, never portal
  payment_link   text                -- QBO hosted invoice/pay link when present
  lines          jsonb not null default '[]'  -- [{description, quantity, rate, amount, item_name}]
  synced_at      timestamptz not null default now()
  created_at/updated_at
  unique (source, external_id)
```

QBO customer mapping lives on `companies.metadata.qbo_customer_ids` (text
array; EO needs two, see below). Sync upserts on `(source, external_id)`,
recomputes `status` from balance + due date, and flags invoices whose QBO
customer has no mapped company (admin fixes the mapping, nothing is guessed).

**QuickBooks ground truth (pulled 2026-07-11, QBO org "Talent Edge LLC",
77 invoices Jan 1 to date, $576,943.75 total).** The eight customers account
for $531,059.68 (92%):

| CRM company | QBO customer (id) | 2026 invoices | Billed | Open |
|---|---|---|---|---|
| On Target by Abound Health | Aym Technologies (On Target) (5) | 8 | $305,591.00 | $43,593.00 |
| Entrepreneurs Organization | Entrepreneurs' Organization (205) + EO APAC (187) | 7 + 1 | $98,352.00 | $15,242.00 |
| Unlock Venture Partners | Unlock Venture Partners (4) | 11 | $37,904.68 | $5,633.48 |
| Wareease | WareEase (13) | 7 | $33,235.00 | $0 |
| DOXA Talent | DOXA Talent Operating LLC (223) | 2 | $19,375.00 | $12,375.00 |
| Work Healthy Australia | James Murray (220, billed as the person) | 4 | $17,000.00 | $4,000.00 |
| Australian Payroll | Australian Payroll Association (224) | 3 | $12,100.00 | $0 |
| Grady Golf | Grady Golf LLC (158) | 7 | $8,160.00 | $2,640.00 |

Mapping notes: On Target is billed through "Aym Technologies"; Work Healthy
is billed to James Murray personally; EO spans two QBO customers (main +
APAC), which is why the mapping is an array. The remaining ~$46k of 2026
invoicing is retreat attendees and one-offs, out of portal scope.

Staffing invoice lines are per-person ("Salary - Binh Tran ...
Staffing Revenue:Quality Assurance Engineer"), which independently confirms
the `staff_assignments` backfill and gives the portal invoice detail view
real substance for staffing clients.

Sync path: v1 is a backfill of the 2026 invoices plus an on-demand re-sync;
a scheduled auto-sync needs an Intuit OAuth app with a server-held refresh
token (open decision 5).

### 4. Events: no new tables

`products (type='event')` + `event_registrations.person_id` already model
retreats and workshops end to end, including status and cohort_slug. My
Events v1 is a pure read. Private-retreat `bookings` are a fast follow (fold
into the same list once the display shape is agreed).

## Navigation and module specs

```
Home             welcome, company switcher (if >1), module cards, next event,
                 latest project update, who is off this week (if staffing)
My Events        upcoming + past: event name, dates, location, tier,
                 registration status. Later: .ics download, cohort survey link
Team             card grid from team_directory filtered to assignments:
                 name, photo, role_title (from the assignment), position,
                 location, work schedule, start_date with the client
Time Off         read-only: "out now / upcoming" list + a simple month
                 calendar for assigned staff; history table per person
Projects         project list -> updates feed (markdown rendered), status,
                 target date
Invoices         table: number, date, due date, amount, balance, status;
                 expandable line items; "Pay" link when balance > 0 and a
                 payment_link exists
```

Design system: the portal is client-facing, so it uses the public site's
brand treatment (marketing typography/colors), not the internal admin design
system. Layout shell mirrors `/team` (sidebar + `requirePortalMember()` in
the dashboard layout), skinned for clients.

### Privacy rules (portal hard lines)

- Time off shows person, leave type, dates, half-day flag, status. It never
  shows `reason`, `manager_note`, balances, entitlements, or leave policy.
  Client question answered: "who is out when", not "how much leave do they
  have".
- Team view shows directory-safe fields only: no employee_number, no legal
  entity, no manager chain, no compensation, no personal contact details
  beyond what Edge8 chooses (work email optional, decide at build).
- Only `approved` and `taken` leave is shown by default; `requested` rows are
  shown as "pending" with no detail. (Open decision 2 below can change this.)
- Project updates are publish-gated; drafts never leave the server.
- Invoices: a client sees only invoices where `company_id` is in their scope,
  and never the `memo` column. Line items are shown (they are the client's
  own bill, already on the PDF they receive). Strictly no cross-client
  leakage; this table holds every client's revenue.

## Admin surfaces (all behind requireAdmin)

1. Company 360 (`revenue/companies/[id]`): "Client portal" card (members,
   invite, revoke), "Assigned staff" card (add/end assignment), "Projects"
   tab (create project, compose/publish updates), "Invoices" tab (synced
   ledger, QBO customer mapping editor, re-sync button).
2. Person 360 (`contacts/[id]`): portal membership status + invite button
   (mirrors the team InvitePortalButton).
3. Talent > Team > [member]: "Assignments" block (which clients this person
   serves).
4. `audit_log` entries for invite, revoke, assignment changes, update
   publish.

## Build plan — the PRs

Format and conventions follow `2026-07-11-team-portal-build-plan.md`. Each PR
is its own branch off main, CI green, reviewed; Dave merges. Migrations via
Supabase MCP `apply_migration`, additive only, explicit `service_role` grants
in the same migration. Verification: `npx tsc --noEmit` + `npm run build`,
UI on the Vercel Preview once pushed. Note: the /team provisioning PR (#194)
already shipped `inviteToPortal` + revoke/ban/resend + audit logging for
employees; PR 1 adapts that code, it does not reinvent it.

### PR 1 — Foundation + provisioning (the unlock)

**Model: Fable 5** — security-critical: identity linking for external
parties, scope computation, ban/revoke semantics. `/code-review` before
merge.

- Migration: `portal_members` + grants.
- Data cleanup (same migration or a sibling): Wareease rename (company +
  department, keep ids), EO name typo, link Tracy Angwin to AustPayroll,
  merge the David Nilssen duplicate, lifecycle bumps for AustPayroll + DOXA.
- `lib/portal-auth.ts` (`getPortalActor`, `requirePortalMember`), rejecting
  admins and active team members.
- `lib/portal/data.ts` (`portalRead`, `assertInScope`) + lint rule banning
  direct `companyOs` import under `app/portal`.
- Admin invite/revoke/resend on company 360 + person 360, adapted from the
  shipped /team provisioning, with `audit_log` on every transition.
- Middleware `/portal/:path*`, callback `safeNext` allowlist += `portal`,
  `SiteFrame` BARE_ROUTES += `/portal`.
- `/portal` route group: login (magic link), dashboard layout, sidebar,
  Home with entitlement-driven module cards.
- Exit check: an invited client contact logs in via magic link and sees Home
  scoped to their company; an admin or employee auth user is bounced to
  their own surface; a revoked member is locked out including live sessions.

### PR 2 — Team

**Model: Sonnet 5** — pattern-following once PR 1's rails exist; review the
scope derivation (assignments -> team_member ids) specifically.

- Migration: `staff_assignments` + partial unique on active + grants.
- Backfill migration for the four staffing clients (14 assignments, table
  above).
- Admin: "Assigned staff" card on company 360, "Assignments" block on
  Talent > Team > [member].
- Portal: `/portal/team` grid from `team_directory` filtered to assigned
  ids, fixed safe column list (no balances, no employee_number, no manager
  chain).
- Exit check: EO's contact sees exactly EO's four people; On Target's sees
  their eight; nobody sees balances or other clients' staff.

### PR 3 — Time Off (read-only)

**Model: Fable 5 (or Opus 4.8)** — this is Edge8 employee data shown to an
external party; the privacy column list and scope filter are the whole
feature. `/code-review` before merge.

- Portal: `/portal/time-off` — out now / upcoming list, month calendar,
  per-person history for assigned staff only. Pending requests render as
  "pending" with no detail (open decision 3).
- Columns hard-limited: person, leave type, dates, half-day, status. Never
  `reason`, `manager_note`, balances, entitlements, policy.
- `holidays` read for calendar shading.
- Exit check: the client sees approved leave for their team; probing foreign
  `team_member_id`s returns nothing; no reason/balance appears in any
  payload (verify the network response, not just the UI).

### PR 4 — Invoices

**Model: Sonnet 5** — mostly data plumbing; review the scope filter and the
QBO-customer -> company mapping (this table holds every client's revenue).

- Migration: `invoices` + grants; `companies.metadata.qbo_customer_ids`
  mapping seeded for the eight (ids in the table above).
- Backfill: import the 77 pulled 2026 invoices (or re-pull at build time),
  upsert on `(source, external_id)`.
- Admin: "Invoices" tab on company 360 (ledger, mapping editor, re-sync).
- Portal: `/portal/invoices` — list + expandable lines + Pay link when
  `balance_cents > 0` and `payment_link` is set. `memo` never selected.
- Exit check: Grady Golf's contact sees exactly 7 invoices totalling $8,160
  with $2,640 open; totals reconcile against the QBO pull; no cross-client
  rows under id probing.

### PR 5 — Projects + Updates

**Model: Sonnet 5** — straightforward CRUD on new tables; publish-gating is
the one sharp edge.

- Migration: `projects`, `project_updates` + grants.
- Admin: "Projects" tab on company 360 with markdown composer,
  draft -> publish, `audit_log` on publish.
- Portal: `/portal/projects` — list + updates feed (published only).
- Seed one project per AI Program client (Work Healthy, Grady Golf,
  Australian Payroll, DOXA Talent) so the module is alive at launch.
- Exit check: a published update renders for the right client; drafts and
  other companies' projects are invisible.

### PR 6 — My Events

**Model: Sonnet 5** — zero new schema, smallest lift.

- Portal: `/portal/events` — upcoming/past from `event_registrations` x
  `products` for `person_id = actor.personId`.
- Exit check: a retreat attendee among the eight sees their registration
  with correct dates and status, and nobody else's.

### Sequencing

PR 1 is strictly first. PR 3 depends on PR 2 (`staff_assignments` is the
Time Off scope source). PRs 4, 5, 6 are independent of 2/3 and of each
other; they can land in parallel once PR 1 is merged. Suggested order for
customer value: 1 -> 2 -> 3 -> 4 -> 5 -> 6 (staffing core first since those
four log in for Team/Time Off; invoices before projects because all eight
customers see the Invoices module on day one).

| PR | Work | Model | Why |
|---|---|---|---|
| 1 | Foundation + provisioning | Fable 5 | External-party identity + scope; ban/revoke semantics |
| 2 | Team | Sonnet 5 | Rails exist; review scope derivation |
| 3 | Time Off read-only | Fable 5 (or Opus 4.8) | Employee data to external parties; privacy column list |
| 4 | Invoices | Sonnet 5 | Data plumbing; review revenue-table scoping |
| 5 | Projects + Updates | Sonnet 5 | Simple CRUD; publish gating |
| 6 | My Events | Sonnet 5 | Zero schema, smallest lift |

**Later / explicitly out of v1:** scheduled QBO auto-sync (needs an Intuit
OAuth app + server-held refresh token; v1 is backfill + on-demand re-sync),
email notifications (new update, new invoice, leave approved), client
comments or approvals, documents, event-attendee-only access
(`company_id null` invites), private retreat `bookings` in My Events,
per-module permission roles on `portal_members`, client-side write actions
beyond own profile.

### Standing constraints (every PR)

The team-portal build plan's standing constraints apply verbatim with
`/portal` + `requirePortalMember()` + `lib/portal/data.ts` substituted, plus
one addition: **every portal read is company-scoped or self-scoped; there is
no "company-visible" tier here** — unlike /team, no helper may return
unscoped rows.

## Open decisions (recommendations inline)

1. **Route name.** `/portal` recommended (`/team` is taken by employees;
   "client portal" is what users will call it). Alternative: `/clients`.
2. **Client role in the time-off loop.** v1 is read-only: employees request
   (via /team, Slice 1 there), Edge8 approves, clients see the result.
   Staffing clients may eventually expect approve/ack rights on their
   dedicated staff's leave. Recommended: read-only now, revisit as a
   dedicated slice with its own state ('client_acknowledged') rather than
   putting clients inside the approval state machine on day one.
3. **Pending requests visibility.** Show `requested` leave to clients as
   "pending" (recommended, avoids surprise absences) vs approved-only.
4. **Staffing-client primary contacts.** Who gets the invite at EO, On
   Target, Unlock, and Wareease? Needed before PR 1 provisioning.
5. **Ongoing QBO sync mechanism.** v1 ships with the 2026 backfill and
   operator-run re-sync. For automation: an Intuit OAuth app with a
   server-held refresh token and a cron route (recommended eventually), vs
   staying operator-run. Decide when invoice staleness starts to hurt.

## Resolved (2026-07-11)

- **Audience:** v1 is exclusively the eight current customers (four staffing,
  four AI Program). Event attendees as a standalone audience are deferred;
  `company_id null` memberships stay in the model but are not used in v1.
- **Provisioning:** manual invite per named contact, from the company 360.
  No auto-invite automation in v1.
- **Invoices are in v1** (Dave, 2026-07-11): a `company_os.invoices` table
  synced from QuickBooks, 2026 backfilled, surfaced as a portal module (PR 4).
  QBO org is "Talent Edge LLC"; the eight customers are $531k of $577k of
  2026 invoicing. On Target bills via "Aym Technologies"; Work Healthy bills
  to James Murray personally; EO spans two QBO customers (main + APAC).
