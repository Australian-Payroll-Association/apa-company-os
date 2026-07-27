# UX Designer / Developer Onboarding Plan

**Name:** Nghiem Cam Viet Ha (Ha)
**Companies:** Edge8 Co. | AI Officer Institute (AIO)
**Role:** UX Designer / Developer
**Manager:** Dave Hajdu
**Start date:** Tuesday 28 July 2026
**Plan horizon:** 60 days, ending Friday 25 September 2026

---

## Overview

Ha joins the aiolabz.com team on the design side. She takes assigned tasks and runs with them, alongside everyone else. Ly Doan Van Anh starts the same day as an AI Engineer on the same product, so the two of them are peers on one codebase.

**She ships every day.** Not mockups handed to someone else to build. Design changes she implements herself, in the repo, merged into a live product. That is the job from the first week and it is the thing this plan is measured on.

Ha comes in as a designer who can code a bit. The bet is not that she becomes an engineer. The bet is that Claude closes the gap between what she can design and what she can ship, and that the stack and the protocols give her the discipline to do it safely in production code.

Two things run alongside the work and never gate it:

- **The 18 protocols**, which are how this team operates.
- **AI Officer certification**, A01 to A06 then G01 to G04. Ten courses.

The courses are emphasis. They give her the language and structure for what she is already doing on the product. Their deliverables are documents, not software. If a course slips a week because a real task needed her, that is the correct trade every time.

**One rule above all others, from day one:** she never pushes to `main`. Every change is a branch and a pull request. This is Protocol 05, and it is the difference between a designer who can be trusted in a production repo and one who cannot.

---

## The product

**aiolabz.com** is where all of her work lands. `aio-labz-fe` is Next.js 16 App Router, React 19, TypeScript strict, Tailwind 4, Radix UI, Zustand and React Query, Supabase SSR, on Vercel. There is a documented design system at `docs/engineering/features/design-system/AIO_LAB_DESIGN_SYSTEM_TW4.md`, and working inside it rather than around it is most of the job.

There is a loop worth naming: she takes her certification **on the product she is designing**. Every friction she hits as a student is a design bug she is allowed to fix. That is the best user research we will get, and it expires the moment she stops being a beginner. She should write it down while it still annoys her.

