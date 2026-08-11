# Team member status: single source of truth

**Status:** draft for review. Nothing here is implemented yet.
**Owner edits:** edit this doc directly, answer the Open decisions, then hand it back.
**Problem it solves:** the app repeatedly shows all 51 team member records where it
should show only the 26 current ones.

---

## Why this keeps happening

Reviewed against `origin/main` on 2026-08-05.

### The data

| `team_members.status` | Count |
|---|---|
| active | 26 (23 full_time, 3 contract) |
| notice | 1 |
| alumni | 11 |
| terminated | 13 |

**Half the table is leavers.** Any query that forgets a status filter roughly doubles
its result, and looks plausible while doing it.

### Root cause 1: six competing definitions of "current staff"

All inlined as literals, none shared:

| Set | Where |
|---|---|
| `active, on_leave, notice, pre_start` | `PORTAL_STATUSES`, `lib/team-auth.ts:41` |
| `active, on_leave, notice` | `DIRECTORY_STATUSES`, `lib/team/data.ts:275` |
| `active, pre_start, on_leave, notice` | `LIVE_STATUSES`, `lib/onboarding-cycle.ts:63` |
| `active, pre_start, on_leave` | inline, `lib/admin/probation.ts:58` |
| `active, on_leave, notice` | inline literal twice, `lib/gallery.ts:97` and `:202` |
| `active` only | `lib/admin/equipment.ts:52`, `lib/admin/staff-assignments.ts:106` |

Some variance is deliberate (a pre-start hire should not be issued a laptop). But it is
undocumented, so a new query has no default to copy, and the author either picks one at
random or picks none.

### Root cause 2: no shared helper for status

`/team` already has the right guardrail for *scope*: `teamRead()` in `lib/team/data.ts`
injects the actor's scope and a lint rule bans bypassing it. There is no equivalent for
*employment status*, and `/admin` has no equivalent at all. Roughly 40 `from("team_members")`
call sites each hand-roll their own filter.

### Root cause 3: two stale proxies for "is staff"

- `people.is_team_member` is `true` for 24 of the 25 leavers. It is only ever set to
  `false` by portal revoke (`talent/team/actions.ts:354`), never by a status change. The
  team assistant is told to use it as the staff test (`lib/team-chat/system-prompt.ts:51`).
- `people.persona` drifts both ways: 23 leavers still carry `employee`, and 4 active staff
  carry `job_seeker` or `null`. `lib/admin/equipment.ts:40-47` documents this after PR #451,
  but the lesson never generalized past that one file.

### Root cause 4: nothing in the app writes `status`

There is no offboarding action. `status` is read in ~40 places and written in exactly one:
the Day Off importer's **insert** (`lib/dayoff/import.ts:207`), which never updates status
on re-sync. Terminations are therefore hand-edits in Postgres, which is why only 2 of the
24 leavers have an `end_date`, and why a headcount-over-time chart is still impossible.

---

## Confirmed bugs

| # | Bug | Location | Live impact |
|---|---|---|---|
| 1 | Event P&L and agenda staff pickers list every leaver | `revenue/events/[id]/page.tsx:116-121`, feeds `pnlPeople` at `:414` and `:422` | 51 names offered where 26 belong. Same shape as the equipment bug fixed in #451 |
| 2 | Contractors roster has no status filter | `operations/contractors/data.ts:23-28` | Latent. All 3 contract rows are active today, breaks the first time a contractor leaves |
| 3 | Rehires break person to member lookups | `lib/admin/work-billing.ts:85`, `operations/contractor-requests/actions.ts:44`, `lib/portal/work-requests.ts:181` | Latent. All three use `.eq("person_id", …).maybeSingle()` with no status filter and will error on a second engagement row |
| 4 | "Past" segment cannot see malformed rows | `talent/team/page.tsx:83` defines Past as `["terminated","alumni"]` | A future status value or `null` shows only under "All" |
| 5 | Admin DB assistant has no status guidance | `lib/admin-chat/schema.ts:98`, admin system prompt | "Show me the team" returns ~50 people. The team bot has a proper paragraph on this, admin has none |

Bugs 1 and 5 are the two a person actually sees today.

---

