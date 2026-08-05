# Gen AI — Mission & Certification Workflows (G01–G04)

**Track:** Generative AI Essentials · AI Officer Institute
**Scope:** AI Officer learner · courses G01–G04
**Source of truth:** `aiolabz-prompt-registry` (mission prompts + rubrics) · `aio-lab-be` (certification trigger)
**Published page:** `/workflows/private/aio-labs/gen-ai-workflows.html` (access-code gated)
**Prepared:** 5 August 2026 · from the mission registry
**Status:** Four missions live and AI-graded. One open decision (capstone fail path).

> This is a detected map of what runs today, written for internal review. Confirm any behaviour
> against the code before relying on it.

---

## The idea in one line

The Gen AI track is **four missions** plus a **capstone**. Each mission is a real challenge worked with
an AI Buddy, an artifact the platform captures on its own, and a grade card written by AI. Master all
four and ship the capstone, and the credential is issued automatically.

## The four missions

| # | Code | Mission | Builds | Artifact |
|---|------|---------|--------|----------|
| 1 | G01 | Enter the AI Officer | The AI Officer mindset | **Learning plan** |
| 2 | G02 | Clean Data, AI's Favorite Snack | A cleaning pass on the BOLT survey | **Survey Analysis Report** (HTML) |
| 3 | G03 | Advanced Prompt Frameworks | A business framework × a prompt framework (RACE/CRA) | **Go-to-market brief** (7 sections) |
| 4 | G04 | Prompting Perfect Visuals | Style DNA + structured prompts + templates | **Visual system** |

Each artifact builds on the last — mindset → data → brief → visuals.

## How one mission runs (the shared loop)

All four missions follow the same five steps; only the task changes.

1. **Open** the mission from Mission Control. *(Learner)*
2. **Work** the challenge with the AI Buddy in chat. *(Learner + AI)*
3. **Capture** — the deliverable is saved automatically; no file to save. *(Automatic)*
4. **Grade** — an AI grade card appears in the chat. *(AI)*
5. **Route** — pass unlocks the next mission; below-pass reveals **Retake**. *(Automatic)*

- **Pass** → the mission flips to `mastered`; the next unlocks; the pass is final and never re-graded.
- **Not yet** → a **Retake** button appears. A retake is graded fresh from the top — a new, independent
  grade, never an edit of the old attempt.

**AI grades everything** — there is no human grader and no manual save. The platform captures each
deliverable in-conversation and the AI writes the grade card the same way every time.

### The seven elements (applies to every mission)

| Element | Owner | What happens |
|---|---|---|
| 01 Trigger | Learner | Opens the mission from Mission Control. |
| 02 Inputs | Learner + AI | The course textbook, the rubric, and the learner's real work. |
| 03 Decision | AI | Grades the deliverable for completeness against the rubric. |
| 04 Routing | Automatic | Pass is final; below-pass reveals a Retake (a fresh, independent grade). |
| 05 Output | Learner | The mission's artifact, from the learner's real work. |
| 06 Delivery | Automatic | The grade card renders in chat; the mission flips to mastered. |
| 07 Measurement | AI + Automatic | Pass/fail, the score, and the number of retakes. |

## Certification (runs once per learner)

The credential certifies something that **exists**. When all four missions are mastered, the capstone
unlocks; the learner ships it to **production** (not slides), the AI grader passes it, and a database
trigger issues the certificate.

1. **Master all four missions.** Certification requires every published Gen AI course (`G01`–`G04`) at
   `mastered`. No partial credit — three of four is locked, not "almost certified."
2. **Capstone unlocks.** The instant `missionsCompleted === missionsTotal`, the capstone flips
   `locked → open` — on the fourth mastery, no one opens it by hand.
3. **Ship the capstone to production.** The final artifact deploys to production rather than a
   presentation. It builds on all four mission outputs.
4. **The capstone is graded** for completeness against its rubric — fully AI, no human. Result:
   `passed` or `failed`. An admin override exists for edge cases but clears the same bar.
5. **The trigger issues the certificate.** On pass, `trg_award_certification` checks all four courses,
   writes `earned_certification`, the program flips to `certified`, and the Gen AI badge appears.

**Why it holds:** one trigger, checking all four courses, is the single writer of the credential — so the
certificate and the record stay in sync.

## To refine — open question

- **Capstone retake.** Each mission has a clean pass / Retake loop. The capstone today is a soft resubmit
  (an overwrite warning), not a locked fail → Retake with defined attempts. Aligning the capstone to the
  same loop would make the whole track behave the same way end to end.

## References

- Mission prompts + rubrics: `aiolabz-prompt-registry/prompts/ai-officer/gen-ai/g01`…`g04`
- Certification trigger: `aio-lab-be/supabase/migrations/20260701120700_v2_views.sql`
  (`award_certification()` / `trg_award_certification`, views `v_course_progress` +
  `v_certification_progress`)
