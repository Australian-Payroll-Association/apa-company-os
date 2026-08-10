// One-off importer, PR 3 of the Leadership Coach v2 dev plan
// (docs/plans/2026-08-10-leadership-coach-dev-plan.md).
//
//   npx tsx scripts/coaching-import-lark-backup.ts
//
// Imports the final Lark coaching-wiki state (exported 2026-08-10 to
// ~/code-projects/leadership-coach/lark-backup/) into the v2 schema:
// the 2026-07-01 1-1 cycle, structured OCEAN reads, FAST goals with Eight
// Edges ladders, priorities, the live commitment table, retention roots,
// mode splits, and Lark Minutes tokens for the whole meeting history.
//
// Content is transcribed here verbatim from the backup files (cleaned of
// Lark's markdown escaping) rather than parsed at runtime: the export
// format is one-off, and embedding makes the import reviewable in the PR.
// Second-person OCEAN guidance is the AI rewrite of the coach-directed
// notes; every ocean row imports with published = false so Dave reviews
// before anything is member-visible.
//
// Idempotent: meetings keyed by (profile, held_on), goals/priorities/
// commitments by (profile, title), ocean by profile. Re-running fills
// gaps, never duplicates, never overwrites a non-null field it didn't
// write. Edges ladder targets are resolved by title match at runtime —
// no hardcoded UUIDs.
//
// Known drift (logged, not fixed here): the Lark dashboard's O1 had a
// "100 Retreat Attendees" KR that the Eight Edges Q3 seed does not —
// Quan's goal therefore imports without a ladder until Dave adds the KR.

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  const file = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of file.split("\n")) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    const [, k, raw] = m;
    if (process.env[k] !== undefined) continue;
    process.env[k] = raw.replace(/^"(.*)"$/, "$1").trim();
  }
}

type OceanDim = { rating: string; evidence: string };
type Seed = {
  email: string;
  label: string;
  nextOneOnOne: string | null;
  retentionRoot: "belonging" | "links" | "sacrifice" | "watching" | null;
  fastGoalLine: string; // the ★ goal line as written on the member page
  goals: {
    title: string;
    status: "active" | "draft";
    ladder?: { kind: "kr" | "metric"; match: string };
  }[];
  priorities: { title: string; detail?: string; ladder?: { kind: "kr"; match: string } }[];
  ocean: {
    openness: OceanDim;
    conscientiousness: OceanDim;
    extraversion: OceanDim;
    agreeableness: OceanDim;
    neuroticism: OceanDim;
    snapshot: string;
    guidance: string;
  } | null;
  privateAppendix: string | null; // coach-only: coaching moves, watch-fors, retention narrative
  meetings: {
    heldOn: string;
    minutesToken?: string;
    durationMin?: number;
    mode?: { coach: number; mentor: number; direct: number };
    privateSummary?: string;
    sharedSummary?: string;
  }[];
  commitments: {
    title: string;
    owner: "coach" | "member";
    dueOn: string | null;
    status: "open" | "on_track" | "needs_attention" | "blocked";
    linkMeeting?: string; // held_on of the 1-1 this came from
  }[];
};

// Mai's hiring KPI becomes a real Eight Edges metric she owns.
const METRIC_SEED = {
  name: "Days to hire",
  office: "talent",
  direction: "down",
  target: 20,
  source: "manual",
  ownerEmail: "mai@edge8.ai",
} as const;

