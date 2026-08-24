# edge8-web — Portal auth + company-scoped read path (recon for /portal/tokens)

Worktree: `/Users/infinite-leverage/code-projects/edge8-web-wt/htt-integration` (read-only).
Repo uses a root `middleware.ts` (revalidates the JWT via `auth.getUser()` on every
matched `/portal` request before the page gate runs). All paths below are relative to
the worktree root.

> NOTE: `/portal/tokens` and `lib/portal/tokens.ts` **already exist** — a "human-token
> pack" purchase page (Stripe Checkout). See §8. The HTT integration is likely rebuilding
> or extending this, so read §8 before touching it.

---

## 1. `requirePortalMember()` — the gate

**File:** `lib/portal-auth.ts`

Import path (used everywhere in `app/portal/**`):
```ts
import { requirePortalMember } from "@/lib/portal-auth";
```

Signature + body (`lib/portal-auth.ts:241`):
```ts
export async function requirePortalMember(): Promise<PortalActor> {
  const { actor, redirectTo } = await getPortalActor();
  if (!actor) redirect(redirectTo);
  return actor;
}
```

- Returns a `PortalActor` (never null — it `redirect()`s otherwise).
- Backed by `getPortalActor()` (`lib/portal-auth.ts:159`), wrapped in React `cache()` so
  the layout + page resolve identity once per request. Redirect targets:
  not signed in → `/portal/login`; an admin w/o Assume → `/admin`; active employee →
  `/team`; no active `portal_members` row → `/portal/login`.
- Identity matched on `people.auth_user_id` (from the JWT), **never** email
  (`lib/portal-auth.ts:176-190`).
- Access is an explicit allowlist: a person may enter iff they hold ≥1 **active**
  `company_os.portal_members` row (`lib/portal-auth.ts:205-213`). CRM `person_companies`
  links never grant access.
- Call it at the top of the `/portal` layout AND every `/portal` page/server action
  (comment at `lib/portal-auth.ts:239-240`).

Siblings: `lib/admin-auth.ts` (admins, `requireAdmin`/`getAdminUser`) and
`lib/team-auth.ts` (employees).

---

## 2. `PortalActor` type — scope representation

**File:** `lib/portal-auth.ts:50-65`

```ts
export type PortalActor = {
  authUserId: string;
  personId: string;
  displayName: string;
  email: string;
  companyScope: string[];              // companies.id values this actor may read
  memberships: PortalMembership[];
  impersonation: PortalImpersonation | null;  // set iff admin is in Assume mode
  mustChangePassword: boolean;
};
```

`PortalMembership` (`lib/portal-auth.ts:37-42`):
```ts
export type PortalMembership = {
  id: string;
  companyId: string | null;
  companyName: string | null;
  role: string;          // "admin" | "contributor" | "viewer" (see lib/portal/roles.ts)
};
```

**Multi-company scope:** `companyScope: string[]` is the flat list of `companies.id` the
actor may read — computed server-side from the active `portal_members` rows
(`lib/portal-auth.ts:221-224`), one entry per membership. A person can be admin at one
company and viewer at another; per-company power is resolved via
`roleForCompany(actor, companyId)` in `lib/portal/roles.ts`. In Assume mode `companyScope`
is exactly the single assumed company (`lib/portal-auth.ts:143`).

Role helpers (`lib/portal/roles.ts`): `isPortalAdmin(actor, companyId)`,
`canContribute(actor, companyId)`, `adminCompanyScope(actor)`,
`contributorCompanyScope(actor)`, `ROLE_DENIED`. Unknown roles degrade to `viewer`
(fail closed).

---

## 3. Service-role Supabase client factory (portal reads)

**File:** `lib/supabase.ts`

```ts
import { createClient } from "@supabase/supabase-js";
export const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
// Scoped to the company_os schema — the canonical Company OS.
export const companyOs = supabase.schema("company_os");   // lib/supabase.ts:28
```

Import used by all portal reads:
```ts
import { companyOs } from "@/lib/supabase";
```

- `supabase` uses `SUPABASE_SECRET_KEY` (service role — **bypasses RLS**). Server-only;
  comment at `lib/supabase.ts:3-5` says NEVER import from a client component.
- `companyOs` = the same client `.schema("company_os")`. **All** portal DB reads go
  through `companyOs`.
