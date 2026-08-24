# edge8-web — Design System + Migration/CI Conventions (recon)

Worktree scanned (read-only): `/Users/infinite-leverage/code-projects/edge8-web-wt/htt-integration`
Repo: `talentedgeai/edge8-web` (branch worktree `htt-integration`). Stack: **Next.js 14.2.29 App Router, React 18, TS 5**. Uses `middleware.ts` (present), NOT proxy.ts. This is the marketing site + the "Edge8 OS" (admin/team/portal).

---

## 1. Token system (design system)

**One system, two layers** (CLAUDE.md §Design system):
- Foundations (marketing): `docs/product/edge8-design-system.md`
- Data layer (OS: admin/team/portal): `docs/product/edge8-design-system-data.md`
- Known drift catalogue: `docs/product/edge8-design-system-inventory.md` (check before "fixing" an inconsistency)

**Where tokens live**: `app/globals.css` `:root`. `app/admin/admin.css` (167 KB) re-roots onto them. The OS shell is shared — `/team` and `/portal` both import `admin.css` and render inside `.admin-shell`; a change there hits all three views.

### Font — Manrope is the ONLY font (confirmed)
- `globals.css`: `--font-display` and `--font-body` = `'Manrope', 'Helvetica Neue', Arial, sans-serif`. Self-hosted from `public/fonts/manrope-latin.woff2`, `manrope-latin-ext.woff2`, `manrope-vietnamese.woff2` (variable font, weights 200–800, nothing above 800). Never load fonts from a CDN; never add a licensed font.
- `admin.css`: `--admin-font-sans: var(--font-body)` AND `--admin-font-mono: var(--font-body)` — the "mono" var resolves to Manrope too. No DM Sans, no JetBrains Mono, no second UI font.
- **Numeric alignment uses `font-variant-numeric: tabular-nums`** (class `.admin-cell-mono`), NOT a monospace typeface. Optional `letter-spacing:-0.01em` allowed ONLY on tabular numerics.
- NOTE (drift): the shipped `/admin/patterns` page comment still says "DM Sans for UI, JetBrains Mono for numerics" and shows an "UPPERCASE EYEBROW" row — this is stale copy on the demo page; the actual tokens/faces are Manrope-only.

### Colors — data-layer tokens SHIP in `globals.css :root` under `--data-*` (the design-doc target is implemented)
- Brand blue `#287BE8` (`--color-primary-blue` / `--data-chart-1`); hover `#1D6AD4`; mint `#6FF2C1` (decorative only); body gray `#797c82`; near-black ink `#101014`.
- Neutrals: `--data-canvas #F1F3F5`, `--data-surface #fff`, `--data-surface-2 #F5F6F8`, `--data-line` (card border `#E6E6E6`), `--data-ink #101014`, `--data-ink-2 #797c82`, `--data-muted #9CA3AF`, `--data-faint #BCC1C7`.
- Status pairs (bg/ink): `--data-ok-* (#d8f3e8/#157a5a)`, `--data-warn-* (#fbf0cf/#8a6a0f)`, `--data-err-* (#fde4e4/#b0332f)`, `--data-info-* (#e2ecfd/#1d6ad4)`.
- Categorical chart ramp `--data-chart-1..7`: `#287BE8 #6FF2C1 #1D6AD4 #101014 #9CA3AF #3B8CF5 #6B7280` (brand only; legible to ~4 series).
- **In the OS shell, the same values are exposed as `--admin-*`** (what admin.css + `/admin/patterns` actually use): `--admin-accent #287be8`, `--admin-accent-strong #1d6ad4`, `--admin-accent-soft #eaf2ff`, `--admin-ink #101014`, `--admin-ink-2 #797c82`, `--admin-muted #9ca3af`, `--admin-line #e6e6e6`, `--admin-bg #f1f3f5`, `--admin-surface #fff`, `--admin-sidebar-bg #101014`, status `--admin-ok/warn/err/info/pink/muted-bg`.

### Radius
- `--data-btn-radius 8px` (compact utility button), `--data-radius 12px` (tables/dense panels/data cards), `--data-radius-sm 6px` (chips/tags), inputs 8px. **40px pill (`--radius-btn`/`--admin-radius-pill`) stays mandatory for real CTAs.** Content (non-grid) cards keep Foundations 20px (`--radius`). Admin aliases: `--admin-radius-xs 6px`, `--admin-radius-sm 8px`, `--admin-radius 12px`, `--admin-radius-pill`.

### Shadow — OVERLAYS ONLY (resting cards/sections stay shadow-free)
- `--data-elevation-1` (popovers/dropdowns/sticky head), `--data-elevation-2` (floating menus), `--data-elevation-drawer`, `--data-elevation-modal`. Navy-tinted `rgba(4,16,45,…)`. Admin aliases: `--admin-shadow`, `--admin-shadow-md`, `--admin-shadow-modal`.