const SEEDS: Seed[] = [
  {
    email: "mai@edge8.ai",
    label: "Mai Dang",
    nextOneOnOne: "2026-07-15",
    retentionRoot: "belonging",
    fastGoalLine: "Days to hire under 20 days; book 6 keynotes in 2026.",
    goals: [
      { title: "Book 6 keynotes in 2026", status: "active", ladder: { kind: "kr", match: "paid keynotes" } },
      { title: "Days to hire under 20 days", status: "active", ladder: { kind: "metric", match: "Days to hire" } },
    ],
    priorities: [
      {
        title: "P1 — Book 12 EO/YPO speaking engagements for Dave by Dec 31",
        detail: "At least 3 per quarter. Ladders to O1-KR1.",
        ladder: { kind: "kr", match: "paid keynotes" },
      },
      {
        title: "P2 — Support 25% profit margin across all business lines",
        detail: "Keep books current, flag any line under margin the same week. Ladders to O3-KR2.",
        ladder: { kind: "kr", match: "25% profit margin" },
      },
    ],
    ocean: {
      openness: {
        rating: "Medium",
        evidence:
          'Proposed her own Vietnam-market approach ("do some research about the market and then take the list from you and do some action like email"); executes once a lane is named.',
      },
      conscientiousness: {
        rating: "High",
        evidence:
          'Confirmed and closed action items ("Okay, I will do it"; "I\'ll get on Monday"); tracked the recurring EO-list thread ("we discussed this over three times").',
      },
      extraversion: {
        rating: "Medium",
        evidence:
          'Short, responsive turns; relational read on the team — surfaced that members "sometimes cannot adapt." Energy from people, not from holding the floor.',
      },
      agreeableness: {
        rating: "High",
        evidence:
          'Deferred readily ("Sure. Okay"); raised the moving-target concern gently rather than as a challenge.',
      },
      neuroticism: {
        rating: "Medium-High",
        evidence:
          'Named unease with ambiguity ("I\'m still not clear about this"; the goal "keeps going up and down") and uncertainty about the future ("still going, but I\'m not sure it will be better").',
      },
      snapshot:
        "Mai is a dependable, relationship-first operator who runs a tight process and genuinely cares about the people around her. She brings warmth and reliability to everything she touches, and the team trusts her because of it. She holds the pulse of the team: people naturally bring her what they would not raise elsewhere.",
      guidance: `You execute brilliantly once a lane is clearly named: you prepare, you follow through, and you close what you commit to. The team trusts you because you have earned it, and the way you read people is a real leadership asset — keep surfacing what you see.

Two growth edges for this season:

1. **Own one decision per cycle without checking in first.** You have the judgment; the habit to build is acting on it before asking. When you catch yourself waiting for approval, ask "what would I do if Dave were unreachable this week?" and do that.
2. **Name a moving target the moment you feel it.** When a goal or definition keeps shifting, saying "this is not stable yet, can we lock it?" is not a complaint — it is exactly the signal the team needs from you. You did this with the keynote goal, and it worked. Do it earlier and louder.

Your wiring runs on clarity and timely feedback. When things feel ambiguous or quiet, assume good intent and ask directly rather than absorbing the uncertainty — you carry enough already.`,
    },
    privateAppendix: `## Coaching moves (2026-07-01 read)

Warm and direct; give feedback frequently and specifically (silence reads as disapproval). The 2026-07-01 session ran heavily in direct mode — long monologues on accrual accounting and the keynote definition, with Dave answering his own questions — so open with a Reality question and let her talk first. Introduce change one lane at a time: the keynote goal has moved 3+ times and she has flagged that; stabilize the definition before adding to it. Push toward autonomous decisions by shrinking the approval loop — she is blocked waiting on the EO list, so give her explicit permission to start the Vietnam-market outreach without waiting.

## Watch-for

A moving-target goal is her stress trigger — she named that the keynote goal "keeps going up and down" and that she is "still not clear." Do not let the keynote definition or the EO-list commitment slip again; every reset lands as ambiguity she absorbs quietly. Name her wins out loud (she found the new PM on LinkedIn) so recognition stays visible.

## Loose engagement root (retention, 2026-07-01)

Fit and links remain strong — she is trusted, holds the people pulse, and Dave leans on her for team reads. Sacrifice is moderate. The thinnest root is now twofold: recognition (her ops/growth work can feel unseen) and stability of direction. New signal this session: she named, unprompted, that Dave's "busy and a bit chaotic" moving-target style makes it hard for team members to adapt and cited it as "one of the reasons they resign." She is reporting it as an observer, not as her own exit intent — but it is the mechanism that has cost retention before and she now feels it in her own goal (keynotes moving 3+ times). Commitment type: affective (wants to stay), watch. Protect it by giving her one stable lane and visible recognition. PRIVATE — the resignation-cause remark must never reach her person-facing page.`,
    meetings: [
      {
        heldOn: "2026-07-01",
        minutesToken: "obsgj588nvz23n13e82ciw98",
        durationMin: 26,
        mode: { coach: 10, mentor: 30, direct: 60 },
        privateSummary: `**Mode:** Direct — Dave over-directed. Long monologues on the keynote definition and cash-vs-accrual accounting, several self-answered questions; Mai's turns stayed short and responsive. Flip to coach mode next time.

**Five catalogue lines** (behaviors, not feelings):

1. What they want — a stable definition of the keynote goal plus the EO list, so she can act; she said it is "still not clear" and "keeps going up and down."
2. What is actually true — she owns the hiring lane and proposed tightening days-to-hire from under 20 to ~14; the keynote lane is blocked on Dave (definition + EO list), not on her effort.
3. What we discussed — what a keynote is (paid speaking; "hunting" for event bookers), cash vs. accrual accounting, tightening days-to-hire, and team reads (Quan, Tan, Bo Quan's AI-engineer training, "me"'s probation).
4. What they committed to, by when — research the Vietnam market and start keynote outreach, hold 1-1s with Quan and Tan, and proceed with "me"'s evaluation and contract; all by the 2026-07-15 1-1.
5. One signal on what is loose — she named the moving-target pattern directly ("keeps going up and down," "still not clear"): the keynote goal has not landed and she is absorbing the ambiguity quietly.

**Coaching move, next 1-1:** Last 1-1 ran 60% directing. Flip it — open with a Reality question, make her own one decision without checking first, and name a specific win so she feels seen.`,
        sharedSummary: `Good session, Mai — thank you. We reviewed your two goals: keeping days-to-hire tight (you're aiming to push it down toward ~14 days, which is great) and booking 6 keynotes in 2026. Nice work sourcing the new PM through LinkedIn. On keynotes, we got clearer on what one actually is — paid speaking opportunities that we "hunt" for the same way you hunt recruits — and where they come from (EO contacts, plus HR/AI conferences and universities in the Vietnam market). Dave will pull the new EO list so you have people to reach out to, and you'll start researching the Vietnam market and sending outreach. We also lined up your team check-ins (1-1s with Quan and Tan, and a look-in on Bo Quan's training) and agreed to move ahead with "me"'s probation evaluation and contract. You own the pulse of the team and it shows — keep pushing questions and ideas my way, and treat these two goals as the standing agenda every time we meet.`,
      },
      { heldOn: "2026-06-23", minutesToken: "obsgekru142t857isteqc695" },
      { heldOn: "2026-05-12", minutesToken: "obsgkxthe56xdma3hp2d6lao" },
      { heldOn: "2026-03-31", minutesToken: "obsgqyd8k3irjbuz3kamo619" },
      { heldOn: "2026-03-19", minutesToken: "obsgiul42d7yeyr79s114fnz" },
      { heldOn: "2026-03-05", minutesToken: "obsg861y4ijpeenpf8f5h3g1" },
      { heldOn: "2025-08-27", minutesToken: "obsgiva3922yrp4x59e5x2fy" },
      { heldOn: "2025-02-24", minutesToken: "obsgwtw4lxr6pg196oy9c2up" },
      { heldOn: "2024-12-23", minutesToken: "obusom89rvc1vmf1268z3l97" },
    ],
    commitments: [
      {
        title: "Pull and hand over the new EO list so Mai can start outreach",
        owner: "coach",
        dueOn: "2026-07-15",
        status: "blocked",
        linkMeeting: "2026-07-01",
      },
      {
        title: "Research the Vietnam market and start keynote outreach (email)",
        owner: "member",
        dueOn: "2026-07-15",
        status: "on_track",
        linkMeeting: "2026-07-01",
      },
      {
        title:
          "Hold 1-1s with Quan and Tan; check in on Bo Quan's AI-engineer training and read how the team is doing",
        owner: "member",
        dueOn: "2026-07-15",
        status: "on_track",
        linkMeeting: "2026-07-01",
      },
      {
        title: 'Proceed with the formal probation evaluation for "me" and issue her contract',
        owner: "member",
        dueOn: "2026-07-15",
        status: "on_track",
        linkMeeting: "2026-07-01",
      },
    ],
  },
  {
    email: "khoa.doan@edge8.ai",
    label: "Khoa Doan",
    nextOneOnOne: "2026-07-15",
    retentionRoot: "links",
    fastGoalLine: "Ramp fast — 500 paid AIO Labs users.",
    goals: [
      {
        title: "Ramp fast — 500 paid AIO Labs users",
        status: "active",
        ladder: { kind: "kr", match: "$170K MRR" },
      },
    ],
    priorities: [
      {
        title: "P1 — Own AI Labs",
        detail:
          "The company's top priority area and your strongest interest. Develop it and build toward large-scale sessions (1,000 to 2,000 people).",
      },
      {
        title: "P2 — Build the real company database",
        detail:
          "With Quan. Treat it like a client engagement: consolidate the existing ATS, CRM and tools into one source of truth, then build on top.",
      },
      {
        title: "P3 — Deliver current client projects",
        detail:
          "Justin / IPP e-commerce (Saigon retreat Jun 30, payments and fulfillment are the hard part) and James / Work Healthy, partnering with Trac on knowledge transfer over the next ~5 weeks.",
      },
    ],
    ocean: {
      openness: {
        rating: "High",
        evidence:
          'Database-as-platform vision; called the AI-avatar walkthrough "fun" and "better than I expected"; floats workshops/demo days.',
      },
      conscientiousness: {
        rating: "High",
        evidence:
          'When asked for a top priority, chose one and committed; "don\'t wanna make a delay anymore". Grinds single-threaded and finishes.',
      },
      extraversion: { rating: "TBD (low signal)", evidence: "" },
      agreeableness: { rating: "TBD (low signal)", evidence: "" },
      neuroticism: { rating: "TBD (low signal)", evidence: "" },
      snapshot:
        "Khoa is a strong engineer who loves the build cycle and thinks in platforms. He scopes his own work well, prefers technical and architecture leadership over people management, and commits cleanly once a priority is chosen. Three weeks in, his engagement is high and his direction is clear.",
      guidance: `You scope your own work well and you finish what you start — that combination is rarer than it sounds, and it is why the architecture lane is yours to own. Your platform instincts (the company database, the AI-avatar flow) are exactly what the company needs right now.

Two growth edges for this season:

1. **Multi-delegating over multitasking.** Your natural mode is grinding deep on one thing. The skill to build is lining up 3 to 4 planned workstreams, letting AI agents run them in parallel, reviewing, and ending the day focused. Deep focus stays your superpower; delegation multiplies it.
2. **Pull ownership proactively.** When a handoff or an ownership area is fuzzy, define it yourself and propose the boundary rather than waiting for it to be assigned. You named the knowledge-transfer risk sharply — the next step is owning the checklist, not just spotting the gap.

And do not be penny-wise, pound-foolish on AI tooling — your time is the expensive part.`,
    },
    privateAppendix: `## Coaching moves (2026-07-01 read)

Hand him ONE clearly-bounded ownership area (company DB + AI Labs), not Trac's whole backlog — when asked to prioritize he chose a single focus. Coach-first; he scopes his own work well. Push him to pull ownership proactively rather than wait for the hand-off.

## Watch-for

Absorbing Trac's undefined load at once. On 2026-07-01 he framed Trac's knowledge-docs as Trac's job, not his — the handoff has no owner yet. Probe next 1-1.

## Loose engagement root (retention, 2026-07-01)

Links is the thin root — his main technical anchor (Trac) leaves in ~4 weeks. Fit and engagement are high; the risk is losing his main source of undocumented knowledge once Trac exits (e.g. the Redis setup he can't yet identify), not disengagement. Protect it by handing one scoped ownership area. Commitment type: affective. Read 2026-07-01, low-moderate confidence.`,
    meetings: [
      {
        heldOn: "2026-07-01",
        durationMin: 26,
        privateSummary: `**Mode:** coach (mentor overlay) — question-first; taught FAST + the "penny-wise" lesson; one direct call on the new Claude account.

**Five catalogue lines** (behaviors, not feelings):

1. **What they want:** Own AIO Labs and get the company database clean and extensible; leads the architecture side (a PM is being hired for people/customer). Called the AI-avatar walkthrough "fun" and "better than I expected."
2. **What is actually true:** Labs DB still a concept — backend not wired; ~6 months slipped; speed/scale unsolved. Trac holds undocumented knowledge (e.g. the Redis DB Khoa can't identify).
3. **What we discussed:** FAST goal (500 paid users ≈ $25K/mo); Trac's 4-week handoff window; the token bottleneck (Teams + personal Max for ~3× capacity); Claude Code vs Codex; stop being penny-wise on infra.
4. **What they committed to:** In 2 weeks — DB "done enough" to hook the backend on, working. Research the Claude account setup and report what to buy.
5. **What is loose:** The Trac handoff is still verbal — Khoa named the risk sharply but framed docs as Trac's job, not his; no owner or checklist locked.

**Coaching move, next 1-1:** Coach the ownership choice — let him define what owning AI Labs means before you do. Lock what he needs from Trac before Trac exits.`,
        sharedSummary: `Good first real 1-1, Khoa. We locked your headline goal: 500 paid AIO Labs users by year-end — the number we check every two weeks (~$25K/month, which funds raises and bonuses). You're clearly into the product, and the AI-avatar learning flow is a genuine differentiator. Next two weeks: get the company database far enough along to wire the backend onto it and prove that piece works — the thing that's been holding us back from launch. We'll also fix your tooling so you're never waiting on tokens. With Trac wrapping up in about four weeks, it's a good time to capture his setup in docs — the Redis config, the repo history, and access details — so the team has what it needs. Launch opportunities are lining up (Philadelphia ~Jul 15). Nice work.`,
      },
      {
        heldOn: "2026-06-26",
        minutesToken: "obsggq12424avuqh34efr88v",
        durationMin: 35,
        mode: { coach: 25, mentor: 45, direct: 30 },
        privateSummary: `**Mode:** coach + direct — new hire, lots to orient; some directing on tooling and ownership.

**Five catalogue lines** (behaviors, not feelings):

1. **What they want:** technical / architecture leadership — plan and scope the work for others to execute, NOT people management. Wants to own the company database and AI Labs; wants to learn multi-agent ("collude") engineering.
2. **What is actually true:** ~3 weeks in, strong engineer, loves the build cycle. Grinds single-threaded and is slow to switch scope (his own contrast: Trac runs 3 projects at once). Trac, his main technical mentor, leaves in ~5 weeks.
3. **What we discussed:** multi-delegating vs multitasking; not being penny-wise / pound-foolish on AI tooling (read the engineering blog Dave shared, share learnings in the channel); the four ownership areas opening up; the Justin / Saigon retreat on June 30.
4. **Committed to, by when:** Khoa — talk to his wife about Saigon (come Mon 29, workshop Tue 30); read the engineering blog and start sharing learnings in the channel. Dave — finalize Justin, run Luke's 1-1, and define Khoa's ownership with Trac before Trac exits.
5. **One signal on what is loose:** LINKS — his primary technical anchor (Trac) is leaving; risk of feeling unmoored. Fit and engagement are high right now. Keep it by handing clear, scoped ownership (company database + AI Labs), not Trac's whole undefined load at once.

**Profile signal:** high openness (multi-agent, scaling visions), high conscientiousness (single-threaded, finishes), prefers technical over people leadership, reasonably communicative. **Watch-for:** do not dump Trac's full scope on him at once — he grinds one thing at a time; give him defined ownership.`,
        sharedSummary: `**Settling in (3 weeks):** You are enjoying the engineering cycle and the volume of real work. We talked about your habit of grinding deep on one thing, and the shift to multi-delegating vs multitasking: line up 3 to 4 planned workstreams, let AI run them in parallel, review, end the day focused. A skill to build.

**Your direction:** You want to lead on the technical and architecture side, planning and scoping work for others to execute, rather than people-managing. Noted, and a good fit.

**Growth focus:** Multi-agent ("collude") engineering. Read the engineering blog Dave shared, and start posting what you learn in the channel. Do not be penny-wise, pound-foolish on AI tooling.

**Ownership opening up:** Four areas need owners: AI Labs, the Infinite Leverage agents, the Human Token Tracker, and a real company database. You are most drawn to the company database and AI Labs.

**Next:** Justin / IPP e-commerce retreat, Saigon, Tue June 30 (come Mon 29). The hard part is payments and fulfillment, not the website. You, Dave, and Quan.

**Your commitments:** Confirm Saigon with your wife; read the eng blog and post one learning in the channel.`,
      },
    ],
    commitments: [
      {
        title: 'Company DB "done enough" to hook the backend onto it, and that piece working',
        owner: "member",
        dueOn: "2026-07-15",
        status: "open",
        linkMeeting: "2026-07-01",
      },
      {
        title: "Research Claude account setup (Teams + personal Max vs top-ups); report what to buy",
        owner: "member",
        dueOn: "2026-07-15",
        status: "open",
        linkMeeting: "2026-07-01",
      },
      {
        title: "Fund + set up new personal Claude account (start $100/4×, upgrade if it runs out)",
        owner: "coach",
        dueOn: null,
        status: "open",
        linkMeeting: "2026-07-01",
      },
      {
        title: "Get Trac's knowledge documented before he exits (Redis, repo, keys)",
        owner: "member",
        dueOn: null,
        status: "needs_attention",
        linkMeeting: "2026-07-01",
      },
    ],
  },
  {
    email: "quan@edge8.ai",
    label: "Quan Chau",
    nextOneOnOne: "2026-07-15",
    retentionRoot: "belonging",
    fastGoalLine: "500 retreat attendees.",
    goals: [
      // Drift: the Lark O1 "100 Retreat Attendees" KR is not in the Eight Edges
      // seed, so this goal has no ladder target yet. Logged by the run.
      { title: "500 retreat attendees", status: "active" },
    ],
    priorities: [],
    ocean: {
      openness: { rating: "TBD (low signal)", evidence: "" },
      conscientiousness: {
        rating: "High (provisional)",
        evidence:
          'Volunteered a dated end-to-end ownership plan (prep → setup → follow-up, own by ~6 weeks); offered to take the token tracker and "really polish" it back to a clean architecture.',
      },
      extraversion: { rating: "TBD (low signal)", evidence: "" },
      agreeableness: {
        rating: "Low (provisional)",
        evidence:
          'Self-described: "I get a little pushy too… I present it to you and nudge you" — pushes a vetted view rather than deferring.',
      },
      neuroticism: { rating: "TBD (low signal)", evidence: "" },
      snapshot:
        'Quan is experienced, initiative-taking, and direct. He came from structured consulting, builds plans with dates on them, and pushes a vetted point of view rather than deferring. Two months in, he calls the retreats work "something I\'m really passionate about" and says he is "full gas."',
      guidance: `You bring experience, initiative, and a plan with dates on it — and you push back with a vetted view instead of just agreeing. Keep doing that; it is signal, not friction, and it is treated that way.

Two growth edges for this season:

1. **State the ownership boundary yourself.** Where a lane is fuzzy (which retreats, which prep steps, where Dave should step back), propose the line explicitly instead of working around it. You are at your best when the scope is yours on paper, not just in practice.
2. **Hold yourself to the Will, not just the goal.** You agree fast and warmly — make sure each agreement converts into a named owner, a first checkpoint, and a date, especially on things you take over (like the token tracker).

The PM discipline is your highest-leverage muscle right now: the retreat business becomes yours end-to-end as that muscle builds.`,
    },
    privateAppendix: `## Coaching moves (2026-07-01 read)

He is capable, experienced, and initiative-taking — over-direct less, ask more. The first 1-1 ran mentor-heavy (Dave set both metrics, taught FAST and GROW); next cycle default back to coach. He responds to being treated as a peer and pushes back with a vetted view, so receive the challenge without defending — his "pushy" is signal, not friction. Give explicit permission to own and decide, then hold him to the Will, not the goal. Because he agreed fast and warmly to everything proposed, draw out where he actually disagrees before closing — do not read the string of "yeahs" as full alignment.

## Watch-for

The ownership line between Quan-led and Dave-led is still fuzzy. In this session Dave kept the pen — wrote the goals, kept the James/Justin presentations. He accepted a ~6-week hand-off to own the 7th/8th Vietnam retreats end-to-end, but who owns what before then was never nailed down. Next 1-1, make him state the boundary himself: which retreats, which prep steps, and where Dave should step back. Watch that "I'll take it" on the human-token tracker does not quietly become Dave carrying the customer role while Quan architects — pin an owner and a first checkpoint.

## Loose engagement root (retention, 2026-07-01)

New (~2 months). No retention flag. Reads affective — wants to be here: called retreats "something I'm really, still really passionate about," the goal "a golden opportunity," and said he is "full gas." Thinnest root is fit, not disengagement: he came from structured consulting with "a team of people I could lean on" and named the startup's unstructured setting as the unfamiliar part — he says Claude and the assembly get him "90% there" and he feels "protected," but the adjustment is the live variable. Links and sacrifice are naturally thin this early, so watch fit: keep his ownership real and unblocked. Confirm next cycle.`,
    meetings: [
      {
        heldOn: "2026-07-01",
        minutesToken: "obsgj336twly1q24d7u5yvps",
        durationMin: 27,
        privateSummary: `**Mode:** mentor (first-ever 1-1, ran mentor-heavy) — Dave wrote both FAST metrics, taught FAST ("the A is ambitious") and the GROW "Will," and framed the PM discipline from his own experience. Question-first coaching was light; Dave proposed, Quan agreed and elaborated. Default back to coach next cycle.

**Five catalogue lines** (behaviors, not feelings):

1. **What they want:** Own the retreats end-to-end — the full experience from prep and pre-work through delivery, post-work, and follow-up — and channel attendees toward three package tiers (small / medium / whole-shebang) where everyone walks away with a built product. Called retreats something he is "still really passionate about" and said he is "full gas on that one."
2. **What is actually true:** ~2 months in; the retreat deck is "more or less memorized" but he still plugs into individual components rather than leading end-to-end. The Human Token Tracker drifted from his intended V0 architecture across V1/V2 and does not log Dave's own work; Trac, who built it, is exiting. Dave still holds the pen — he wrote the goals and is keeping the James and Justin presentations.
3. **What we discussed:** The two FAST metrics Dave wrote (500 retreat attendees; 100 documented products by end of 2026); the FAST framework and the GROW "Will" as the task layer; the PM discipline as the single highest-leverage muscle to build; the upcoming retreat calendar (Jul 27 James/Tracy, Aug 3 Justin Coen, Aug 7 public repeat + Aug 8 first Agentic day in Vietnam); taking over the token tracker; and pairing with Wang (Huang).
4. **What they committed to (by when):** Map and own the retreat end-to-end by the Aug 7/8 retreats (~6 weeks); take over and restore the token tracker with Dave as the first customer, first checkpoint 2026-07-15; work with Wang on the DB/tracker; and research the PM discipline — all reviewed at the next 1-1.
5. **What is loose:** The Quan-led vs Dave-led ownership boundary was never nailed down. Dave kept the goals and both client presentations ("I wouldn't expect you to own that one") while Quan agreed warmly to everything proposed; no owner or checkpoint was locked for the stretch before the ~6-week hand-off. Make him state the boundary himself next 1-1.

**Coaching move, next 1-1:** Open with Goal and Reality, let him define what owning retreats means. Do not fill the silence.`,
        sharedSummary: `Great first 1-1, Quan. We aligned on your focus: growing the retreats business, anchored by two goals for the year — 500 retreat attendees and 100 documented products from participants. We walked the upcoming retreat calendar and set a path for you to take the lead on running a retreat end-to-end over the next six weeks, aiming at the Aug 7–8 sessions. You also took on getting the Human Token Tracker into great shape — simplifying it toward the clean V0 design and partnering with Wang. Loved the energy and the "full gas" attitude. Let's keep building the PM muscle — it's the highest-leverage skill right now.`,
      },
    ],
    commitments: [
      {
        title:
          "Map the retreat end-to-end (prep · setup · pre-work · delivery · follow-up) and own it end-to-end by the 7th/8th Vietnam retreats; plug into components until then",
        owner: "member",
        dueOn: "2026-08-08",
        status: "on_track",
        linkMeeting: "2026-07-01",
      },
      {
        title:
          "Take over the Human Token Tracker: sync with Trac on the V1/V2 changes, restore the simpler V0 architecture, surface the dashboard, and make Dave's own logging (human token → AI tokens → PRs → goal) actually work",
        owner: "member",
        dueOn: "2026-07-15",
        status: "needs_attention",
        linkMeeting: "2026-07-01",
      },
      {
        title: "Work with Wang (Huang) on the DB / tracker and bring him up to speed on how we operate",
        owner: "member",
        dueOn: "2026-07-15",
        status: "on_track",
        linkMeeting: "2026-07-01",
      },
      {
        title:
          "Research the PM discipline and come back with what he wants to learn / build (the PM-agent muscle)",
        owner: "member",
        dueOn: "2026-07-15",
        status: "on_track",
        linkMeeting: "2026-07-01",
      },
      {
        title: "Finish migrating and cleaning the rebuilt CRM; point the websites at the one CRM",
        owner: "coach",
        dueOn: "2026-07-06",
        status: "on_track",
        linkMeeting: "2026-07-01",
      },
      {
        title: "Act as Quan's first tracker customer: re-install on his projects, report what is not logging",
        owner: "coach",
        dueOn: "2026-07-15",
        status: "on_track",
        linkMeeting: "2026-07-01",
      },
    ],
  },
  {
    email: "my.pham@edge8.ai",
    label: "My Pham",
    nextOneOnOne: "2026-07-15",
    retentionRoot: "links",
    fastGoalLine: "Forecast by the 20th each month; expected vs actual within 10%.",
    goals: [
      {
        title: "Forecast by the 20th each month; expected vs actual within 10%",
        status: "active",
        ladder: { kind: "kr", match: "25% profit margin" },
      },
    ],
    priorities: [],
    ocean: {
      openness: {
        rating: "Medium (low-confidence)",
        evidence:
          'Named her own pattern unprompted: "I\'m really data-oriented and I keep banking my head against the wall for the tiny little things… need a bit of a mindset shift."',
      },
      conscientiousness: {
        rating: "Medium (low-confidence)",
        evidence:
          'Built in a buffer when picking the delivery date ("the 5th is giving it a buffer"); cited prior outsourcing/accounting experience; leans to detail/tracking.',
      },
      extraversion: { rating: "TBD (low signal)", evidence: "" },
      agreeableness: {
        rating: "TBD (low signal)",
        evidence:
          'Short affirming answers ("Yes", "Correct", "It makes sense") make agree-to-please vs genuine buy-in indistinguishable this session.',
      },
      neuroticism: { rating: "TBD (low signal)", evidence: "" },
      snapshot:
        "My is data-oriented with a real accounting and outsourcing background, builds buffers into her own deadlines, and names her own growth areas unprompted. Two months in, she is being stretched from admin and bookkeeping toward an owner-analyst forecasting role.",
      guidance: `Your data instincts and accounting background are exactly the foundation this role needs — and the fact that you name your own patterns ("banking my head against the wall on tiny things") means you already see the growth edge clearly.

Two growth edges for this season:

1. **Aim the skill forward.** Your highest-value work is predicting what's coming — the rolling 3-month forecast — not perfecting the record of what already happened. When you catch yourself deep in backward-looking detail, ask: "does this change what we do next month?"
2. **Say it back in your own words.** When a goal or a framework lands in a 1-1, restate it your way rather than confirming with "yes / correct." If you can say the forecast logic in your own words, it is yours; if not, that is the exact question to ask.

Think of the arc as accounting → forecasting → CFO-level judgment. The company wants your analysis, not just your data.`,
    },
    privateAppendix: `## Coaching moves (2026-07-01 read)

She reaches for the concrete and the backward-looking (cost-cutting, admin detail) — steer her forward to prediction and analysis by asking, not telling ("what's №1?", "what can you control?") which worked well this session. Make her say the answer back in her own words rather than accepting "yes/correct"; the goal only sticks once she articulates the forecast logic herself. Frame her contribution as owner-level judgement ("I want your analysis, not just the data") to pull her out of pure execution. Keep goals to two — she flagged that too many goals dilutes focus and Dave agreed.

## Watch-for

Agree-to-please. Her buy-in signals are short affirmations ("yes", "correct", "makes sense") that don't prove she has internalised the operator-to-owner shift. Don't read agreement as understanding — probe for it. Second risk: she defaults back to cost-cutting/admin detail ("keep things running and cutting costs") when unsteered; re-anchor to forecasting and margin analysis each cycle until the owner mindset holds.

## Loose engagement root (retention, 2026-07-01)

Watching (first 1-1, thin read). Fit: developing — passed probation with a strong review and is being stretched from admin/bookkeeping toward an owner-analyst / forecasting role; the stretch is motivating if the mindset shift lands, a source of friction if it doesn't. Links: thinnest root — only 2 months in, no established peer bonds evidenced in-room; her working relationships with Dave and Quan are still prospective. Sacrifice: minimal at this tenure. Thinnest root overall = links. Commitment type: not yet affective; reads as early continuance/normative. Build affective commitment by making the forecasting ownership visibly hers and connecting it to career progression (accounting → forecasting → CFO framing she responded to).`,
    meetings: [
      {
        heldOn: "2026-07-01",
        minutesToken: "obsgj65526dm545n6g3r7mdl",
        durationMin: 39,
        privateSummary: `**Mode:** Coach. Dave asked open questions and withheld answers to draw her out ("what's №1?", "what can you control?", "how would you phrase it?"; "I want to know what you know first"; "I don't know the answer, I'm just brainstorming with you"), redirecting rather than instructing.

**Five catalogue lines** (behaviors, not feelings):

1. **Want:** She asked for time plus the June expenses/data from Dave and a clearer view of the sales prospects before she could forecast.
2. **True:** To be clear on expectations and shift from head-down data/admin work up to higher-level strategic and forecasting thinking — she named it herself ("I'm really data-oriented, banking my head against the wall on tiny things… need a bit of a mindset shift").
3. **Discussed:** That her №1 priority is predicting the future (not cutting cost or looking back); how the business makes money (keynotes, public/private retreats, staffing) and where the margin lives; and a 200% retreat profit-margin target she can influence through analysis.
4. **Committed:** First rolling 3-month forecast, a cleaned plain-ledger retreat P&L reviewed with Dave, and a weekly retreat margin analysis pushed to Dave & Quan — first cut by the next 1-1, 2026-07-15.
5. **Loose:** Buy-in is unconfirmed — she agreed in short affirmations ("yes", "correct", "makes sense") and did not restate the operator-to-owner / forecasting logic in her own words, so it is unclear whether the mindset shift has actually landed.

**Coaching move, next 1-1:** Get to know her wiring and interests first. Coach, do not assign. Confirm depth of understanding by having her state the forecast logic back.`,
        sharedSummary: `Great first 1-1, My — thanks for thinking out loud with me. The big takeaway: your №1 priority is looking forward, not back. Rather than cutting cost or cleaning up the past, your highest-value work is predicting what's coming — a rolling 3-month forecast of what we'll earn and spend, so the team always knows where we stand. We agreed you'll deliver that forecast by the 15th each month: July as tight as ~10%, with August and September a little looser, then just small adjustments each cycle. The first one is the heaviest lift because you're building all three months at once — after that it gets much easier. Alongside the numbers, the second focus is our retreats, where most of our upside is: keep the retreat P&L as a clean, plain ledger (budget · actual · difference) and bring a short weekly read on where each one stands and what it needs to hit a strong margin. You already have the instincts and the data background for this — the shift is just aiming that skill forward. Anything you need from me (June expenses, the CRM access), push me for it. Nice work, and talk soon at our next one-on-one.`,
      },
    ],
    commitments: [
      {
        title: "Deliver the first rolling 3-month forecast (Jul within ~10%, Aug/Sep looser)",
        owner: "member",
        dueOn: "2026-07-15",
        status: "on_track",
        linkMeeting: "2026-07-01",
      },
      {
        title:
          "Clean up the retreat P&L sheet into a plain ledger (budget · actual · difference; drop the formatting) and review it with Dave",
        owner: "member",
        dueOn: "2026-07-15",
        status: "on_track",
        linkMeeting: "2026-07-01",
      },
      {
        title:
          "Produce a weekly retreat analysis for Dave & Quan — margin status per retreat, path to the 200% target, outstanding payments — and push the team on it",
        owner: "member",
        dueOn: "2026-07-15",
        status: "on_track",
        linkMeeting: "2026-07-01",
      },
      {
        title: "Send My June expenses and time so she can close the month and forecast",
        owner: "coach",
        dueOn: "2026-07-05",
        status: "needs_attention",
        linkMeeting: "2026-07-01",
      },
      {
        title:
          "Finish migrating the CRM to one company database and give My access so she can own pipeline forecasting",
        owner: "coach",
        dueOn: "2026-07-15",
        status: "needs_attention",
        linkMeeting: "2026-07-01",
      },
    ],
  },
];