- CONFIRMED: portal reads use the service-role client. `company_os` has RLS enabled with
  **no policies and no grants to the browser/publishable key**, so the anon key can read
  nothing there — the service-role gate is the boundary
  (`lib/portal-auth.ts:6-12`, `lib/portal/data.ts:1-8`). The browser/anon key is never
  used for portal data.
- The session client for identity only (never for data reads):
  `createSessionClient()` from `@/lib/supabase/server` — `getPortalActor` calls
  `supabase.auth.getSession()` on it (`lib/portal-auth.ts:160-168`).

### The sanctioned scoping helper — `lib/portal/data.ts`

Portal code is supposed to read through `portalRead()`, which injects the scope filter so
an unscoped query is structurally impossible:

```ts
// lib/portal/data.ts:18-25 — the ONLY tables /portal may read, + their scope column
const SCOPE_ALLOWLIST = {
  portal_members:          { column: "person_id",  scope: "person"  },
  staff_assignments:       { column: "company_id", scope: "company" },
  event_registrations:     { column: "person_id",  scope: "person"  },
  client_backlog_items:    { column: "company_id", scope: "company" },
  client_roadmap_groups:   { column: "company_id", scope: "company" },
  client_roadmap_overview: { column: "company_id", scope: "company" },
};

export function portalRead(actor, table, select) {   // lib/portal/data.ts:35
  const cfg = SCOPE_ALLOWLIST[table];
  const ids = cfg.scope === "company" ? actor.companyScope : [actor.personId];
  return companyOs.from(table).select(select).in(cfg.column, ids);  // filter cannot be removed
}
export async function assertInScope(actor, table, id): Promise<string|null>  // lib/portal/data.ts:50 (IDOR guard)
```

> IMPORTANT: not every portal read uses `portalRead`. Tables not in the allowlist
> (`ai_programs`, `program_plans`, `program_documents`, `boards`, `tasks`,
> `token_purchases`, `orders`) are read directly on `companyOs` with a hand-written
> `.in("company_id", actor.companyScope)` (or `.in("id", ids)`) filter — see §5, §6, §8.
> A new `/portal/tokens` read should either add its table to the allowlist OR follow the
> existing hand-scoped pattern in `lib/portal/tokens.ts` (which filters `token_purchases`
> on `company_id` directly, NOT via portalRead).

---

## 4. Template: an existing end-to-end company-scoped `/portal` page

Two clean templates. **Programs** is the closest structural match for a new
list-plus-detail token page; the **hub roadmap** is the richest company-scoped read.

### A. AI Programs (recommended template)
- Page/route: `app/portal/(dashboard)/programs/page.tsx` (route `/portal/programs`)
  - `const actor = await requirePortalMember();` (`page.tsx:42`)
  - Loads via `listProgramsForActor(actor)` (`page.tsx:43-46`).
- Data-loading fn: `listProgramsForActor()` in `lib/portal/ai-programs.ts:74`.
  - Table queried: `ai_programs`, filter **`company_id`** — `.in("company_id", actor.companyScope)` (`ai-programs.ts:79`).
  - Then child reads: `program_plans` / `program_documents` filtered on **`ai_program_id`**
    `.in("ai_program_id", ids)` (`ai-programs.ts:94-102`).
- Detail route: `app/portal/(dashboard)/programs/[id]/page.tsx` → `getProgramForActor()`
  (IDOR-guarded via `ownedProgram()` = `.eq("id", programId).in("company_id", actor.companyScope)`,
  `ai-programs.ts:62-72`).

### B. Roadmap / Client Hub (company-scoped, goes through portalRead)
- Page/route: `app/portal/(dashboard)/hub/page.tsx` (route `/portal/hub`). **There is no
  `roadmap/page.tsx`** — the roadmap tab renders inside the hub via
  `BacklogPortalView` (`../roadmap/BacklogPortalView.tsx`).
- Data-loading fns (all in `lib/portal/backlog.ts`, all via `portalRead`):
  `getBacklogForActor` (`backlog.ts:109`), `getGroupsForActor` (`backlog.ts:42`),
  `getOverviewForActor` (`backlog.ts:101`).
  - Tables + filter column: `client_backlog_items` / `client_roadmap_groups` /
    `client_roadmap_overview`, all filtered on **`company_id`** (via `portalRead`
    scope=company).
