# AI Program Brief - Onboarding Plans (My Team), Edge8 Talent, 2026-07-22

**Status:** Plan for review. Nothing built.
**Format:** A01 "5Ds AI Program Brief" (Define, Discover, Design, Determine, Deploy), adapted for an internal build.
**Four Outcomes tag:** Higher-Performing People.
**Surface:** Team portal, "My Team" sidebar group (manager-only), new page with a six-column kanban board.

---

## 1. Definition of the Problem

Four-line Problem Statement (Define):

- **Who:** Every manager with a new hire, and Mai as Talent Director, on every hire (currently 3 people in pre-boarding and 3 on probation, ~10 hires/year).
- **Cost:** Each onboarding is chased by hand: plan reminders, Day 8 check-in, 45-day review scheduling, 60-day status flips, and the 180-day follow-up. Roughly 4 hours of manual follow-up per hire, and steps slip when nobody chases them.
- **Why now:** The new-member onboarding form, probation stages, and the probation-review cron shipped this month. Six people are in the pipeline today with no shared view of where each one stands, and the 60-day decisions are tracked in heads and chats.
- **Success:** A manager can open one board and see every report's onboarding stage; the plan-upload nag, Day 8 survey, 45-day review, 60-day promotion, and 180-day stay interview all fire automatically on schedule, with zero manual chasing.

---

## 2. Datasources Needed (Discover)

All of these exist today unless marked **NEW**.

| Source | What it provides |
|---|---|
| `company_os.team_members` | Employment record: `start_date`, `manager_id`, `employment_stage` (CHECK already allows `pre_boarding / probation / full_time / declined_offer / rescinded / failed_probation`), `probation_ends_on`, `status`. **NEW column:** `contract_start_date` (admin-editable). |
| `company_os.people` | Names, emails (citext), `preferred_name`, avatar for the card face. |
| `company_os.onboarding_plans` | **NEW table.** One row per onboarding journey: stage, plan document path, per-milestone sent/complete markers, the 45-day decision. |
| `company_os.onboarding_tasks` | Exists, empty, pre-scaffolded (`team_member_id`, title, category, status, due_date). Seeds the three Day 1 activities as checklist items. |
| Survey engine (`surveys`, `survey_fields`, `survey_responses`, `survey_answers`) | Already supports `rating` and `single_choice` fields and a `purpose` post-submit hook (`lib/onboarding.ts` pattern). **NEW seeds:** Day 8 feedback survey (3 ratings) and 45-day review survey (stub, 1 question). |
| Supabase Storage | **NEW private bucket** `onboarding-plans` (PDF/DOCX/images, 10 MB), same signed-URL pattern as `id-documents`. |
| `lib/email.ts` `sendTransactionalEmail` | Resend wrapper, logs every send to `interactions`. Used for all five email automations. |
| Vercel cron | Existing daily 07:00 UTC pattern (`/api/cron/probation-reviews`). **NEW route** `/api/cron/onboarding-plans` in the same slot, `CRON_SECRET` bearer auth, Saigon-date day math. |
| `lib/team-auth.ts` + `lib/team/data.ts` | Manager resolution is already built: `role === "manager"`, `directReportIds`, `teamMemberScope`. The new table must be added to `SCOPE_ALLOWLIST` and granted to `service_role` (both are known gotchas in this repo). |
| Hiring side (`applications`, `job_requisitions.recruiter_id`) | Resolves the recruiter to CC on the Day 60 congratulations email. Fallback: mai@edge8.ai. |

What a user provides each run: the manager uploads one plan document per new hire; the new hire answers the Day 8 survey; the manager answers the 45-day review.

---

## 3. Diagram and Documented Workflow (Design)

### Program roadmap - the automation opportunities inside onboarding

