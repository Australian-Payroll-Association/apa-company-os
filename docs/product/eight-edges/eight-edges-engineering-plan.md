# Eight Edges: build plan

Written 2026-08-09. Companion docs in this folder: the product doc and the prototype.
The prototype is the picture of what we are building; this file is the order we build it in.

## The idea in one paragraph

We are building one thing: a goal tree that lives in the company database. Company goals at
the top, office goals under them, and at the bottom the people and agents who do the work.
Every goal below the top level must point at the goal above it, so nothing floats free. Every
key result must name one accountable human and say whether the work is done by a human, an
agent, or both. One page in Edge8 OS shows the whole tree. Agents read the tree to know what
matters, and write back the weekly numbers. That's it.

We build it as seven small pull requests. Each one is useful on its own, and each one gets
used in a real Monday sync before the next one starts. Total build time is about two weeks of
work, spread across the quarter on purpose.

## What we are NOT building (so nobody builds it)

- No employee engagement surveys (later phase).
- No version for clients (dogfood first).
- No reminder emails or notifications (the Monday packet is the reminder).
- No charts of history (this week's number and last week's number is enough).
- No connection to Human Tokens (different system, stays separate).
- No new login system (the existing Edge8 OS admin login covers it).

---

## PR 1: "Create the goal tables"

**What it does.** Adds five tables to the company database: strategies (the one-page annual
strategy), objectives, key results, metrics with their weekly readings, and issues. Two rules
are built into the database itself so they can never be skipped: an office or individual
objective cannot be saved without naming the company key result it serves, and a key result
cannot be saved without naming its one accountable human.

**What you'll see.** Nothing on screen yet. What exists after this PR is the real Q4 goal
tree, sitting in the database. Writing that tree is part of this PR: we sit down, do Q4
planning for real, and load it in.

**Done when.** We can ask the database "show me how this individual goal connects up to the
company goal" and get the full chain back. About 1 day, most of it the planning session.

---

## PR 2: "The Eight Edges page"

**What it does.** Builds the page at /admin/edges that shows the tree: the strategy line at
the top, the FAST health chips, each objective with its key results, the human/AI/blended
badge on every key result, progress bars, and the right-hand rail with this week's numbers
and open issues. Read-only for now. It should look like the prototype; the prototype is the
design, not a suggestion.

**What you'll see.** Open /admin/edges and see the real Q4 goals, live from the database.

**Done when.** You look at it next to the prototype and say "yes, that's it." About 3 days.

---

## PR 3: "Update goals from the page"

**What it does.** Adds the three things you need to touch every week, as simple forms: update
a key result's number and status (the Monday check-in), add or edit an objective and its key
results, and file or close an issue. The goal form politely challenges you if a key result
looks like a task instead of an outcome ("launch X" is a task; "retention at 90%" is an
outcome).

**What you'll see.** You run a whole Monday sync from the page. No spreadsheets, no SQL, no
asking Claude to update a number.

**Done when.** One real Monday sync happens entirely through the page. About 3 days.

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
Eight Edges page.

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
| 2 | The Eight Edges page | 3 days | You can see the tree |
| 3 | Update goals from the page | 3 days | Monday syncs run on the page |
| 4 | Agents read the goals | 2 days | The 7am plan starts from the goals |
| 5 | Agents collect the numbers | 4 days | Numbers are fresh without you |
| 6 | The Monday packet | 2 days | Meetings start at the decision |
| 7 | Quarterly review packets | 2 days | December |

One measure tells us if this project is working: **how many weekly syncs in a row have run on
the system.** If that streak breaks, we stop building and fix the reason before adding
anything new.

Ship rules as always: each PR from a clean branch off main, merged only when CI is green,
verified on production.
