# AI Engineer Onboarding Plan

**Name:** Ly Doan Van Anh (Anh)
**Companies:** Edge8 Co. | AI Officer Institute (AIO)
**Role:** AI Engineer
**Manager:** Dave Hajdu
**Start date:** Tuesday 28 July 2026
**Plan horizon:** 60 days, ending Friday 25 September 2026

---

## Overview

Anh joins the aiolabz.com team as an engineer. She takes assigned tasks and runs with them, alongside everyone else. Nghiem Cam Viet Ha starts the same day on the design side of the same product, so the two of them are peers on one codebase, not on separate tracks.

**She ships every day.** That is the job from the first week, and it is the thing this plan is measured on. Not a capstone, not a graduation project, not a build that goes live in week eight. Daily commits into a live product, reviewed and merged like anyone else's.

Two things run alongside the work and never gate it:

- **The 18 protocols**, which are how this team operates.
- **Two certifications**, AI Engineer (E01 to E08) and AI Officer (A01 to A06, G01 to G04). Eighteen courses.

The courses are emphasis. They give her the language and the structure for what she is already doing on the product. Their deliverables are documents, not software. If a course slips a week because a real task needed her, that is the correct trade every time. If shipping slips because of a course, something has gone wrong.

**One rule above all others, from day one:** she never pushes to `main`. Every change is a branch and a pull request. This is Protocol 05, and it is the line between an engineer who can be trusted in a production repo and one who cannot.

**Second rule:** no secrets in code. Not in a commit, not in a comment, not in a test file. E04 and E05 each end with a `grep` that must come back empty, and that check exists because this is the mistake that costs real money.

---

## The product

**aiolabz.com** is where all of her work lands.

- `aio-labz-fe` is Next.js 16 App Router, React 19, TypeScript strict, Tailwind 4, Radix, Zustand and React Query, Supabase SSR, on Vercel. There is a documented design system at `docs/engineering/features/design-system/AIO_LAB_DESIGN_SYSTEM_TW4.md`.
- `aio-labz-be` is a separate FastAPI service in Python.

She should know on day one that these are two repos in two languages, because the certification missions are written against the Next.js and Supabase path and will not map cleanly onto the Python service.

There is a loop worth naming: she takes both certifications **on the product she is building**. Every rough edge she hits as a student is a bug she is allowed to file. That perspective expires the moment she stops being a beginner, so she should write things down while they still annoy her.

**Timing note.** The AustPayroll AI Retreat week runs from Monday 27 July, so she starts on day two of it. She is not expected to contribute. Sitting in where useful is worth more than it looks, because the retreat deck is the 18 protocols and seeing them delivered to a paying client is the fastest way to understand why they matter.

---

## How the work runs

This is the whole operating rhythm. It starts in week one and does not change for the 60 days.

| Cadence | What |
|---|---|
| Daily | Check-in posted. Tasks picked up from the team's queue, same as everyone |
| Daily | Something ships. A pull request opened, reviewed, merged |
| Every pull request | Branch off `main`, Vercel preview link included, reviewed before merge. Never straight to `main` |
| Weekly | 1-1 with Dave. What shipped, what is blocked, what she proposes next |
| Weekly | One or two courses completed, per the schedule below |
| Blocked more than an hour | Ask. Protocol 15 covers how to bring a problem to an engineer so it takes minutes instead of days |

The support is heavy in the first fortnight and tapers. What does not change is the cadence. Early tasks are small and someone reviews closely; later tasks are larger and the review is lighter. The daily ship is constant throughout.

---

## Week 1: Access, then straight into the queue
**Tuesday 28 July to Friday 1 August**

The only week that needs spelling out day by day, because it is the only one with setup in it.

### Tuesday: access and environment

