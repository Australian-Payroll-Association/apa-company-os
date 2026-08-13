# Fleet Fitness Agent: grade the machines our engineers actually use

Date: 2026-08-13
Source: Dave's request to build an agent that monitors hardware, narrowed to engineers building AI systems.
Verified against origin/main and the live company_os database on 2026-08-13.
Plan doc (product framing): /workflows/private/e8/fleet-fitness-agent.html

## What we found (context for every PR below)

- `company_os.equipment` holds 23 active items (21 laptops, 2 monitors), with a working
  admin at `/admin/operations/equipment` (list, form, custody, requests) and a team
  request form. The register records specs but grades nothing.
- The spec columns are usable: `ram` and `storage` are populated for every laptop except
  EQ-0014 (fully blank). The `processor` column often carries raw invoice strings, but we
  read `ram` and `storage` directly, so parsing is a small job, not a big one.
- Role lives in the `company_os.current_team_members` view (`position_title`,
  `department_name`), keyed by `person_id`, which equals `equipment.current_holder_id`.
  Joining the two is how we scope to engineers.
- The hardware policy is decided (app dev, no local model work): floor 24 GB RAM / 512 GB
  SSD, preferred 48 GB / 1 TB, replacement flag at 4 years. Scope is engineers only, by job
  title. Macs first.
- Graded today: of the Mac laptops held by engineers, 4 sit below the floor (3 AI
  Engineers plus 1 Senior Software Engineer), all RAM-bound at 16 to 18 GB. The one capable
  spare on the shelf is a Windows ThinkPad, so this is a buy-RAM problem.
- A `fleet-fitness-quarterly` scheduled routine already exists (1st of Jan/Apr/Jul/Oct). It
  writes a digest to `docs/ops/fleet-fitness/{year}-Q{n}.md`; the 2026-Q3 baseline is
  committed.

The register uses the secret-key Supabase client (bypasses RLS), so a server component can
read `equipment` and `current_team_members` directly. No schema changes, no migrations.

---

## PR 1: `feat/fleet-fitness-agent` (same day)

**What it does.** Adds a Fleet Fitness page to the equipment admin that grades every
engineer-held laptop against the policy, live off the register. A pure grading module does
the work so the logic is testable and shared with the quarterly routine later.

- New `lib/admin/fleet-fitness.ts`: `parseGb` (reads "16GB", "1 TB", "36 GB" into integer
  GB), `isEngineerTitle` (title contains "engineer"), `gradeSpec` (PASS / WATCH / FAIL /
  DATA GAP against the floor and the 4-year age flag), and `loadFleetFitness`, which joins
  `equipment` (laptops) to `current_team_members` and returns the graded, partitioned view.
- New page at `/admin/operations/equipment/fitness`:
  - A summary row: Macs below floor, at the floor, meeting the floor, and under-spec buys
    caught in the last 90 days.
  - Upgrade priority: engineer Macs that FAIL, worst first, AI Engineers called out.
  - The full graded table of engineer Macs (grade + reason).
  - Redistribution: in-stock laptops that could fix a failure, with a platform note when a
    Windows spare cannot replace a Mac.
  - Purchase guard: any engineer laptop bought in the last 90 days that is below the floor.
  - Data gaps: machines whose specs cannot be read.
  - Appendix: other (non-Mac) engineer laptops graded, and out-of-scope holders listed.
- A "Fitness" link from the Equipment page header.

**What you'll see.** Open `/admin/operations/equipment/fitness`: 4 engineer Macs read FAIL
(EQ-0001, EQ-0009, EQ-0011, EQ-0024), EQ-0017 reads WATCH at the floor, the rest PASS.
EQ-0024 shows in the purchase guard (M5, 16 GB, bought Jul 11). EQ-0018 shows as the one
capable spare with the Windows note. EQ-0014 shows as a data gap.

**Done when.** The page renders the grades above with no console or build errors, matches
the 2026-Q3 digest, and the design guardrail (`npm run check:design`) passes.

---

## PR 2: `feat/fleet-fitness-purchase-guard` (follow-up)

**What it does.** Moves the purchase guard upstream, to the point of entry. When a laptop
is saved in the equipment form below the floor, the form shows an inline policy warning
(not a block, since some machines are for non-engineers). Reuses `gradeSpec` from PR 1.

**What you'll see.** Adding or editing a laptop with 16 GB RAM shows a "below the 24 GB
engineer floor" note next to the spec fields on save.

**Done when.** A 16 GB laptop surfaces the warning; a 48 GB one does not.

---

## Phase 2 (built): Team Pulse survey

On-device telemetry was **ruled out** (no computer access), and so was a bespoke equipment
table (PR #626, reverted #629). Equipment is now one question in a short, person-linked
**Team Pulse** that also reads work, manager, and team, on the existing survey system. No
new tables, no new form.

- **Migration** `20260813140000_team_pulse_survey.sql` seeds one survey (`team-pulse`,
  `purpose = 'team_pulse'`, not anonymous) and six `survey_fields`: three agree/disagree
  ratings (work, manager, team), one `single_choice` on the machine (awesome / ok, may need
  upgrading / slows me down), and two optional `long_text` notes. Idempotent.
- **Reuse only.** The public runner at `/surveys/team-pulse`, person attribution
  (`lib/survey-identity.ts` links a logged-in team member's response to their people row),
  and the admin results view all already exist. `purpose = 'team_pulse'` is not special-cased,
  so it takes the normal survey flow and writes person-linked `survey_responses`.
- **Cadence.** A scheduled task (`team-pulse-biannual`, 15 Jan / 15 Jul) sends the link over
  Lark to every active team member. Everyone on the team, not just engineers.

**Done when.** `/surveys/team-pulse` renders all six questions publicly (verified on prod,
HTTP 200), and a submitted response lands in the survey results with the respondent attached.
