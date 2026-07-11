# Team Portal — Build Plan (Round 1)

Date: 2026-07-11
Status: Proposed
Extends: `2026-07-05-team-portal-design.md` (the locked design; all security
controls there remain binding). Related: `2026-07-05-dayoff-migration-plan.md`
(shipped time_off schema), `2026-07-08-surveys-design.md` (surveys + external
writer caveat).

## Where we are

The `/team` foundation from Slice 0 is largely built and merged:

- Magic-link login (`app/team/(auth)/login`), shared hardened auth callback,
  middleware coverage for `/team/:path*`.
- `lib/team-auth.ts`: `getTeamActor()` / `requireTeamMember()` resolving identity
  by `people.auth_user_id` (never email), requiring an active `team_members` row,
  deriving the manager role from `manager_id`, and redirecting admins to `/admin`.
- `lib/team/data.ts`: the mandatory scoped read layer (`teamRead`,
  `assertInScope`, `getOwnProfile`) with `time_off` already in the allowlist.
- Dashboard shell: `app/team/(dashboard)` layout + `TeamSidebar` with Home live
  and Time Off / My Profile / Directory / manager items rendered as "soon".

**The blocker:** the admin "Invite to portal" provisioning action does not exist.
`people.auth_user_id` is unpopulated, so no employee can log in. Everything below
is gated on Workstream A.

## Scope of this round

| # | Workstream | Status today |
|---|---|---|
| A | Provisioning (Invite to portal) | Not built; the unlock |
| B | Time Off self-service: employee requests + manager approvals | Admin side done; /team side not built |
| C | Directory + My Profile | `getOwnProfile` exists; no pages |
| D | Surveys in /team | Public fill flow + identity resolution exist; no portal surface |
| E | Announcements | Greenfield (no table, no code) |

Rollout is a pilot: invite a few people one-by-one from Talent > Team. Bulk
invite is out of scope for this round.

Out of scope (later slices per the design doc): Onboarding, Documents, 1-1s,
Goals, Reviews, bulk provisioning, read receipts on announcements, comp anywhere
in `/team`.

---

## Workstream A — Provisioning (PR 1, first, blocking)

> Status update while building PR 1: more of this existed than assumed. The
> `inviteToPortal` action, `InvitePortalButton`, and the implicit-flow
> `/team/callback` landing were already on main, and the DB already has
> `UNIQUE(people.auth_user_id)`, `UNIQUE(people.email)` (citext, no duplicates)
> and `people.is_team_member` — so no migration was needed. PR 1 therefore
> delivers the gaps: portal-status eligibility guard, empty-email guard,
> resend sign-in link, revoke access (auth-user ban; invite un-bans to
> restore), and audit logging on all four transitions. Magic-link rate
> limiting rides on Supabase's built-in OTP limits, which is sufficient for
> the pilot.

Admin action "Invite to portal" on Talent > Team, gated by `requireAdmin()`,
exactly per the design doc's provisioning flow:

1. Load person (`email`, `auth_user_id`). Refuse if email is empty, if the email
   is in `ADMIN_ALLOWLIST` or `company_os.admins`, or if the person has no
   active `team_members` row.
2. `auth_user_id` null and no auth user with that email:
   `admin.inviteUserByEmail(email, { redirectTo: .../api/auth/callback?next=/team })`,
   then `UPDATE people SET auth_user_id = <id>, is_team_member = true`.
3. Auth user with that email already exists: link to it (never mint a second),
   after a case-insensitive email match against `people.email`.
4. Already linked: offer "Resend sign-in link" (idempotent).
5. Server-only admin client (`SUPABASE_URL` + secret key, `persistSession:
   false`), never in a client bundle. Auth email delivery already goes through
   Resend SMTP (no 2/hr cap).

Also in PR 1:

- Migration: `UNIQUE (people.auth_user_id)`; confirm `UNIQUE (people.email)`.
  Additive only; explicit `service_role` grants on anything new (prior bite:
  missing grants make objects invisible to the app).
- Admin "Revoke portal access" action: ban/disable the auth user and revoke
  sessions, not just the app-side check. Automatic revocation on status change
  (e.g. via Day Off import) is a fast-follow; note it in the action's copy.
- Verify or add rate limiting on the magic-link request (per email, per IP);
  keep the neutral "if an account exists…" response.
- Audit log entries (`recordAudit`) for invite, link, resend, revoke.

Exit check: a pilot employee receives the invite, signs in via magic link, lands
on `/team` Home; a signed-in non-employee is denied; an admin email cannot be
invited.

## Workstream B — Time Off self-service (PRs 2–3)

### PR 2 — Employee side (`/team/time-off`)

- Page: own balance (from the `team_directory` view, own row only), own policy
  label, request history via `teamRead(actor, "time_off", …)`, and a "Request
  time off" form (leave type, start/end, half-day, optional reason). Reuse
  `lib/admin/time-off.ts` constants (`LEAVE_TYPES`, `STATUSES`,
  `countWorkingDays`, `formatLeaveBalance`).
