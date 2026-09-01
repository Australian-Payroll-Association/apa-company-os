# Improved Scheduling and Tracking

**Australian Payroll Association · Project detail · [Master plan](building-on-company-os.md)**

The consulting team's scheduling layer on the Company OS: scheduling, time entry, resourcing, and client projects and tasks. One system to replace the three surfaces the schedule lives on today (Kantata, a spreadsheet, Adriana's whiteboard), and to make the two judgments in people's heads — who has capacity, who can do what — visible.

- **Day-one user:** Adriana and the consulting team
- **The one action:** answer "who can take this project?" from the system
- **Size:** medium (rides on the Unified Project System)
- **Builds on:** `company_os` — boards, tasks, deals, leave, staff assignments

> Companion of the [Unified Project System](project-unified-pm.md). Source: discovery interview with Emily (consulting), 1 September 2026. The visual charter is [project-scheduling.html](project-scheduling.html).

---

## 1. Ground truth (verified against the schema)

The charter says this project "mostly extends." Checked against `supabase/01-schema.sql`, that is true for leave, deals and boards — but three assumptions needed correcting, and they shape the build:

| Charter assumed | Reality in the schema | Consequence |
|---|---|---|
| `time_entry` is "already the heart of the Unified Project System build" | **`time_entry` does not exist.** The Unified Project System is an unbuilt charter. | Phase 1 has no foundation. `time_entry` is built first, as Phase 0. |
| `staff_assignments` "already models one person on one project" | It links a person to a **client company**, not a project. No allocation hours, no tentative status, no deal link. | The "extend, don't fork" step is the spine, not a footnote. |
| (unstated) no time tracking exists | The `htt` schema auto-captures hours (`htt.token_entries`) from repo effort logs. | Two possible truths for hours. Decided: the manual timesheet wins; `htt` stays for code/AI effort only. |

Confirmed solid: `time_off` fully models leave (typed, dated, approved, hours/days — 309 live rows); `deals` carries `stage_id`, `probability` and `amount_cents` (the forecast line is directly buildable); the boards/tasks/sprints kanban is fully built and reusable; `tasks.human_tokens` (1 token = 1 hour) is the estimate unit.

---

## 2. Decisions settled (1 September 2026)

**Foundation**
1. **`time_entry` is built first**, as its own Phase 0 — the Unified Project System spine. Scheduling rides on it.
2. **The manual timesheet is the source of truth** for consulting hours. `htt` is not joined into any scheduling view.
3. **`staff_assignments` is extended in place**, not forked — `allocation_hours`, `schedule_status` (tentative/confirmed), `source_deal_id`, `board_id`. The legacy free-text `status` on existing client placements is left untouched.
4. **Home:** `app/admin/(dashboard)/operations/scheduling` (next to time-off), with a self-service timesheet slice under `app/team/(dashboard)`.

**Policy & definitions**
5. **One judgment seat** — Adriana, head of advisory, holds both availability and assignment judgment. Modelled as a single resourcing-lead permission; the bus-factor risk is explicit, and the capability matrix exists to reduce it.
6. **Work-type list** for the capability matrix is seeded from the real **Kantata project-type list** (export pending). Keep under ~12; it is an assignment aid, not a competency framework.
7. **Tentative-entry rule** (provisional, to finalise with Adriana): a deal **past the `proposal` stage** may enter the schedule as tentative. Enforced in the app, not the DB.
8. **Overwork flag is two-tier:** a soft advisory at sustained ≥ 85% (the burnout band; Fair Work s62 "reasonable additional hours"), a hard flag over 100%. Applied in the app over `consultant_load`.

**Scope & transition**
9. **Pilot: Consulting only.** Phase 0 and Phase 1 share the consulting pilot on purpose.
10. **Kantata is dual-maintained** and mirrored; each phase cuts over only when its real-world exit test passes. No new investment in Kantata.
11. **Internal-only.** Nothing here reaches the client portal. A DB CHECK enforces that a tentative allocation can never be `client_visible`.

---

## 3. On company_os

### Reuse as-is
`time_off` + `components/admin/TimeOffCalendar.tsx` (availability) · boards/tasks/sprints kanban `lib/boards/*`, `components/admin/KanbanBoard.tsx` (workload) · `deals` pipeline `app/admin/(dashboard)/revenue/deals` (forecast) · `compensation_sensitive` / `can_view_sensitive` (cost visibility) · `tasks.human_tokens` (estimate unit) · `lib/admin/staff-assignments.ts`, `lib/admin/time-off.ts` (data access).

### New / extended — the migrations
Reviewable DDL lives in [`supabase/features/scheduling/`](../../supabase/features/scheduling/README.md), applied 00→05:

| # | Change |
|---|---|
| 00 | **`time_entry`** — new. `person_id`, `board_id?`, `task_id?`, `work_date`, `hours`, `billable`, `note`. The timesheet spine. |
| 01 | **`staff_assignments`** — extend: `allocation_hours`, `schedule_status` (tentative/confirmed), `source_deal_id → deals`, `board_id → boards`; plus a CHECK that tentative rows are never client-visible. |
| 02 | **`boards`** — extend: `start_date`, `end_date`, `budget_hours`, `client_response_sla_days`. |
| 03 | **`capability`** — new. `person_id`, `work_type`, `level` (fast/capable/learning/no), `preference`, `note`. Updated at close-out, not by review. |
| 04 | **`client_requests`** — new. `board_id`, `asked_on`, `description`, `answered_on`, `note`. Elapsed days derived, never stored. |
| 05 | **Views** — `consultant_load`, `deal_forecast_load`, `project_slip`, `estimate_variance`, `project_budget_health`. |

Every new table enables RLS and mirrors the `staff_assignments` policy/grant pattern (`service_role`, `chatbot_reader`, `chatbot_writer`, `team_chatbot_reader`).

---

## 4. Rollout

- **Phase 0 · Timesheet spine** (new). `time_entry` + the ≤10-second logging surface for consulting. **Exit:** consulting logs 100% of hours for two weeks.
- **Phase 1 · One schedule.** Timeline over boards, tasks, extended `staff_assignments` and `time_off`; linked dates; tentative status. **Exit:** Adriana runs a full weekly pass in-system; the whiteboard and spreadsheet go untouched that week.
- **Phase 2 · Judgment visible.** Capability matrix seeded; `consultant_load`; the two early-warning flags. **Exit:** a project assigned via the matrix, and an over-budget flag fires before the overrun.
- **Phase 3 · Modelling & proof.** What-if overlay (in-memory, stores nothing); `client_requests` + slip decomposition. **Exit:** a big-deal slip modelled in-system; one overrun shows its waiting-on-client days with evidence.

---

## 5. Still open (data & sign-off)

- **Kantata project-type export** — to seed `capability.work_type`.
- **Adriana's whiteboard** — a photo/sketch (structure, not data) before designing the tentative-project screen. Asked for in discovery; not yet received.
- **Territories** — named at the start of discovery, never materialised (skill turned out to be the whole assignment story). Ask once, directly, before assuming they don't exist.
- **Capacity source** — `consultant_load` defaults to 38h/week; swap for `people.weekly_capacity_hours` when the Unified Project System adds it.
- **Budget unit** — `boards.budget_hours` (here, for estimate variance) vs `boards.budget_cents` (Unified PM, for cost). Confirm both are wanted.
- **Tentative-entry rule** — finalise the exact pipeline stage with Adriana.

---

## 6. Handoff — what shipped (1 September 2026)

All four phases are **built, merged, and deployed to production**. Migrations `00`–`05` are applied to the live database. What remains is data and sign-off (section 5), not code.

### Live surfaces

| Surface | Route | Ships in |
|---|---|---|
| My timesheet (team self-service) | `/team/timesheet` | PR #13 |
| Resourcing schedule grid | `/admin/operations/scheduling` | PR #14 |
| What-if toggle (committed vs win-all-tentative) | `/admin/operations/scheduling?view=expected` | PR #19 |
| Capability matrix | `/admin/operations/scheduling/capability` | PR #16 |
| Early-warning flags (overwork + over-budget) | on the schedule page | PR #16 |
| Project slip + client requests | `/admin/operations/scheduling/slip` | PR #19 |

### Schema in production
`time_entry`, `capability`, `client_requests` (new); `staff_assignments` and `boards` extended; views `consultant_load`, `deal_forecast_load`, `project_slip`, `estimate_variance`, `project_budget_health`. DDL: [`supabase/features/scheduling/`](../../supabase/features/scheduling/README.md).

### Known limitations carried into production
- **Capacity is a flat 38h/week.** Part-time staff read as over-utilised until `people.weekly_capacity_hours` exists (see section 5). Marked `-- CAPACITY` in `05-views.sql`.
- **Capability work types are provisional** (`lib/scheduling.ts`) — swap for the Kantata export.
- **`estimate_variance` per project-type is inert** — nothing populates `boards.metadata->>'project_type'` yet; the view is correct per project.
- **Auth accounts are seeded, not real.** A demo team-member account (`kylie@austpayroll.com.au`) and one seed project (**Logan Meats — Payroll Review**) exist to give each surface live data. Real consulting data comes from the Kantata mirror.

### Adoption gates still ahead (the charter's exit tests)
Code shipped ≠ in use. Each phase's real-world exit test (section 4) — Adriana running a full weekly scheduling pass in-system, consulting logging 100% of hours for two weeks, a slip modelled in-system — is the bar that closes the project.