**Rule (CLAUDE.md)**: never introduce a raw hex, radius, shadow, or font family that isn't a token. Read the relevant layer doc before building UI; do not invent values.

---

## 2. `/admin/patterns` — the living pattern library (copy from here)

- Route: `app/admin/(dashboard)/patterns/page.tsx` (+ `PersonSelectDemo.tsx`). Reachable at `/admin/patterns`; NOT in sidebar nav by design. Renders every token + component with the real `.admin-*` classes.
- **Reusable components live in `components/admin/`** (import via `@/components/admin/<Name>`):

| Component | Import | Purpose / props |
|---|---|---|
| `PageHead` | `@/components/admin/PageHead` | page header: `{eyebrow?, title, sub?, action?}` → `.admin-page-head` |
| `MetricCard` | `@/components/admin/MetricCard` | **KPI / stat tile**: `{label, value, sub?, href?}` → `.mp-kpi`; grid wrapper `.mp-kpi-grid` |
| `Badge` + `statusTone()` | `@/components/admin/Badge` | status chip: `{tone?:'ok'\|'warn'\|'err'\|'info'\|'pink'\|'neutral', dot?}`; `statusTone(str)` maps company_os statuses → tone |
| `DataTable<T>` | `@/components/admin/DataTable` | **generic table** (server comp, URL-driven sort/pagination/search): `{columns, rows, total, page, pageSize, sort?, dir?, basePath, searchParams, searchPlaceholder?, emptyText?, filterBar?, getRowPreview?, renderRow?, pageSizeOptions?, view?, renderCards?}`. `Column<T>={key,header,cell?,sortable?,align?,className?}`. `getRowPreview` makes the whole row open the side-car drawer. |
| `FilterBar` | `@/components/admin/FilterBar` | URL-driven `<select>` filters: `{basePath, searchParams, filters:FilterDef[]}` |
| `TableSearch` | `@/components/admin/TableSearch` | search box client island (used inside DataTable toolbar) |
| `DetailDrawer` | `@/components/admin/DetailDrawer` | **side-car / drill-down drawer**: `{open,onClose,title,eyebrow?,action?,children}` (Esc-close, body scroll-lock) |
| `PreviewRow` | `@/components/admin/PreviewRow` | clickable row → drawer preview |
| `KanbanBoard` | `@/components/admin/KanbanBoard` | board view (`.sap-col`/`.sap-card` classes) |
| `MoneyCell` | `@/components/admin/MoneyCell` | `{cents, currency?}` → `.admin-cell-mono` via `formatCents` (`@/lib/admin/format`) |
| `Tabs`, `ViewToggle`, `Expandable`, `ConfirmButton`, `InlineEdit`, `PersonSelect` | `@/components/admin/*` | tabs, segmented toggle, expand, confirm, inline edit, person picker |
| `BarChart`, `DonutChart` | `@/components/admin/charts/{BarChart,DonutChart}` | brand-token charts |

- Bare CSS patterns (no component, copy classes from patterns page): `.admin-card`+`.admin-section-card` (card + padding), `.admin-toolbar`, `.admin-table`/`.admin-table-wrap`/`.admin-table-scroll`, `.admin-pagination`, `.admin-btn`(`--primary`/`--danger`/`--sm`), `.admin-form`/`.admin-field`/`.admin-input`/`.admin-select`/`.admin-textarea`, `.admin-kv` (key/value dl), `.admin-alert`, `.admin-toast`, `.admin-modal`, `.admin-danger-zone`, `.admin-empty`.
- Person pickers: feed from `listAssignablePeople()` in `@/lib/admin/people-options`; labels via `personName()` in `@/lib/people-name` (never `full_name` directly).
- **Path alias: only `@/*` → repo root** (`tsconfig.json`). Import content lib from `@/lib/...`, components from `@/components/...`.

---

## 3. `check:design` guardrail

