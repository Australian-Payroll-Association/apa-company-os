# Ideas that Spark Solutions — learnings alongside build ideas

**Date:** 2026-07-29 · **Requested by:** Dave, during the onboarding deck update.
The deck's closing slide asks two questions and points to edge8.ai/team/ideas:
"What should we build?" and "What have I learned?" (the Learn and Share core value).

## Decisions (confirmed with Dave 2026-07-29)

| Question | Decision |
|---|---|
| Learning flow | Lighter flow with a light AI touch: title + what happened + takeaway (one card, voice dictation kept). Claude writes a brief polished summary, not a 5D product plan. |
| Surfacing | One "Ideas that Spark Solutions" area at /team/ideas with two sections: **Learnings** and **Plans**. |
| Visibility | Both sections are team-wide: everyone sees everyone's learnings AND build ideas + their plans. Archived entries drop off the feed (still visible to their submitter). |
| Admin | Learnings appear in /admin/innovation/ideas behind a Type filter. They skip approve/decline triage — the shelf offers Archive/Unarchive only. |

## What changed

- **Schema** (`supabase/migrations/20260729120000_ideas_learnings.sql`): `ideas.kind`
  ('build' default | 'learning'), new `story` + `takeaway` columns, the four 5D
  columns made nullable (per-kind requirements enforced in the server actions).
  `ai_plan` is reused for the learning's polished summary.
- **AI** (`lib/ai/idea-plan.ts`): `generateIdeaPlan` branches on kind. Learnings get
  a light editor prompt (keep first-person voice, bold takeaway line, "What
  happened", "Try it yourself", under 150 words) with the same office
  classification and failure handling; admin retry works unchanged.
- **Team** (`app/team/(dashboard)/ideas/`): list page is now the shared
  "Ideas that Spark Solutions" feed with Learnings/Plans tabs; `/team/ideas/new`
  is a chooser between the 5D wizard and the new one-card `LearningForm`
  (dictation extracted to `useDictation.ts`); the detail page is company-visible
  via `getSharedIdeas`/`getSharedIdea` in `lib/team/data.ts` (purpose-built
  company-visible reads, same pattern as `getDirectory`).
- **Admin** (`app/admin/(dashboard)/innovation/ideas/`): Type column + filter,
  search covers story/takeaway, shelf branches per kind.
- **Assistants:** ideas table descriptions updated in `lib/team-chat/schema.ts`
  and `lib/admin-chat/schema.ts`.

## Out of scope (this slice)

- Reactions/comments on learnings, a digest email, tagging beyond the office
  badge, and surfacing learnings on the /team home feed.