- Server actions: `app/portal/(dashboard)/roadmap/actions.ts` →
  `setClientPriorityForActor` / `proposeItemForActor` / `reorderGroupForActor` in
  `lib/portal/backlog.ts` (each re-checks scope + role before writing).

---

## 5. Sites reading/writing the Phase-1 target tables (must become `ai_program_id`-aware)

Current filter/insert column per site. **All roadmap/backlog reads today filter on
`company_id`; boards filter on `client_company_id`; columns/sprints/tasks filter on
`board_id` (never company directly).**

### `client_backlog_items` (filter/insert col = `company_id`)
| File:line | Op | Column |
|---|---|---|
| `lib/portal/data.ts:22` | allowlist entry | `company_id` (scope=company) |
| `lib/portal/backlog.ts:25,61,111,133` | read (portalRead) | `company_id` |
| `lib/portal/backlog.ts:150` | update (reorder) | `.eq("id", id)` |
| `lib/portal/backlog.ts:175,192` | update priority/note | `.eq("id", itemId)` |
| `lib/portal/backlog.ts:224` | insert (propose) | `company_id` (`backlog.ts:227`) |
| `lib/team/roadmap.ts:17` | `const TABLE` | `company_id` |
| `lib/team/clients.ts:113,148` | read | `company_id` |
| `lib/admin/company-hub.ts:29` | read | `.eq("company_id", companyId)` |
| `lib/boards/data.ts:295,302` | read (link picker) | `.in("id", backlogIds)` |
| `app/admin/(dashboard)/boards/[slug]/actions.ts:205` | read/link | (by id) |
| `app/admin/(dashboard)/edges/client-roadmaps/page.tsx:46,115` | read | `company_id` |
| `app/admin/(dashboard)/edges/client-roadmaps/actions.ts:16` (`const TABLE`); insert `company_id` at `:85`, insert at `:91`; updates `:116,135,148,161`; read `:101,305-307` | read+write | insert `company_id`; group filter `company_id` |
| `app/admin/(dashboard)/revenue/companies/[id]/page.tsx:217` | read | `.eq("company_id", company.id)` |

### `client_roadmap_groups` (filter/insert col = `company_id`)
| File:line | Op | Column |
|---|---|---|
| `lib/portal/data.ts:23` | allowlist | `company_id` (scope=company) |
| `lib/portal/backlog.ts:44` | read (portalRead) | `company_id` |
| `lib/portal/backlog.ts:214` | read (validate propose group) | `.eq("company_id", input.companyId)` |
| `lib/team/roadmap.ts:46`, `lib/team/clients.ts:41`, `lib/admin/company-hub.ts:31` | read | `company_id` |
| `lib/boards/data.ts:310` | read | (grouping) |
| `app/admin/(dashboard)/edges/client-roadmaps/page.tsx:52` | read | `company_id` |
| `app/admin/(dashboard)/edges/client-roadmaps/actions.ts:17` (`const GROUPS_TABLE`); insert `company_id` at `:226`, insert `:233,358`; updates `:250,282-283,317,330`; reads `:58-60,263-272,297-307,345-347` | read+write | insert/filter `company_id` |
| `app/admin/(dashboard)/revenue/companies/[id]/page.tsx:218` | read | `.eq("company_id", company.id)` |

### `client_roadmap_overview` (filter/upsert col = `company_id`, PK-ish on company)
| File:line | Op | Column |
|---|---|---|
| `lib/portal/data.ts:24` | allowlist | `company_id` (scope=company) |
| `lib/portal/backlog.ts:103` | read (portalRead) | `company_id` |
| `lib/team/clients.ts:119`, `lib/admin/company-hub.ts:36` | read | `company_id` |
| `app/admin/(dashboard)/edges/client-roadmaps/page.tsx:60` | read | `.eq("company_id", selected.id)` |
| `app/admin/(dashboard)/edges/client-roadmaps/actions.ts:175-178` | **upsert** | `{ company_id }` `onConflict: "company_id"` |
| `app/admin/(dashboard)/revenue/companies/[id]/page.tsx:219` | read | `.eq("company_id", company.id)` |

### `boards` (filter/insert col = `client_company_id`)
- Client-visible read: `lib/boards/client-view.ts:38,50` — `.in("client_company_id", companyIds)`.
- Portal wrapper: `lib/portal/boards.ts` → `hasClientBoard` / `getClientBoardView`
  (`lib/boards/client-view.ts`), passed `actor.companyScope`.
