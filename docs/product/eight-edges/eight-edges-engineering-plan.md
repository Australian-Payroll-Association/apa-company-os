# Eight Edges: engineering plan

Style: Karpathy rules. Spec first. Smallest thing that closes the loop. The database is the
product; the UI is a view. No stage starts until the previous one survived a real Monday sync.
Every task below is sized so a junior engineer (or the developer agent) can complete it without
asking questions. If a task can't be verified, it isn't a task.

Written 2026-08-09. Companion docs in this folder: product doc + prototype (the prototype is
the UI spec; do not redesign it in code review).

---

## 0. What we are actually building

One goal tree in `company_os`, three levels (Company → Office → Executor), where:

- every child Objective points at a parent Key Result (FK, enforced),
- every KR carries a casting decision (`human | ai | blended`) and one accountable human,
- agents read the tree as context and write metrics/issues/packets into it,
- one page in Edge8 OS (`/admin/edges`) renders it.

That's the whole system. Strategy is a text column. Sync is a generated document. Reviews are
generated documents. Resist the urge to make any of those "features" in v1.

### Non-goals for v1 (write them down so nobody builds them)

- No engagement pulse, no Q12.
- No multi-tenant / client-facing anything.
- No notification system (the 7am plan and Monday packet ARE the notifications).
- No historical trend charts. A number and last week's number.
- No drag-and-drop OKR editor. Forms are fine.
- No new auth. Existing Edge8 OS admin auth gates everything.
- No merging with Human Tokens. Different ledger, different doc.

---

## 1. Data model (Stage 0)

Five tables in schema `company_os`. Naming is boring on purpose.

```sql
-- The annual page. One row per year. Everything hangs off it.
strategies (
  id uuid pk, year int unique, title text, body_md text,
  created_at, updated_at
)

objectives (
  id uuid pk,
  strategy_id uuid -> strategies,
  level text check in ('company','office','executor'),
  office text null check in ('revenue','talent','operations','innovation'),
  business_line text null check in ('staffing','ai_programs'),  -- null = company-wide
  parent_kr_id uuid null -> key_results,   -- REQUIRED (not null) when level != 'company'
  quarter text,                             -- '2026Q4'
  title text, status text default 'active',
  owner_person_id uuid null -> people,      -- accountable human
  owner_agent text null,                    -- agent slug when an agent co-owns
  created_at, updated_at
)

key_results (
  id uuid pk, objective_id uuid -> objectives,
  title text,
  target_value numeric, current_value numeric default 0, unit text,
  direction text check in ('up','down'),
  delivery_mix text check in ('human','ai','blended'),
  accountable_person_id uuid -> people,     -- NOT NULL. governance rule lives here.
  executing_agent text null,
  status text default 'on_track' check in ('on_track','at_risk','off_track','done'),
  created_at, updated_at
)

metrics (
  id uuid pk, name text, office text, formula text,
  target numeric, direction text check in ('up','down'),
  source text check in ('agent','manual'), source_detail text,
  owner_person_id uuid null, owner_agent text null,
  key_result_id uuid null -> key_results    -- a metric may feed a KR
)
metric_readings (
  id uuid pk, metric_id uuid -> metrics,
  week_start date, value numeric, collected_by text,  -- 'devops-agent' | 'manual:dave'
  created_at, unique(metric_id, week_start)
)

issues (
  id uuid pk, title text,
  diagnosis text check in ('goal','system','execution'),
  key_result_id uuid null -> key_results,
  filed_by text,                            -- 'dave' | 'pm-agent:auto' etc
  status text default 'open' check in ('open','solving','solved','dropped'),
  notes_md text, created_at, resolved_at
)
```

Two deliberate choices:

1. **The cascade is `objectives.parent_kr_id`.** A non-company objective without a parent KR is
   rejected by a CHECK constraint. Orphan goals are impossible, not discouraged.
2. **`key_results.accountable_person_id` is NOT NULL.** The "every KR has one accountable
   human" rule is a schema constraint, not a code review comment.

### Tasks

- [ ] 0.1 Migration file with the five tables + constraints. Apply to the Supabase project
      (schema `company_os`, same access pattern as the CRM: service key + Content-Profile).
- [ ] 0.2 Seed script `scripts/edges/seed-q4.mjs` (reuse `scripts/crm/db.mjs`): inserts the 2026
      strategy row and the real Q4 tree Dave writes during planning. No fake data in prod, ever.
- [ ] 0.3 Verify: one SQL query walks Executor KR → objective → parent KR → company objective.
      Paste the query and its output into the PR description.

**Exit test for Stage 0:** the real Q4 tree exists in the database and the cascade query works.
Time: 1 day including the planning session to write the actual OKRs.

---

## 2. Read-only page (Stage 1)

`/admin/edges` in edge8-web, server component, reads the tree, renders what the prototype
shows: strategy banner, FAST chips (hardcode "Frequent" and "Transparent" logic for now, see
Stage 4), three-level cascade with casting chips and progress bars, right rail with latest
`metric_readings` and open `issues`.

Rules:

- Copy the prototype's layout and palette. Do not invent UI. The prototype is the spec.
- Progress = `current_value / target_value` clamped, direction-aware. One utility function,
  one unit test file, done.
- Nav: fixed 68px top nav exists on full-page routes; remember the ~108px top padding.

### Tasks

