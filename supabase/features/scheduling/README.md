# Improved Scheduling & Tracking — feature migrations

Reviewable DDL for the **Improved Scheduling and Tracking** project
([charter](../../../docs/product/project-scheduling.html) ·
[build spec](../../../docs/product/project-scheduling.md)).

> **These files are NOT part of the setup runbook.** The canonical database is
> still built from `supabase/00-prereqs.sql` then `supabase/01-schema.sql`, per
> the repo `CLAUDE.md`. These are forward feature migrations to be reviewed,
> then applied to a live database (dev first) once the decisions below are
> signed off. They do **not** belong in `supabase/migrations/`.

## Apply order

| # | File | What it does | Phase |
|---|------|--------------|-------|
| 00 | `00-time_entry.sql` | New `time_entry` table — the shared timesheet spine (Unified Project System). Consulting pilot. | 0 (foundation) |
| 01 | `01-staff_assignments-extend.sql` | Extend `staff_assignments` in place: allocation hours, tentative/confirmed schedule status, deal + board links, portal-leak guard. | 1 |
| 02 | `02-boards-extend.sql` | Extend `boards`: project start/end, budget hours, client-response SLA. | 1–3 |
| 03 | `03-capability.sql` | New `capability` matrix (person × work-type × level). | 2 |
| 04 | `04-client_requests.sql` | New `client_requests` log for the slip decomposition. | 3 |
| 05 | `05-views.sql` | `consultant_load`, `project_slip`, `estimate_variance`, `deal_forecast_load`. | 1–3 |

Run 00–04 before 05 (the views depend on the new columns/tables).

## Decisions baked in (from the 1 Sep 2026 sign-off)

- **`time_entry` is built first**, as the Unified Project System spine; Scheduling rides on it.
- **The manual timesheet is the source of truth** for consulting hours. The `htt` schema stays for code/AI effort only — it is not joined here.
- **`staff_assignments` is extended in place** (not forked). A new `schedule_status` column carries tentative/confirmed so the legacy free-text `status` on existing client placements is untouched.
- **Internal-only.** Nothing here is exposed to the client portal. A CHECK constraint enforces that a `tentative` allocation can never be `client_visible`.
- **No double-counting.** A second CHECK (`allocation_requires_project`) means `allocation_hours` can only sit on a row tied to a board or a deal — never on a durable client placement — so `consultant_load` can't sum a placement into someone's utilisation.
- **Two-tier overwork flag** (soft ≥ 85%, hard > 100%) lives in the app over `consultant_load`, not in the schema.

## Still open before apply

- **Capacity source (also a part-time bug).** `consultant_load` hard-codes weekly capacity to **38h** and converts leave at 38/5 = 7.6h/day. This is wrong for anyone on `team_members.employment_type = 'part_time'` — they'll read as chronically under-utilised. When the Unified Project System adds `people.weekly_capacity_hours`, swap the constant for `COALESCE(p.weekly_capacity_hours, 38)` (marked `-- CAPACITY` in `05-views.sql`). Until then, treat part-timers' utilisation as unreliable.
- **estimate_variance per project-type is inert.** Nothing populates `boards.metadata->>'project_type'` today, so that column reads `(unset)`. The view is correct **per project (board)**; do not present a per-type breakdown until a project-type field exists.
- **Budget unit.** `02-boards-extend.sql` adds `budget_hours` for the estimate-variance flag. The Unified Project System charter separately proposes `boards.budget_cents` for cost. They are complementary; confirm both are wanted before applying, to avoid two budget fields with unclear ownership.
- **Tentative-entry rule.** Enforced in the app, not the DB (default: deal past the `proposal` stage). Finalise with Adriana.
- **Work-type vocabulary** for `capability.work_type` — seed from the Kantata project-type export (pending).

## Security

Every new table enables RLS and mirrors the `staff_assignments` policy/grant
pattern exactly: `service_role` (full), `chatbot_reader` (select),
`chatbot_writer` (select/insert/update), `team_chatbot_reader` (select). The
Next.js server connects as `service_role`, so application reads/writes are
unaffected; RLS here governs the assistant roles.