// Ginny (inactive, contractor): only her last dashboard mode split lands on her
// existing 2026-04-20 meeting. Her "NPS + 50" Lark goal is not imported — no
// active coaching relationship to attach it to.
const GINNY = {
  email: "ginny.vo@edge8.ai",
  meetingHeldOn: "2026-04-20",
  mode: { coach: 10, mentor: 60, direct: 30 },
};

const PREP_PATH = resolve(
  process.env.HOME ?? "~",
  "code-projects/leadership-coach/lark-backup/Manager/Wed 2026-07-01 — Prep.md"
);

// Slice the shared prep doc into per-person sections by their "## Name — HH:MM"
// headings; fall back to the whole doc if a heading is missing.
function prepSlice(prepDoc: string, firstName: string): string | null {
  const unescaped = prepDoc.replace(/\\([\\`*_{}[\]()#+\-.!|<>~])/g, "$1");
  const re = new RegExp(`^## ${firstName}[^\n]*$`, "m");
  const m = re.exec(unescaped);
  if (!m) return null;
  const start = m.index;
  const next = unescaped.slice(start + m[0].length).search(/^## /m);
  const body =
    next === -1
      ? unescaped.slice(start)
      : unescaped.slice(start, start + m[0].length + next);
  const header = unescaped.split(/^## /m)[0]; // the shared reminders block
  return `${header.trim()}\n\n${body.trim()}`;
}

async function main() {
  loadEnvLocal();
  const { companyOs } = await import("../lib/supabase");

  const log: string[] = [];
  const skip: string[] = [];

  // ---- shared lookups -------------------------------------------------------

  async function profileByEmail(email: string): Promise<{ id: string } | null> {
    const { data: person } = await companyOs
      .from("people")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    if (!person) return null;
    const { data: tms } = await companyOs
      .from("team_members")
      .select("id")
      .eq("person_id", (person as { id: string }).id);
    for (const tm of (tms ?? []) as { id: string }[]) {
      const { data: prof } = await companyOs
        .from("coaching_profiles")
        .select("id")
        .eq("team_member_id", tm.id)
        .maybeSingle();
      if (prof) return prof as { id: string };
    }
    return null;
  }

  async function personIdByEmail(email: string): Promise<string | null> {
    const { data } = await companyOs.from("people").select("id").ilike("email", email).maybeSingle();
    return (data as { id: string } | null)?.id ?? null;
  }

  async function krIdByTitle(match: string): Promise<string | null> {
    const { data } = await companyOs
      .from("key_results")
      .select("id, title")
      .ilike("title", `%${match}%`);
    const rows = (data ?? []) as { id: string; title: string }[];
    if (rows.length !== 1) return null;
    return rows[0].id;
  }

  // ---- Mai's hiring KPI as an Eight Edges metric ---------------------------

  let hiringMetricId: string | null = null;
  {
    const ownerId = await personIdByEmail(METRIC_SEED.ownerEmail);
    if (!ownerId) {
      skip.push(`metric "${METRIC_SEED.name}": owner ${METRIC_SEED.ownerEmail} not found`);
    } else {
      const { data: existing } = await companyOs
        .from("metrics")
        .select("id")
        .eq("name", METRIC_SEED.name)
        .maybeSingle();
      if (existing) {
        hiringMetricId = (existing as { id: string }).id;
        log.push(`metric "${METRIC_SEED.name}": exists`);
      } else {
        const { data, error } = await companyOs
          .from("metrics")
          .insert({
            name: METRIC_SEED.name,
            office: METRIC_SEED.office,
            direction: METRIC_SEED.direction,
            target: METRIC_SEED.target,
            source: METRIC_SEED.source,
            owner_person_id: ownerId,
          })
          .select("id")
          .single();
        if (error) skip.push(`metric "${METRIC_SEED.name}": ${error.message}`);
        else {
          hiringMetricId = (data as { id: string }).id;
          log.push(`metric "${METRIC_SEED.name}": created (target ${METRIC_SEED.target}, down)`);
        }
      }
    }
  }

  const prepDoc = existsSync(PREP_PATH) ? readFileSync(PREP_PATH, "utf8") : null;
  if (!prepDoc) skip.push(`prep doc missing at ${PREP_PATH}`);

  // ---- per-person import ----------------------------------------------------

  for (const seed of SEEDS) {
    const profile = await profileByEmail(seed.email);
    if (!profile) {
      skip.push(`${seed.label}: no coaching profile found`);
      continue;
    }
    const pid = profile.id;

    // profile fields: next 1-1, retention root, legacy fast_goal columns
    // (still read by the v1 UI until PR 4 lands).
    await companyOs
      .from("coaching_profiles")
      .update({
        next_one_on_one_on: seed.nextOneOnOne,
        retention_root: seed.retentionRoot,
        fast_goal: seed.fastGoalLine,
        fast_goal_status: "set",
        updated_at: new Date().toISOString(),
      })
      .eq("id", pid);
    log.push(`${seed.label}: profile updated (next 1-1 ${seed.nextOneOnOne}, root ${seed.retentionRoot})`);

    // private appendix onto private_profile_markdown (append-once by marker)
    if (seed.privateAppendix) {
      const { data: prof } = await companyOs
        .from("coaching_profiles")
        .select("private_profile_markdown")
        .eq("id", pid)
        .single();
      const current = ((prof as { private_profile_markdown: string | null }).private_profile_markdown ?? "").trim();
      const marker = "## Coaching moves (2026-07-01 read)";
      if (!current.includes(marker)) {
        const next = current ? `${current}\n\n---\n\n${seed.privateAppendix}` : seed.privateAppendix;
        await companyOs
          .from("coaching_profiles")
          .update({ private_profile_markdown: next })
          .eq("id", pid);
        log.push(`${seed.label}: private appendix added`);
      } else {
        log.push(`${seed.label}: private appendix already present`);
      }
    }

    // structured OCEAN (published=false — Dave reviews before member-visible)
    if (seed.ocean) {
      const o = seed.ocean;
      const row = {
        coaching_profile_id: pid,
        openness_rating: o.openness.rating,
        openness_evidence: o.openness.evidence || null,
        conscientiousness_rating: o.conscientiousness.rating,
        conscientiousness_evidence: o.conscientiousness.evidence || null,
        extraversion_rating: o.extraversion.rating,
        extraversion_evidence: o.extraversion.evidence || null,
        agreeableness_rating: o.agreeableness.rating,
        agreeableness_evidence: o.agreeableness.evidence || null,
        neuroticism_rating: o.neuroticism.rating,
        neuroticism_evidence: o.neuroticism.evidence || null,
        snapshot_markdown: o.snapshot,
        guidance_markdown: o.guidance,
        updated_at: new Date().toISOString(),
      };
      const { data: existing } = await companyOs
        .from("coaching_ocean_profiles")
        .select("id")
        .eq("coaching_profile_id", pid)
        .maybeSingle();
      if (existing) {
        await companyOs
          .from("coaching_ocean_profiles")
          .update(row)
          .eq("id", (existing as { id: string }).id);
        log.push(`${seed.label}: OCEAN updated (published untouched)`);
      } else {
        const { error } = await companyOs
          .from("coaching_ocean_profiles")
          .insert({ ...row, published: false });
        if (error) skip.push(`${seed.label} OCEAN: ${error.message}`);
        else log.push(`${seed.label}: OCEAN created (unpublished)`);
      }
    }

    // goals
    for (const goal of seed.goals) {
      const { data: existing } = await companyOs
        .from("coaching_goals")
        .select("id")
        .eq("coaching_profile_id", pid)
        .eq("title", goal.title)
        .maybeSingle();
      if (existing) {
        log.push(`${seed.label}: goal "${goal.title}" exists`);
        continue;
      }
      let ladder: Record<string, string> = {};
      if (goal.ladder?.kind === "kr") {
        const krId = await krIdByTitle(goal.ladder.match);
        if (krId) ladder = { key_result_id: krId };
        else skip.push(`${seed.label}: goal "${goal.title}" — KR match "${goal.ladder.match}" unresolved, imported without ladder`);
      } else if (goal.ladder?.kind === "metric") {
        if (hiringMetricId) ladder = { metric_id: hiringMetricId };
        else skip.push(`${seed.label}: goal "${goal.title}" — metric missing, imported without ladder`);
      } else {
        skip.push(`${seed.label}: goal "${goal.title}" — no Eight Edges target (Lark retreat-attendees KR not in the Edges seed)`);
      }
      const { error } = await companyOs.from("coaching_goals").insert({
        coaching_profile_id: pid,
        title: goal.title,
        status: goal.status,
        quarter_label: "2026-Q3",
        ...ladder,
      });
      if (error) skip.push(`${seed.label} goal "${goal.title}": ${error.message}`);
      else log.push(`${seed.label}: goal "${goal.title}" created${ladder.key_result_id ? " (→ KR)" : ladder.metric_id ? " (→ metric)" : ""}`);
    }

    // priorities
    for (const [i, prio] of seed.priorities.entries()) {
      const { data: existing } = await companyOs
        .from("coaching_priorities")
        .select("id")
        .eq("coaching_profile_id", pid)
        .eq("title", prio.title)
        .maybeSingle();
      if (existing) {
        log.push(`${seed.label}: priority "${prio.title}" exists`);
        continue;
      }
      let ladder: Record<string, string> = {};
      if (prio.ladder) {
        const krId = await krIdByTitle(prio.ladder.match);
        if (krId) ladder = { key_result_id: krId };
        else skip.push(`${seed.label}: priority "${prio.title}" — KR unresolved`);
      }
      const { error } = await companyOs.from("coaching_priorities").insert({
        coaching_profile_id: pid,
        title: prio.title,
        detail_markdown: prio.detail ?? null,
        sort_order: i,
        ...ladder,
      });
      if (error) skip.push(`${seed.label} priority: ${error.message}`);
      else log.push(`${seed.label}: priority "${prio.title}" created`);
    }

    // meetings
    for (const mtg of seed.meetings) {
      const { data: existing } = await companyOs
        .from("coaching_one_on_ones")
        .select("id, summary_markdown, shared_summary_markdown, prep_markdown, minutes_token")
        .eq("coaching_profile_id", pid)
        .eq("held_on", mtg.heldOn)
        .maybeSingle();
      const patch: Record<string, unknown> = {};
      if (mtg.minutesToken) patch.minutes_token = mtg.minutesToken;
      if (mtg.mode) {
        patch.mode_coach_pct = mtg.mode.coach;
        patch.mode_mentor_pct = mtg.mode.mentor;
        patch.mode_direct_pct = mtg.mode.direct;
      }
      const row = existing as
        | { id: string; summary_markdown: string | null; shared_summary_markdown: string | null; prep_markdown: string | null; minutes_token: string | null }
        | null;
      if (row) {
        if (mtg.privateSummary && !row.summary_markdown) patch.summary_markdown = mtg.privateSummary;
        if (mtg.sharedSummary && !row.shared_summary_markdown) patch.shared_summary_markdown = mtg.sharedSummary;
        if (mtg.heldOn === "2026-07-01" && prepDoc && !row.prep_markdown) {
          const slice = prepSlice(prepDoc, seed.label.split(" ")[0]);
          if (slice) patch.prep_markdown = slice;
        }
        if (Object.keys(patch).length) {
          await companyOs.from("coaching_one_on_ones").update(patch).eq("id", row.id);
          log.push(`${seed.label}: 1-1 ${mtg.heldOn} updated (${Object.keys(patch).join(", ")})`);
        }
      } else {
        const insert: Record<string, unknown> = {
          coaching_profile_id: pid,
          held_on: mtg.heldOn,
          status: "held",
          ...patch,
        };
        if (mtg.privateSummary) insert.summary_markdown = mtg.privateSummary;
        if (mtg.sharedSummary) insert.shared_summary_markdown = mtg.sharedSummary;
        if (mtg.heldOn === "2026-07-01" && prepDoc) {
          const slice = prepSlice(prepDoc, seed.label.split(" ")[0]);
          if (slice) insert.prep_markdown = slice;
        }
        const { error } = await companyOs.from("coaching_one_on_ones").insert(insert);
        if (error) skip.push(`${seed.label} 1-1 ${mtg.heldOn}: ${error.message}`);
        else log.push(`${seed.label}: 1-1 ${mtg.heldOn} created`);
      }
    }

    // commitments (linked to their source 1-1 where known)
    for (const c of seed.commitments) {
      const { data: existing } = await companyOs
        .from("coaching_commitments")
        .select("id")
        .eq("coaching_profile_id", pid)
        .eq("title", c.title)
        .maybeSingle();
      if (existing) {
        log.push(`${seed.label}: commitment "${c.title.slice(0, 40)}…" exists`);
        continue;
      }
      let oneOnOneId: string | null = null;
      if (c.linkMeeting) {
        const { data: mtg } = await companyOs
          .from("coaching_one_on_ones")
          .select("id")
          .eq("coaching_profile_id", pid)
          .eq("held_on", c.linkMeeting)
          .maybeSingle();
        oneOnOneId = (mtg as { id: string } | null)?.id ?? null;
      }
      const { error } = await companyOs.from("coaching_commitments").insert({
        coaching_profile_id: pid,
        one_on_one_id: oneOnOneId,
        title: c.title,
        owner: c.owner,
        due_on: c.dueOn,
        status: c.status,
      });
      if (error) skip.push(`${seed.label} commitment: ${error.message}`);
      else log.push(`${seed.label}: commitment "${c.title.slice(0, 40)}…" created (${c.status})`);
    }
  }

  // ---- Ginny's last mode split ---------------------------------------------
  {
    const profile = await profileByEmail(GINNY.email);
    if (!profile) skip.push("Ginny: no coaching profile");
    else {
      const { data: mtg } = await companyOs
        .from("coaching_one_on_ones")
        .select("id, mode_coach_pct")
        .eq("coaching_profile_id", profile.id)
        .eq("held_on", GINNY.meetingHeldOn)
        .maybeSingle();
      const row = mtg as { id: string; mode_coach_pct: number | null } | null;
      if (!row) skip.push(`Ginny: 1-1 ${GINNY.meetingHeldOn} not found`);
      else if (row.mode_coach_pct == null) {
        await companyOs
          .from("coaching_one_on_ones")
          .update({
            mode_coach_pct: GINNY.mode.coach,
            mode_mentor_pct: GINNY.mode.mentor,
            mode_direct_pct: GINNY.mode.direct,
          })
          .eq("id", row.id);
        log.push(`Ginny: mode split ${GINNY.mode.coach}/${GINNY.mode.mentor}/${GINNY.mode.direct} on ${GINNY.meetingHeldOn}`);
      } else log.push("Ginny: mode split already set");
    }
  }

  console.log("\n== imported ==");
  for (const l of log) console.log("  " + l);
  console.log("\n== skipped / drift ==");
  for (const s of skip.length ? skip : ["(none)"]) console.log("  " + s);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