- Admin insert: `app/admin/(dashboard)/boards/actions.ts:46-47` — `client_company_id: input.clientCompanyId`.
- Other reads: `lib/boards/access.ts:21`, `lib/boards/data.ts:72,200,211`,
  `lib/admin/company-hub.ts:57`, `lib/team/boards.ts:31,54,158,207`,
  `lib/coaching/data.ts:37,72`, `app/admin/(dashboard)/boards/[slug]/actions.ts:198,448,458,566`.

### `board_columns` (filter col = `board_id`)
- `lib/boards/client-view.ts:62` — `.eq("board_id", board.id)`.
- Admin insert: `app/admin/(dashboard)/boards/actions.ts:51-52` — `board_id`.
- Others: `lib/boards/data.ts:220`, `lib/team/boards.ts:208`,
  `app/admin/(dashboard)/boards/[slug]/actions.ts:80,134`, `lib/coaching/data.ts:74,1492`.

### `sprints` (filter col = `board_id`)
- `lib/boards/client-view.ts:97` — `.in("id", sprintIds)` (client read by id).
- `lib/boards/data.ts:94,223`, and CRUD in `app/admin/(dashboard)/boards/[slug]/actions.ts`
  (insert `:319`; reads/updates `:334,359,366,395,511,523,533,541,555`).

### `tasks` (filter col = `board_id`; client read also `internal=false`)
- Client read: `lib/boards/client-view.ts:64-70` — `.eq("board_id", board.id).eq("internal", false).is("parent_task_id", null).is("archived_at", null)`.
- CRUD: `app/admin/(dashboard)/boards/[slug]/actions.ts` (insert `:105`; many
  updates `:149,216,263,282,295,342,382,598,627`; reads `:27,40,184,236,375,471,479,490,495,593`).
- Others: `lib/boards/data.ts:88,229,382`, `lib/team/boards.ts:68,140,188`,
  `lib/admin/company-hub.ts:73`, `app/api/cron/board-digest/route.ts:50`,
  `lib/coaching/data.ts:57,1483,1515,1525`,
  `app/admin/(dashboard)/edges/client-roadmaps/page.tsx:72`.
- `tasks.human_tokens` column already exists and is set by admins:
  `app/admin/(dashboard)/boards/[slug]/actions.ts:598` — `.update({ human_tokens }).eq("id", taskId)`.

**Summary for Phase 1:** roadmap/backlog/overview are scoped on `company_id`; boards on
`client_company_id`; columns/sprints/tasks inherit scope through `board_id`. To make these
`ai_program_id`-aware you add an `ai_program_id` filter/column at the `company_id`-filtered
sites (backlog/groups/overview) and at the `boards` (`client_company_id`) site; columns/
sprints/tasks follow their board.

---

## 6. `ai_programs` usage today + existing AI Programs surfaces

`ai_programs` (company_os, service-role only) has: `id, company_id, name, status,
created_at, created_by`. Children link via **`ai_program_id`**: `program_plans`
(`id, ai_program_id, title, method, brief_html, created_at, created_by`),
`program_documents` (`id, company_id, ai_program_id, storage_path, filename, size_bytes,
uploaded_by, created_at`). NOTE `program_documents` carries BOTH `company_id` and
`ai_program_id` (documents are company-owned; the program is a tag —
`lib/portal/ai-programs.ts:235-237`).

Read/write sites:
- `lib/portal/ai-programs.ts` — full portal CRUD, all scoped `.in("company_id",
  actor.companyScope)` (list `:79`), IDOR guard `ownedProgram` `:64-69`, children on
  `ai_program_id` (`:94-102`), inserts `company_id` (`:164`), plans insert `ai_program_id` (`:170-172`).
- `lib/client-documents.ts:35,54,77,174` — `ai_program_id` on client documents +
  a join `program:ai_programs!ai_program_id(name)`.
- Admin: `app/admin/(dashboard)/edges/client-roadmaps/page.tsx:62` —
  `companyOs.from("ai_programs").select("id, name").eq("company_id", selected.id)`.
- Admin: `app/admin/(dashboard)/revenue/companies/[id]/page.tsx:224` — same, per company.
- Admin: `app/admin/(dashboard)/revenue/companies/documents-actions.ts:33` — reads
  `ai_programs` when attaching a doc.
- `app/admin/(dashboard)/edges/edges-shared.ts:16,31` — `BUSINESS_LINES` includes
  `"ai_programs"` (label "AI Programs") — a business-line enum, not a per-program surface.