- New server actions in `app/team/(dashboard)/time-off/actions.ts` (do NOT
  reuse the admin actions as-is; the design doc flags them as IDOR-unsafe
  outside `requireAdmin`):
  - `requestOwnTimeOff(fields)`: forces `team_member_id = actor.teamMemberId`,
    ignores any client-supplied id, inserts `status: "requested"`.
  - `cancelOwnTimeOff(id)`: `assertInScope(actor, "time_off", id)` first; only
    requested/approved and not-yet-taken can be cancelled.
- Notify on request: best-effort `notifyOps()` to Lark plus Resend email to the
  manager if one is set (existing `sendTransactionalEmail`).
- Enable the Time Off nav item.

### PR 3 — Manager approvals, team calendar, manager home

- `/team/reports` as the **manager home**: a dashboard landing for the My Team
  section, not a bare roster. v1 widgets: pending approvals count, who is off
  now / next 2 weeks, report roster with position + start date. Later manager
  slices (1-1s, reviews, goals, training — see "Manager enablement" below) plug
  their summary tiles into this page, so it is the section's center of gravity
  from day one.
- `/team/approvals`: pending requests where `team_member_id` is in
  `actor.directReportIds` (server-derived, never client input). Approve/reject
  actions re-derive the actor, SELECT the target row, assert the owner is a
  direct report, then stamp `approved_by = actor.teamMemberId`, `approved_at`.
  Managers see the full request including `reason` (decided 2026-07-05).
- `/team/calendar`: month view of requested + approved leave for direct reports
  (and self). Reuse the admin board's data shaping where practical.
- Notify the employee on decision (Lark + Resend, best-effort).
- Scope mechanics: `directReportIds` is already part of `TeamActor`; extend the
  time_off scope so a manager's `teamMemberScope` covers self + reports (it is
  built this way per `lib/team-auth.ts`; verify before relying on it).
- Enable Approvals / Team calendar nav for managers. `/admin/operations/time-off`
  stays as the admin override surface.

Exit check: employee requests leave, manager sees it in Approvals and approves,
employee sees the status flip and the balance reflect it; a manager cannot act
on a non-report's request (verified by test or manual probe).

## Workstream C — Directory + My Profile (PR 4)

- `/team/directory`: read-only list of active team members: name, position,
  department, location, manager. **Do not** read the `team_directory` view
  wholesale — it carries leave balances. Add a dedicated helper in
  `lib/team/data.ts` (e.g. `getDirectory()`) selecting a fixed safe column list
  from `team_members` + embeds; company-visible by design, so it does not use
  the per-actor allowlist — it is its own reviewed function with an explicit
  "safe columns only" contract.
- `/team/profile`: render `getOwnProfile()` (already built). Editable fields v1:
  phone and preferred name only, via a self-scoped action (`eq id =
  actor.personId`). Emergency-contact fields: check whether columns exist on
  `people`; if not, add additive nullable columns (`emergency_contact_name`,
  `emergency_contact_phone`) in this PR's migration. Employment fields
  (department, position, manager, dates) stay read-only; `manager_id` /
  `department_id` remain admin-only writes forever.
- Enable both nav items.

## Workstream D — Surveys in /team (PR 5)

Small lift; the runner and identity resolution already exist.

- `/team/surveys`: list `status = "published"`, non-archived surveys. Surveys
  are company-published content, not per-actor rows, so like the directory this
  is a dedicated helper with a fixed safe column list (`slug, name, description,
  is_anonymous`), not a scope-allowlist entry.
- Completion marker: for non-anonymous surveys, check `survey_responses` for
  `person_id = actor.personId` (this table fits the allowlist: `person_id`,
  person scope). Anonymous surveys always show as open, with the anonymity
  stated.
- Each item links to the existing `/surveys/[slug]` runner;
  `resolveSurveyActor()` already attributes team members via `auth_user_id`.
- Constraints carried over from the surveys design: strictly additive, no new
  CHECK constraints, don't touch `cohort_slug`, respect the external writer.
- Nav: add a "Surveys" item under Me (new; not in the original nav sketch).

## Workstream E — Announcements (PR 6)

Greenfield; smallest useful version:

- Migration: `company_os.announcements` — `id uuid pk`, `title text not null`,
  `body text not null` (markdown), `status text` (draft | published | archived,
  app-enforced to match house style), `pinned boolean default false`,
  `published_at timestamptz`, `created_by text`, `created_at`, `updated_at`.
  Explicit `service_role` grants in the same migration.
- Admin composer at `/admin/operations/announcements`: list, create, edit,
  publish, archive. Server actions with `requireAdmin()` + `recordAudit`.
  Follow `docs/engineering/admin-consistency-playbook.md`.
- Portal: latest published announcements on `/team` Home (pinned first), full
  feed at `/team/announcements`. Company-visible: dedicated helper returning
  published rows only (never drafts), fixed columns.
- Optional publish hook: Lark `notifyOps` on publish. No read receipts, no
  comments, no targeting in v1.

---

## Manager enablement — the Round 2+ roadmap (decided 2026-07-11)