- [ ] 1.1 Route + data fetch (one query per table, join in JS; no ORM adventures).
- [ ] 1.2 Cascade tree component with expand/collapse (client component, state = open set).
- [ ] 1.3 Right rail: numbers (latest reading vs target, delta vs previous week) + open issues.
- [ ] 1.4 Verify: screenshot side-by-side with prototype; Dave says "yes, that's it."

**Exit test for Stage 1:** Dave opens `/admin/edges` on production and sees the real Q4 tree.
Time: 2-3 days.

---

## 3. Write paths (Stage 2)

The minimum set of mutations, as plain forms + server actions:

1. **Weekly check-in:** update `key_results.current_value` and `status`, one inline field per
   KR row. This is the one write that must be frictionless; it happens every Monday.
2. **Add/edit Objective + KRs:** one form. The form enforces what the schema enforces, plus
   one soft lint: if a KR title starts with a verb like "launch/build/create/run", show
   "this looks like an activity, not an outcome; are you sure?" (string list, not an LLM;
   the LLM lint is Stage 5 garnish and may never be needed).
3. **File/solve an Issue:** title, diagnosis, linked KR, done.

### Tasks

- [ ] 2.1 Check-in action + inline UI. Verify: update a KR value without touching SQL.
- [ ] 2.2 Objective/KR forms with cascade-link picker (dropdown of parent KRs). Verify: try to
      create an office objective without a parent KR: the UI stops you and the DB would too.
- [ ] 2.3 Issue form + status flips. Verify: file, solve, see it move.

**Exit test for Stage 2:** one full Monday sync run entirely through the UI: check in every KR,
file one issue, no SQL. Time: 2-3 days.

---

## 4. Agents read the tree (Stage 3)

This is the 50% AI half, and it is deliberately the simplest stage, because the agents already
run on this machine and can already reach the DB.

- `scripts/edges/context.mjs`: prints the current tree as compact markdown
  (strategy line, KRs with owner/mix/status/value). This is THE integration point. Any agent
  that needs goal context runs this script. No API server, no MCP work, a script.
- Wire the 7am product-manager routine: daily plan opens with "KRs at risk" from the script.
- Wire agent briefings: the standup/briefing templates include the context block.

### Tasks

- [ ] 3.1 `context.mjs` with `--office`, `--owner`, `--at-risk` flags. Verify: output under
      100 lines for the full tree (it's context, not a report).
- [ ] 3.2 Add the context call to the pm agent's daily-plan step. Verify: Tuesday's 7am plan
      names real KRs.
- [ ] 3.3 Tag work: the pm agent's plan items each name the KR they advance ("KR2.1") or say
      "no KR" explicitly. Verify by reading one real plan.

**Exit test for Stage 3:** a week of daily plans where every item traces to a KR or is flagged.
Time: 1-2 days.

---

## 5. Agents write the tree (Stage 4)

Three writers, built in this order because each is independently useful:

1. **Metrics collector** (devops agent, Mon 06:00 scheduled task): pulls what has an API today:
   deals/MRR from `company_os`, playbook run times from the CRM skill logs, published posts
   from the site. Writes `metric_readings` with `collected_by`. Metrics without an API stay
   `source='manual'` and appear in the UI with a "manual" badge (honesty over coverage; this
   badge is exactly KR3.3's tension and that's fine).
2. **Issue watcher** (same run): metric under target 2 consecutive weeks and no open issue for
   it → insert issue with `diagnosis` guess + `filed_by='devops-agent:auto'`.
3. **Sync packet** (pm agent, Sun 18:00): generates the Monday packet (numbers, KR deltas,
   at-risk list, proposed agenda from oldest open issue) as markdown, saved where the standup
   briefings already live, linked from `/admin/edges`.

### Tasks

- [ ] 4.1 Collector for 3 agent-pullable metrics. Verify: Monday rows appear unattended.
- [ ] 4.2 Issue watcher with the 2-week rule. Verify: seed a failing metric in a test week,
      watch it file once and only once.
- [ ] 4.3 Sync packet generation. Verify: run one real Monday sync from the packet; Dave
      grades it. Iterate on the prompt, not the plumbing.

**Exit test for Stage 4:** two consecutive Mondays where the packet was ready, the numbers were
fresh, and nobody typed a metric by hand that has an API. Time: 3-4 days.

---

## 6. Reviews (Stage 5)

Quarterly, so build it in week 10, not week 1.

- `scripts/edges/review-packet.mjs <executor>`: progress / learning-prompts / adjust-candidates
  from the quarter's data, for humans AND agents (an agent packet includes run stats and a
  recast recommendation).
- Render packets read-only under `/admin/edges/reviews`.
- Casting recap: one table, KRs by delivery mix with hit rate per mix. This single table is the
  Eight Edges pitch slide, generated from real data.

**Exit test:** Q4 review week runs off generated packets. Time: 2 days, in December.

---

## 7. Order of operations and the one metric for this project

```
Stage 0  schema + real Q4 tree        ~1 day     (blocks everything)
Stage 1  read-only /admin/edges       ~3 days
Stage 2  write paths                  ~3 days    (Monday syncs go live here)
Stage 3  agents read                  ~2 days
Stage 4  agents write                 ~4 days    (FAST becomes ambient here)
Stage 5  reviews                      ~2 days    (December)
```

Total: ~2 weeks of build spread over the quarter, on purpose: the system must absorb real
Mondays between stages. The meta-metric for the project itself: **consecutive weekly syncs run
on the system**. If that streak breaks, stop building features and fix why.

Ship flow per repo rules: worktree off origin/main, named staging, PR, merge on green CI,
verify on https://www.edge8.ai with curl. Never build on the WIP checkout.