**Payroll IQ, for context only.** The Australian Payroll Association build at [www.payrolliq.com.au](https://www.payrolliq.com.au) is a one-week project, running this week alongside the AustPayroll AI Retreat. It wraps as she arrives. She is not expected to contribute and she does not own any of it going forward. It is worth a look for one reason: the client's own summary of the problem was **"it just looks ugly"**, and that is a clean statement of why this role exists commercially. The client week brief is at [https://www.edge8.ai/workflows/private/ai-retreat-austpayroll](https://www.edge8.ai/workflows/private/ai-retreat-austpayroll).

---

## How the work runs

This is the whole operating rhythm. It starts in week one and does not change for the 60 days.

| Cadence | What |
|---|---|
| Daily | Check-in posted. Tasks picked up from the team's queue, same as everyone |
| Daily | Something ships. A pull request opened, reviewed, merged |
| Every pull request | Branch off `main`, Vercel preview link included, reviewed before merge. Never straight to `main` |
| Weekly | 1-1 with Dave. What shipped, what is blocked, what she proposes next |
| Weekly | One course completed, per the schedule below |
| Ongoing | Running list of design debt on aiolabz.com. This is her own backlog and it is where her proposed work comes from |

Support is heavy in the first fortnight and tapers. What does not change is the cadence. Early tasks are small and reviewed closely; later tasks are larger and the review is lighter.

---

## Week 1: Access, then straight into the queue
**Tuesday 28 July to Friday 1 August**

The only week that needs spelling out day by day, because it is the only one with setup in it.

### Tuesday: access and environment

- [ ] edge8.ai email account and Lark
- [ ] GitHub account added to the `talentedgeai` organization, with access to `aio-labz-fe`
- [ ] Vercel account with access to the AIO Labz project
- [ ] Supabase access, read only, on the AIO Labz project
- [ ] Claude Code installed on her machine and signed in
- [ ] Student account on [aiolabz.com](https://aiolabz.com), enrolled in the Agentic and Generative tracks
- [ ] Team portal login at [https://www.edge8.ai/team](https://www.edge8.ai/team), then complete the onboarding survey (this populates her profile, so do it properly)
- [ ] Understand how we design here: there is no separate design tool and no handoff step. Design happens in the code, against the design system, previewed in the browser. Claude is the tool that gets it there.
- [ ] `aio-labz-fe` cloned and running locally
- [ ] Read this document and bring questions to the first 1-1
- [ ] Weekly 1-1 with Dave scheduled as a recurring slot

**The stack, in one sitting**

Read Protocol 02, then have Claude explain each tool in the context of `aio-labz-fe` specifically, not in the abstract. The one-line version she should be able to repeat back by Friday:

| Tool | What it does | Where she meets it |
|---|---|---|
| Claude | Writes and changes the code, and explains anything she does not understand | Claude Code in her terminal, pointed at the repo |
| GitHub | Stores the code and tracks every change. Branches and pull requests | `talentedgeai/aio-labz-fe` |
| Vercel | Takes what is in GitHub and puts it on the internet | Preview URL on every PR, production on merge |
| Supabase | Remembers things. Users, progress, content | Read-only for now, but it is the data behind the screens she designs |

### Wednesday: first ship

- [ ] With Vũ Trần Minh or a nominated engineer beside her: branch, one small visible change, push, pull request, Vercel preview, review, merge
- [ ] Spacing, a hover state, a heading size. The change itself does not matter. The full loop from branch to production is the deliverable, and she runs it again unaided the same afternoon

### Thursday and Friday: the real queue

- [ ] Assigned tasks from the aiolabz.com queue, same as everyone else
- [ ] Something merged each day
- [ ] Start the design debt list as she goes. Three places where the live product does not follow its own design system is a good first pass, and it plays to what she is already good at

By Friday the daily rhythm is the rhythm. Everything after this week is that, plus the course schedule.

---

## The learning track

Ten courses over nine weeks, taken alongside the work. Protocols are paired to the week where they are most useful.

| Week | Dates | Course | Protocols |
|---|---|---|---|
| 1 | 28 Jul to 1 Aug | A01 AI Program Planning | 01 to 04 (Mindset) |
| 2 | 4 to 8 Aug | A02 From Prompts to Packaged AI | 05 to 07 (Infrastructure) |
| 3 | 11 to 15 Aug | A03 Wire the Workflow | 08 Design systems, 09 Workflow design |
| 4 | 18 to 22 Aug | A04 Teach Your Workflow to Decide | 10 Communications, 11 Admin interfaces |
| 5 | 25 to 29 Aug | A05 Unleash the Agent | 12 to 14 (Product Management) |
| 6 | 1 to 5 Sep | A06 From Prototype to Production | 15 Working with an engineer, 16 User roles |
| 7 | 8 to 12 Sep | G01 Enter the AI Officer, G02 Clean Data | 17 AI vs human testing, 18 Handoff |
| 8 | 15 to 19 Sep | G03 Advanced Prompt Frameworks, G04 Prompting Perfect Visuals | — |
| 9 | 22 to 25 Sep | — | — |

**Milestones.** Agentic track (A01 to A06) complete end of week 6. All 18 protocols by end of week 7. AI Officer certified end of week 8. Week 9 is deliberately clear: the last week should be pure delivery.

### What the course deliverables are about

**Point them at aiolabz.com and her own real work.** The A track carries one workflow from A01 through A06, so the choice in A01 matters. The recommendation is **"turn an ugly screen into an on-brand shipped page"**, because that is literally her job, and it means each deliverable is something we can use rather than a training exercise.

- A02 builds a Packaged AI. The obvious one is a design review assistant loaded with the AIO design system file, so it can check a screen against the tokens. She will use it every week after that
- A05 builds a real agent. Recommended: a design system enforcement agent that reads a component or page and reports where it departs from the design tokens. It builds directly on her A02 work
- A06 covers the 18 protocols as its own content, so by week 6 she will have met them twice: once as weekly practice, once as curriculum. That is intentional
- **G04 is the highest-leverage course in the plan for this role.** The Style DNA concept applies to aiolabz.com directly and to every build after it. Her Style DNA output should be a real document for the product, not a training exercise

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
| **Independence** | Can be left alone with a design task and a repo. Knows when to ask, and asks early |
| **Stack** | Works in Claude, GitHub and Vercel independently. Reads Supabase and understands the data behind the screens she designs |
| **Craft** | aiolabz.com is visibly better. The design system is followed because she is enforcing it, and her design debt list is shrinking |
| **Certification** | A01 to A06 and G01 to G04 complete. AI Officer certified |

The honest bar on the first row: **can she be left alone with a design task and a repo?** If yes at day 60, this works. If she still needs someone sitting with her for every PR, that is the conversation to have, and it should not be a surprise to either side by then.

---

## Key contacts

| Person | Role | Notes |
|---|---|---|
| Dave Hajdu | CEO, Edge8 and AIO | Manager. Weekly 1-1 |
| Vũ Trần Minh | Principal Engineer | Code review and unblocking. See Protocol 15 for how to use an engineer well |
| Ly Doan Van Anh | AI Engineer | Starts the same day, same product. Her counterpart on the engineering side |
| Quan Chau | Senior Consultant | Runs the Infinite Leverage retreat content |
| Đặng Phương Mai | Technical Recruiter | Contract, payroll and HR questions |

---

## Resources

| Resource | Where |
|---|---|
| The 18 protocols | `content-studio/infinite-leverage-retreat/protocols/` |
| AI Officer certification (A01 to A06, G01 to G04) | `content-studio/educational-content/ai-officer-certification/`, taken at [https://aiolabz.com](https://aiolabz.com) |
| AIO design system | `aio-labz-fe`, `docs/engineering/features/design-system/AIO_LAB_DESIGN_SYSTEM_TW4.md` |
| AustPayroll client week brief | [https://www.edge8.ai/workflows/private/ai-retreat-austpayroll](https://www.edge8.ai/workflows/private/ai-retreat-austpayroll) |
| Team portal | [https://www.edge8.ai/team](https://www.edge8.ai/team) |
| Edge8 core values | `docs/product/product.md`, "How we work" |

---

*Last updated: 27 July 2026*
