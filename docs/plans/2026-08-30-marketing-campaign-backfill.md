# Marketing campaign backfill — 2026-08-30

**Branch:** `feat/marketing-campaign-backfill` (worktree from `origin/main`)
**Goal:** every published blog rolls up to a Campaign. No schema change — the
Campaign → asset → image model already exists (`marketing_campaigns` →
`marketing_content` → `marketing_asset_images`). This is data backfill + one
small UI addition (friendly URLs).

Rule (corrected): a Campaign has 1-to-many assets; usually one blog but not
mandatory. The missing part is that **no blog asset should be orphaned** — each
must have a `campaign_id`.

## Current state (live DB, project `wwchefrgkkxmhlkntufm`)

| Table | Rows |
|---|---|
| `marketing_campaigns` | 11 (edge8 6, ai-officer 5) |
| `marketing_content` (assets) | 111 — blog 80, email 11, linkedin 10, facebook 10 |
| `marketing_asset_images` | 131 |

- Blog assets by brand: **edge8 75, ai-officer 5**.
- **69 edge8 blog rows have `campaign_id = null`** (the orphans). All AIO rows already linked.
- AIO published posts live on ai-officer.com: **33**, served as **static HTML** in
  `aio-website/public/post/*.html`. Only ~1 (`leadership-in-the-ai-era`) is also in
  the DB. So ~32 AIO posts are not in `marketing_content` at all.

## Decisions (from Dave, 2026-08-30)

- Scope: **Edge8 orphans + ingest AIO**.
- Granularity: **one campaign per orphan blog** (name from blog title, dates from publish date).

## Phase 1 — Edge8 orphan blogs → campaigns  (in-DB, reversible)

For each of the 69 edge8 `marketing_content` rows where `channel='blog'` and
`campaign_id is null`:
1. Insert a `marketing_campaigns` row: `brand_id = edge8`, `name = content.title`,
   `pillar_id = content.pillar_id`, `starts_on = ends_on = content.publish_date`,
   `status = 'done'` (they are published), `objective = null`, `seo_geo_md = null`.
2. Set `content.campaign_id` to the new campaign id.

Idempotent: skip any blog that already has a `campaign_id`. Reversible: the created
campaigns are tagged (e.g. `created_by = 'backfill-2026-08-30'`) so they can be
unlinked/deleted as a set.

## Phase 2 — AIO blog goes DB-driven  (confirmed scope, spans 3 repos)

**Decisions (Dave, 2026-08-30):**
- Make the sites **DB-driven** (retire static files); this is the PR #890 endgame.
- **One brand, two domains.** ai-officer.com is the AIO blog; **aiolabz.com renders
  the same AIO blog** for students in certification. Ingest the corpus **once** under
  `brand = ai-officer`; both sites read those same rows. Do not create a separate brand
  and do not double-create campaigns.

**Current state of the corpus:**
- `aio-website/public/post/*.html` — 33 static posts (ai-officer.com).
- `aio-labz-fe/content/blog/posts/*.html` — 31 static posts, **same slugs** (aiolabz.com).
- Neither reads the DB. Clean `<head>` metadata (title, description, og:image,
  JSON-LD `datePublished`, canonical slug); FAQ present as `faq-item` blocks; **no
  `<article>`/`<main>` wrapper and no category** in metadata — body extraction + category
  need real handling, not a one-line regex.

### 2a — Ingest corpus into the DB  (edge8-web / this worktree)
Idempotent by slug (skip existing; dedupes ~1 overlap). Per post → one
`marketing_content` row (`brand=ai-officer`, `channel='blog'`, `status='published'`,
`slug`, `posted_url`, `title_tag`, `meta_description`, `excerpt`, `image_url`,
`publish_date`, `body_html` = article HTML, `copy_md` if cleanly derivable) + one
`marketing_campaigns` (same pattern/tag as Phase 1). Dry-run → eyeball → commit.

Open impl questions for 2a:
- **Body capture:** store `body_html` verbatim (fidelity, FAQ/figures survive) vs
  convert to `copy_md`. Lean `body_html`, since readers will render it.
- **Category:** not in the static metadata. Default `pillar_id = null`, or derive later.
- **Images:** reference existing `ai-officer.com/images/...` paths (fast, already public)
  vs re-host in the Supabase `marketing` bucket. Lean reference for v1.

### 2b — ai-officer.com reads from DB  (aio-website repo, own PR)
Per PR #890 brief: `lib/blog.ts` (`getAllPublishedPosts`/`getUnifiedPostBySlug`,
`unstable_cache`, brand-scoped `brands.slug='ai-officer'`), `renderPostMarkdown`/
`extractFaq`, `/blog` + `/post/[slug]` SSG, FAQPage JSON-LD, remove the static files +
307s. Then flip `ai-officer` → `blogEnabled: true` in `lib/marketing/brand-sites.ts`
(edge8-web) only once the reader is live.

### 2c — aiolabz.com reads the same AIO rows  (aio-labz-fe repo, own PR)
Replace the local `getAllContentFiles(BLOG_POSTS_SUBDIR)` loader in
`src/app/(dashboard)/blog/**` with the same brand-scoped DB reader (`ai-officer` rows),
matching aiolabz's own layout. Retire `content/blog/posts/*.html`.

**Sequencing:** 2a first (foundation both readers depend on). 2b and 2c are independent
of each other once 2a lands; each is a focused PR in its own repo (load
`karpathy-guidelines` before writing the readers). `blogEnabled` flip is the last step.

## Phase 3 — Friendly campaign URLs `/E/1`, `/A/1`  (small UI + data)

1. Add a one-char `code` to `company_os.brands` (`edge8 → E`, `ai-officer → A`).
2. Add a persisted per-brand sequence `campaign_no int` to `marketing_campaigns`,
   assigned in **publish-date-ascending** order (oldest = 1), unique per brand, so
   existing numbers never shift as new campaigns are added.
3. New route `app/admin/(dashboard)/revenue/marketing/campaigns/[brand]/[no]/page.tsx`
   that resolves `(brand code, campaign_no)` → the campaign UUID and renders the
   existing `CampaignHub`. Keep UUID as PK; optionally 301 the UUID path to the
   friendly one.

## Order & risk

- Phase 1 first (smallest, all data present, trivially reversible).
- Phase 2 next (content ingest — the bulk of the effort and the only fidelity risk).
- Phase 3 last (additive route + two columns).
- All writes go to the live `company_os` schema via the service key; run each phase
  as an idempotent script under `scripts/`, dry-run (print) first, then commit.
