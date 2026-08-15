# Task Boards: development plan

Trello-style boards in Edge8 OS, tied to coaching commitments, with agents as
board users. Product plan: `public/workflows/private/e8/task-board-product-plan.html`.
Mockup: `public/workflows/private/e8/task-board-mockup.html`.

Ground rules for the whole build:

- Cards are rows in the existing `company_os.tasks` table (0 rows today). No new
  task table. Commitments link via the existing `subject_type` / `subject_id`
  columns; nothing is duplicated.
- Cards archive (timestamp), never delete. The app role has no DELETE grant.
- UI follows the data design layer (`docs/product/edge8-design-system-data.md`);
  the new board component gets an entry on `/admin/patterns`.
- Each PR is built in a worktree off `origin/main`, merged when CI is green,
  verified with `curl` against `https://www.edge8.ai/...`.

## PR 1: Schema and seed

**What it does:** adds the board structure to the `company_os` schema: a
`boards` table (name, slug, owner, and an optional link to a client company), a
`board_columns` table (per-board, ordered, renamable, one flagged as the done
column), a `board_members` table (who can see the board in the team portal), a
`sprints` table (per-board: name, start and end dates, optional goal), board
placement on `tasks` (column reference plus a numeric position for ordering
within the column, an optional sprint reference, an internal flag for
client-board cards, and an archived timestamp), and a `task_stage_log` table
modeled on `application_stage_log` for column-move history. Roadmap links need
no new columns: they use the existing `subject_type` / `subject_id` slot,
pointing at `client_backlog_items` belonging to the board's client.

Seeds seven boards, each with To do / Doing / Waiting / Done, with their
starting members (resolved to `company_os.people` rows, verified before
seeding):

- AIOlabz (the product): Khoa, Ethan, Quan Chau, Dave, Viha, Quang, Ash
- Operations: Dave, My, Mai
- Eight Edges: Dave, Ash, Viha
- Australian Payroll (client-linked): Dave, Khoa
- Work Healthy (client-linked): Dave, Quan Chau
- Arca Wellness (client-linked): Dave, Quan Chau, Ash
- EO Global: Dave, Thanh, Khoi, Ha

The three client boards are linked to their companies in
`company_os.companies` (looked up by name, verified against the CRM before
seeding).

**What you'll see:** nothing in the UI yet. All seven boards and their columns
exist in the database, three of them client-linked.

**Done when:** a task row can be placed in a column, moved (writing a stage log
row), and archived, all through the db helper; the seed shows seven boards with
four columns each and the memberships above resolved to real people; and the
three client boards resolve to real company rows.

## PR 2: The board

**What it does:** builds `/admin/boards/[slug]`: a shared kanban component
(columns, cards, drag and drop, card drawer) rendering from the new tables.
Create, edit, assign, set priority and due date, drag between columns (persisted
via server action, logged to `task_stage_log`), archive from the drawer. Cards
show priority chip, assignee avatar and name, due date, and days-in-column with
an amber clock past 7 days. Filters: assignee, priority. Sidebar gets a Boards section listing
all boards. The component is registered on `/admin/patterns`.

**What you'll see:** the mockup, live: the Operations board at
`/admin/boards/operations`, cards you can create and drag, a drawer with
activity history.

**Done when:** a card created on Operations can be assigned, dragged through all
four columns, and archived; each move appears in the drawer's activity list; a
hard refresh shows everything where you left it.

## PR 3: Sprints

**What it does:** sprint management for boards that want it. Board settings can
create sprints (name, dates, optional goal); the card drawer assigns or clears
a sprint; cards carry a sprint chip. The toolbar gains a sprint picker: active
sprint (default when one exists), backlog (no sprint), and all. Closing a
sprint rolls its unfinished cards to the chosen next sprint (or back to
backlog), logging each rollover. Boards with no sprints look exactly as they
did after PR 2: no picker, no chips.

**What you'll see:** on AIOlabz, create "Aug 18-29", drag cards into it via the
drawer, filter the board to just that sprint, then close it and watch the
leftovers land in the next one.

**Done when:** the flow above works end to end, a card can never be in two
sprints, sprints from one board never appear on another, and a board with no
sprints is visually unchanged.

## PR 4: Commitments and roadmap links

