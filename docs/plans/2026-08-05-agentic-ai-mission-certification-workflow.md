# Agentic AI — Mission & Certification Workflows (A01–A06)

**Track:** Agentic AI for Business · AI Officer Institute
**Scope:** AI Officer learner · courses A01–A06
**Source of truth:** `aiolabz-prompt-registry` (mission prompts + rubrics) · `aio-lab-be` (certification trigger)
**Published page:** `/workflows/private/aio-labs/agentic-ai-workflows.html` (access-code gated)
**Prepared:** 5 August 2026 · from the mission registry
**Status:** All six missions live and AI-graded. One open decision (A06 retake path).

> This is a detected map of what runs today, written for internal review. Confirm any behaviour
> against the code before relying on it.

---

## The idea in one line

The Agentic AI track is **six missions**. The learner builds **one workflow of their own** the whole
way through — from a funded plan to a live agent running in production — and the platform grades every
step and issues the credential on its own. There is **no separate capstone**: mission six *is* the
production ship.

## The six missions

| # | Code | Mission | Builds | Artifact |
|---|------|---------|--------|----------|
| 1 | A01 | AI Program Planning | One workflow planned through the 5 Ds | **AI Program Brief** |
| 2 | A02 | From Prompts to Packaged AI | A RACE system prompt that kills the setup tax | **Packaged AI Spec** |
| 3 | A03 | Wire the Workflow | Trigger → data → AI step → action → log, in one line | **Wired Workflow Document** |
| 4 | A04 | Teach Your Workflow to Decide | A classify-route-respond logic layer | **AI Program Logic Layer** |
| 5 | A05 | Unleash the Agent | Mission, brain, tools, memory, guardrails | **Agent Launch Brief** |
| 6 | A06 | From Prototype to Production | A real page shipped live (Claude → GitHub → Vercel) | **Shipping Map** (live `vercel.app`) |

Each artifact feeds the next — plan → package → wire → decide → agent → ship.

## How one mission runs (the shared loop)

All six missions follow the same five steps; only the task changes.

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

The credential certifies something that **exists**. When all six missions are mastered — the last one a
real page live on the internet — a database trigger issues the certificate. The record and the
certificate can never disagree, because one trigger checking all six courses is the only writer.

1. **Master all six missions.** Certification requires every published Agentic AI course (`A01`–`A06`)
   complete. A course completes when its one final-project activity passes. No partial credit.
2. **Mission 6 is the production ship.** A06 deploys a real page to a live `vercel.app` address — there
   is no separate capstone course to unlock.
3. **The final project is graded** for completeness against its rubric — fully AI, no human. Result:
   `pass` or below-pass. An admin `force_complete` override exists for edge cases but clears the same bar.
4. **The trigger checks all six courses.** On any final-project pass, `trg_award_certification` asks
   `v_certification_progress` whether every published course in the certification is complete. Completion
   is **derived, never stored** — so the check is always live.
5. **The certificate is issued.** When all six are complete, the trigger writes `earned_certification`
   (`on conflict do nothing`, so it never double-issues) and the Agentic AI badge appears.

**Why it holds:** completion is derived from the assessments, not stored as a flag, and one trigger over
all six courses is the single writer of the credential — so the certificate and the record stay in sync.

## To refine — open questions

- **A06 retake path.** Missions A01–A05 have a clean pass / Retake loop. A06 runs in a live
  instructor-led session and touches real GitHub and Vercel accounts, so a below-pass is messier to
  retake cleanly. Decide whether A06 uses the same locked fail → Retake loop or a session-based recovery.
- **Prerequisite ordering.** Each mission's artifact feeds the next, so the intended path is strictly
  sequential. Confirm whether the platform should hard-lock that order, or let an experienced learner
  start mid-track and lose the carry-forward.

## References

- Mission prompts + rubrics: `aiolabz-prompt-registry/prompts/ai-officer/agentic-ai/a01`…`a06`
- Certification trigger: `aio-lab-be/supabase/migrations/20260701120700_v2_views.sql`
  (`award_certification()` / `trg_award_certification`, views `v_course_progress` +
  `v_certification_progress`)
