# Unified Project System

**Australian Payroll Association · Project detail · [Master plan](building-on-company-os.md)**

One system for the whole company (about 24 people, three teams) to replace Kantata, ClickUp and Infinity. It follows every project from start to finish and answers three questions at any moment.

- **Day-one user:** the whole team
- **The one action:** log a day in under 10 seconds
- **Size:** larger (biggest win)
- **Builds on:** `company_os` (boards, tasks, pay)

> One of three projects in the [Building on company_os](building-on-company-os.md) master plan.

---

## 1. What it is

- **What are we working on?** Projects and their stage.
- **Where are our people?** Who is on what, and their workload.
- **What is each job costing us?** Hours logged times each person's cost rate, against budget.

Everything hangs off one loop: **create a project, log time, cost rolls up against budget.** Each team keeps its own project types and fields under one roof, rather than one forced structure.

**The rule that keeps costs honest:** never store cost on a row. Work out `hours × current rate` when you read it. Storing it creates two truths and breaks the moment a rate changes.

---

## 2. How it works

Five parts, built in this order. The timesheet comes first because everything else depends on the hours being logged.

1. **My timesheet** (first). If logging is slow, people will not do it, and every cost number goes wrong. Target: log a day in under 10 seconds.
2. **Cost dashboard.** Cost per project and per team, budget against actual. Leadership only.
3. **Project board.** Projects by stage. Filter by team, owner and status.
4. **Project detail.** Fields, tasks and checklist, hours, cost-to-date against budget, people allocated.
5. **Staff allocation.** Who is on what this week and next, against each person's capacity.

---

## 3. On company_os

Most of this already exists. The board system covers projects, tasks and allocation, and the pay data is already there and already locked down.

**Existing tables it uses:** `boards`, `board_columns`, `board_members`, `sprints`, `tasks`, `task_comments`, `task_stage_log`, `staff_assignments`, `availability_blocks`, `people`, `team_members`, `compensation_sensitive`, `deals`, `invoices`, `expenses`

**The requirement that is already solved:** "only leadership sees cost rates." Pay data lives in `compensation_sensitive`, already gated by the `can_view_sensitive` permission. You reuse that gate, you do not build it.

**New, and it is mostly one table**

- `time_entry` (the real gap): person_id → people, board_id → boards, task_id → tasks (optional), work_date, hours, note. There is no staff timesheet today (the contractor table is contractor-only). This one table is the heart of the build.
- `checklist_template` + items: per team, recurring-task checklists seeded onto a board.
- Column adds (extend, don't fork): people.`weekly_capacity_hours`, boards.`team` / `project_type` / `budget_cents`.

**Core data to pull in**
- Staff are already `people` and `team_members`. Nothing to import.
- Each person's cost rate into `compensation_sensitive`, if not already recorded. This is the one input the cost view needs.
- Live projects from the three old tools moved into `boards`, tagged by team and type, linked to the client through `boards.client_company_id`.
- Budgets onto the board. Actuals already flow from `invoices` and `expenses`.

**Views & permissions**
- `project_cost` view: sum of `time_entry.hours` times the current cost rate, per board and team, against `budget_cents`.
- `workload` view: allocated hours against `weekly_capacity_hours`, per person per week.
- Permissions: everyone logs time; only leadership reads cost rates and project cost, through the existing pay-data gate.

---

## 4. Rollout

One team at a time. Do not switch off an old tool until its team runs fully on the new one.

| Phase | Build | Move on when |
|---|---|---|
| 1 · Real for one team | Timesheet, recurring-task checklists, allocation and workload view, cost dashboard, cost-rate permissions. | Consulting logs 100% of hours here for two weeks, and leadership reads cost from the dashboard, not a spreadsheet. |
| 2 · Other teams | Marketing and Events, then Design: their project types, fields and checklists. Move their live projects in. | Each team's projects live in the system with their own templates. |
| 3 · Retire the old tools | Reporting, full permissions, finance links, training, and switch-off of Kantata, ClickUp and Infinity. | A tool is switched off only after its team runs fully on the new system. |

Pilot team: **Consulting**, where cost and hours matter most and the value proves fastest.

---

## 5. Decisions to settle

- **[Decision] Who is "leadership".** The cost gate needs a list of who may read rates and project cost. Uses the existing `can_view_sensitive` permission, so it is a setting, not a build.
- **[Decision] One source of truth for hours.** The tasks table already has an hours proxy; reconcile it with the new `time_entry` so cost is worked out from one place.
- **[Watch] Adoption is make or break.** Build the timesheet and the fast logging screen first. Slow logging means no logging, and then every cost number is wrong.

---

*See also: [Beryl ROI Calculator](project-beryl-roi.md) · [Payroll 360 Report Engine](project-report-360.md) · [Master plan](building-on-company-os.md)*
