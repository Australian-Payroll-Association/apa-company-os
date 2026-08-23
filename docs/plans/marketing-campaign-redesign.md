# Marketing Campaign redesign — development plan

**Status:** proposed (not started)
**Branch/worktree:** `marketing-campaign-redesign`
**Date:** 2026-08-23

## Problem

Today "campaign" means one email send (`email_campaigns`). The founder's mental model
is the opposite: a **Campaign is the idea**, voiced by the founder, carrying a goal, a
launch schedule, a content pillar, and an SEO/GEO plan. That idea spawns **assets per
channel** (Blog, Email, LinkedIn, Facebook). The calendar shows when posts go out; the
workboard shows how far each asset is built; one report rolls the whole thing up.

Wireframe (7 screens): https://claude.ai/code/artifact/1617af12-3b81-436c-825b-19397f5efb53

## Target model

```
marketing_campaigns (NEW umbrella = the founder's idea)
  goal · dates · pillar · SEO/GEO plan · brand · status
      │
      ├── marketing_calendar entries (assets per channel: blog/email/linkedin/facebook)
      │       calendar = when they go out · workboard = build stage
      │
      └── email_campaigns  →  renamed "Broadcast" in UI (send + suppression engine)
```

Naming resolved:
- `Campaign` = new umbrella (`marketing_campaigns`).
- `Broadcast` = promoted email object. Table `email_campaigns` keeps its name; UI + routes rebrand.
- `marketing_calendar.campaign_id` → renamed `broadcast_id`; new `campaign_id` → `marketing_campaigns`.

## Working method

Per repo ship-flow: worktree from `origin/main`, one stacked PR per phase, stage files by
name, run `npm run check:design` + `tsc` + `next build` before each PR (no dev server),
Dave merges when CI is green. Retarget each stacked PR to `main` before its base branch is
deleted (stacked-PR gotcha). Verify schema with rolled-back probe inserts; add explicit
service_role grants on every new table/function.

## Key findings from code inventory

- **No per-entry copy generator exists.** Copy comes from the `draftWithAI` action →
  `writeForBrand()` (`lib/ai/brand-writer.ts`), which regenerates the whole brand channel
  set from the brand profile and ignores the entry's own fields. Screen 7's text
  regenerate needs a NEW `generateEntryCopy(entryId, promptOverride?)`, symmetric to
  `generateEntryImage`.
- **Image prompt is hidden.** `buildPrompt()` lives inside `generateEntryImage`
  (`lib/ai/brand-image.ts`); it must be split so the assembled prompt can be shown/edited.
- **No image history.** `marketing_calendar.image_url` is a single column; regenerate
  overwrites. Needs a versions table.
- **Cleanup targets** (fold in as we build): duplicated suppression gates
  (`passesSuppression`/`BLOCKED_PERSONAS` vs `isEligible`/`NON_MARKETING_PERSONAS`), two
  draft-email creation paths (`createCampaignFromEntry` + `draftWithAI` email branch),
  orphaned `image_type` field, `repurposeEntry`/`draftWithAI` overlap, double
  `revalidatePath` in `brands/actions.ts`.

## Phases (stacked PRs)

### PR 1 — Schema + read/write foundation
New:
- Migration: `marketing_campaigns` (id, brand_id, pillar_id, name, objective, starts_on,
  ends_on, seo_geo_md, status, created_by, created_at) + `marketing_asset_images`
  (id, entry_id→marketing_calendar, url, prompt_used, model, is_selected, created_by,
  created_at) + service_role grants.
- Migration: `rename column campaign_id to broadcast_id` on `marketing_calendar`; add new
  nullable `campaign_id` → `marketing_campaigns`.
- Migration: backfill existing `image_url` into `marketing_asset_images` as selected v1.
- `lib/admin/marketing-campaigns.ts` (umbrella reads/stats), `lib/admin/marketing-images.ts`
  (`listAssetImages`, `setSelectedImage`).

Removed/changed:
- `marketing-calendar.ts`: `mapEntry`/`ENTRY_SELECT`/`getPillarPerformance` switch
  `campaign_id → broadcast_id`; fix embed hint `email_campaigns!broadcast_id(status)`.
- `brand-image.ts`: insert a version row + flip `is_selected` instead of only writing
  `image_url` (keep `image_url` mirroring the selected row so downstream keeps working).

Verify: rolled-back probe inserts; `tsc`; `next build`.

### PR 2 — Broadcast rebrand + de-dup (cleanup-heavy)
New: move `campaigns/` email pages → `broadcasts/`; rename components/strings; update
`AdminSidebar.tsx`.
Removed: consolidate suppression to one source; collapse the two draft-email creation
paths; fix double `revalidatePath`; retire old email-only `/campaigns` route.

### PR 3 — Campaign umbrella: index + detail hub (wireframe screens 1–2)
New: `/campaigns` idea list + `NewCampaignForm`; `/campaigns/[id]` hub (header:
goal/dates/pillar/SEO-GEO + "Assets by channel" tab); assign asset → campaign.

### PR 4 — Workboard + Calendar tabs + pillar rollup (screens 3–4)
New: reuse `CalendarBoard`/`CalendarMonth` in the hub filtered by `campaign_id`; add a
Campaign filter to the global calendar.
Changed: `getPillarPerformance` rolls up per-campaign, not per-email.

### PR 5 — Content detail page (screen 6)
New: `/campaigns/[id]/assets/[assetId]` — rendered `copy_md` panel + image-versions panel
(thumbnails, select/upload).
Removed: wire or remove orphaned `image_type` (skip AI for "Real photo").

### PR 6 — Editable-prompt regenerate (screen 7)
New: split `buildPrompt` → `buildEntryImagePrompt(entryId)` + `generateEntryImage(entryId,
promptOverride?)`; build `generateEntryCopy` + `buildEntryCopyPrompt`; regenerate modal
(image + text) that shows the prompt, edits it, and appends a new version (never overwrite).
Removed: consolidate `repurposeEntry` / `draftWithAI` overlap.

## Cleanup ledger

| Cleanup | Lands in |
|---|---|
| Duplicate suppression gates + persona lists | PR 2 |
| Two draft-email creation paths | PR 2 |
| Double `revalidatePath` | PR 2 |
| Old email-only `/campaigns` route | PR 2–3 |
| Per-email-only pillar performance | PR 4 |
| Orphaned `image_type` | PR 5 |
| `repurposeEntry` / `draftWithAI` overlap | PR 6 |
| Single `image_url` (no history) | PR 1 |

## Sequencing & risk

- PR 1 is the sharp edge: the `campaign_id → broadcast_id` rename must land with the
  `marketing-calendar.ts` + `brand-image.ts` changes in the same PR, or the calendar
  breaks. Everything after is additive.
- PRs 3–6 are stacked (each depends on the prior). PR 2 is independent of PR 1.

## Assumptions

- Broadcasts live at their own `/broadcasts` route, not nested under a campaign.
- A calendar asset can exist without a campaign (nullable link), so nothing breaks day one.