## Plan

Five phases. Phases 1 and 2 are small and independently shippable, and together they stop
the visible bleeding. Phase 3 is the structural fix. Phases 4 and 5 are the durable fix and
can wait.

### Phase 1: fix the two live bugs

Small, no new abstractions, ship on its own.

- Filter the events picker read to current staff (`revenue/events/[id]/page.tsx`).
- Add a status filter to the contractors roster (`operations/contractors/data.ts`).
- Add the staff status paragraph to the admin assistant prompt, mirroring
  `lib/team-chat/system-prompt.ts:50-55`, and document the real status values in
  `lib/admin-chat/schema.ts`.

**Verification:** the event P&L picker offers 26 names, not 51. Ask the admin bot "list the
team" and confirm it returns current staff and says so.

### Phase 2: name the concepts

Create `lib/staff-status.ts` as the one place these sets are defined:

```ts
export const CURRENT    = ["active", "on_leave", "notice"];   // works here today
export const PORTAL     = [...CURRENT, "pre_start"];          // may sign in to /team
export const ASSIGNABLE = ["active"];                         // may hold an item, be booked, be billed
export const PAST       = ["terminated", "alumni"];
```

Then replace all six literal sets with these. The names carry the intent, so the next
author picks by meaning instead of by copy-paste.

**Verification:** `grep` finds no remaining status literal arrays outside `lib/staff-status.ts`.
`tsc` and `next build` clean. Directory, org chart, gallery tagging, home collage, equipment
picker, staff assignments picker and probation list all return the same rows as before.

### Phase 3: make the safe query the easy query

Add a `company_os.current_team_members` view: `team_directory` filtered to `CURRENT`, with
the same grants. Point every picker and roster read at it.

This inverts the failure mode. A picker that forgets a filter then returns 26, not 51.

**Verification:** the view returns 26 rows. Every picker in `/admin` and `/team` reads either
the view or an explicit `staffStatus.*` set, confirmed by grep. Service role grant smoke-tested
per the `company_os` grants rule.

### Phase 4: close the write path

Until status is writable in-app the data keeps drifting, however good the read filters get.

- An **Offboard** action on the team member profile that sets `status`, `end_date` and clears
  `people.is_team_member` in one transaction, with an audit row.
- Cascade decisions on offboard: revoke portal access, end open `staff_assignments`, flag
  equipment still on loan. See Open decisions.
- Update the Day Off importer to write status on re-sync, not only on insert
  (`lib/dayoff/import.ts:207`).

**Verification:** offboard a test row, confirm status, `end_date`, `is_team_member` and the
audit entry, and that the person disappears from the directory, pickers and portal on the next
request. Re-run the Day Off import and confirm an inactive employee flips status.

### Phase 5: retire the stale proxies

- Stop using `people.is_team_member` as a staff test. Keep the column as a CRM display badge
  only, or drop it if nothing needs it.
- Same for `people.persona = 'employee'`. Employment truth lives on `team_members.status`.
- Backfill `end_date` for the 22 leavers missing one, which unlocks a real headcount trend on
  the admin dashboard. Needs real dates from Mai. See Open decisions.

**Verification:** grep shows no authorization or list query keyed on `is_team_member` or
`persona`. Headcount trend renders and goes down as well as up.

---

## Open decisions

1. **`notice`**: currently visible in the directory and org chart, but not assignable for
   equipment or staff assignments. Confirm that split is what you want.
2. **`pre_start`**: currently gets portal access (so they can onboard) but is not in the
   directory. Should a pre-start hire be visible to the team before day one?
3. **Offboarding cascade**: on offboard, should the action automatically revoke portal access,
   end open staff assignments, and flag equipment still on loan? Or flag them for a human and
   change nothing?
4. **Who can offboard**: all admins, or Dave and Mai only, in line with the wage and PII gate?
5. **`end_date` backfill**: do we have real leave dates for the 22 leavers, or do we accept an
   approximation and mark it as such?

## Out of scope

- Any change to `people` PII or the sensitive table.
- The Day Off leave balance unification (tracked separately as Time Off phase 2).
- Renaming or consolidating the status values themselves. This plan takes the existing
  vocabulary as given.
