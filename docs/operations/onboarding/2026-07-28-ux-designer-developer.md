# UX Designer / Developer Onboarding Plan

**Name:** Nghiem Cam Viet Ha (Ha)
**Companies:** Edge8 Co. | AI Officer Institute (AIO)
**Role:** UX Designer / Developer
**Manager:** Dave Hajdu
**Start date:** Tuesday 28 July 2026
**Plan horizon:** 60 days, ending Friday 25 September 2026

---

## Overview

This role covers three things running in parallel from day one:

1. **Learn the stack.** Claude, GitHub, Vercel, Supabase. Not as theory. She ships with it in week one.
2. **Learn the method.** The 18 protocols, and AI Officer certification across A01 to A06 and G01 to G04.
3. **Do the work.** Design and front-end on [aiolabz.com](https://aiolabz.com), plus the Australian Payroll Association build at [www.payrolliq.com.au](https://www.payrolliq.com.au).

Ha comes in as a designer who can code a bit. The bet is not that she becomes an engineer. The bet is that Claude closes the gap between what she can design and what she can ship, and that the stack, the protocols and the certification give her the discipline to ship safely into production code that customers are paying for.

The sequencing is deliberate. Weeks 1 and 2 are about being able to change something and get it live without breaking anything. Weeks 3 to 6 are about owning design surfaces on both products. Weeks 7 and 8 are about working without supervision and closing out certification.

**One rule above all others, from day one:** she never pushes to `main`. Every change is a branch and a pull request. This is Protocol 05 and it is the difference between a designer who can be trusted in a production repo and one who cannot.

---

## The two products

**aiolabz.com** is the AIO certification dashboard. Next.js 16 App Router, React 19, TypeScript strict, Tailwind 4, Radix UI, Zustand and React Query, Supabase SSR, deployed on Vercel. It has a documented design system at `docs/engineering/features/design-system/AIO_LAB_DESIGN_SYSTEM_TW4.md`. This is her home base and the safest place to learn, because we own it and a mistake costs us nothing but time.

There is a neat loop here worth naming out loud: she takes her certification **on the product she is designing**. Every friction she hits as a student is a design bug she is allowed to fix. That is the best user research we will ever get, and it expires the moment she stops being a beginner. She should write it down while it still annoys her.

**Payroll IQ** (Australian Payroll Association, Tracy Angwin) is the client work. Same stack, which is the point: one stack, two products, no context switching cost. A learner signs up, takes a diagnostic assessment, and gets an auto-generated 90-day training plan built only from what they do not already know. Wrong answers pull remediation videos back into the plan.

Tracy's own words on the current state: **"it just looks ugly."** The content pipeline works, built solo and self-taught. The weak point is design. That is literally this role. Ha should read the client week brief at [https://www.edge8.ai/workflows/private/ai-retreat-austpayroll](https://www.edge8.ai/workflows/private/ai-retreat-austpayroll) in week one so she understands what Tracy is actually buying.

Note the timing: the AI Retreat week for AustPayroll runs the week of Monday 27 July, so Ha starts on day two of it. She will not contribute much to that week and should not be expected to. She watches.

---

## Week 1: Access, the stack, and shipping something small
**Tuesday 28 July to Friday 1 August**

### Goals

Get access to everything. Understand what the four tools in the stack each do. Get one small, real change live on aiolabz.com by Friday. Not a big change. A live one.

### Tasks

**Systems access**
- [ ] edge8.ai email account and Lark
- [ ] GitHub account added to the `talentedgeai` organization, with access to `aio-labz-fe` and `payroll-training-au`
- [ ] Vercel account with access to both projects
- [ ] Supabase access (read-only to start on both the AIOLabz and Payroll IQ projects)
- [ ] Claude Code installed on her machine and signed in
- [ ] Student account on [aiolabz.com](https://aiolabz.com), enrolled in the Agentic and Generative tracks
- [ ] Team portal login at [https://www.edge8.ai/team](https://www.edge8.ai/team), then complete the onboarding survey (this populates her profile, so do it properly)
- [ ] Confirm design tooling: does she need a Figma seat, or is she designing directly in code? Decide in week one, do not let it drift.
- [ ] Read this document and bring questions to the first 1-1
- [ ] Weekly 1-1 with Dave scheduled as a recurring slot

**The stack, in one sitting**

Read Protocol 02, then have Claude explain each tool in the context of `aio-labz-fe` specifically, not in the abstract. The one-line version she should be able to repeat back by Friday:

| Tool | What it does | Where she meets it |
|---|---|---|
| Claude | Writes and changes the code, and explains anything she does not understand | Claude Code in her terminal, pointed at the repo |
| GitHub | Stores the code and tracks every change. Branches and pull requests | `talentedgeai/aio-labz-fe` |
| Vercel | Takes what is in GitHub and puts it on the internet | Preview URL on every PR, production on merge |
| Supabase | Remembers things. Users, progress, content | Read-only for now |

**Protocols 01 to 04 (Mindset track)**
- [ ] Protocol 01, CMS is Dead: AI is the CMS. Why we do not use WordPress or Webflow
- [ ] Protocol 02, The Stack. The four tools above
- [ ] Protocol 03, Agents: the folder is the Agent. Demystifies the word before A05 asks her to build one
- [ ] Protocol 04, Cataloguing. Folder structure and naming. The boring one that everybody wants to skip and nobody should

**Ship one thing**
- [ ] Clone `aio-labz-fe`, get it running locally (`pnpm install`, `pnpm dev`)
- [ ] With Dave or a nominated engineer sitting with her: create a branch, make one small visible improvement, push it, open a PR, look at the Vercel preview URL, get it reviewed, merge it
- [ ] The change itself does not matter. Spacing, a hover state, a heading size. The full loop from branch to production is the deliverable.

**Certification: A01 AI Program Planning** (~40 min guided, plus finishing time)
- [ ] Complete A01 and produce `program-brief.html`, the 5Ds brief

The workflow she picks in A01 carries through A02 to A06, so **choose it deliberately**. The recommendation: **"turn an ugly screen into an on-brand shipped page."** That is her actual job, it applies to both products, and it means her certification capstone in A06 is a real thing we can use rather than a training exercise. Do not let her pick something abstract.

**Watch the AustPayroll retreat**
- [ ] Read the client week brief
- [ ] Sit in where useful. No deliverables this week. She is building context on what Tracy wants and why the design matters commercially.

---

## Week 2: Infrastructure, and the design system
**Monday 4 August to Friday 8 August**

### Goals

Be able to work in GitHub, Vercel and Supabase without supervision for the read-and-ship path. Understand the aiolabz.com design system well enough to work inside it rather than around it.

**Day 8 milestone falls this week (Tuesday 5 August).** The check-in survey goes out automatically. Dave should read the response before the week 2 1-1.

### Tasks

**Protocols 05 to 07 (Infrastructure track)**
- [ ] Protocol 05, GitHub hygiene: check-in / check-out. Five operations, done cleanly, every time. This is the load-bearing one for her
- [ ] Protocol 06, Vercel hygiene: domains and DNS. Mainly so she knows what she is looking at in the dashboard, and understands preview versus production
- [ ] Protocol 07, Supabase: data structures basics. Enough to read a table and understand what the app is storing. Writing comes later

**Design system**
- [ ] Read `docs/engineering/features/design-system/AIO_LAB_DESIGN_SYSTEM_TW4.md` in `aio-labz-fe`
- [ ] Read Protocol 08 alongside it (the theory behind why the file exists)
- [ ] Audit: find three places on aiolabz.com where the live product does not follow its own design system. Write them up. This is her first real piece of work and it plays to what she is already good at.
- [ ] Review the audit with Dave, agree which ones she fixes

**Ship**
- [ ] Fix at least one of the three, as a PR, on her own this time
- [ ] Target: three PRs merged by end of week 2

**Certification: A02 From Prompts to Packaged AI** (~40 min guided)
- [ ] Build a Packaged AI (a Claude Project) on her chosen workflow, plus `packaged-ai.html`

The obvious one for her: a design review assistant loaded with the AIO design system file, so it can check a screen against the tokens. She will use this every week for the rest of the plan.

---

## Week 3: Owning design surfaces
**Monday 11 August to Friday 15 August**

### Goals

Move from fixing things to owning things. Take a first real design surface on aiolabz.com end to end.

### Tasks

**Protocols 08 to 09 (Building track)**
- [ ] Protocol 08, Design systems and Claude design. Her home turf. She should be able to teach this one back
- [ ] Protocol 09, Workflow Design. Breaking a job into steps rather than asking AI to do whole jobs

**Work**
- [ ] Dave assigns one aiolabz.com surface she owns end to end (design and implementation). Scope it to something shippable in a week
- [ ] She writes the approach before building: what changes, what it should feel like, what stays the same
- [ ] Build it, PR it, ship it
- [ ] Start a running list of design debt on aiolabz.com. This becomes her backlog

**Payroll IQ, first contact**
- [ ] Get the repo running locally (`payroll-training-au`, the app lives in `website/`)
- [ ] Read `docs/brand/style-guide.md`
- [ ] Read `docs/project-status.html` to see where the build actually is
- [ ] Do not change anything yet. Walk the learner journey as a user: sign up, take the assessment, get the plan. Write down every place it looks or feels wrong. That list is her week 4 brief.

**Certification: A03 Wire the Workflow** (~50 min guided)
- [ ] Produce `workflow.html` with the five-part blueprint and a runnable Claude Routine

---

## Week 4: Payroll IQ, and admin interfaces
**Monday 18 August to Friday 22 August**

### Goals

Start delivering on the client product. Understand how the parts of these apps that are not the marketing pages actually work.

### Tasks

**Protocols 10 to 11 (Building track)**
- [ ] Protocol 10, Communications: SMS, Email, Resend. Both products send email, and the design of those emails is her job too
- [ ] Protocol 11, Admin Interfaces: CRM, dashboards, Supabase access. The admin UI is the new editor. Both products have one and both need design attention

**Payroll IQ work**
- [ ] Present the walkthrough findings from week 3 to Dave. Prioritise together against what Tracy actually cares about commercially
- [ ] Take the highest-value visible surface (likely the assessment flow or the 90-day plan view) and redesign it
- [ ] Ship it behind a PR, review with Dave before it goes anywhere near Tracy

**Accessibility**
- [ ] Payroll IQ runs axe and Lighthouse CI in its test suite. Learn what those check and how to read the output. A B2B learning platform sold to enterprise payroll teams will get asked about accessibility, and it is cheaper to build it in than retrofit it.

**Certification: A04 Teach Your Workflow to Decide** (~20 min guided)
- [ ] Produce `decision-layer.html` with classifier and router

---

## Week 5: Product management discipline
**Monday 25 August to Friday 29 August**

### Goals

Stop being assigned work and start proposing it. This is the week the role shifts from executing to owning.

### Tasks

**Protocols 12 to 14 (Product Management track)**
- [ ] Protocol 12, Product planning and epic planning. Breaking ideas into things that ship in a week
- [ ] Protocol 13, Epic status: project status HTML tracking. One file that always tells the truth. Payroll IQ already has `docs/project-status.html`, so she can see a live example
- [ ] Protocol 14, Planning your day with a PM agent

**Work**
- [ ] She writes her own plan for the next two weeks across both products, in the format Protocol 12 teaches, and brings it to the 1-1 for approval rather than waiting to be told
- [ ] Continue shipping on both products against that plan
- [ ] Update the design debt backlog with what she has learned

**Certification: A05 Unleash the Agent** (~90 min, live session)
- [ ] Build a real agent folder with instructions, memory, a tool, guardrails and one packaged skill, plus `agent.html`

Recommended agent: a **design system enforcement agent** that reads a component or page and reports where it departs from the design tokens. It is a genuinely useful tool for us, it builds directly on her A02 Packaged AI, and it means her A05 deliverable earns its keep after certification.

---

## Week 6: Shipping to production, and the human side
**Monday 1 September to Friday 5 September**

### Goals

Complete the agentic track. Understand where she fits in a team that is mostly agents.

### Tasks

**Protocols 15 to 16 (Continuity track)**
- [ ] Protocol 15, Working with an engineer to unlock you. When to call an engineer, what to bring, how to be unblocked in minutes rather than days. Important for this role specifically: she will hit real limits, and knowing how to escalate well is a skill, not an admission
- [ ] Protocol 16, User Roles on an Infinite Leverage Team

**Certification: A06 From Prototype to Production** (~90 min, plus Supabase homework)
- [ ] Produce `development-map.html`, the final Agentic certification submission
- [ ] Complete the Supabase homework (logins and shared data), with Thursday coaching if needed

A06 covers the 18 protocols as its own content, so by this week she will have met them twice: once as practice through this plan, once as curriculum. That is intentional.

**Milestone: Agentic AI for Business certification complete (A01 to A06).**

**Work**
- [ ] Both products, against her own week 5 plan
- [ ] Day 45 falls Thursday 10 September. Dave should be forming a view now on whether this is working, not on day 59.

---

## Weeks 7 and 8: Generative track and independence
**Monday 8 September to Friday 25 September**

### Goals

Finish certification. Work at full independence. Reach the day 60 review with a clear track record.

### Tasks

**Protocols 17 to 18 (Continuity track)**
- [ ] Protocol 17, AI testing vs human testing. Where the line sits between what to automate and what stays human
- [ ] Protocol 18, Working with human tokens after you leave. Handoff discipline

**Milestone: all 18 protocols complete.**

**Certification: G01 to G04**

Two per week. These are closer to her existing craft than the A track, which is why they come second: she can move fast through them.

- [ ] G01, Enter the AI Officer (~85 min). Deliverable: a personal AI Learning Plan, 8 weeks, tied to her real role. This one is genuinely useful for her, so do not let her rush it
- [ ] G02, Clean Data, AI's Favorite Snack (~95 min). Deliverables: clean dataset plus analysis report
- [ ] G03, Advanced Prompt Frameworks (~90 min). Deliverable: a go-to-market brief
- [ ] G04, Prompting Perfect Visuals (~75 min). Deliverables: Style DNA document plus a 13-piece visual campaign

G04 is the highest-leverage course in the whole plan for this role. The Style DNA concept applies directly to both products and to every client build after them. Her G04 output should not stay a training exercise: she should produce a Style DNA document for Payroll IQ as the real application of it.

**Milestone: Generative AI Essentials certification complete (G01 to G04). AI Officer certified.**

**Work**
- [ ] Full ownership of design on aiolabz.com
- [ ] A named, agreed deliverable on Payroll IQ that Tracy sees and responds to
- [ ] She runs her own weekly plan and reports against it. Dave reviews, does not assign

---

## Day 60 review: Friday 25 September

The contract decision. Assessed against four things:

| Area | What good looks like at day 60 |
|---|---|
| **Shipping** | Ships design changes to production on her own, through PRs, without breaking things. No supervision needed on the routine path |
| **Stack** | Works in Claude, GitHub and Vercel independently. Reads Supabase and understands the data behind the screens she designs |
| **Craft** | Both products visibly better. Specifically, Tracy's "it just looks ugly" is no longer true of Payroll IQ |
| **Certification** | A01 to A06 and G01 to G04 complete. AI Officer certified |

The honest bar on the first row: **can she be left alone with a design task and a repo?** If yes at day 60, this works. If she still needs someone sitting with her for every PR, that is the conversation to have.

---

## Standing weekly rhythm

| Cadence | What |
|---|---|
| Daily | Check-in posted, per team practice |
| Weekly | 1-1 with Dave. She brings: what shipped, what is blocked, what she proposes next |
| Weekly | One certification course completed |
| Weekly | Design debt backlog updated across both products |
| Every PR | Vercel preview link included, reviewed before merge, never straight to `main` |

---

## Key contacts

| Person | Role | Notes |
|---|---|---|
| Dave Hajdu | CEO, Edge8 and AIO | Manager. Weekly 1-1, approves her plan and reviews client-facing work |
| Tracy Angwin | Australian Payroll Association | Client. Nothing goes to Tracy without Dave seeing it first |
| Engineering team | Edge8 | Code review and unblocking. See Protocol 15 for how to use them well |

---

## Resources

| Resource | Where |
|---|---|
| The 18 protocols | `content-studio/infinite-leverage-retreat/protocols/` |
| AI Officer certification (A01 to A06, G01 to G04) | `content-studio/educational-content/ai-officer-certification/`, taken at [https://aiolabz.com](https://aiolabz.com) |
| AIO design system | `aio-labz-fe`, `docs/engineering/features/design-system/AIO_LAB_DESIGN_SYSTEM_TW4.md` |
| Payroll IQ style guide | `payroll-training-au`, `docs/brand/style-guide.md` |
| Payroll IQ status | `payroll-training-au`, `docs/project-status.html` |
| AustPayroll client week brief | [https://www.edge8.ai/workflows/private/ai-retreat-austpayroll](https://www.edge8.ai/workflows/private/ai-retreat-austpayroll) |
| Payroll IQ live | [https://www.payrolliq.com.au](https://www.payrolliq.com.au) |
| Team portal | [https://www.edge8.ai/team](https://www.edge8.ai/team) |
| Edge8 core values | `docs/product/product.md`, "How we work" |

---

## Open items for Dave before day one

- [ ] Confirm the spelling of her name including diacritics. The team record currently reads "Nghiem Cam Viet Ha" with none, and confirm she goes by Ha
- [ ] Set her position and start date on her team member record. Both are currently empty, which is why she does not appear correctly on the onboarding board
- [ ] Upload this plan against her onboarding journey at [https://www.edge8.ai/admin/talent/onboarding](https://www.edge8.ai/admin/talent/onboarding). The cron nags daily until a plan is attached
- [ ] Decide the Figma question in week 1
- [ ] Nominate the engineer who sits with her for the first PR in week 1
- [ ] Decide whether she attends any of the AustPayroll retreat week in person

---

*Last updated: 27 July 2026*