**Existing AI Programs surfaces:**
- Portal (client-facing): `app/portal/(dashboard)/programs/**` (list `/portal/programs`,
  detail `/portal/programs/[id]`, add flows `add/plan`, `add/upload`). Nav item
  "AI Programs" → `/portal/programs` (`components/portal/PortalSidebar.tsx:48`).
- Admin: **no dedicated per-program admin page.** AI programs surface only inside
  `edges/client-roadmaps` and `revenue/companies/[id]` (as a name list) — there is no
  `/admin/.../ai-programs` CRUD route.
- `app/ai-programs/` is a **public marketing page** (`layout.tsx`, `page.tsx`,
  `opengraph-image.tsx`) — unrelated to portal data.

---

## 7. `app/portal` route/layout structure + how nav links are added

Two route groups:
```
app/portal/(auth)/     login, callback, change-password        (public/auth, outside dashboard shell)
app/portal/(dashboard)/                                        (all behind requirePortalMember)
  actions.ts           signOut / endAssumeSession
  layout.tsx           gate + entitlements + <PortalSidebar>   (app/portal/(dashboard)/layout.tsx)
  loading.tsx, page.tsx (Overview / home)
  company/  documents/  events/  hub/  invoices/  meetings/
  profile/  programs/ (+ [id], add/plan, add/upload)  referrals/
  requests/ (+ [id], new, hire)  roadmap/ (components only, no page)
  team/  time-off/  tokens/  users/
```

**How nav links are added — two steps:**
1. **Entitlement (server):** `app/portal/(dashboard)/layout.tsx:43-55` builds an
   `entitlements` object (booleans) and passes it to `<PortalSidebar entitlements={...}>`.
   Each boolean is a "does this company have X" check (e.g. `roadmap: hasBacklogResult`,
   `board: hasBoardResult`, `users/companyProfile: adminCompanyScope(actor).length > 0`).
   Add a new key here to gate a new module.
2. **Nav entry (client):** `components/portal/PortalSidebar.tsx` — the `NAV` array
   (`:34-81`) holds `NavGroup`→`NavItem` ({ label, href, ico, built?, entitlementKey? }).
   A link renders **live** only when `built === true` AND (no `entitlementKey` OR
   `entitlements[key]` is true); otherwise it renders as a muted "soon" placeholder
   (`isEnabled`, `:125-126`). Items with no `entitlementKey` (Overview, Client Hub,
   AI Programs, Requests, Personal Profile, My Events, Referrals) are always live once
   `built`. The `PortalEntitlements` type is declared in the sidebar (`:14-23`) and must
   stay in sync with the layout's object.
   > There is currently **no "Tokens" nav item** in `NAV`, even though
   > `/portal/tokens` exists — the tokens page is reachable only by direct URL / from
   > checkout redirects today. A new HTT nav link must be added to this array (and, if
   > gated, a matching entitlement key in both the type and the layout).

---

## 8. Existing `/portal/tokens` (human-token packs) — read before rebuilding

- Page: `app/portal/(dashboard)/tokens/page.tsx` — `requirePortalMember()` then
  `getTokenBalance(actor)`; renders balance + purchase list + `<TokenPurchaseCard>`.
- Action: `app/portal/(dashboard)/tokens/actions.ts` — `purchaseTokenPacks(packs)`:
  inserts pending `token_purchases` + `orders`, creates a Stripe Checkout session, blocks
  purchases in Assume mode. `company_id = actor.companyScope[0]` (`actions.ts:25`).
- Data: `lib/portal/tokens.ts` — `getTokenBalance(actor)` reads `token_purchases`
  **directly** (NOT via portalRead): `companyOs.from("token_purchases")
  .select(...).in("company_id", actor.companyScope)` (`tokens.ts:33-37`). Constants:
  `PACK_TOKENS=40`, `PACK_PRICE_CENTS=200_000` ($2,000), `MAX_PACKS=4`. 1 token = 1 hour
  of skilled work. Balance = sum of `status="paid"` tokens; pending = `status="pending"`.
- `tasks.human_tokens` (admin-set, `boards/[slug]/actions.ts:598`) is the consumption
  side — no draw-down against purchases is wired yet (`lib/portal/tokens.ts:4-5`).
  This is the likely seam for a Human Token Tracker.
