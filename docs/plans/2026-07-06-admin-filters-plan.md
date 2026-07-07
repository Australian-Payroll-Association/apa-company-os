# Admin filters plan — content per page

**Status:** draft for review. Nothing here is implemented yet.
**Owner edits:** this doc is the source of truth for what filters each admin list page
should expose. Edit it directly, then hand it back and I'll wire it up.

---

## How to edit this doc

Each list page has a **Proposed filters** checklist:

- `[x]` = include this filter · `[ ]` = leave it out
- Edit the **options** inline (add, remove, rename). Options shown are my proposal;
  where they come from a database enum I have marked `‹confirm enum›` so we use the
  real values.
- Add a new bullet for any filter I missed.
- Cross out anything you do not want.

## Conventions (proposed)

1. **One filter mechanism.** Standardize every page on the shared `FilterBar`
   (URL-driven `?key=value` dropdowns that sit next to the search box). Today only
   Contacts uses it; Deals / Inquiries / Time Off filter in client state instead.
   Moving those to the URL is a bigger change and is flagged per page.
2. **Single-select dropdowns** default to `‹Label›: All`. Multi-select only where noted.
3. **Archived** stays a separate toggle (not a dropdown), as it is today.
4. **Date ranges** use presets (This month · This quarter · Overdue · All time), not
   free-date pickers, unless you ask for pickers.
5. **Money bands** are proposed as fixed brackets you can rename.
6. Two pages are intentionally filter-free: **Leads** (an ordered SDR queue) and
   **Funnel** (a metrics dashboard). Called out below.

---

## Contacts

### `/admin/contacts`
- **Search:** name, email, phone
- **Current filters:** Persona · Stage · Team (+ Archived toggle)
- **Proposed filters:**
  - [x] **Persona** — Job seeker · Prospect · Client · Employee · Unset *(keep)*
  - [x] **Stage** — Lead · Customer · None *(keep)*
  - [x] **Team** — Team only · Non-team *(keep)*
  - [ ] **Source** — Edge8 · AIO · ‹other brand sources — confirm list›
  - [ ] **Contactable** — Do-not-contact only · Contactable only

---

## Revenue

### `/admin/revenue/companies`
- **Search:** name, domain
- **Current filters:** none (+ Archived toggle)
- **Proposed filters:**
  - [x] **Industry** — ‹confirm enum / distinct values›
  - [x] **Size band** — ‹confirm enum: e.g. 1–10 · 11–50 · 51–200 · 200+›
  - [x] **Country** — ‹distinct values›
  - [x] **Priority** — High · Medium · Low

### `/admin/revenue/deals`
- **Search:** none today *(propose adding: deal title, company, person)*
- **Current:** Board/List view toggle · Archived toggle *(client-side, not URL)*
- **Note:** filters here are client-state; wiring these to the URL is a larger change.
- **Proposed filters:**
  - [x] **Status** — Open · Won · Lost
  - [x] **Stage** — ‹pipeline stage labels — confirm›
  - [ ] **Owner** — ‹team members›
  - [ ] **Value band** — Under $5k · $5k–25k · $25k+
  - [ ] **Expected close** — This month · This quarter · Overdue
  - [ ] **Handoff** — Pending · Accepted · Rejected

### `/admin/revenue/leads`
- **Search:** none · **Current filters:** none
- **Proposed:** _none — this is an ordered SDR queue (SLA due, then age)._ If you want
  it filterable, say so and I'll add: Attempt status · Owner.

### `/admin/revenue/inquiries`
- **Current:** Kanban board (status columns) · no filters
- **Note:** client-side board; a status filter would be a URL change.
- **Proposed filters:**
  - [ ] **Status** — New lead · Contacted · Discovery · Proposal · Won · Lost
  - [ ] **Source** — ‹brand / channel — confirm›
  - [ ] **Received** — This week · This month · All time

### `/admin/revenue/orders`
- **Search:** Stripe session id
- **Current filters:** none
- **Proposed filters:**
  - [x] **Status** — Paid · Pending · Refunded · Failed ‹confirm enum›
  - [x] **Payment method** — Card · ‹others›
  - [ ] **Currency** — USD · VND · ‹others›
  - [ ] **Date** — This month · This quarter · All time
  - [ ] **Refunded** — Refunded only

