# Performance Reviews at Edge8

Date: 2026-08-12
Status: Draft for approval
Reference data: 33 historical reviews (Performance Pulse, Sep 2024 to Jun 2026)

## Purpose

Three scheduled review moments, each with one job:

1. **Probation Review** (6 weeks after start date): pass or fail probation.
2. **Mid-Year Check-In** (5 months from contract date): identify high performers.
3. **Renewal Review** (1 month before contract expiration): decide on contract extension.

Salary is handled in a separate process. Reviews carry no salary fields and no comp
discussion. Review history is an input Dave consults when setting comp, never the venue.

## Lessons from the old data

- Timing was ad hoc; reviews happened in bursts when someone remembered. The system
  must fire from dates on the person record, not from memory.
- The flat form changed shape mid-stream (Review Type added late, rating columns
  shifted), so old rows are not comparable. The instrument must be frozen.
- Self + manager pairs happened for only ~5 of 27 people. Where both exist, the gap
  between self and manager rating is the best coaching signal in the dataset.
- Ratings compress to 3-5 (average 4.1, no 1s ever). Averages cannot identify high
  performers; the mid-year moment needs a forcing question.
- Half the rows captured no decision. Every review must end in a recorded decision.
- Salary requests and comp promises leaked into review text. Firewalled going forward.
- Long-form manager guidance is the most valuable content. Keep the free-text fields.
- Multiple managers now review people (Trac, Phuong, Thanh). Each person needs a
  manager-of-record; the founder is the fallback, not the default.

## The instrument (frozen, identical every cycle)

The original Performance Pulse form, kept verbatim (names and helper text as
on the survey), plus five AI craft ratings. Rated 1-5, same wording forever
so trends are real:

1. Role Understanding & Application: how well the employee understands the
   duties, policies, and expectations
2. Work Quality & Output: accuracy, thoroughness, and timeliness of work
   delivered
3. Collaboration & Team Fit: interaction with colleagues, contribution to a
   positive workplace culture
4. Communication Skills: clarity, responsiveness, and professionalism in
   communication
5. Problem-solving: ability to analyse issues, develop practical solutions,
   and implement them effectively
6. Learning & Innovation: willingness to take feedback, learn new skills,
   and adapt to change
Dimensions 7-11 follow the AI Officer curriculum (educational-content,
SERIES-FRAMING-v2): planning (a01, the 5D pass), the three craft skills
every agentic mission exercises (worded the way we teach them), and
building (a06, ship it). The 1-5 ladders follow the mission compound curve,
so a review score maps directly to curriculum progress.

7. AI Planning (new): planning the AI program: scanning your workflows for
   opportunities and turning the right one into a plan (the 5D pass:
   Define, Discover, Design, Determine, Deploy)
   - 1 = Waits to be told; doesn't spot AI opportunities in their own work
   - 2 = Spots opportunities but can't frame them: no clear problem
     statement or goal
   - 3 = Scans their workflows, picks the right opportunity, writes a clear
     problem statement and goal
   - 4 = Plans programs others execute; keeps a roadmap across the four
     outcomes
   - 5 = Runs the planning rhythm for the team; their roadmaps decide what
     gets built
8. Workflow Design (new): seeing work as a flow (trigger, steps, handoffs,
   decisions, outputs) and deciding where AI fits and where a human stays
   - 1 = Does the work; doesn't see it as a workflow
   - 2 = Can map a workflow on paper: trigger, steps, handoffs, outputs
   - 3 = Has wired a real multi-step workflow that runs end to end
   - 4 = Designs workflows that branch and decide (classify, route,
     respond) with human-in-the-loop where it belongs
   - 5 = Ships workflows that run unattended in production, designed for
     failure modes; others copy their designs
9. Organizing Information (new): making sure AI has the right data to do
   the job well: where it lives, whether it's clean, whether it's accessible
   - 1 = Data lives in their head or scattered files; AI works blind
   - 2 = Gathers the reference docs and examples a prompt needs to be good
   - 3 = Keeps team data where workflows can point to it, clean and current
   - 4 = Decides what AI can see and reach on its own: access, boundaries,
     what it must not touch
   - 5 = Designs the real data layer: schemas, access control, logs that
     others rely on
10. Creating Instructions (new): writing prompts, system prompts, and
    decision criteria clear enough that AI (and any teammate) gets it right
    the first time
    - 1 = One-off prompting; results are luck
    - 2 = Writes solid prompts: role, task, constraints, output format
    - 3 = Packages instructions others can run without them
    - 4 = Writes decision criteria, routing rules, and goals with guardrails
    - 5 = Instructions live in version control: reviewed, testable; sets the
      team standard
11. AI Building (new): turning the plan into working product by directing
    AI, in the role's own medium
    - 1 = Consumes what others build; work is made by hand
    - 2 = Builds with help; prototypes with guidance
    - 3 = Builds and ships a working prototype on their own (no-code or
      code)
    - 4 = Ships to production on the real stack; output is a clear multiple
      of hand-speed
    - 5 = Ships systems others build on; sets the build standard

AI craft expectation by level (level and track live on the person record;
tracks are IC and Manager, levels are Junior, Collaborator, Senior,
Principal). Expected: Junior 2, Collaborator 3, Senior 4, Principal 4-5.
One above expected = high-performer signal. Manager track: same ladders,
but the medium is the team (workflows the team runs, the team's data layer,
instructions the team executes from). Roughly: level 2 = generative track
capability, 3 = a03 wired workflow, 4 = a04/a05 decision logic and agents,
5 = a06 production. AI Officer certification and review scores should
corroborate each other.

Anchored scale (shown next to every rating):