- Command: **`npm run check:design`** → runs **`node scripts/design/check-assets.mjs`** (`--warn-only` flag downgrades errors to warnings; default exits 1 on error).
- Sibling: `npm run check:crons` → `node scripts/check-crons.mjs` (every `vercel.json` cron path reaches a handler, not a 308).
- **What it FLAGS** (5 checks; scans `app/`, `components/`, `lib/`):
  1. **missing-asset (ERROR)** — every `/public` asset referenced in CSS `url()` or JSX `src|href|poster` exists; also server-side `readFileSync('public/…')` reads. Missing file = build/silent-404 hazard.
  2. **font-weight-without-face** — every `font-weight`/`fontWeight` used is backed by a real `@font-face`. Weight **above** heaviest real face = WARNING (silent degradation); weight **inside a gap** = ERROR. (This is the check that caught the original "SemiBold shipped missing for months" bug.)
  3. **card-without-padding (ERROR)** — any `.admin-card` in JSX must get padding from a companion class (`.admin-section-card` etc.), an inline `padding:`, or a self-padding child (`.admin-empty`/`.admin-table`/`.admin-drawer-head`).
  4. **off-type-scale / off-space-scale (WARNING)** — `font-size` px must be on TYPE_SCALE `[11,12,13,14,15,16,18,20,24,28,32,40,48,64,80]`; `gap/padding/margin` px on SPACE_SCALE `[2,4,6,8,10,12,14,16,18,20,24,28,32,40,48,56,64,80,96,120]`. (em/rem/% exempt.)
  5. **ad-hoc-content-width (WARNING)** — page-level `maxWidth`/`max-width` ≥400px in `app/admin|team|portal` must be a sanctioned width `[640,880,1440]` or use `.admin-content`(880)/`.admin-content--form`(640).