### `/admin/revenue/products`
- **Search:** title
- **Current filters:** none
- **Proposed filters:**
  - [x] **Type** — ‹event · sprint · membership — confirm enum›
  - [x] **Tier** — ‹confirm enum›
  - [ ] **Location** — ‹distinct values›
  - [x] **Active** — Active only · Inactive only

### `/admin/revenue/registrations`
- **Search:** attendee name, email
- **Current filters:** none
- **Proposed filters:**
  - [x] **Status** — Registered · Attended · Cancelled ‹confirm enum›
  - [ ] **Product** — ‹product titles›

### `/admin/revenue/bookings`
- **Search:** kind
- **Current filters:** none
- **Proposed filters:**
  - [x] **Kind** — ‹confirm distinct values›
  - [x] **Status** — ‹confirm enum›
  - [ ] **Start date** — Upcoming · This month · Past

### `/admin/revenue/affiliates`
- **Search:** code, notes
- **Current filters:** none
- **Proposed filters:**
  - [x] **Program type** — Revenue share · Referral ‹confirm enum›
  - [x] **Active** — Active only · Inactive only

### `/admin/revenue/funnel`
- **Proposed:** _none — this is a metrics dashboard, not a list._ Optional single
  control: **Window** — This month · This quarter · All time.

---

## Talent

### `/admin/talent/candidates`
- **Search:** headline, current title
- **Current filters:** none
- **Proposed filters:**
  - [x] **Pool status** — Active · Nurture · Hired · Rejected ‹confirm enum›
  - [ ] **Resume** — Has resume only
  - [ ] **LinkedIn** — Has LinkedIn only

### `/admin/talent/applications`
- **Search:** source
- **Current filters:** none
- **Proposed filters:**
  - [x] **Status** — Applied · Screening · Interview · Offer · Hired · Rejected ‹confirm enum›
  - [x] **Job** — ‹open requisitions›
  - [ ] **Rating** — 1+ · 2+ · 3+ · 4+ · 5

### `/admin/talent/jobs`
- **Search:** title
- **Current filters:** none
- **Proposed filters:**
  - [x] **Status** — Open · Closed · Filled ‹confirm enum›
  - [x] **Employment type** — Full-time · Part-time · Contract ‹confirm enum›
  - [ ] **Remote policy** — Onsite · Hybrid · Remote
  - [ ] **Location** — ‹distinct values›
  - [ ] **Company** — ‹client companies›

### `/admin/talent/team`
- **Search:** employee number
- **Current filters:** none
- **Proposed filters:**
  - [x] **Status** — Active · On leave · Inactive ‹confirm enum›
  - [x] **Employment type** — ‹confirm enum›
  - [ ] **Work location** — ‹distinct values›

---

## Operations

### `/admin/operations/time-off/requests`
- **Current:** Archived toggle only *(entirely client-side React state)*
- **Note:** this board holds all rows in client state; URL filters are a larger change.
- **Proposed filters:**
  - [x] **Status** — Requested · Approved · Rejected · Cancelled · Taken
  - [x] **Leave type** — Vacation · Sick · Personal · Parental · Bereavement · Unpaid · Public holiday · Other
  - [ ] **Team member** — ‹team members›
  - [ ] **Dates** — This month · This quarter · Upcoming

### `/admin/operations/time-off/people`
- **Current:** status tabs — Activated · Deactivated (URL `?view=`)
- **Proposed filters:** _(keep the status tabs; add dropdowns)_
  - [x] **Status** — Activated · Deactivated *(keep as tabs)*
  - [ ] **Location** — ‹distinct values›
  - [ ] **Team** — ‹distinct values›
  - [ ] **Leave policy** — ‹policy names›
  - [ ] **Work schedule** — ‹schedule names›

---

## Settings

### `/admin/settings/admins`
- **Proposed:** _none — this is an access-control management screen, not a filtered list._

---

## Open questions for you

1. **Multi-select anywhere?** e.g. Status on Deals/Applications where you often want two
   states at once. Default plan is single-select.
2. **Deals / Inquiries / Time Off** filter in the browser today. Approve moving them to
   URL-driven filters (shareable links, back-button friendly) as part of this work?
3. Any page where you would rather have a **free date picker** than presets?
4. Confirm the real enum values marked `‹confirm enum›`, or tell me to pull them from
   the database.
