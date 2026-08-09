# Eight Edges: build plan

Written 2026-08-09, revised same day after nav review with Dave. Companion docs in this
folder: the product doc and the prototype. The prototype is the picture of what we are
building; this file is the order we build it in.

## The idea in one paragraph

We are building one thing: a goal tree that lives in the company database. Company goals at
the top, office goals under them, and at the bottom the people and agents who do the work.
Every goal below the top level must point at the goal above it, so nothing floats free. Every
key result must name one accountable human and say whether the work is done by a human, an
agent, or both. Eight Edges gets its own pages in Edge8 OS, and every page is editable; you
administer everything from the page itself. Agents read the tree to know what matters, and
write back the weekly numbers.

We build it as seven small pull requests. Each one is useful on its own, and each one gets
used in a real Monday sync before the next one starts. About two weeks of work, spread across
the quarter on purpose.

## Where it lives in the navigation (agreed 2026-08-09)

The current admin Dashboard at /admin stays exactly as it is. Eight Edges gets its own
top-level group with its own dashboard, because its metrics are strategy-specific. We may look
at combining the two dashboards later, not now.

```
Dashboard            /admin (unchanged)
Eight Edges
  Dashboard          /admin/edges
  Strategy           /admin/edges/strategy

FOUR OFFICES         (labeled section)
  Revenue · Talent · Operations · Innovation   (all unchanged)

WORKSPACE            (labeled section)
  Settings           (unchanged)
```

Playbooks and Agents pages, when we build them, belong under Operations. They are not part of
this plan.

Design system: everything uses the Edge8 Data Layer (the admin design system in
app/admin/admin.css, living reference at /admin/patterns): SVN-Gilroy, the dense 13px scale,
near-black sidebar, per-section accent theming. Eight Edges gets its own section accent within
the brand steps, same mechanism the offices use. The prototype's colors were illustrative.

## What we are NOT building (so nobody builds it)

- No changes to the existing /admin dashboard.
- No employee engagement surveys (later phase).
- No version for clients (dogfood first).
- No reminder emails or notifications (the Monday packet is the reminder).
- No charts of history (this week's number and last week's number is enough).
- No connection to Human Tokens (different system, stays separate).
- No new login system (the existing Edge8 OS admin login covers it).
- No Playbooks or Agents pages (future work, under Operations).

---

## PR 1: "Create the goal tables"

**What it does.** Adds five tables to the `company_os` schema in our existing Supabase project,
the same schema where the CRM already lives (deals, people, companies, meetings). No new
database, no new schema; agents reach it the same way the CRM helper already does. The five
tables: strategies (the one-page annual strategy), objectives, key results, metrics with their
weekly readings, and issues. Two rules are built into the database itself so they can never be
skipped: an office or individual objective cannot be saved without naming the company key
result it serves, and a key result cannot be saved without naming its one accountable human.

**What you'll see.** Nothing on screen yet. What exists after this PR is the real Q4 goal
tree, sitting in the database. Writing that tree is part of this PR: we sit down, do Q4
planning for real, and load it in.

**Done when.** We can ask the database "show me how this individual goal connects up to the
company goal" and get the full chain back. About 1 day, most of it the planning session.

---

## PR 2: "The Eight Edges dashboard, with editing"

**What it does.** Adds the Eight Edges group to the sidebar (with the Four Offices and
Workspace section labels) and builds /admin/edges: the strategy line at the top, the FAST
health chips, the goal cascade with the human/AI/blended badge on every key result, progress
bars, the Eight Edges metrics rail, and open issues. Editing is built in from day one, not a
later phase: update a key result's number and status inline (the Monday check-in), add or edit
objectives and key results, file and close issues. The goal form politely challenges you if a
key result looks like a task instead of an outcome ("launch X" is a task; "retention at 90%"
is an outcome).

**What you'll see.** Open /admin/edges and see the real Q4 goals live from the database, and
run a whole Monday sync from the page: check in every number, no spreadsheets, no SQL.

**Done when.** One real Monday sync happens entirely through the page, and it looks native to
Edge8 OS next to the other admin pages. About 5 days.

---

## PR 3: "The Strategy page"

**What it does.** Builds /admin/edges/strategy: the annual one-page strategy, editable in
place, with the quarter's objectives listed under it so the page always shows how the year's
direction became this quarter's goals.

**What you'll see.** The 2026 strategy as a real page you can edit, not a doc lost in a drive.

**Done when.** You edit a line on it and the change shows on the Eight Edges dashboard's
strategy banner. About 1 day.

---

## PR 4: "Agents read the goals"

**What it does.** Gives every agent on the Mac Mini one simple command that prints the current
goal tree in a compact form: what the strategy is, which key results exist, who owns them, and
which ones are at risk. Then wires it into the product manager agent's 7am routine, so the
daily plan starts from the goals instead of from memory.

**What you'll see.** Tomorrow's 7am daily plan opens with "key results at risk" and every item
on the plan says which key result it advances, or says plainly "not tied to a goal."

**Done when.** A full week of daily plans where every item traces to a goal. About 2 days.

---

## PR 5: "Agents collect the numbers"

**What it does.** A scheduled job every Monday at 6am where the devops agent pulls the weekly
numbers that have a source it can reach (revenue from the deals table, proposal speed from the
playbook logs, published posts from the site) and writes them into the metrics table. Numbers
with no automatic source stay manual and are labeled "manual" on the page, honestly. The same
job watches for trouble: if a number misses its target two weeks in a row and nobody has filed
an issue about it, the agent files one, with its best guess at the cause attached.

**What you'll see.** Monday morning the numbers are already fresh, and problems show up as
filed issues before anyone noticed them.

**Done when.** Two Mondays in a row where no human typed a number that has an automatic
source. About 4 days.

---

## PR 6: "The Monday packet"

**What it does.** Every Sunday at 6pm the product manager agent writes the packet for Monday's
sync: what the numbers say, which key results are at risk, which issue to solve first, and a
proposed agenda. It lands where the standup briefings already live and is linked from the
Eight Edges dashboard.

**What you'll see.** You walk into Monday's sync with the whole picture already assembled, and
the meeting starts at the decision, not at the data gathering.

**Done when.** Two consecutive syncs run off the packet and you grade the packet useful. About
2 days.

---

## PR 7: "Quarterly review packets" (build in December, not now)

**What it does.** At quarter end, generates a review packet for every person AND every agent:
what progress was made, what the misses teach us, and what to adjust, including whether any
work should be recast from human to AI or back. Also produces the one table that is the whole
Eight Edges story: key results grouped by human/AI/blended, with the hit rate of each.

**What you'll see.** Q4 review week runs off generated packets instead of memory.

**Done when.** The Q4 reviews happen. About 2 days, in December.

---

## Order and timing

| PR | Name | Time | What changes for you |
|----|------|------|----------------------|
| 1 | Create the goal tables | 1 day | Q4 goals exist in the database |
| 2 | The Eight Edges dashboard, with editing | 5 days | Monday syncs run on /admin/edges |
| 3 | The Strategy page | 1 day | The annual page is live and editable |
| 4 | Agents read the goals | 2 days | The 7am plan starts from the goals |
| 5 | Agents collect the numbers | 4 days | Numbers are fresh without you |
| 6 | The Monday packet | 2 days | Meetings start at the decision |
| 7 | Quarterly review packets | 2 days | December |

One measure tells us if this project is working: **how many weekly syncs in a row have run on
the system.** If that streak breaks, we stop building and fix the reason before adding
anything new.

Ship rules as always: each PR from a clean branch off main, merged only when CI is green,
verified on production.