| # | Opportunity | Type | Outcome | Difficulty |
|---|---|---|---|---|
| 1 | Plan-upload nag emails (T-7 to Day 1) | Automated Workflow | Higher-Performing People | Easy |
| 2 | Day 8 feedback survey auto-send | Automated Workflow | Higher-Performing People | Easy |
| 3 | 45-day review trigger + decision capture | Automated Workflow | Higher-Performing People | Medium |
| 4 | Day 60 auto-promotion + congratulations | Automated Workflow | Higher-Performing People | Medium |
| 5 | 180-day stay-interview trigger | Automated Workflow | Higher-Performing People | Easy |
| 6 | Manager kanban board (the visible surface for 1-5) | Packaged UI | Higher-Performing People | Medium |

**Selected workflow:** all six ship together as one program; the board is the surface, the cron is the engine.
**Why chosen:** every piece rides on infrastructure that already exists (survey engine, cron idiom, manager scoping, kanban component), so this is assembly, not invention.
**Expected delivery:** onboarding runs itself on a clock; humans only upload the plan, hold the sessions, and make the 45-day call.

### Stage diagram

```
                        (clock runs from team_members.start_date; Day 1 = start_date, Saigon time)

 Preboarding        Day 1            Day 8             45 Day           60 Day            180 Day
 ───────────►  Orientation  ───►  Onboarding  ───►   Review   ───►   Decision   ───►  Stay Interview ───► Complete
                                   Feedback
 plan due T-7      3 activities    survey to hire    email manager    pass → auto       email Talent
 daily nag to      checklist       (3 questions,     with review      full_time +       Director
 manager if        (Mai / Dave /   1-5 Likert)       survey link      congrats email    (mai@edge8.ai)
 missing, CC       team manager,                     one question:    CC manager +
 mai@edge8.ai      1 hr each)                        next step        recruiter
```

Cards advance automatically by calendar. Columns are date-driven states, not free drag targets: the board renders with the shared `KanbanBoard` component but drag is disabled; every human action happens in a card drawer (upload plan, tick Day 1 activities, see survey status, see the decision). This avoids a manager dragging someone to "60 Day Decision" and implying a promotion that never fired.

### Data model (migration)

```sql
-- 1) Contract start date, admin-editable (the "extend probation" lever)
alter table company_os.team_members
  add column if not exists contract_start_date date;

-- 2) One journey per new hire
create table company_os.onboarding_plans (
  id                  uuid primary key default gen_random_uuid(),
  team_member_id      uuid not null unique references company_os.team_members(id),
  stage               text not null default 'preboarding'
                      check (stage in ('preboarding','day_1','day_8','day_45','day_60','day_180','complete')),
  -- plan document
  plan_path           text,                    -- object path in private onboarding-plans bucket
  plan_uploaded_by    uuid,                    -- team_members.id of the manager
  plan_uploaded_at    timestamptz,
  -- milestone markers (idempotent sends; cron re-runs are safe)
  day8_survey_sent_at   timestamptz,
  day8_response_id      uuid,                  -- survey_responses.id once answered
  day45_email_sent_at   timestamptz,
  day45_response_id     uuid,
  decision              text check (decision in ('offer_full_time','extend_probation_30','terminate')),
  decision_at           timestamptz,
  decision_by           uuid,                  -- team_members.id of the manager
  day60_promoted_at     timestamptz,
  day180_email_sent_at  timestamptz,
  completed_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
grant select, insert, update on company_os.onboarding_plans to service_role;  -- repo gotcha: required
```

Plus: private storage bucket `onboarding-plans` (10 MB, pdf/docx/png/jpg), and `onboarding_plans` added to `SCOPE_ALLOWLIST` in `lib/team/data.ts` scoped by `team_member_id`, so a manager reads exactly their reports' journeys through `teamRead()` and nothing else.

Journey creation: when a `team_members` row enters `employment_stage = 'pre_boarding'` (the existing onboarding-form processor in `lib/onboarding.ts` does this), also insert the `onboarding_plans` row and seed the three Day 1 activities into `onboarding_tasks` (category `day_1`): "HR Handbook with Mai", "Intro to Edge8 with Dave", "Team Overview with team manager", each 1 hour, due on Day 1. A daily cron sweep also backfills journeys for any onboarding-stage member without one (covers admin-created hires and the 6 people already in flight).

