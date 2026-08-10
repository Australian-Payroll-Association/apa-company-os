# Leadership Coach v2 — development plan

**Date:** 2026-08-10 · **Owner:** Dave · **Status:** ready to build
**Companion doc:** the AI Program Plan v2 (`docs/product/leadership-coach/`) — that file is the *what and why*; this file is the build order.
**Supersedes:** `docs/plans/2026-07-25-team-coaching-cycle.md` (v1 engineering plan; its build is the base we resume).

## Ground truth (verified 2026-08-10)

- **The 2026-07-25 build exists but never shipped.** Branch `my-team-1-1-coach` (worktree
  `.claude/worktrees/my-team-1-1-coach`) holds ~2,750 lines, all uncommitted: `lib/coaching/`
  (data, ai, cycle, markdown), coach UI at `/team/coaching`, member UI at `/team/my-coaching`,
  cron at `/api/cron/coaching-cycle`. Branch base is 153+ commits behind `origin/main`.
- **The v1 schema is live** in `company_os` with data: `coaching_profiles` (6),
  `coaching_one_on_ones` (7), `coaching_checkins` (2), `coaching_context` (6),
  `coaching_commitments` (0), `coaching_trends` (0).
- **Eight Edges shipped** (PRs #486–#496): `strategies` → `objectives` → `key_results` →
  `metrics` → `metric_readings`, plus `issues` and sync packets, pages under `/admin/edges/`.
  `key_results` carries `accountable_person_id`, `target_value`, `direction` — real ladder targets.
- **`lib/lark.ts` is webhook-only** (group channel posts). Per-person DMs and Minutes reads need
  tenant app credentials — new code.
- **Roster:** Mai, Khoa, Quan, My Pham active. Ginny (contractor now) and Trac (departed)
  deactivate with history retained.
- **Import source:** `~/code-projects/leadership-coach/lark-backup/` (member pages, Manager/
  coach pages with OCEAN reads + sessions + commitments, dashboard, 2026-07-01 prep).

---

## PR 1 — Rescue the v1 build

Commit the worktree code as-is on `my-team-1-1-coach`, then merge `origin/main` into the branch.
No new features in this PR.

- Expected conflicts: `components/team/TeamSidebar.tsx`, `app/team/(dashboard)/layout.tsx`,
  `lib/team-chat/db.ts`, `vercel.json`, `app/admin/admin.css`.
- Reconcile against 6 weeks of main drift: team actor helpers, sidebar structure, any renamed
  shared components.
- Table-name check: code must match live names (`coaching_one_on_ones`, not `one_on_ones` —
  a bare `one_on_ones` table also exists in the schema; confirm which one the v1 code and data
  actually use before anything else, and standardise).
- **Done when:** `npx tsc --noEmit` and `next build` pass; v1 pages render against live data.
  No dev server (per repo practice); verification is build + a Vercel preview.

## PR 2 — Schema v2

One migration + explicit `service_role` grants (company-os-table-grants) + data moves.

```sql
-- Goals: quarterly FAST goals, 1+ per person, team-wide readable
create table company_os.coaching_goals (
  id uuid primary key default gen_random_uuid(),
  coaching_profile_id uuid not null references company_os.coaching_profiles(id),
  title text not null,
  description_markdown text,
  status text not null default 'draft'
    check (status in ('draft','active','achieved','dropped')),
  quarter_label text,                      -- e.g. '2026-Q3'
  objective_id uuid references company_os.objectives(id),
  key_result_id uuid references company_os.key_results(id),
  metric_id uuid references company_os.metrics(id),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint one_ladder check (
    (objective_id is not null)::int + (key_result_id is not null)::int
      + (metric_id is not null)::int <= 1)
);

-- Priorities: standing 1-1 focus items (P1, P2…), coach + member
create table company_os.coaching_priorities (
  id uuid primary key default gen_random_uuid(),
  coaching_profile_id uuid not null references company_os.coaching_profiles(id),
  title text not null,
  detail_markdown text,
  status text not null default 'active' check (status in ('active','retired')),
  objective_id uuid references company_os.objectives(id),
  key_result_id uuid references company_os.key_results(id),
  metric_id uuid references company_os.metrics(id),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint one_ladder check (
    (objective_id is not null)::int + (key_result_id is not null)::int
      + (metric_id is not null)::int <= 1)
);

-- OCEAN: structured, coach-authored, member-readable once published
create table company_os.coaching_ocean_profiles (
  id uuid primary key default gen_random_uuid(),
  coaching_profile_id uuid not null unique
    references company_os.coaching_profiles(id),
  openness_rating text,          openness_evidence text,
  conscientiousness_rating text, conscientiousness_evidence text,
  extraversion_rating text,      extraversion_evidence text,
  agreeableness_rating text,     agreeableness_evidence text,
  neuroticism_rating text,       neuroticism_evidence text,
  snapshot_markdown text,
  guidance_markdown text,        -- second person, member-visible
  published boolean not null default false,  -- Dave's review gate
  updated_at timestamptz not null default now()
);

alter table company_os.coaching_profiles
  add column retention_root text
    check (retention_root in ('belonging','links','sacrifice','watching'));

alter table company_os.coaching_one_on_ones
  add column mode_coach_pct int, add column mode_mentor_pct int,
  add column mode_direct_pct int,
  add column minutes_token text,           -- matched Lark Minutes id
  add column transcript_source text
    check (transcript_source in ('minutes_auto','minutes_link','manual'));
```

Data moves in the same PR:
- `fast_goal` → one `coaching_goals` row per non-empty value (status from `fast_goal_status`);
  keep the old columns until PR 4 removes their last reader, then drop in a follow-up migration.
- Deactivate Ginny + Trac profiles (`active = false`).
- Retention roots from the Lark dashboard (Mai: belonging, Khoa: links, others: watching).

**Verify:** rolled-back probe inserts for every new check constraint (check-constraint-drift);
grants smoke-tested via the app client.

## PR 3 — lark-backup import (one-off script)

Extend `scripts/coaching-import-run.ts` to consume `lark-backup/`:

| Source | Target |
|---|---|
| `Manager/{Name} · 1-1.md` → "Sessions" blocks | `coaching_one_on_ones` (held_on from heading, private summary; mode split from "Mode C/M/D" where present) |
| `Manager/{Name} · 1-1.md` → "How to coach (OCEAN read)" | `coaching_ocean_profiles` (parsed to dimensions; AI-assisted second-person `guidance_markdown`; `published = false`) |
| `Manager/{Name} · 1-1.md` → "Open commitments (live)" + member-page tables | `coaching_commitments` (dedup by title + due) |
| `{Name}.md` (member pages) → FAST goal + "Ladders to" | `coaching_goals` with resolved Edges FK (match "O1-KR1"-style refs against seeded `objectives`/`key_results` titles; unresolved → goal saved without ladder + logged) |
| `{Name}.md` → Priorities & KPIs | `coaching_priorities`; KPI lines → `metrics` rows owned by the person (only when clearly numeric with a target) |
| `{Name}.md` → 1-1 Recaps | `shared_summary_markdown` on the matching meeting |
| `Manager/Leadership Coaching — Dashboard.md` | mode splits, retention roots, next-1-1 dates; 2026 OKR block cross-checked against the Edges Q3 seed (report drift, don't overwrite Edges) |
| `Manager/Wed 2026-07-01 — Prep.md` | `prep_markdown` on the 2026-07-01 meetings |

Rules: idempotent (safe re-run via natural keys), names resolved against live
`company_os.people` by email (verify-names-against-db), every unmatched block logged not dropped.

## PR 4 — Coach UI v2 (`/team/coaching`)

- `lib/coaching/data.ts`: goals + priorities CRUD replaces `coachSetFastGoal`; OCEAN
  read/write + publish; mode-split and retention-root setters. All scoped
  `coach_id = actor.teamMemberId`.
- Person page: goals section (with Edges ladder picker — searchable objective/KR/metric select,
  live metric readings shown when linked), priorities list, OCEAN editor with publish gate,
  mode-split input on each logged 1-1.
- Dashboard roster: mode-split column (last 1-1 + trend vs 80/15/5), retention root, top
  priority; attention flags extended (goal not set → no active goal).
- Log-1-1 form: transcript paste + Minutes-link paste (auto-detect lands in PR 7; the manual
  path must work first).

## PR 5 — Member + team surfaces

- `/team/my-coaching`: goals (with ladder + live metric progress), priorities, KPIs, published
  OCEAN profile (read-only), commitments (status + note updates), shared recaps, check-ins.
- Team-wide goal transparency: active FAST goals (title, status, ladder) on each person's
  `/team` profile page; read path available to any team member.
- Eight Edges tie-in: FAST health chips on `/admin/edges/goals` compute from `coaching_goals`
  (% of active roster with an active goal, laddered %).

## PR 6 — AI v2 (`lib/coaching/ai.ts`)

- `generatePrep`: inputs gain structured OCEAN, active goals with ladder + latest metric
  readings, priorities. Output keeps v1 sections and adds: recommended mode (vs 80/15/5
  trend), one retention check tied to the current root, one question to avoid.
- `summarizeMeeting`: structured output gains `mode_split_estimate` ({coach, mentor,
  direct} percentages) and per-goal status suggestions. Two-tier output unchanged; shared tier
  still publishes only on coach save.
- `generateTrendReport`: adds goal progress vs ladder targets and mode-split trajectory.
- OCEAN guidance rewriter (used by PR 3's import): third person coach notes → second person
  growth guidance, flagged for review.

## PR 7 — Lark API + cron v2

- New `lib/lark-api.ts`: tenant access token (`LARK_APP_ID`/`LARK_APP_SECRET`), open_id lookup
  by email, DM send (`im:message` scope), Minutes list + transcript export.
- Notifications: every cron nudge goes Lark DM + Resend email (shared message builder; email
  is the fallback when DM fails or open_id is missing).
- Minutes auto-detect (new cron step): poll recent Minutes → match to 1-1s scheduled within
  ±1 day whose participants include the coach + member emails → store `minutes_token`, pull
  transcript, run `summarizeMeeting`, DM the coach "recap drafted, review here".
- vercel.json cron stays daily 07:45 Saigon.
- **Risk:** Minutes list/export scopes under tenant auth are unverified (v1 hit enumeration
  limits on wiki children). Scope check is step one of this PR; if listing is blocked, the
  Minutes-link paste path from PR 4 is the interim, and we revisit with a callback/webhook.

## Sequencing and size

PR 1 (rescue, ~1 day) → PR 2 (schema, ~0.5) → PR 3 (import, ~1) → PR 4 (coach UI, ~1.5) →
PR 5 (member/team, ~1) → PR 6 (AI, ~0.5) → PR 7 (Lark + cron, ~1). PRs 4–6 can interleave
after 2; 3 needs 2; 7 needs 4. Work iterates locally, batch PRs, Dave merges
(work-locally-batch-prs).

## Standing constraints

- Verification is `npx tsc --noEmit` + `next build`; never a dev server.
- No coaching table ever enters the admin NL→SQL assistant or team-chat readable sets.
- No browser Supabase clients created during render (Vercel preview prerender).
- New tables/functions get explicit `service_role` grants in the migration.
- Coach scope is always `coach_id = actor.teamMemberId`; member scope selects member-visible
  columns only; team-wide reads expose goals only.

## Env checklist (Vercel prod)

| Var | Status |
|---|---|
| `ANTHROPIC_API_KEY` | verify present (used by ideas/ATS) |
| `COACHING_CLAUDE_MODEL` | optional override, default `claude-opus-4-8` |
| `LARK_APP_ID` / `LARK_APP_SECRET` | new — app needs `im:message`, contact read, Minutes read scopes |
| `CRON_SECRET` | existing pattern, reused by the coaching cron |

## Rollout + retirement (after PR 7 is live)

1. Dave reviews OCEAN rewrites → publish per person.
2. One full cycle runs in parallel with the Lark routines (2 weeks).
3. Kill the local scheduled routines (biweekly Tue 6am prep + recap sweep).
4. Archive the Lark coaching wiki + Base (read-only); Lark stays for DMs + Minutes.
5. From then on, roster and cadence edits happen in the portal only.
