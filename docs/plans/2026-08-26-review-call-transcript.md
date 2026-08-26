# Add a call transcript to a performance review

Let a manager attach a call transcript to a performance review, have Claude summarize it, and fold the approved summary into the overall review as a labeled section.

Target page: `/team/reviews/[id]` (file: `app/team/(dashboard)/reviews/[id]/page.tsx`), which was display only.

## Reuse (no new tables)

- Transcript storage mirrors `lib/coaching/transcript.ts`: a `company_os.meetings` row + a `company_os.call_transcripts` upsert, keyed to the review via `meetings.metadata.performance_review_id` and `source='review'`.
- Summarization mirrors `lib/ai/meeting-summary.ts` / `lib/coaching/ai.ts`: transcript in, structured JSON out, Claude `claude-opus-4-8`, fail-soft.
- The summary lives in `company_os.performance_reviews.metadata.transcript_summary` (existing `metadata jsonb`, no migration).
- Authorization reuses `getReviewDetail` (reviewer only, locked once finalized).

## Lark Minutes note

Prod has no Lark app creds, so a live server-side Minutes pull will not work in the deployed app. PR 1 ships paste + file upload. Pulling from Lark natively is a later PR, gated on server-side Lark creds. (An operator with `lark-cli` can pull a transcript and paste/upload it in the meantime.)

## PR 1 (shipped, #925)

Attach a transcript (paste or `.txt`/`.vtt`/`.srt`/`.md`/`.docx` upload), store it linked to the review, run Claude to produce a structured draft summary (overview, strengths, growth areas, per-dimension signals). Shown as a draft card. Nothing folded into the narrative yet.

Follow-up fix (#926): `company_os.meetings` granted `service_role` SELECT only, so creating the review meeting failed. Granted `service_role` write, in line with `call_transcripts` / `meeting_notes`.

## PR 2 (shipped)

Fold the approved summary into the overall review. The reviewer edits the AI-generated "From call" text, then folds it in (or retracts it). Non-destructive: stored on `metadata.transcript_summary` (`included` + `final_markdown`) and rendered as its own "From call" section, so the manager's written narrative is never overwritten. Visible to the subject once the review is finalized (same visibility as manager content). Replacing the transcript retracts any folded-in section.

## Later (separate PR, gated on creds)

- Lark Minutes picker: search and pull a meeting transcript server-side. Needs prod Lark app creds first.