Decision: **one portal, no separate manager app.** Managers are employees; the
role is derived from `manager_id`; every manager feature is an employee feature
scoped to `directReportIds`. The My Team section grows into a full manager
workspace anchored on the PR 3 manager home. Target capabilities and how each
maps onto the existing schema (per the design doc's scope table):

| Capability | Backing | Notes |
|---|---|---|
| Team stats (1-1 cadence, performance, engagement) | derived | Aggregates over 1-1s, reviews, survey pulse, time off. Build last — it is a rollup of the features below and gets richer as each ships. |
| 1-1 prep + **private** development notes | `one_on_ones`, `one_on_one_sessions` (exist, empty) | Design doc Slice 4. Shared agenda/notes visible to both parties; private notes in a separate structure readable ONLY by their author — not the report, and by default not other managers. |
| Conduct performance reviews of reports | `performance_reviews` (exists, empty) | Design doc Slice 5. Manager drafts and finalizes; the reviewee sees finalized only. |
| Team-level survey results | `surveys` + `survey_responses`/`answers` | Aggregates only, with an anonymity floor (suppress any cut below ~4 respondents so small teams cannot be de-anonymized). Anonymous surveys are never sliced by team. Needs a team attribution on responses (respondent's `team_member_id` or manager at submit time) — additive column, respecting the external-writer constraint. |
| Set team goals | `goals` (exists, empty) | Design doc Slice 5. `owner_team_member_id` for individual goals; team goals owned by the manager and visible to all reports. |
| Manage team training | greenfield | New tables (`trainings`, `training_assignments`); relates to `person_skills`. Manager assigns, report sees theirs under Me, completion feeds team stats. |

Sequencing intent after this round: 1-1s first (highest manager-habit value,
schema ready), then reviews + goals (design doc Slice 5), then team survey
results, then training, with team stats accreting throughout. Each gets its own
plan doc when picked up; privacy rows above (private notes, anonymity floor,
finalized-only reviews) are binding constraints, not suggestions.

## Sequencing

PR 1 (provisioning) is strictly first. PR 2 then PR 3 (approvals build on the
employee flow). PRs 4, 5, 6 are independent of each other and of PR 3; they can
land in any order or in parallel once PR 1 is merged. Suggested order for pilot
value: 1 → 2 → 3 → 5 → 4 → 6 (surveys before directory because it is the
smallest and immediately usable by the pilot group).

Each PR: its own branch off main, CI green, reviewed, merged before the next
dependent PR starts. Migrations via Supabase MCP `apply_migration`, additive
only, grants included.

### Recommended Claude model per PR

Security-critical PRs get the top tier; pattern-following UI work runs fine on
Sonnet. Run `/code-review` before merging any PR marked security-critical.

| PR | Work | Model | Why |
|---|---|---|---|
| 1 | Provisioning (shipped, #194) | Fable 5 | Security-critical: identity linking, ban/revoke semantics. Built with Fable 5. |
| 2 | Time Off, employee side | Sonnet 5 | Pattern-following (scoped helper + admin design system), but the new actions must force `team_member_id = actor.teamMemberId` — review that line specifically. |
| 3 | Manager approvals + calendar + manager home | Fable 5 (or Opus 4.8) | Security-critical: IDOR re-scoping of approve/reject, direct-report scope derivation. `/code-review` before merge. |
| 4 | Directory + My Profile | Sonnet 5 | Routine pages; the one sharp edge (no leave balances in the directory helper) is spelled out in Workstream C. |
| 5 | Surveys in /team | Sonnet 5 | Smallest lift; reuses the existing runner and identity resolution. |
| 6 | Announcements | Sonnet 5 | Greenfield but simple CRUD; the migration must include service_role grants. |

If switching models per PR is more hassle than it is worth, staying on Fable 5
throughout is the safe default — the cost delta across six PRs is small next to
the cost of an auth bug in this portal.

## Standing constraints (apply to every PR)

- Every `/team` page and action starts with `requireTeamMember()`; every
  `/admin` one with `requireAdmin()`.
- `/team` code never imports `companyOs` directly — reads go through
  `lib/team/data.ts` helpers (allowlist or reviewed company-visible helpers).
- Creates force the actor's own id; id-taking mutations assert ownership via
  `assertInScope` or an explicit direct-report check.
- Interactive client components own their list state fully; never pass stateful
  shelf components through server-computed row previews (has bitten twice).
- No browser `company_os` access; never create browser Supabase clients during
  render (Vercel Preview lacks the public env vars).
- Verification: `npx tsc --noEmit` + `npm run build` (no dev server on this
  machine). UI verified on the Vercel Preview once pushed.
- New tables/columns: additive migrations with explicit `service_role` grants.

## Open questions (non-blocking, decide during the relevant PR)

1. Should time-off request emails go to the manager only, or also cc ops?
   (Default: manager + Lark ops channel.)
2. Directory: include phone/email of colleagues, or names/roles only? (Default:
   name, role, department, location, manager; contact details deferred.)
3. Announcements author display: admin display name from `company_os.admins`
   vs a free-text byline. (Default: admin display name.)