- [ ] edge8.ai email account and Lark
- [ ] GitHub account added to the `talentedgeai` organization, with write access to `aio-labz-fe` and `aio-labz-be`
- [ ] Vercel account with access to the AIO Labz projects
- [ ] Supabase access on the AIO Labz project
- [ ] Claude Code installed and signed in
- [ ] Student seat on [aiolabz.com](https://aiolabz.com). A Basic seat grants both the AI Officer and AI Engineer series, so this is one action, not two
- [ ] Team portal login at [https://www.edge8.ai/team](https://www.edge8.ai/team), then the onboarding survey. It populates her profile, so it is worth doing properly
- [ ] Both repos cloned and running locally
- [ ] Read this document, bring questions to the first 1-1
- [ ] Weekly 1-1 with Dave as a recurring slot

**The stack in one sitting.** Read Protocol 02, then have Claude explain each tool against `aio-labz-fe` specifically rather than in the abstract:

| Tool | What it does | Where she meets it |
|---|---|---|
| Claude | Writes and changes the code, and explains anything she does not understand | Claude Code in her terminal, pointed at the repo |
| GitHub | Stores the code and every change to it. Branches and pull requests | `talentedgeai/aio-labz-fe` and `aio-labz-be` |
| Vercel | Takes what is in GitHub and puts it on the internet | Preview URL on every pull request, production on merge |
| Supabase | Remembers things. Users, progress, content. Postgres with row level security | The data behind everything she builds |

### Wednesday: first ship

- [ ] With Vũ Trần Minh or a nominated engineer beside her: branch, small change, push, pull request, Vercel preview, review, merge
- [ ] The change itself does not matter. The loop is the deliverable, and she runs it again unaided the same afternoon

### Thursday and Friday: the real queue

- [ ] Assigned tasks from the aiolabz.com queue, same as everyone else
- [ ] Something merged each day

By Friday the daily rhythm is the rhythm. Everything after this week is that, plus the course schedule.

---

## The learning track

Eighteen courses over nine weeks. Two a week, taken alongside the work. Protocols are paired to the week where they are most useful.

| Week | Dates | Courses | Protocols |
|---|---|---|---|
| 1 | 28 Jul to 1 Aug | E01 Enter the AI Engineer, E02 Command the Harness | 01 to 04 (Mindset), 05 to 07 (Infrastructure) |
| 2 | 4 to 8 Aug | E03 Design the System, A01 AI Program Planning | 08 Design systems, 09 Workflow design |
| 3 | 11 to 15 Aug | E04 Wire the Stack, A02 Prompts to Packaged AI | 10 Communications, 11 Admin interfaces |
| 4 | 18 to 22 Aug | E05 Integrate Comms, A03 Wire the Workflow | 12 to 14 (Product Management) |
| 5 | 25 to 29 Aug | E06 Show and Validate, E07 Scale and Harden, A04 Decision layer | 15 Working with an engineer, 16 User roles |
| 6 | 1 to 5 Sep | E08 Ship and Revisit, A05 Unleash the Agent | 17 AI vs human testing, 18 Handoff |
| 7 | 8 to 12 Sep | A06 Prototype to Production, G01 Enter the AI Officer | — |
| 8 | 15 to 19 Sep | G02 Clean Data, G03 Advanced Prompt Frameworks | — |
| 9 | 22 to 25 Sep | G04 Prompting Perfect Visuals | — |

**Milestones.** All 18 protocols by end of week 6. AI Engineer certification (E01 to E08) end of week 6. Agentic track (A01 to A06) end of week 7. AI Officer certification end of week 9.

Weeks 1 and 5 are the heavy ones. E02 is the single biggest course in the set and it lands in the same week as setup, which is deliberate: it is where the 18 protocols and the 8-agent team come from, and both are more useful early than late.

### What the course deliverables are about

Every mission produces an HTML document. **Point them at aiolabz.com and at her own real work**, not at an invented side project. The E track is written to carry one subject through all eight missions, and the subject should be whatever part of the product she is closest to.

- E01 `system-map.html` maps a real area of aiolabz.com: actors, flows, boundaries, seams
- E03 `architecture.html` documents decisions in that area, including ones already made before she arrived, and what the alternatives were
- E04 `integration-proof.html` is paste-driven proof against real schema, real row level security policies, real endpoints. Row level security is the one to slow down on, because it is the difference between a database that is private and one that only looks private
- E05 `comms-brief.html` covers the product's transactional and outreach email. **Use her own free-tier Resend and Brevo accounts for the coursework, never production keys.** A test broadcast fired at a real contact list is not a recoverable mistake
- E06 is a conversation. She walks Dave or the team through what she has shipped, in plain language, and takes the feedback
- E07 `scale-report.html` and E08 `runbook.html` cover a real part of the product she has worked in, written so someone else could operate it

The A track workflow she picks in A01 carries through A02 to A06. It should come out of her actual work for the same reason.

**One content defect she will hit in week 2.** The E-track folders have numbering drift. `e03-design-the-system` is titled "AE04" internally and asks for a `prd.html` from an "AE03" mission that has no folder; `e04` and `e05` are off by one the same way; `e06` reuses the AE06 number; there is a stray `e01-think-in-systems` folder containing only a prompt; and `ai-engineer-4-week-plan.html` names the eight courses differently again. The deliverable chain still works end to end. She should be told up front so she does not go hunting for a mission that does not exist, and she should log what she hits, because she is the first person to run this track from a standing start.

---

## Checkpoints

| Point | Date | What happens |
|---|---|---|
| Day 8 | Tuesday 5 August | Check-in survey goes out automatically. Dave reads the response before that week's 1-1 |
| Day 45 | Thursday 10 September | Dave should have a clear view by now, not on day 59 |
| Day 60 | Friday 25 September | Contract decision |

---

## Day 60 review: Friday 25 September

| Area | What good looks like at day 60 |
|---|---|
| **Cadence** | Shipping every day. Takes a task, runs with it, merges it. The queue moves because she is on it |
| **Independence** | Picks up an assigned task and delivers without someone sitting beside her. Knows when to ask, and asks early |
| **Stack** | Claude Code, GitHub and Vercel unsupervised. Writes Supabase migrations and row level security policies, not just reads tables |
| **Team** | Reviews other people's pull requests. Runs the 8-agent harness and delegates to it rather than doing everything by hand |
| **Certification** | E01 to E08, A01 to A06, G01 to G04 complete |

The honest bar: **is the team faster with her on it than without her?** That is a question about throughput over 60 days, not about any single piece of work. If the answer is yes, this works.

---

## Key contacts

| Person | Role | Notes |
|---|---|---|
| Dave Hajdu | CEO, Edge8 and AIO | Manager. Weekly 1-1 |
| Vũ Trần Minh | Principal Engineer | Code review and unblocking. See Protocol 15 for how to use an engineer well |
| Nghiem Cam Viet Ha | UX Designer / Developer | Starts the same day, same product. Her counterpart on the design side |
| Khoa Doan, Lê Vinh, Ngoc Le | AI Engineers | Her peer group. They have run this stack already |
| Quan Chau | Senior Consultant | Runs the Infinite Leverage retreat content |
| Đặng Phương Mai | Technical Recruiter | Contract, payroll and HR questions |

---

## Resources

| Resource | Where |
|---|---|
| The 18 protocols | `content-studio/infinite-leverage-retreat/protocols/` |
| AI Engineer certification (E01 to E08) | `content-studio/educational-content/ai-engineer-certification/`, taken at [https://aiolabz.com](https://aiolabz.com) |
| AI Officer certification (A01 to A06, G01 to G04) | `content-studio/educational-content/ai-officer-certification/`, taken at [https://aiolabz.com](https://aiolabz.com) |
| AIO design system | `aio-labz-fe`, `docs/engineering/features/design-system/AIO_LAB_DESIGN_SYSTEM_TW4.md` |
| 8-agent template | `talentedgeai/infiniteleverage-8-agents-template`, cloned in E02 |
| Team portal | [https://www.edge8.ai/team](https://www.edge8.ai/team) |
| Edge8 core values | `docs/product/product.md`, "How we work" |

---

## Open items for Dave before day one

- [ ] Confirm the spelling of her name including diacritics. The team record reads "Ly Doan Van Anh" with none, and confirm she goes by Anh
- [ ] Set her position on her team member record. It is currently empty, so she renders thin on the onboarding board. The `AI Engineer` position row already exists
- [ ] Nominate the engineer who sits with her for Wednesday's first pull request. Vũ Trần Minh is the obvious choice, subject to his load
- [ ] Make sure there are small, well-scoped tasks in the aiolabz.com queue waiting for Thursday. The daily cadence only starts on time if there is something to pick up
- [ ] Decide whether she attends any of the AustPayroll retreat week in person

---

*Last updated: 27 July 2026*