**What it does:** wires coaching to the board. On a commitment in the coaching
detail view: a "Push to board" action that picks a board and creates a linked
card (`subject_type = coaching_commitment`). On the board: a COMMITMENT badge,
and a drawer panel quoting the commitment with a link back to coaching. Moving a
linked card into the board's done column marks the commitment kept (one-way
sync). The coaching view shows each pushed commitment's card status inline
("Doing, 9 days").

Roadmap links ride the same slot, scoped by the board's client: on a
client-linked board, the card drawer can link a card to an item on that
client's roadmap (the picker shows only that client's `client_backlog_items`).
The card shows a ROADMAP badge, the drawer names the item, and the client
roadmap view marks backlog items that have a live card. Boards with no client
show no roadmap option.

**What you'll see:** make a commitment in a 1-1, push it to Operations, and it
appears as a badged card. Drag it to Done and the coaching view shows the
commitment kept. Separately, link a card to a roadmap item and see the badge on
both ends.

**Done when:** the commitment round trip works, pushing the same commitment
twice does not create a second card, commitments that were never pushed behave
exactly as today, and a roadmap-linked card resolves correctly in both
directions.

## PR 5: Team view, gated by membership

**What it does:** boards in the team portal at `/team/boards/[slug]`, visible
only to that board's members. Membership is explicit (managed from board
settings in admin) and automatic: assigning someone a card adds them to the
board. Members get a working view built on the same shared component: move
cards, mark done, edit cards. Plus a cross-board "My tasks" list on `/team`:
cards assigned to me across all boards and my open commitments, sorted by due
date, with mark-done inline (syncing any linked commitment).

**What you'll see:** a team member signs into `/team`, sees only the boards
they belong to in the nav, works their cards there, and has one "My tasks"
list of everything with their name on it.

**Done when:** a member of two boards sees exactly those two and a direct URL
to any other board is refused; assigning a card to a non-member adds them; and
marking a card done from "My tasks" moves it on the right board.

## PR 6: Client portal board

**What it does:** the client view. A client signing into `/portal` sees the
board linked to their company: read-only, internal-flagged cards hidden, no
drag, no drawer edit actions. Cards show title, assignee, due date, column,
and sprint. The admin drawer gets the "internal" toggle for cards on client
boards.

**What you'll see:** sign into the portal as Australian Payroll and see their
board's real progress; flip a card to internal in admin and it disappears from
the portal view.

**Done when:** each of the three client boards renders for its own client only,
internal cards never appear in the portal, and a client with no linked board
sees no board section at all.

## PR 7: Agents file cards (phase 2 opener)

**What it does:** extends the db helper (`scripts/crm/db.mjs` conventions) so
scheduled routines can create cards in a board's intake column and move their
own cards to done, stamping metadata with the routine name and evidence. First
consumer: the quarterly fleet fitness routine files one card per laptop below
the floor, and clears it when the laptop passes. Agent-filed cards get the AGENT
badge.

**What you'll see:** after the routine runs, cards appear on Operations naming
the machines that need replacing, without anyone typing them.

**Done when:** the routine run creates correctly badged cards with evidence in
the drawer, re-running it does not duplicate them, and a card whose laptop now
passes moves itself to Done with a note.

## Decisions locked

- Columns are per-board data, not a status enum. Task `status` stays for
  done/archived semantics; placement is the column.
- One-way sync only: card completion marks the commitment kept, never the
  reverse.
- One link per card: the subject slot points at a commitment or a roadmap item,
  never both. A card is about one thing.
- Sprints are per-board and optional, and sprint is time while columns are
  state: there is never a sprint column. Closing a sprint is an explicit action
  that rolls leftovers forward, logged.
- A board optionally links to one client company. Roadmap links are scoped to
  the board's client; no client, no roadmap picker.
- Visibility: admin sees all boards; team members see only boards they are
  members of (explicit membership plus auto-add on card assignment); a client
  sees only their linked board, read-only, minus internal cards.
- No checklists, attachments, comments, swimlanes, WIP limits, or client-portal
  exposure in this build. The five existing kanbans are not refactored.

## Open question (needs Dave)

- Client boards default to client-visible cards, with a per-card "internal"
  toggle to hide. Confirm the default, or flip it (internal unless marked
  client-visible).