### Survey seeds (built on the existing engine, additive only)

**Day 8 - `onboarding-day-8-feedback`** (purpose `onboarding_day8`, respondent = the new hire, non-anonymous). Three `rating` fields, scale 1-5, labels "Strongly disagree" to "Strongly agree":
1. I have the information I need to do my job well.
2. I feel good about the company culture.
3. I understand the company policies.

**Day 45 - `probation-45-review`** (purpose `probation_review`, respondent = the manager, stub as requested). One `single_choice` field, "Next step":
- Offer full time contract
- Extend probation 30 days
- Terminate employee

The manager's email link carries `?subject={team_member_id}`; the runner stores it in the response metadata so the post-submit processor knows who the review is about. Processor records the decision on `onboarding_plans`, and:
- **Extend probation 30 days:** `probation_ends_on += 30` and `contract_start_date += 30` on `team_members`, decision cleared back to pending so the next 45-day-equivalent review can fire against the new window.
- **Terminate employee:** no automation. Marks the decision and emails mai@edge8.ai; a human runs the off-ramp (`failed_probation`) in admin. Termination is never machine-executed.
- **Offer full time contract:** decision stored; Day 60 automation takes it from there.

### The cron - `/api/cron/onboarding-plans`, daily 07:00 UTC (14:00 Saigon)

Same skeleton as `probation-reviews` (CRON_SECRET bearer, Saigon-date math, JSON summary). One pass over active journeys, `d = daysSince(start_date) + 1` (so start_date is Day 1):

| Condition | Action | Email |
|---|---|---|
| `d` in [-6, 0] (the 7 days before Day 1) and `plan_path is null` | none (nag repeats daily by design, stateless) | To manager, CC mai@edge8.ai: "Upload {name}'s onboarding plan before Day 1 ({date})" with a link to the board |
| `d >= 1` and stage `preboarding` | stage → `day_1` | none |
| `d >= 8` and `day8_survey_sent_at is null` | stamp sent, stage → `day_8` | To new hire: Day 8 feedback survey link |
| `d >= 45` and `day45_email_sent_at is null` | stamp sent, stage → `day_45` | To manager: 45-day review survey link (`?subject=...`) |
| `d >= 55` and no decision recorded | none (repeats daily) | To manager, CC mai@edge8.ai: decision overdue reminder |
| `d >= 60` and decision = `offer_full_time` and not yet promoted | `employment_stage → 'full_time'`, clear `probation_ends_on`, stamp `day60_promoted_at`, stage → `day_60` | Congratulations to the new hire, CC manager + recruiter (from `applications → job_requisitions.recruiter_id`; fallback CC mai@edge8.ai) |
| `d >= 60` and no `offer_full_time` decision | hold: no promotion until a human decides | (covered by the overdue reminder above) |
| `d >= 180` and `day180_email_sent_at is null` | stamp sent, stage → `day_180` then `complete`, set `completed_at` | To mai@edge8.ai (Talent Director): time for {name}'s stay interview |

`>=` conditions plus stored markers (rather than exact-day matching) mean a missed cron day self-heals the next morning; the one deliberate exception is the stateless daily plan nag, which is supposed to repeat.

### The board - `/team` My Team section

- New route `app/team/(dashboard)/onboarding-plans/` behind `requireTeamMember()`; page redirects non-managers away (`role !== "manager"`).
- `components/team/TeamSidebar.tsx`: add "Onboarding plans" to the existing `MY_TEAM` group with `enabled: true` (the group already renders only for managers). This becomes the first live My Team page.
- Board: reuse `components/admin/KanbanBoard.tsx` (already consumed cross-surface; /team already imports admin components and CSS) with the six columns above, drag disabled. Card face: avatar, name, position, Day N counter, plan-uploaded badge (red if missing and Day 1 is near), milestone dots.
- Card drawer: plan upload (server-action FormData upload to the private bucket, `id-documents` pattern, signed-URL download link), Day 1 activity checklist (ticks `onboarding_tasks` rows via `teamUpdateInScope`), Day 8 survey status + score once answered, 45-day decision status, timeline of stamps.
- Writes from /team go only through new scoped helpers in `lib/team/data.ts` (the Time Off precedent: never reuse admin actions in /team; IDOR guard via `assertInScope`).
- Mai and Dave get full visibility through a thin admin mirror later (see Deployment); v1 board scope is the manager's own reports, which is what My Team means.

