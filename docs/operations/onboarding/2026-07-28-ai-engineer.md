# AI Engineer Onboarding Plan

**Name:** Ly Doan Van Anh (Anh)
**Companies:** Edge8 Co. | AI Officer Institute (AIO)
**Role:** AI Engineer
**Manager:** Dave Hajdu
**Start date:** Tuesday 28 July 2026
**Plan horizon:** 60 days, ending Friday 25 September 2026

---

## Overview

Three things run in parallel from day one.

1. **Learn the stack.** Claude, GitHub, Vercel, Supabase. Not as reading. She writes migrations, opens pull requests and watches them deploy in week one.
2. **Learn the operating system.** The 18 protocols, then two certifications: AI Engineer (E01 to E08) and AI Officer (A01 to A06 plus G01 to G04). Eighteen courses in total.
3. **Do the work.** [aiolabz.com](https://aiolabz.com), front end and backend. No client work in the first 60 days. That is deliberate: she learns to ship safely on a product we own before anything she writes touches a paying customer.

Anh joins early in her career. The plan is built around that, not in spite of it. Weeks 1 and 2 move slowly and with someone beside her, because the habits set in those two weeks are the ones she keeps. Weeks 3 to 6 are about carrying a real build end to end. Weeks 7 to 9 are about doing it without supervision.

**One rule above all others, from day one:** she never pushes to `main`. Every change is a branch and a pull request. This is Protocol 05, and it is the line between an engineer who can be trusted in a production repo and one who cannot.

**A second rule, close behind:** no secrets in code, ever. Not in a commit, not in a comment, not in a test file. E04 and E05 both end with a `grep` that must come back empty. That check exists because this is the mistake that costs real money.

---

## The two workstreams

The AI Engineer certification carries **one student project through all eight missions**. Each deliverable is the input to the next: the system map feeds the harness playbook, which feeds the architecture, which feeds the wiring. That means she needs a project she owns completely, because E04 has her running migrations and row level security policies, E07 has her load testing, and E08 has her wiring CI/CD and deploying to production. She cannot do any of that inside a shared production repo.

So there are two workstreams, and they are different on purpose.

**Workstream 1: her own build.** Her repo, her Supabase project, her Vercel project. This is the spine of the E track and it runs the whole 60 days. Dave picks it with her in week 1. The test for a good choice is three things: small enough to ship in eight weeks alongside everything else, real enough that one named person at Edge8 will actually use it, and separate enough from production that a mistake costs nothing but her own time. E06 requires her to demo it to a real stakeholder and take feedback, so that person needs to be named up front and needs to be willing.

**Workstream 2: aiolabz.com.** Real contribution to a live product, starting small. `aio-labz-fe` is Next.js 16 App Router, React 19, TypeScript strict, Tailwind 4, Radix, Zustand and React Query, Supabase SSR, on Vercel. `aio-labz-be` is a separate FastAPI service in Python. She should know from day one that these are two different languages and two different repos, because the E track missions are written against the Next.js and Supabase path and the Python service will not map onto them cleanly.

There is a loop here worth naming out loud: she takes both certifications **on the product she is helping to build**. Every rough edge she hits as a student is a bug she is allowed to file. That perspective expires the moment she stops being a beginner, so she should write things down while they still annoy her.

**Timing note.** The AustPayroll AI Retreat week runs from Monday 27 July, so she starts on day two of it. She is not expected to contribute. She should sit in where useful, because the retreat deck is the 18 protocols and seeing them delivered to a paying client is the fastest way to understand why they matter.

---

## Week 1: Access, the stack, and one live change
**Tuesday 28 July to Friday 1 August**

### Goals

Get access to everything. Understand what each of the four tools does. Get one small, real change live on aiolabz.com by Friday. Not a big change. A live one.

### Tasks

**Systems access**
- [ ] edge8.ai email account and Lark
- [ ] GitHub account added to the `talentedgeai` organization, with write access to `aio-labz-fe` and `aio-labz-be`
- [ ] Vercel account with access to the AIO Labz projects
- [ ] Supabase access, read only to start, on the AIO Labz project
- [ ] **Her own Supabase and Vercel projects** for the student build, on free tier, separate from anything of ours
- [ ] Claude Code installed and signed in
- [ ] Student seat on [aiolabz.com](https://aiolabz.com). A Basic seat grants both the AI Officer and AI Engineer series, so this is one action, not two
- [ ] Team portal login at [https://www.edge8.ai/team](https://www.edge8.ai/team), then the onboarding survey. It populates her profile, so it is worth doing properly
- [ ] Read this document and bring questions to the first 1-1
- [ ] Weekly 1-1 with Dave as a recurring slot

**The stack, in one sitting**

Read Protocol 02, then have Claude explain each tool against `aio-labz-fe` specifically rather than in the abstract. She should be able to repeat this back by Friday:

| Tool | What it does | Where she meets it |
|---|---|---|
| Claude | Writes and changes the code, and explains anything she does not understand | Claude Code in her terminal, pointed at the repo |
| GitHub | Stores the code and every change to it. Branches and pull requests | `talentedgeai/aio-labz-fe` and `aio-labz-be` |
| Vercel | Takes what is in GitHub and puts it on the internet | Preview URL on every pull request, production on merge |
| Supabase | Remembers things. Users, progress, content. Postgres with row level security | Read only on ours, full control on her own |

**Protocols 01 to 04 (Mindset)**
- [ ] Protocol 01, CMS is Dead: AI is the CMS
- [ ] Protocol 02, The Stack
- [ ] Protocol 03, Agents: the folder is the Agent. This one matters early, because E02 next week has her standing up eight of them
- [ ] Protocol 04, Cataloguing. Folder structure and naming. The boring one that everybody skips and nobody should

**Ship one thing**
- [ ] Clone `aio-labz-fe`, get it running locally
- [ ] With Vũ Trần Minh or a nominated engineer sitting with her: create a branch, make one small change, push it, open a pull request, look at the Vercel preview URL, get it reviewed, merge it
- [ ] The change itself does not matter. The full loop from branch to production is the deliverable

**Certification: E01 Enter the AI Engineer** (~90 min)
- [ ] Produce `system-map.html`: actors, flows, scope boundary, seams, risk register, harness plan

This is where she chooses the student project, and the choice carries through all eight missions. **Choose it deliberately, with Dave, and do not let it drift into week 2.** E01 grades on specificity, so a vague idea here produces a vague map, and E03 is built directly on top of it.

**Watch the retreat**
- [ ] Sit in on the AustPayroll retreat where useful. No deliverables

---

## Week 2: The harness
**Monday 4 August to Friday 8 August**

### Goals

Stand up the 8-agent team and learn the 18 protocols as one system. Work in GitHub, Vercel and Supabase unsupervised on the read-and-ship path.

**Day 8 milestone falls Tuesday 5 August.** The check-in survey goes out automatically. Dave should read the response before the week 2 1-1.

### Tasks

**Certification: E02 Command the Harness** (~100 min plus setup time)
- [ ] Work through the 18 protocols as an operating system, not a reading list
- [ ] Clone the Infinite Leverage 8-agent template, run the init skill, stand up product manager, developer, QA, DevOps, writer, designer, web publisher and email marketer
- [ ] Configure project rules and gates for her own build
- [ ] Produce `harness-playbook.html`

This is the heaviest single course in the plan and the most important one for this role. She meets all 18 protocols here as curriculum, then goes back through them category by category over the following weeks as practice. Meeting them twice is intentional.

**Protocols 05 to 07 (Infrastructure), in practice**
- [ ] Protocol 05, GitHub hygiene: check-in and check-out. Five operations, done cleanly, every time. This is the load-bearing one
- [ ] Protocol 06, Vercel hygiene: domains and DNS. Enough to read the dashboard and to know exactly what separates preview from production
- [ ] Protocol 07, Supabase: data structures basics. She should be able to read our schema and explain what the app stores before she designs her own

**Ship**
- [ ] Target: three pull requests merged on aiolabz.com by end of week 2, on her own, still reviewed before merge

---

## Week 3: Design the system
**Monday 11 August to Friday 15 August**

### Goals

Make the architecture decisions for her own build before writing backend code. Start the AI Officer track alongside.

### Tasks

**Protocols 08 to 09 (Building)**
- [ ] Protocol 08, Design systems and Claude design. `aio-labz-fe` has a documented design system at `docs/engineering/features/design-system/AIO_LAB_DESIGN_SYSTEM_TW4.md`. She reads it and works inside it rather than around it
- [ ] Protocol 09, Workflow design. Breaking a job into steps instead of asking AI to do whole jobs

**Certification: E03 Design the System** (~90 min plus assembly)
- [ ] Three architecture decision records, each naming what she rejected and what could go wrong
- [ ] PostgreSQL data model with foreign keys and row level security flags
- [ ] API contract, every endpoint with an auth decision
- [ ] Produce `architecture.html`

**Read the numbering note in "Open items" before she starts E03.** The mission asks for a `prd.html` from a mission that does not exist as a folder. She should not go looking for it.

**Certification: A01 AI Program Planning** (~40 min guided)
- [ ] Produce `program-brief.html`, the 5Ds brief

The A track workflow she picks here carries through A02 to A06. The recommendation is to pick something from her own build so the two tracks reinforce each other instead of competing for her time.

**Work**
- [ ] Continue shipping on aiolabz.com. Dave assigns one slightly larger item, scoped to a week

---

## Week 4: Wire the stack
**Monday 18 August to Friday 22 August**

### Goals

Prove she can wire a real database with real security, not just describe how it should work.

### Tasks

**Protocols 10 to 11 (Building)**
- [ ] Protocol 10, Communications: SMS, email, Resend
- [ ] Protocol 11, Admin interfaces: CRM, dashboards, Supabase access. The admin UI is the new editor

**Certification: E04 Wire the Stack** (~80 min)

Four paste-driven checks, each pass or fix-and-repaste. No partial credit.
- [ ] Schema matches her E03 data model
- [ ] Row level security policies exist on every user-data table and reference `auth.uid()`. No permissive catch-all policies
- [ ] `curl` responses show correct status codes and enforce auth (401 without a token)
- [ ] Secrets audit returns empty
- [ ] Produce `integration-proof.html`

Row level security is the thing to slow down on. It is the difference between a database that is private and one that only looks private, and it is not obvious from the outside which one you have built.

**Certification: A02 From Prompts to Packaged AI** (~40 min guided)
- [ ] Build a Packaged AI on her chosen workflow, plus `packaged-ai.html`

**Work**
- [ ] Continue on aiolabz.com against the week's assigned item

---

## Week 5: Communications, and planning her own work
**Monday 25 August to Friday 29 August**

### Goals

Add the communication layer to her build. Start proposing work instead of receiving it.

### Tasks

**Protocols 12 to 14 (Product Management)**
- [ ] Protocol 12, Product planning and epic planning
- [ ] Protocol 13, Epic status and project status HTML tracking. One file that always tells the truth
- [ ] Protocol 14, Planning your day with a PM agent

**Certification: E05 Integrate Comms** (~80 min)
- [ ] Resend for transactional email, Brevo for outreach, plus a webhook channel if her build needs one
- [ ] Secrets audit clean again
- [ ] Produce `comms-brief.html`

**Use her own free-tier Resend and Brevo accounts for this, not our production keys.** Coursework and production credentials do not mix, and a test broadcast fired against a real contact list is not a recoverable mistake.

**Certification: A03 Wire the Workflow** (~50 min guided)
- [ ] Produce `workflow.html` with the five-part blueprint and a runnable Claude Routine

**Work**
- [ ] She writes her own two-week plan across both workstreams in the Protocol 12 format and brings it to the 1-1 for approval, rather than waiting to be assigned

---

## Week 6: Show it, then harden it
**Monday 1 September to Friday 5 September**

### Goals

Put the build in front of a real person, take the feedback, then make it survive contact with real usage.

This is the heaviest week in the plan. E06 is mostly conversation and a document update, which is what makes pairing it with E07 workable.

### Tasks

**Protocols 15 to 16 (Continuity)**
- [ ] Protocol 15, Working with an engineer to unlock you. When to escalate, what to bring, how to be unblocked in minutes instead of days. Knowing how to escalate well is a skill, not an admission
- [ ] Protocol 16, User roles on an Infinite Leverage team

**Certification: E06 Show and Validate** (~80 min)
- [ ] Demo her working build to the named stakeholder, in plain language, no jargon
- [ ] Take the feedback honestly: what they liked, what confused them, what they want changed
- [ ] Translate trade-offs into cost rather than saying yes or no
- [ ] Update `prd.html` to reflect what she actually built

**Certification: E07 Scale and Harden** (~80 min)
- [ ] Load test, error boundaries, one monitoring check, three edge cases
- [ ] Produce `scale-report.html`

**Certification: A04 Teach Your Workflow to Decide** (~20 min guided)
- [ ] Produce `decision-layer.html` with classifier and router

---

## Week 7: Ship it
**Monday 8 September to Friday 12 September**

### Goals

Take her build to production with a real pipeline, and finish the AI Engineer certification.

**Day 45 falls Thursday 10 September.** Dave should be forming a view now on whether this is working, not on day 59.

### Tasks

**Protocols 17 to 18 (Continuity)**
- [ ] Protocol 17, AI testing versus human testing. Where the line sits between what to automate and what stays human
- [ ] Protocol 18, Working with human tokens after you leave. Handoff discipline

**Milestone: all 18 protocols complete.**

**Certification: E08 Ship and Revisit** (~85 min)
- [ ] GitHub Actions pipeline: lint, type check, tests and build, all before anything deploys
- [ ] Production environment on Vercel, separate from preview, secrets in the right place
- [ ] Write the runbook: failure scenarios, release process, architecture, who owns what
- [ ] Produce `runbook.html`

**Milestone: AI Engineer certification complete (E01 to E08).**

**Certification: A05 Unleash the Agent** (~90 min, live session)
- [ ] Build a real agent folder with instructions, memory, a tool, guardrails and one packaged skill, plus `agent.html`

**Work**
- [ ] aiolabz.com, against her own plan

---

## Week 8: Finish the agentic track, start generative
**Monday 15 September to Friday 19 September**

### Goals

Close out A01 to A06 and get through the first half of the generative track.

Also a heavy week. If something has to slip, slip the G track, not the E track.

### Tasks

**Certification: A06 From Prototype to Production** (~90 min plus Supabase homework)
- [ ] Produce `development-map.html`
- [ ] Complete the Supabase homework, with Thursday coaching if needed

A06 covers the 18 protocols as its own content, so by this point she will have met them three times: as curriculum in E02, as weekly practice, and again here. For this role that repetition is the point.

**Milestone: Agentic AI for Business complete (A01 to A06).**

**Certification: G01 and G02**
- [ ] G01, Enter the AI Officer (~85 min). Deliverable: a personal AI Learning Plan tied to her real role. Genuinely useful for someone at this stage, so do not let her rush it
- [ ] G02, Clean Data, AI's Favorite Snack (~95 min). Deliverables: clean dataset plus analysis report

**Work**
- [ ] Full independence on aiolabz.com. She runs her own weekly plan and reports against it. Dave reviews, does not assign

---

## Week 9: Certified, and working alone
**Monday 22 September to Friday 25 September**

### Tasks

**Certification: G03 and G04**
- [ ] G03, Advanced Prompt Frameworks (~90 min). Deliverable: a go-to-market brief
- [ ] G04, Prompting Perfect Visuals (~75 min). Deliverables: Style DNA document plus a 13-piece visual campaign

**Milestone: Generative AI Essentials complete (G01 to G04). AI Officer certified.**

**Work**
- [ ] Close out the day 60 review pack: both certificates, her shipped build with its runbook, and the list of what she has merged to aiolabz.com

---

## Day 60 review: Friday 25 September

The contract decision, assessed against four things.

| Area | What good looks like at day 60 |
|---|---|
| **Shipping** | Ships to production on aiolabz.com through pull requests, unsupervised, without breaking things |
| **Stack** | Works in Claude Code, GitHub and Vercel independently. Writes Supabase migrations and row level security policies, not just reads tables |
| **Harness** | Runs the 8-agent team. Delegates to it rather than doing everything by hand. Her own build is live, with CI/CD and a runbook someone else could operate |
| **Certification** | E01 to E08, A01 to A06, G01 to G04. Both certifications complete |

The honest bar on the first row: **can she take a roadmap item and run plan, build, ship without someone sitting beside her?** If yes at day 60, this works, and client work is the natural next step. If she still needs a pair on every pull request, that is the conversation to have, and it should not be a surprise to either side by then.

---

## Standing weekly rhythm

| Cadence | What |
|---|---|
| Daily | Check-in posted, per team practice |
| Weekly | 1-1 with Dave. She brings: what shipped, what is blocked, what she proposes next |
| Weekly | One or two certification courses completed, per the schedule above |
| Weekly | Progress on her own build, visible at a URL |
| Every pull request | Vercel preview link included, reviewed before merge, never straight to `main` |

---

## Key contacts

| Person | Role | Notes |
|---|---|---|
| Dave Hajdu | CEO, Edge8 and AIO | Manager. Weekly 1-1, approves her plan, picks the student project with her in week 1 |
| Vũ Trần Minh | Principal Engineer | Code review and unblocking. See Protocol 15 for how to use an engineer well |
| Quan Chau | Senior Consultant | Runs the Infinite Leverage retreat content. Worth time with him on the protocols |
| Khoa Doan, Lê Vinh, Ngoc Le | AI Engineers | Her peer group. They have run this stack already |
| Đặng Phương Mai | Technical Recruiter | Contract, payroll and HR questions |

---

## Resources

| Resource | Where |
|---|---|
| The 18 protocols | `content-studio/infinite-leverage-retreat/protocols/` |
| AI Engineer certification (E01 to E08) | `content-studio/educational-content/ai-engineer-certification/`, taken at [https://aiolabz.com](https://aiolabz.com) |
| AI Officer certification (A01 to A06, G01 to G04) | `content-studio/educational-content/ai-officer-certification/`, taken at [https://aiolabz.com](https://aiolabz.com) |
| The 4-week AI Engineer plan | `ai-engineer-certification/ai-engineer-4-week-plan.html`. Background on the house approach. Note it uses different course titles to the ones above |
| AIO design system | `aio-labz-fe`, `docs/engineering/features/design-system/AIO_LAB_DESIGN_SYSTEM_TW4.md` |
| 8-agent template | `talentedgeai/infiniteleverage-8-agents-template`, cloned in E02 |
| Team portal | [https://www.edge8.ai/team](https://www.edge8.ai/team) |
| Edge8 core values | `docs/product/product.md`, "How we work" |

---

## Open items for Dave before day one

- [ ] Confirm the spelling of her name including diacritics. The team record reads "Ly Doan Van Anh" with none, and confirm she goes by Anh
- [ ] Set her position on her team member record. It is currently empty, so she does not appear correctly on the onboarding board. Start date is already set to 28 July
- [ ] Upload this plan against her onboarding journey at [https://www.edge8.ai/admin/talent/onboarding](https://www.edge8.ai/admin/talent/onboarding). The cron nags daily until a plan is attached
- [ ] **Pick the student project with her in week 1**, and name the stakeholder who will take the E06 demo in week 6. Both need to be settled before E01 closes
- [ ] Nominate the engineer who sits with her for the first pull request in week 1. Vũ Trần Minh is the obvious choice, subject to his load
- [ ] Decide whether she attends any of the AustPayroll retreat week in person

### One content defect she will hit

The E-track content has numbering drift that will confuse a first-time student, and it is worth deciding whether to fix it or brief her around it before week 3.

- The folder `e03-design-the-system/` is titled **AE04: Design the System, Mission 4 of 8** in its own intro, and asks for a `prd.html` "from AE03". There is no AE03 folder and no PRD mission. The same missing PRD is referenced again by `e06-show-and-validate`
- `e04-wire-the-stack/` is titled AE05, `e05-integrate-comms/` is titled AE06, and `e06-show-and-validate/` is also titled AE06
- There is a stray `e01-think-in-systems/` folder containing only a prompt, alongside the real `e01-enter-the-ai-engineer/`
- `ai-engineer-4-week-plan.html` names the eight courses completely differently again (Product Planning, Thinking at Scale, The Company Database, Flying Solo)

None of this blocks the plan. The deliverable chain still works end to end. But she is the first person to run this track from a standing start, which makes her the best proofreader we will get, and she should be told to log what she hits rather than assume she has missed something.

---

*Last updated: 27 July 2026*
