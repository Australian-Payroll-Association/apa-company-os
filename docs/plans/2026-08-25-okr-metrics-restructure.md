# OKR + Metrics Restructure — Plan

_One goal system instead of two. Objectives and Key Results, tagged by Brand and the Four Offices, with weekly agent-written logs. The Metrics table retires. Status is derived, never asserted._

**Date:** 2026-08-25
**Relates to:** `2026-08-25-four-offices-dashboard-redesign.md` (the cockpits consume this model)
**Branch base:** `origin/main` (worktree, per CLAUDE.md ship flow)

---

## The one-sentence goal

Every quarterly commitment lives in one place (`objectives` → `key_results`), tagged by office and brand, updated weekly by agent-written `kr_logs` (humans where needed), with health chips computed from progress vs. pace, and the standing health numbers left to the cockpit KPIs computed live.

## Why

Today three overlapping "number" systems exist:

1. **objectives → key_results**: quarterly, tagged `level`/`office`/`business_line`, asserted `status`.
2. **metrics + metric_readings**: standing numbers with an `office` tag, weekly readings, optional `key_result_id` link. When linked it duplicates the KR; when standing it duplicates what cockpits will compute live.
3. **Dashboard KPIs**: computed live in page queries (four-offices plan).

The division of labor after this plan:

> **Cockpit KPIs = standing health, computed live from source tables (no rows).**
> **OKRs = quarterly commitments, one model, tagged office + brand, logged weekly.**
> **Metrics = gone.**

---

## Target model

### objectives (modified)

- `office`: `revenue | talent | operations | innovation | null` (null = company-wide)
- **new** `brand`: `edge8 | aio | null` (null = company-wide). Text enum like `business_line`, NOT a FK to the deprecated brands table (company_os dropped brand FKs deliberately; do not reintroduce).
- Keep `quarter`, `title`, owners, `parent_kr_id` cascade, `sort_order`.
- **Drop** `level` (derived: no office + no brand = company). **Drop or migrate** `business_line` (open decision 1).

### key_results (modified)

- Keep `title`, `target_value`, `current_value`, `unit`, `direction`, `delivery_mix`, `accountable_person_id`, `executing_agent`, `sort_order`.
- **New** `source`: `agent | manual` and `source_detail` (a rule key from the KPI rules registry, or free text). Migrated from the old metrics columns.
- **Drop** `status` — derived, see below.
- `current_value` stays as a denormalized copy of the latest log value (updated on log insert).

### kr_logs (new, replaces metric_readings)

```
id               uuid pk
key_result_id    uuid → key_results
week_start       date          -- Monday, weekStartISO() convention
value            numeric null  -- null = note-only update
note_md          text null     -- what moved and why, 1-3 sentences
author_kind      'agent' | 'human'
author_agent     text null     -- one of the 8 agents
author_person_id uuid null
created_at       timestamptz
```

- **Append-only, no unique constraint on (kr, week).** Agent writes Sunday, a human can correct Monday; the latest log with a `value` per week wins for the series. Full audit trail of who said what.
- Insert action (or trigger) copies latest value onto `key_results.current_value`.
- Service_role grants in the same migration (standing gotcha).

### Derived status (code, not column)

`deriveKrStatus(kr, now)` in `edges-shared.ts`, built on the existing `progressPct` + `currentQuarter`:

- expected pace = `week / totalWeeks` × 100
- `done`: progress ≥ 100
- `on_track`: progress ≥ pace − 10
- `at_risk`: pace − 25 ≤ progress < pace − 10
- `off_track`: progress < pace − 25
- `tracking`: no `target_value` (excluded from health rollups)

Agents may flag risk narratively in a log note; the chip color is always computed. Tune thresholds once real data renders, in one function.

### KPI rules registry (new): `lib/kpi-rules.ts`

Single source of truth for how every number is calculated. Declarative — strings and enums, no query functions (queries stay in pages/cron per the one-query-pass principle).