- **What it does NOT flag**: raw hex colors, raw radius values, raw box-shadow values, and inline `style={{...}}` in general are NOT checked. (The "no raw hex/radius/shadow/non-token font" rule is a CLAUDE.md **convention enforced by review**, not by this script. The only font enforcement is check #2 = weight-vs-face, not family.)
- Run it before opening a PR. Any new asset (font/image/icon) referenced in code must be committed in the same PR.

### Other commands (package.json — note the gaps)
- `npm run dev` / `build` (`next build`) / `start` / `lint` (`next lint`). **There is NO `test` script and NO standalone `tsc`/typecheck script.** Typecheck happens only inside `next build` (next.config.mjs sets no `typescript.ignoreBuildErrors` / `eslint.ignoreDuringBuilds`, so build enforces both TS + lint).

---

## 4. DB migrations — storage, apply, and service_role grant convention

- **Location**: `supabase/migrations/*.sql` — 129 files, named **`YYYYMMDDHHMMSS_snake_case_name.sql`** (timestamp-ordered).
- **Linked project**: `supabase/.temp/project-ref` = `wwchefrgkkxmhlkntufm` ("Edge8 Company Database", org `afazlvyacsijthammztl`). All company_os objects live in schema **`company_os`**. (The CRM DB helper `scripts/crm/db.mjs` connects to this same project via the `postgres` driver, pooler `aws-0-ap-southeast-1`, password read from a `SUPABASE Password:` line in `.env.local`.)
- **How applied**: NOT via a CI migration runner and NOT `supabase db push` in this repo. Migration headers say **"Applied via Supabase MCP."** (18 files) or "Applied via Supabase Management API" — i.e. the SQL is applied out-of-band via MCP/Management API, and the file is committed to the repo for history. (Matches the aiolabz memory note: MCP is read-only for queries; writes go through the Supabase CLI keychain token → Management API SQL endpoint.) A second archival copy of many statements also lives in `docs/db/*.sql`.
- **No dedicated migration-convention doc**; the convention is the file pattern itself + the "Applied via …" header comment. `docs/engineering/admin-consistency-playbook.md` is the closest playbook.
- **service_role grants ARE included** for company_os objects (60 of 129 migration files contain `service_role`). Canonical per-table snippet (from `20260822110000_brand_contacts.sql`):

```sql
create table if not exists company_os.brand_contacts ( ... );
create index if not exists brand_contacts_brand_idx on company_os.brand_contacts (brand_id);

alter table company_os.brand_contacts enable row level security;

grant select, insert, update, delete on company_os.brand_contacts to service_role;
grant select on company_os.brand_contacts to supabase_read_only_user;
```

  - Convention: **enable RLS**, then `grant select, insert, update, delete on company_os.<table> to service_role;` (the app talks to Postgres as `service_role`). Read replica/readonly access via `grant select … to supabase_read_only_user;` (11 files).
  - **Functions/RPCs**: `revoke execute on function company_os.<fn>(...) from public;` then `grant execute on function company_os.<fn>(...) to service_role;` (e.g. `20260711120000_events_core.sql`). SECURITY DEFINER fns set `set search_path = company_os, extensions, pg_catalog`.
  - Sequences: `grant usage, select on sequence company_os.<seq> to service_role;`

---

## 5. Supabase TypeScript types — NONE are generated/stored

- **There is no generated Supabase types file** in this repo — no `lib/database.types.ts`, no `*.types.ts`, no `supabase gen types` script, no `type Database` definition. (Verified by find/grep across `lib/`, `app/`, `supabase/`.)
- DB access is **untyped/raw**: server code uses the `postgres` npm driver (raw SQL, e.g. `scripts/crm/db.mjs`, `lib/company-os.ts`) and `@supabase/ssr` / `@supabase/supabase-js` clients (`lib/supabase.ts`, `lib/supabase/server.ts`, `lib/supabase/browser.ts`, `lib/admin/mutations.ts`) created **without** a `Database` generic. Row shapes are hand-written TS types per feature in `lib/**`.
- **Consequence for new portal pages**: do not expect (or import) generated DB types; define row types by hand in the feature's `lib/` module, matching the migration's columns. If generated types are desired they would have to be introduced (would use `npx supabase gen types typescript --project-id wwchefrgkkxmhlkntufm` / MCP `generate_typescript_types`), but that is NOT an existing convention here.

---

## 6. CI (`.github/workflows/*.yml`) — what "green" requires

Only two workflow files exist. **There is NO typecheck/lint/test/build job in GitHub Actions CI.**

1. **`design-guardrails.yml`** — trigger `pull_request` on paths `app/** components/** lib/** public/** scripts/design/** scripts/check-crons.mjs vercel.json next.config.mjs .github/workflows/design-guardrails.yml`. Node **20**. Two jobs (both BLOCKING):
   - `check-assets`: `node scripts/design/check-assets.mjs`
   - `check-crons`: `node scripts/check-crons.mjs`
2. **`authorship-guard.yml`** — trigger `pull_request` [opened, edited, reopened, synchronize]. **Warn-only, NEVER blocks.** Posts/updates one advisory comment if the PR body lacks a resolvable `<!-- author: <handle> <git-email> -->` block. Add that block to the PR description (use your edge8 git email) to be attributed for human-token tracking.

- **Build/typecheck/lint gate is Vercel, not GitHub Actions**: `next build` (which runs TS strict + eslint) executes as the Vercel PR **preview deployment**. `vercel.json` here has NO `ignoreCommand`, so previews build normally on every PR — a Vercel build failure = real TS/lint/build break. So "green CI" = **design-guardrails jobs pass (assets + crons) AND the Vercel preview build succeeds**; authorship-guard is advisory only.
- Locally reproduce the gate before opening a PR: `npm run check:design && npm run check:crons && npm run build` (add `npm run lint`).

---

## 7. Repo rules (worktree `CLAUDE.md`)

- **95% confidence before any change** — ask follow-ups first. Exception: pre-approved runbooks in `.claude/skills/` (e.g. `crm-call-to-proposal`) run end-to-end.
- **Brand**: "Edge8" written exactly like that, never all-caps (watch CSS `text-transform:uppercase` on eyebrows). **Never use em dashes anywhere** — use commas/colons/periods/parentheses. (Applies to pages, copy, AND commits.)
- **Design**: read the relevant layer doc before building UI; copy from `/admin/patterns`; never introduce a non-token hex/radius/shadow/font; Manrope only, self-hosted, weights ≤800; new asset committed in same PR; run `npm run check:design` before a PR.
- **Ship flow**: the local checkout is usually a WIP branch with uncommitted changes and is many commits behind — **never build on it**. `git worktree add` a branch **from `origin/main`** (fetch first), stage files **by name** (never `git add .`), open a PR, merge when CI green. After merge, verify with `curl` against `https://www.edge8.ai/...` (the in-app browser blocks edge8.ai by policy) and reply with the live URL.
- **Sales ops / CRM**: `app/proposals/page.tsx` status and `company_os.deals` move together; proposals are static files in `public/proposals/` from `docs/templates/proposal-template.html`; DB helper `scripts/crm/db.mjs`; runbook `.claude/skills/crm-call-to-proposal/SKILL.md` (has verified Company OS IDs — don't re-explore schema).
- Global rules (user CLAUDE.md) also apply: run `git status` before file work; never `git add .`/`-A`; never force-push; never `--no-verify`; never commit unless told; never deploy via CLI (all deploys via git push → CI/CD).

---

## Gotchas / open items
- `/admin/patterns` demo copy is stale (mentions DM Sans / JetBrains Mono / uppercase eyebrow) but the real tokens are Manrope-only + sentence case — don't copy that stale framing.
- `check:design` does NOT catch raw hex/radius/shadow or inline styles — those are review-enforced conventions, so a page can pass CI and still violate the design system.
- No GitHub Actions typecheck/test — the TS/build safety net is the Vercel preview build; if Vercel previews are disabled for a PR, nothing catches a type error until merge.
- Migrations are applied by hand via Supabase MCP/Management API, then committed — the committed `.sql` is a record, not an auto-applied artifact. New company_os tables MUST include `enable row level security` + `grant … to service_role` (+ optional `grant select … to supabase_read_only_user`) or the app (service_role) can't read/write them.
</content>
</invoke>