- 1 = Not meeting expectations, needs intervention
- 2 = Below expectations, clear gaps
- 3 = Meets expectations, solid
- 4 = Exceeds expectations, would be missed
- 5 = Exceptional, role model for others

Free text (both raters): Achievements, Areas for Improvement, Additional Comments.

## The three moments

### 1. Probation Review, 6 weeks after start date

- Why 6 weeks: Vietnam probation is typically 60 days; reviewing at day 42 leaves
  buffer to act before probation lapses into contract by default.
- Self-assessment first, then manager. Manager drafts blind, sees the self-assessment
  only after submitting their own draft, then finalizes.
- Required decision: **Continue to contract / Extend probation 30 days / Discontinue.**
- An extension schedules a follow-up probation review 30 days out automatically
  (the Trang case from Apr 2025, done by hand then).

### 2. Mid-Year Check-In, 5 months from contract date

- Purpose: development plus high-performer identification. No employment decision,
  so people can be honest.
- Same instrument, plus two manager-only questions:
  - **"If this person told you they were leaving, would you fight to keep them?"
    Yes / No** (the forcing question; rating averages are too compressed to rank).
  - "What one thing would make them twice as valuable next half?"
- High performer = keeper-question Yes. Flag stored on the review record; admin
  talent view lists all current high performers.
- Feeds the coaching cycle: agreed development focus becomes a coaching goal.

### 3. Renewal Review, 1 month before contract expiration

- Purpose: the contract decision, made with the full year's record on screen
  (probation review, mid-year check-in, coaching goals, self vs manager gaps).
- Required decision: **Renew / Renew with changes / Do not renew.**
  "Renew with changes" captures role or scope changes in text, never salary.
- One month out leaves time for notice or negotiation either way.

Off-cycle: a manager can open an ad-hoc review (e.g. promotion case) any time.
Same instrument, type "Ad-hoc". Not scheduled.

## Mechanics that make it work

- **Two linked records per cycle**, self and manager, on the same frozen instrument.
  Employee sees the manager's review only once finalized (per the team-portal
  design's finalized-only rule).
- **Person-keyed history.** Every review stacks into one timeline per person:
  six dimensions over time, self vs manager gap per dimension, decisions.
- **Manager-of-record** on the person record drives who owes the manager review.
- **Dates drive everything.** start_date fires the 6-week review; contract date
  fires the 5-month check-in; contract end date fires the renewal review.
  Reminders chase both parties until submitted (extends the existing
  probation-reviews cron pattern).

## Build plan (PRs)

### PR 1: Reviews schema and history import

- What it does: creates the `performance_reviews` table in the `company_os` schema
  (Supabase project wwchefrgkkxmhlkntufm), one row per person per cycle per rater
  (self or manager), with the eleven ratings, free text, decision, keeper flag, and
  cycle metadata. Follows the shape already spec'd in the DBML. Imports the 33
  historical Performance Pulse rows mapped to existing people records (old rows
  keep their original ratings; pre-Aug-2025 rows flagged as legacy scale).
- What you'll see: nothing in the UI yet; history queryable per person via db.mjs.
- Done when: every historical review is attached to the right person and a query
  returns one clean timeline per person.

### PR 2: Review forms on the survey engine

- What it does: reviews are taken through the existing survey runner, which is
  already one-question-at-a-time (progress bar, Enter to advance). Adds a
  `performance_review` survey purpose that requires sign-in (respondent
  resolved via people.auth_user_id), widens the existing subject mechanic
  beyond probation_review, extends the rating question so each 1-5 value
  carries its anchor text plus the "expected for level" marker, and adds a
  localStorage draft so a closed tab doesn't lose long answers. A post-submit
  processor (same pattern as processProbationReview) writes the structured
  row to performance_reviews: the survey captures, the review table is the
  record. Privacy: performance_review responses are excluded from the admin
  survey-results aggregates; visibility follows the review rules (own
  self-assessment, manager review once finalized, managers see reports).
  /team/reviews lists what you owe and what's finalized, and links into the
  runner.
- What you'll see: /team/reviews with "My reviews" and, for managers, "My
  reports"; the form itself runs one question per screen like /surveys.
- Done when: a full cycle runs end to end in production: self submits, manager
  drafts blind, sees the self-assessment, finalizes, employee sees the
  finalized review, decision stored in performance_reviews, and none of it
  appears in generic survey results.

### PR 3: Scheduling and reminders

- What it does: a cron computes due reviews from each person's start date (+6
  weeks), contract date (+5 months), and contract end date (-1 month), opens the
  review cycle, and emails both parties. Chases weekly until both sides submit.
  Probation extensions auto-schedule the 30-day follow-up.
- What you'll see: review cycles appear without anyone remembering; reminder
  emails to employee and manager-of-record.
- Done when: a test person with seeded dates generates all three cycles on the
  right days and reminders fire.

### PR 4: Trends and the gap view

- What it does: per-person review timeline in the admin talent profile and the
  team portal: six dimensions plotted across cycles, self vs manager gap per
  dimension, decisions and high-performer flags on the timeline. Admin roll-up
  lists current high performers and upcoming decisions (probations ending,
  contracts expiring).
- What you'll see: a person's page answers "how are they evolving" at a glance;
  an admin view answers "who is due and who are our high performers".
- Done when: historical import plus new cycles render on one timeline and the
  high-performer list matches keeper-question answers.

## Out of scope

- Salary, comp, commissions: separate process, no fields here.
- Peer reviews (two managers reviewed Tam in Nov 2025): possible later as extra
  rater rows on the same instrument; not in v1.
- 360 feedback, calibration meetings, bell curves: not at this team size.
