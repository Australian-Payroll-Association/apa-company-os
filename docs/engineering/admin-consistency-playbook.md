# Admin UX Consistency Playbook

How every admin list/board page should look and behave, and a ready-to-paste
prompt for bringing a new section up to standard. Derived from the CRM section
work (Contacts, Companies, Deals, Leads, Inquiries, Sales cockpit).

**Status**
- Done: **CRM** (Contacts, Companies, Deals, Leads, Inquiries, `/admin/revenue` cockpit).
- To do: **Commerce** (Orders, Products, Registrations/Retreat, Bookings/AIO Pad, Affiliates), then **Talent** (Applications, Candidates, Job Reqs, Team) and **Operations** (Time Off).

---

## The standard

**Design system (source of truth, match it — don't restyle)**
- `app/admin/admin.css`: scoped tokens, DM Sans (UI) + JetBrains Mono (numerics), navy palette. All rules stay scoped under `.admin-shell` / `.admin-auth`.
- Living style guide at **`/admin/patterns`** (`app/admin/(dashboard)/patterns/page.tsx`). Every token and component in every state. Use it as the QA screen.

**Reuse these components (don't rebuild)**
`PageHead`, `MetricCard` (KPI tiles in an `mp-kpi-grid`), `DataTable` (search + sortable headers + pagination + `filterBar` + `getRowPreview`), `FilterBar`, `TableSearch`, `ArchivedToggle`, `DetailDrawer` (the "side car"), `PreviewRow`, `Badge`. Data via `listEntity` (`lib/admin/query.ts`). Format with `lib/admin/format.ts` (money is integer cents; numerics use `.admin-cell-mono`).

**Mirror these reference pages**
- Table page with search + filters + sort + side-car preview: `app/admin/(dashboard)/contacts/page.tsx`, `app/admin/(dashboard)/revenue/companies/page.tsx`.
- Side-car mechanism: `components/admin/DataTable.tsx` (`getRowPreview`) + `components/admin/PreviewRow.tsx`.
- KPI strip + section landing: `app/admin/(dashboard)/revenue/page.tsx` (the Sales cockpit).

**Rules for every LIST page**
1. **One toolbar everywhere**: `TableSearch` + `FilterBar` + sortable column headers + `ArchivedToggle` (if the table archives) + pagination, via `DataTable`.
2. **Filters**: add a `FilterBar` with ONLY clean, useful fields. Check the real data first (a distinct-values query); skip fields that are ~empty or dirty free-text. One meaningful filter beats four empty dropdowns. Wire through `listEntity`'s `filters`, URL-driven (`?key=value`). Per-page proposals live in `docs/plans/2026-07-06-admin-filters-plan.md`.
3. **Row click → side car**: the WHOLE row is clickable (the name is NOT the lone link) via `DataTable`'s `getRowPreview`. The drawer shows a key-fields card (`admin-kv`) plus an "Open full profile" button when a detail page exists. Keep rows keyboard-accessible. For records with a rich editable shelf (like deals), reuse that shelf component rather than a bespoke summary.
4. **KPI strip**: `mp-kpi-grid` of `MetricCard`s at the top where meaningful (e.g. Orders: revenue this month + count; Products: active count). Board/pipeline-style pages always get one.
5. **Money hygiene**: integer cents, `formatCents`, mono numerics.

---

## Hard constraints

- **Never launch a dev server** (no `next dev` / preview). Verify only with `npx tsc --noEmit` and `npx next build`.
- Keep all CSS **scoped** under `.admin-shell` / `.admin-auth`; never edit `globals.css` (marketing form/input rules bleed into `/admin`). Sanity-check the compiled `/admin/login` CSS chunk after CSS changes.
- Do **not** change navigation content unless explicitly asked.
- Work in an **isolated git worktree** branched off `origin/main` (repo is shared with concurrent agents); symlink `node_modules` + `.env.local` into it. Open a **PR to `main`**; never push to `main` directly. One PR per section is fine.
- Supabase: project **"Edge8 Company Database"** (`wwchefrgkkxmhlkntufm`), schema `company_os`. Use the Supabase MCP for **read-only** distinct-value checks only. Never mutate prod data without explicit confirmation. Watch for **DB CHECK constraints that lag the app code** (an allowed-values list the UI already uses but the DB rejects).
- Note: `brand_id` / `legal_entity_id` are being removed from `company_os` (see the brand_id refactor on `main`); confirm current columns before filtering on them.

**Per-page approach**: audit what the page has (search / filters / sort / cards) → map to the standard → implement → verify (`tsc` + `next build`) → PR referencing `/admin/patterns`.

---

## Ready-to-paste prompt (apply to a new section)

> Bring the admin **COMMERCE** section up to the exact UX consistency standard in
> `docs/engineering/admin-consistency-playbook.md`. Mirror the existing patterns;
> do not invent new ones.
>
> Reference the design system (`app/admin/admin.css`, `/admin/patterns`) and reuse
> the shared components listed in the playbook (`DataTable` with `getRowPreview`,
> `FilterBar`, `TableSearch`, `ArchivedToggle`, `PageHead`, `MetricCard`,
> `DetailDrawer`, `PreviewRow`, `Badge`; `listEntity`; `lib/admin/format`). Mirror
> `contacts/page.tsx` and `revenue/companies/page.tsx` for tables, and
> `revenue/page.tsx` (the cockpit) for KPI strips.
>
> For every list page apply the standard: one toolbar (search + FilterBar +
> sortable columns + ArchivedToggle + pagination); filters using only clean fields
> (check distinct values first, skip empty/dirty ones); the whole row clickable
> opening the record in the side car via `getRowPreview` (with an "Open full
> profile" button when a detail page exists); and a KPI strip where meaningful.
>
> Cover these pages: `/admin/revenue/orders`, `/admin/revenue/products`,
> `/admin/revenue/registrations` (Retreat), `/admin/revenue/bookings` (AIO Pad),
> `/admin/revenue/affiliates`. Then generalize to Talent and Operations.
>
> Honor the hard constraints in the playbook: no dev server (verify with tsc +
> next build), scoped CSS only, nav unchanged, isolated worktree off origin/main,
> PR to main, Supabase MCP read-only for distinct-value checks, watch for DB CHECK
> constraints that lag the code. Deliver one PR per section, each referencing
> `/admin/patterns`.