### Build phases (each ends with a check; verify via `tsc --noEmit` + `next build`, no dev server per repo rule)

1. **Migration + seeds.** Table, `contract_start_date`, bucket, grants, two survey seeds, `SCOPE_ALLOWLIST` entry, journey backfill for the 6 in-flight people. *Check: SQL smoke queries; backfilled journeys visible via service role.*
2. **Board + drawer + plan upload.** Sidebar entry, page, kanban, drawer, upload/download. *Check: build passes; manager scoping proven by SQL (a manager's `teamRead` returns only their reports).*
3. **Cron: nag + Day 8.** Route + vercel.json entry, plan-nag email, Day 8 survey send, stage advancement. *Check: dry-run the route locally against a test journey with a shifted start_date.*
4. **45-day review + decision processing.** Manager email, subject-carrying survey link, post-submit processor, extend-probation date math, admin-editable `contract_start_date` on the existing team profile editor. *Check: each of the three choices produces the right writes on a test row.*
5. **Day 60 promotion + congratulations, Day 180 trigger.** Promotion write, recruiter resolution with fallback, both emails. *Check: promoted test row shows `full_time`; emails logged in `interactions`.*

---

## 4. ROI Determined

FAST GOAL:
Every new hire from August 2026 onward has their onboarding plan uploaded before Day 1 and hits all five milestones (Day 8, 45, 60, 180) on schedule with zero manual chasing, reviewed weekly on the My Team board. That recovers about 4 hours of manager and Talent Director follow-up per hire (~40 hours/year at 10 hires) and, more importantly, stops 60-day contract decisions from slipping past their date.

ROI: ~40 hours/year saved, plus on-time probation decisions on 100% of hires.

(FAST: frequently discussed on the weekly board review; ambitious because today 0% of these steps are automated; specific at 100% on-time milestones; transparent since every manager sees the same board.)

---

## 5. Deployment Plan

First seven days after merge:

- **First action:** Backfill journeys for the 6 people currently in pre-boarding/probation and have their managers upload plans; the nag emails start policing this immediately.
- **Who to talk to:** Mai (Talent Director), day one: confirm she is the CC on nags, the terminate-path recipient, and the Day 180 recipient, and walk her through the board; confirm with each manager where their plan documents live today.
- **Stop doing manually:** Mai stops calendar-reminding managers about plans, Day 8 check-ins, and probation review dates; the cron owns the clock.

---

## Open decisions for Dave (flagged, not blocking review)

1. **`contract_start_date` semantics.** Assumed: the date the full-time labor contract begins (distinct from `start_date`, which stays the probation/Day 1 anchor), and "extend probation 30 days" pushes both `probation_ends_on` and `contract_start_date` out 30 days. Confirm.
2. **Extension and the 60-day clock.** Assumed: an extension re-arms the review (new decision needed before the extended end date) and Day 60 promotion waits for an `offer_full_time` decision; nothing auto-promotes without one. Confirm.
3. **Recruiter CC on the congratulations email.** Resolved via the hire's application → job requisition → `recruiter_id`; direct hires with no application fall back to CC mai@edge8.ai. OK?
4. **Talent Director oversight.** v1 board shows managers their own reports only. Mai sees everything via the emails; an all-journeys admin mirror under `/admin/talent` is a fast follow. OK to defer?
5. **Day 8 survey delivery.** Assumed email link to the existing `/surveys/{slug}` runner (they may not have portal access habits yet at Day 8). Alternative: surface it in the portal too.
