# Beryl ROI Calculator

**Australian Payroll Association · Project detail · [Master plan](building-on-company-os.md)**

A public calculator that turns a prospect's own query volume into a dollar figure, so $49.95 a month stops feeling like a cost and starts looking like an obvious trade for the hours it buys back.

- **Day-one user:** prospects & managers
- **The one action:** enter numbers, see savings
- **Size:** small (days)
- **Builds on:** `company_os` (products, lead)

> One of three projects in the [Building on company_os](building-on-company-os.md) master plan.

---

## 1. What it is

A prospect is looking at Beryl at $49.95 a month, thinking "is this worth it?", and today they cannot do the maths, so they stall. This tool replaces the stall with "that is $50 to save my team 14 hours a month, obviously yes", then hands them a manager-ready PDF to get the purchase approved.

**What we build**
- An ungated savings range on screen. The number is always free.
- An optional manager-ready PDF (this is the value exchange).
- Editable assumptions, tunable without a new release.
- Anonymous usage tracking, for the signal.

**What we skip**
- No gate on the number. Zero friction to the value.
- No login, no accounts.
- No per-customer bespoke modelling. One defensible model.
- No hardcoded price. It reads Beryl's price from the database.

---

## 2. How it works

**The prospect** (self-serve, on the public site)
1. Lands on the page. No sign-up, no wall. Inputs pre-filled with a typical-usage benchmark.
2. Enters their numbers: team size, queries per person, their salary.
3. Sees the range: monthly and annual savings, low to high, with the $49.95 cost beside it.
4. Optionally enters name and work email to unlock a branded PDF.
5. Shares the PDF with their manager to support the approval.

**The system** (under the hood, secrets stay server-side)
1. Reads the editable assumptions row for the defaults.
2. Calculates the range from the inputs, instantly in the browser.
3. Logs one anonymous usage row: inputs and result, no personal data.
4. On request, renders the branded PDF.
5. On request, records the lead, deduped by email.

**The APA team** (tune the model, read the signal, no code)
1. Edits the assumptions (time-saved range, hourly basis, benchmark) in one place.
2. The numbers update on the next page load, with no new release.
3. Reads usage: runs, PDF conversions, common team sizes.
4. Works the leads every PDF request creates.

---

## 3. The numbers

**Inputs (the prospect enters)**
- Team size, the number of Beryl users.
- Queries per person per month, pre-filled benchmark, editable.
- Annual salary per person, or a default if skipped.

**Assumptions (editable, needs sign-off)**
- Time saved per query, 20 to 45 minutes.
- Working hours per year, 1,800.
- Beryl price, read from the product record.
- Typical queries, the benchmark.

**The formula (shown as a range, conservative to optimistic)**

```
total_queries = team_size × queries_per_person
hourly_rate   = annual_salary ÷ 1,800   (or override)
saving_low    = total_queries × (20÷60) × hourly_rate
saving_high   = total_queries × (45÷60) × hourly_rate
annual        = monthly_saving × 12
beryl_cost    = price × team_size
net_benefit   = monthly_saving − beryl_cost
roi_multiple  = monthly_saving ÷ beryl_cost
```

**Worked example: 5 users, 20 queries each, $75k salary**

| | |
|---|---|
| Hourly rate | $41.67 |
| Total queries per month | 100 |
| Monthly saving | $1,389 to $3,125 |
| Annual saving | $16.7k to $37.5k |
| Beryl cost per month | $249.75 |
| Net benefit per month | $1,140 to $2,875 |
| ROI multiple | 5.6x to 12.5x |

"Time saved per query" is the average time a payroll or HR person spends self-resolving one question without Beryl, across an easy-to-hard mix. It is an assumption pending validation against Beryl helpdesk data, not a fact, and the page says so until it is signed off.

---

## 4. On company_os

Mostly stateless by design. Two small new tables, and it borrows the price and the leads from the database.

**Existing tables it uses:** `products`, `people`, `lead`, `deals`, `companies`

**New tables to add**

- `roi_assumptions` (one editable row): time_saved_min_low, time_saved_min_high, working_hours_year, typical_queries, updated_by. Tune with no new release.
- `roi_usage_events` (anonymous): team_size, queries_per_user, salary, result_low_cents, result_high_cents, pdf_requested. No personal data.

**Core data to pull in**
- Beryl's price from the `products` record, so "$49.95" changes in one place, not in code.
- The two sign-off assumptions seeded into `roi_assumptions`.
- Each PDF request written as a `person` plus a `lead` (`source = 'roi_calculator'`), deduped by email.

**Views & permissions**
- View: a usage rollup off `roi_usage_events` (runs, PDF conversions, common team sizes).
- Permissions: the public never touches the database directly. One server route returns only the assumptions row; usage and lead writes go through a service-role route.

---

## 5. The build

### B1. Prove the loop: the ungated number, live

A stranger opens the calculator on the live site, enters team size, query volume and salary, and instantly sees their own monthly and annual savings as a range, with no sign-up.

**Definition of done**
- The page is live on the real domain, not a laptop.
- Inputs return a monthly and annual saving as a low-to-high range.
- The range comes from `roi_assumptions`, not hardcoded.
- Usable end to end with no login, no email, no gate.
- The price shows beside the saving, so the trade is clear.

**Success criteria**
- A first-time user reaches a number in under 30 seconds, with no instructions.
- Changing inputs moves the number the way a hand calculation would.
- Editing the assumptions row changes the defaults with no new release.
- The result reads as "$50 buys back X hours" to someone new to Beryl.

### B2. Make it real: PDF, lead capture and the usage signal

**Definition of done**
- Matches the APA look: Montserrat and Source Sans, brand colours, no gradients.
- Result shown as a clear range: hours and dollars, monthly and annual, cost beside.
- A plain "how we work this out" note states the assumptions.
- Optional PDF (name and work email; company optional).
- Requesting the PDF creates or updates a lead, deduped by email.
- Every run writes one anonymous `roi_usage_events` row, with the PDF flagged.
- Readable and usable on a phone.

**Success criteria**
- You can answer "how many runs, how many PDFs, what team sizes" from the tool.
- Everything a prospect or manager sees matches the signed-off assumptions.
- The PDF stands alone in the manager's inbox: their numbers, the trade, the method.
- Every PDF request lands as a workable lead.
- Sales and renewals stop building one-off ROI cases by hand.

---

## 6. Before external launch

- **[Data] Typical queries per person per month.** Total Beryl queries divided by active users divided by months live, not over the whole member base. Median preferred. Ships as a placeholder.
- **[Data] Time saved per query (20 to 45 min).** Validate against Beryl helpdesk data before the page claims "based on our data."
- **[Decision] Where leads land.** The `lead` pipeline (with owner and SLA) or HubSpot, or both. Recommended: the native pipeline.

---

*See also: [Unified Project System](project-unified-pm.md) · [Payroll 360 Report Engine](project-report-360.md) · [Master plan](building-on-company-os.md)*