```ts
type KpiRule = {
  key: string;          // "revenue_30d"
  office: Office;
  label: string;
  definition: string;   // prose: exactly what counts, edge cases included
  window: "7d" | "30d" | "90d" | "ytd" | "1yr" | "quarter" | "point_in_time";
  sources: string[];    // ["invoices.txn_date", "orders.paid_at"]
  formula: string;      // documentation of the query
  caveats?: string;     // "analytics history starts Jul 11 2026"
  format: "usd" | "count" | "pct" | "days";
  direction: "up" | "down";
};
```

Three consumers:
1. **Pages** render label/format/tooltip from the rule; values come from the page's single `Promise.all`. `MetricCard` gets an info tooltip showing `definition` + `caveats`.
2. **The KR agent-logger** resolves `key_results.source_detail` → rule key → computation.
3. **Generated doc**: `scripts/generate-kpi-rules.mjs` renders `docs/product/kpi-rules.md` (table per office). CI check regenerates and diffs so the doc cannot drift (à la `check:design`).

Not doing: hand-written markdown as source of truth (rots), DB table of formulas (untypecheckable, nobody edits math in an admin UI).

### Weekly heartbeat pipeline

The Sunday 18:00 run becomes one pipeline, two outputs:
1. For each KR with `source = agent`: compute value per its rule, insert a `kr_logs` row with value + short generated note.
2. Compose the sync packet FROM the logs (today it reads raw numbers).
3. Monday packet lists "KRs with no log this week" so manual ones don't silently go stale.

Humans log via an inline form on the goals board: value + note (manual-source KRs and corrections).

---

## Phases (one PR each)

| Phase | Name | Done-check |
|---|---|---|
| 0 | Decisions + metric triage | Open decisions below answered; each existing metric dispositioned (→ KR, → cockpit KPI, → delete) |
| 1 | Schema migration | `brand` on objectives, `source`/`source_detail` on key_results, `kr_logs` created + grants; `kr_logs` backfilled from `metric_readings` where the metric had a `key_result_id` (author_kind from old `source`); app still builds green |
| 2 | KPI rules registry | `lib/kpi-rules.ts` + generator + CI check + `MetricCard` tooltip; `docs/product/kpi-rules.md` committed |
| 3 | Derived status | `deriveKrStatus` replaces the status column everywhere (goals board, team company-goals, dashboard chips); status column dropped; asserted-status UI removed |
| 4 | Heartbeat | Agent-logger in the Sunday run writes `kr_logs`; sync packet composes from logs; human log form on goals board |
| 5 | Retire metrics | `lib/coaching/data.ts` re-pointed to `kr_logs`; `/admin/edges/metrics` page + actions deleted; `metrics` + `metric_readings` dropped once nothing reads them |

Phases 1–2 are independent of 3–4 and can land in either order. Phase 5 is last.

### Known consumers to touch

- `app/admin/(dashboard)/edges/goals/` (board + actions: status UI, metric join, log form)
- `app/admin/(dashboard)/edges/metrics/` (delete in Phase 5)
- `app/admin/(dashboard)/edges/sync/` + `scripts/edges/sync-packet.mjs` (compose from logs)
- `app/team/(dashboard)/company-goals/page.tsx` (derived status, drop metric read)
- `lib/coaching/data.ts` (re-point readings → kr_logs; richer input: notes, not just numbers)
- `app/admin/(dashboard)/edges/issues/` — untouched (already hangs off `key_result_id`)
- Four-offices dashboard plan: goal-health chips + AI-mix queries unchanged; cockpits gain per-KR sparkline + "last update" byline from `kr_logs`

---

## Decided

- **Status is derived** (Dave, 2026-08-25). No asserted status anywhere; log notes may flag risk narratively.
- **One goal system.** Metrics/metric_readings retire; standing health numbers are cockpit KPIs computed live.
- **KR logs are append-only**, agent-first with human correction, weekly cadence.
- **Rules live in code**, doc is generated, CI-checked.

## Open decisions for Dave

1. **Does `brand` replace `business_line`?** Recommendation: yes — migrate `staffing`/`ai_programs` objectives to `brand = edge8` and drop the column, unless goals are still set per business line.
2. **Brand AND office on one objective?** Recommendation: allow both (e.g. AIO certification revenue = `brand: aio` + `office: revenue`); boards group primarily by office with brand as a chip/filter.
3. **Metric triage** (Phase 0): per-metric disposition list — needs the live metrics table contents in front of us.
