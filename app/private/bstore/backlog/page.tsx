"use client";

import { useEffect, useMemo, useState } from "react";
import { PasswordInput } from "@/components/PasswordInput";

const PASSWORD = "Bstore2026";
const STORAGE_KEY = "bstore-backlog-priorities";

// ── Backlog data ──────────────────────────────────────────────────────
// Synthesized from Bstore's own Step 1 AI Framework audits (Retail
// Manager, Customer Service, Dispatch, Ecomm, Marketing, Stock Team
// WILO), the Tech Stack list, and the 2026-07-31 project scope call.

type Priority = "now" | "next" | "later" | "park";

type Item = {
  id: string;
  title: string;
  who: string;
  today: string;
  build: string;
  needs: string[];
  tokens?: string;
  def: Priority;
};

type Group = {
  key: string;
  step: string;
  title: string;
  intro: string;
  items: Item[];
};

const GROUPS: Group[] = [
  {
    key: "foundation",
    step: "Step 1",
    title: "Data Foundation - one-way syncs into the central database",
    intro:
      "Read-only, masked-in-transit syncs from each source system into the Bstore-owned Supabase database. These are enablers: every report and automation below depends on one or more of them. Nothing writes back to source systems in this step.",
    items: [
      {
        id: "F1",
        title: "MYOB Acumatica sync (sales, stock on hand, orders, POs, products, employees)",
        who: "Everyone",
        today:
          "System of record. Every role's audit shows manual exports, report refreshes and re-keying out of MYOB.",
        build:
          "Daily read-only sync of the core entities into the central database, masked in transit. First task is an API research spike on the Acumatica contract-based REST API.",
        needs: ["API research", "MYOB read"],
        tokens: "20-40",
        def: "now",
      },
      {
        id: "F2",
        title: "Master data spine: employees, stores, brands, products, suppliers",
        who: "Everyone",
        today: "No single source of truth linking people, stores and products across systems.",
        build:
          "The hierarchy layer of the database, per the scope call: master and relationship data first, salaried employees before casual staff.",
        needs: ["MYOB read", "Wageloch read"],
        tokens: "10-20",
        def: "now",
      },
      {
        id: "F3",
        title: "Wageloch sync (hours, rosters, labour cost)",
        who: "Malin, Sean, Shannon",
        today: "Labour data lives apart from revenue data, so labour-vs-revenue checks are manual.",
        build:
          "Read-only sync of time and attendance data. Wageloch has no public API docs; access is on request, so this starts with a vendor conversation.",
        needs: ["API research", "Wageloch read"],
        tokens: "8-20",
        def: "now",
      },
      {
        id: "F4",
        title: "Shopify sync (orders, fulfilment status, catalog)",
        who: "Erin, Jessie, Brenda",
        today: "Orders are looked up separately in Shopify, then again in MYOB, for every return and dispatch check.",
        build: "Read-only sync via Shopify's well-documented API. Unlocks the cross-system order view.",
        needs: ["Shopify read"],
        tokens: "8-16",
        def: "next",
      },
      {
        id: "F5",
        title: "REDO returns sync",
        who: "Erin",
        today: "Return requests live only in REDO; every return means a third lookup.",
        build: "Read-only sync of return requests and statuses so a return, its order and its ERP record sit in one row.",
        needs: ["API research", "REDO read"],
        tokens: "6-14",
        def: "next",
      },
      {
        id: "F6",
        title: "Marketing platform pulls (Klaviyo, Google, Meta, Pinterest, TikTok, AfterPay)",
        who: "Brenda, Megan",
        today: "The weekly Gecko report is copy-pasted together from up to nine platforms.",
        build: "Scheduled read-only pulls of the reporting metrics each platform exposes, landing in reporting tables.",
        needs: ["Platform APIs"],
        tokens: "12-24",
        def: "next",
      },
      {
        id: "F7",
        title: "Metronome data ingest",
        who: "Leadership",
        today: "Metronome consumes numbers but has no public API.",
        build:
          "Export-based ingest at best for now. Kept on the list so the constraint is visible; revisit if Metronomics opens an API.",
        needs: ["No API available"],
        tokens: "6-16",
        def: "park",
      },
    ],
  },
  {
    key: "reports",
    step: "Step 1",
    title: "Reports on demand - built once, refreshed from the database",
    intro:
      "The contract targets roughly five on-demand reports in the Foundation. Each one replaces a manual compile-and-email routine with a report that refreshes itself from the central database, plus AI-written commentary and exception ranking. Pick the five that matter most.",
    items: [
      {
        id: "R1",
        title: "Monday weekly retail report",
        who: "Sean",
        today: "About 3 hours every Monday; roughly half auto-pulls over ODBC, the rest is manual Excel work.",
        build:
          "Priority Workflow 1 from the scope call: the full report prepared automatically each Monday from ERP and labour data, with draft commentary.",
        needs: ["F1", "F3"],
        tokens: "8-16",
        def: "now",
      },
      {
        id: "R2",
        title: "Metronome update pack",
        who: "Leadership (about 10 people)",
        today: "Around 10 people each spend an hour a week keying the Monday numbers into Metronome.",
        build:
          "Priority Workflow 2: generate every Metronome value paste-ready from the Monday report data. True auto-entry is blocked by the missing API, so this cuts the hour to minutes rather than to zero.",
        needs: ["R1"],
        tokens: "6-14",
        def: "next",
      },
      {
        id: "R3",
        title: "Weekly retail KPI email to store managers",
        who: "Malin",
        today:
          "Collect Super Duper, Fast/Slow and Labour Cost reports, analyse, combine into one report, draft and send the email.",
        build:
          "One generated weekly pack combining the three reports with drafted store-manager email ready for Malin's review and send.",
        needs: ["F1", "F3"],
        tokens: "8-16",
        def: "now",
      },
      {
        id: "R4",
        title: "Stock reporting stack: Fast/Slow, stock and sales, warehouse holding",
        who: "Kim, stock team",
        today:
          "About 4 hours a week across refreshing macros, updating parameters, pasting values, validating and distributing (SOP refs STK-REP-001 to 005).",
        build:
          "Auto-prepared weekly stock reports with validation checks, week-on-week exception ranking and drafted commentary for the leadership meeting.",
        needs: ["F1"],
        tokens: "10-20",
        def: "now",
      },
      {
        id: "R5",
        title: "Gecko weekly marketing report",
        who: "Brenda, Megan",
        today: "Pull data from Shopify plus up to eight marketing platforms, paste into the Gecko sheet, interpret, share.",
        build: "Auto-compiled weekly marketing report with drafted insights, from the platform pulls in F6.",
        needs: ["F4", "F6"],
        tokens: "8-18",
        def: "next",
      },
      {
        id: "R6",
        title: "Labour cost vs revenue roster check",
        who: "Malin",
        today: "Review each store's roster and compare planned labour cost to revenue by hand.",
        build: "Per-store weekly view of planned labour vs revenue with flagged outliers and suggested adjustments to discuss with SMs.",
        needs: ["F1", "F3"],
        tokens: "6-12",
        def: "next",
      },
      {
        id: "R7",
        title: "Stock Q&A assistant",
        who: "Kim, stock team, stores",
        today:
          "Ad hoc requests (check stock for a style, stock by size, brand performance) trigger manual pivot pulls and one-off analysis.",
        build: "A chat assistant over the central database that answers stock and sales questions on demand, read-only.",
        needs: ["F1"],
        tokens: "6-12",
        def: "next",
      },
      {
        id: "R8",
        title: "Rolling stocktake results report",
        who: "Shin Yi",
        today: "Meant to run weekly; skipped since the MYOB migration because there is no time.",
        build: "Auto-generated weekly stocktake results by store and brand, restoring a control that has quietly lapsed.",
        needs: ["F1"],
        tokens: "4-10",
        def: "later",
      },
    ],
  },
  {
    key: "assist",
    step: "Anytime",
    title: "AI assist - no data sync required",
    intro:
      "Drafting and checking work that Claude can do today with good instructions and reference documents. No integration dependencies, so these can start immediately and double as certification challenges: each one is a real deliverable a team member can build during their AI Officer program.",
    items: [
      {
        id: "S1",
        title: "Product descriptions and fit notes",
        who: "Brenda",
        today: "Top two recurring activities in the Ecomm audit; written by hand per product.",
        build: "A house-style writing assistant: product info in, on-brand description and fit note out, human QA before publish.",
        needs: ["No sync needed"],
        tokens: "2-6",
        def: "now",
      },
      {
        id: "S2",
        title: "PDP QA checklist agent",
        who: "Brenda",
        today: "Manual completeness checks before publishing product pages.",
        build: "A checklist agent that reviews a draft PDP against the standard and lists what is missing.",
        needs: ["No sync needed"],
        tokens: "2-6",
        def: "next",
      },
      {
        id: "S3",
        title: "Social captions and campaign copy",
        who: "Robynn, Megan",
        today: "Captions, copy variations and post ideas written manually; flagged 'Easy / Very High' in Bstore's own opportunity table.",
        build: "Campaign-aware copy assistant producing caption and copy options in brand voice for scheduling in Sked Social.",
        needs: ["No sync needed"],
        tokens: "2-6",
        def: "now",
      },
      {
        id: "S4",
        title: "Briefs: campaign, influencer, supplier",
        who: "Robynn, Megan",
        today: "Every campaign starts with hand-written briefs and asset requests.",
        build: "Brief templates plus an assistant that drafts each brief from the campaign calendar entry.",
        needs: ["No sync needed"],
        tokens: "2-6",
        def: "now",
      },
      {
        id: "S5",
        title: "Recurring comms templates",
        who: "Malin",
        today: "Typing recurring emails from scratch; a named bottleneck in the Retail Manager audit.",
        build: "A template library plus drafting assistant for the weekly KPI email, confirmations, approvals and follow-ups.",
        needs: ["No sync needed"],
        tokens: "2-6",
        def: "now",
      },
      {
        id: "S6",
        title: "Training SOPs and Axonify content",
        who: "Malin",
        today: "Building training docs, checklists, KLPs and quiz questions by hand before loading to Axonify.",
        build: "An assistant that turns a rough process outline into an SOP, KLPs and quiz questions ready to load.",
        needs: ["No sync needed"],
        tokens: "2-6",
        def: "now",
      },
      {
        id: "S7",
        title: "Recruitment: ads, screening summaries, scorecards",
        who: "Malin",
        today: "Typing ads, chasing GM wording approval, filtering applicants by hand.",
        build: "Drafted job ads in house style, applicant screening summaries against the Metronome scorecard, interview question packs.",
        needs: ["No sync needed"],
        tokens: "2-8",
        def: "next",
      },
      {
        id: "S8",
        title: "VM instructions and store comms",
        who: "Malin",
        today: "Typing up VM setup instructions per store/window/section and the emails that go with them (MMX).",
        build: "Drafted VM instructions and store emails from the guideline plus the marketing calendar entry.",
        needs: ["No sync needed"],
        tokens: "2-6",
        def: "next",
      },
      {
        id: "S9",
        title: "Meeting notes to actions",
        who: "Everyone",
        today: "Manual recaps and follow-up chasing across departments.",
        build: "Standard practice taught in certification: notes in, owners, actions and drafted follow-ups out.",
        needs: ["No sync needed"],
        tokens: "1-4",
        def: "now",
      },
    ],
  },
  {
    key: "automation",
    step: "Step 2",
    title: "Cross-system automation - needs two-way sync",
    intro:
      "These write back into source systems, so they come after Step 1 proves the read-only pipeline and after we research each write API. Default state is Later on purpose: we pick a small number together once the foundation is live. Ranked here by the pain they remove.",
    items: [
      {
        id: "A1",
        title: "Returns command centre",
        who: "Erin",
        today:
          "Every return means the same order looked up in Shopify, REDO and MYOB, cross-checked, then statuses and financial adjustments keyed into each. Six of the audit's top ten activities.",
        build:
          "One screen per return showing all three systems, with the agent preparing status updates and MYOB adjustments for one-click human approval. The leading Step 2 candidate.",
        needs: ["F1", "F4", "F5", "MYOB write"],
        tokens: "30-60",
        def: "next",
      },
      {
        id: "A2",
        title: "Dispatch order match and validation",
        who: "Jessie",
        today: "Matching Shopify and MYOB orders and checking products against the order is the top recurring dispatch task.",
        build: "Pre-matched order pairs with mismatches flagged before picking starts; dispatch confirms instead of compares.",
        needs: ["F1", "F4"],
        tokens: "20-40",
        def: "later",
      },
      {
        id: "A3",
        title: "Backorder and aged-order triage",
        who: "Jessie",
        today: "Working oldest orders one at a time across both systems, deciding reallocate, transfer, refund or wait.",
        build:
          "A daily triage list with stock, age, value and location already assembled and a recommended action per order; human decides, agent executes the routine follow-through.",
        needs: ["F1", "F4", "MYOB write"],
        tokens: "16-32",
        def: "later",
      },
      {
        id: "A4",
        title: "New product creation into MYOB and Shopify",
        who: "Shin Yi, Sarah",
        today: "20 to 30 minutes per item; seasonal entry runs to 10 hours, and 'a day' per week in the WILO.",
        build: "Supplier data in, validated product records created in MYOB and Shopify with barcodes and pricing checked.",
        needs: ["MYOB write", "Shopify write"],
        tokens: "16-32",
        def: "later",
      },
      {
        id: "A5",
        title: "Price update automation",
        who: "Shin Yi, Sarah, Maria",
        today: "Price changes appear in every stock team member's WILO, hours per week combined, 'depending how slow MYOB decides to be'.",
        build: "A price change list approved once, applied everywhere by the agent, with a change log.",
        needs: ["MYOB write"],
        tokens: "12-24",
        def: "later",
      },
      {
        id: "A6",
        title: "MYOB weekly PO cleanup",
        who: "Kim, stock team",
        today: "A weekly rules-based cleanup routine (Steve Brown workflow 4).",
        build: "The rules encoded and run automatically with an exception list for human review.",
        needs: ["MYOB write"],
        tokens: "8-16",
        def: "later",
      },
      {
        id: "A7",
        title: "New employee onboarding flow",
        who: "Malin",
        today:
          "Application form, then accounts created by hand in Axonify and Wageloch, welcome email, retail code, and lag between team, Malin and finance.",
        build:
          "One intake form that triggers account creation, welcome email and a status tracker everyone can see. Depends on what Axonify and Wageloch expose.",
        needs: ["API research", "Axonify", "Wageloch write"],
        tokens: "16-32",
        def: "later",
      },
      {
        id: "A8",
        title: "Balance backs and replenishment assist",
        who: "Sarah, Shin Yi, Maria",
        today:
          "The single biggest time pool in the WILO: 4 to 6 hours per allocation day for FitFlop alone, plus daily runs across a dozen brands.",
        build:
          "Research-heavy: encode the allocation logic, generate proposed balance backs for approval, then execute. High reward, approached carefully after the easier MYOB write-backs prove out.",
        needs: ["F1", "MYOB write"],
        tokens: "40-80",
        def: "later",
      },
      {
        id: "A9",
        title: "Support ticket reply drafting with order context",
        who: "Erin",
        today: "Ticket queue handled reply by reply, choosing between macros and custom responses.",
        build: "Drafted replies with the customer's order and return status already looked up; Erin reviews and sends.",
        needs: ["F4", "F5"],
        tokens: "12-24",
        def: "later",
      },
      {
        id: "A10",
        title: "Influencer send-out coordination",
        who: "Robynn, Megan",
        today: "Requesting shoes through MYOB, chasing dispatch details, sending tracking to influencers by hand.",
        build: "A send-out tracker that raises the MYOB request, watches dispatch and drafts the tracking email.",
        needs: ["MYOB write", "F4"],
        tokens: "12-24",
        def: "park",
      },
    ],
  },
  {
    key: "north",
    step: "North Star",
    title: "Bigger builds and open gaps",
    intro:
      "Where this goes once the foundation is earning its keep, plus the gaps in the current audit coverage that need Bstore input.",
    items: [
      {
        id: "N1",
        title: "Bstore portal: role-based views with a database chatbot",
        who: "Everyone",
        today: "The north star from the scope call: Revenue / Talent / Operations / Innovation views over the owned database.",
        build: "Built module by module on top of the central database once syncs and first reports are live.",
        needs: ["F1-F6"],
        tokens: "40-80",
        def: "later",
      },
      {
        id: "N2",
        title: "In-house Metronome replacement",
        who: "Leadership",
        today: "Named in the scope call as a candidate to eventually build in-house.",
        build: "Scorecards and KPI tracking inside the portal, fed live from the database instead of keyed weekly.",
        needs: ["N1"],
        tokens: "40-80",
        def: "park",
      },
      {
        id: "N3",
        title: "Warehouse workflows - audit missing",
        who: "Miles, Harsh",
        today: "Miles and Harsh are on the certification list but no Step 1 audit exists for the warehouse.",
        build: "Bstore action: run the same Step 1 audit for the warehouse team, then fold the findings into this backlog.",
        needs: ["Bstore input"],
        def: "park",
      },
      {
        id: "N4",
        title: "Finance workflows - audit missing",
        who: "Shannon",
        today: "No Step 1 audit exists for finance; ProSpend and payroll touchpoints appear only in other roles' audits.",
        build: "Bstore action: run the Step 1 audit for finance, then fold the findings into this backlog.",
        needs: ["Bstore input"],
        def: "park",
      },
      {
        id: "N5",
        title: "Shopify POS cutover support",
        who: "Leadership",
        today: "1Retail is the current store POS; Shopify POS is listed as the future one.",
        build: "When the cutover is scheduled, the central database absorbs the reporting impact so store data keeps flowing.",
        needs: ["Bstore decision"],
        def: "park",
      },
    ],
  },
];

const PRIORITIES: { key: Priority; label: string }[] = [
  { key: "now", label: "Now" },
  { key: "next", label: "Next" },
  { key: "later", label: "Later" },
  { key: "park", label: "Park" },
];

const PRIORITY_LABEL: Record<Priority, string> = {
  now: "Now",
  next: "Next",
  later: "Later",
  park: "Park",
};

const ALL_ITEMS = GROUPS.flatMap((g) => g.items.map((it) => ({ ...it, group: g.title })));

const STYLES = `
  .bstore-doc {
    --bg: #ffffff; --card: #ffffff; --ink: #101014; --muted: #797c82;
    --accent: #287BE8; --accent-bright: #3B8CF5; --mint: #6FF2C1;
    --accent-soft: rgba(40,123,232,0.08); --border: #E6E6E6; --line: #EAEEF2;
    background: var(--bg); color: var(--ink);
    font: 16px/1.6 'Manrope', 'Helvetica Neue', Arial, sans-serif;
    padding: 108px 16px 56px; min-height: 100vh; box-sizing: border-box;
  }
  .bstore-doc * { box-sizing: border-box; }
  .bstore-doc .wrap { max-width: 960px; margin: 0 auto; }
  .bstore-doc header.bl-head {
    background: linear-gradient(135deg, var(--accent) 0%, var(--accent-bright) 100%);
    color: #fff; border-radius: 20px; padding: 32px 28px; margin-bottom: 24px;
  }
  .bstore-doc header.bl-head h1 { margin: 0 0 6px; font-size: 26px; letter-spacing: -0.02em; }
  .bstore-doc header.bl-head .meta { font-size: 14px; opacity: 0.92; line-height: 1.8; }
  .bstore-doc section.bl-section {
    background: var(--card); border: 1px solid var(--border); border-radius: 14px;
    padding: 22px 26px; margin-bottom: 18px;
  }
  .bstore-doc h2 {
    font-size: 19px; margin: 0 0 6px; padding-bottom: 10px;
    border-bottom: 2px solid var(--accent-soft); letter-spacing: -0.01em;
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  }
  .bstore-doc .step-tag {
    flex: none; font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.04em; padding: 3px 10px; border-radius: 99px;
    background: var(--accent-soft); color: var(--accent);
  }
  .bstore-doc .group-intro { color: var(--muted); font-size: 14px; margin: 8px 0 16px; }
  .bstore-doc p { margin: 0 0 12px; }
  .bstore-doc ul { margin: 0 0 12px; padding-left: 22px; }
  .bstore-doc li { margin-bottom: 7px; }
  .bstore-doc a { color: var(--accent); text-decoration: none; }
  .bstore-doc a:hover { text-decoration: underline; }
  .bstore-doc .lead {
    background: var(--accent-soft); border-radius: 10px;
    padding: 14px 16px; margin: 4px 0 12px; font-size: 15px;
  }
  .bstore-doc .item {
    border: 1px solid var(--border); border-radius: 12px;
    padding: 14px 16px; margin-bottom: 10px;
  }
  .bstore-doc .item-top { display: flex; gap: 10px; align-items: flex-start; flex-wrap: wrap; }
  .bstore-doc .item-id {
    flex: none; font-size: 12px; font-weight: 700; color: var(--accent);
    background: var(--accent-soft); border-radius: 6px; padding: 3px 7px; margin-top: 2px;
  }
  .bstore-doc .item-title { font-weight: 650; font-size: 15px; flex: 1 1 260px; }
  .bstore-doc .pills { display: flex; gap: 4px; flex: none; }
  .bstore-doc .pill {
    font-size: 12px; font-weight: 600; padding: 4px 11px; border-radius: 99px;
    border: 1px solid var(--border); background: #fff; color: var(--muted);
    cursor: pointer; transition: all 0.12s ease; font-family: inherit;
  }
  .bstore-doc .pill:hover { border-color: var(--accent); color: var(--accent); }
  .bstore-doc .pill.on-now { background: var(--accent); border-color: var(--accent); color: #fff; }
  .bstore-doc .pill.on-next { background: rgba(111,242,193,0.25); border-color: #0b8f63; color: #0b8f63; }
  .bstore-doc .pill.on-later { background: #f2f4f7; border-color: #b8bfc9; color: #4a505a; }
  .bstore-doc .pill.on-park { background: #fff4e5; border-color: #d8871f; color: #b06508; }
  .bstore-doc .item-body { font-size: 14px; margin-top: 8px; }
  .bstore-doc .item-body .row { margin-bottom: 4px; }
  .bstore-doc .item-body .k { color: var(--muted); font-weight: 600; }
  .bstore-doc .chips { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; align-items: center; }
  .bstore-doc .chip {
    font-size: 11px; font-weight: 600; color: var(--muted);
    border: 1px solid var(--line); border-radius: 99px; padding: 2px 9px;
  }
  .bstore-doc .chip.tok { color: var(--accent); border-color: var(--accent-soft); background: var(--accent-soft); }
  .bstore-doc .edited { font-size: 11px; color: #b06508; font-weight: 600; }
  .bstore-doc .toolbar {
    display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
    border: 1px solid var(--border); border-radius: 14px;
    padding: 14px 16px; margin-bottom: 18px; background: var(--card);
    position: sticky; top: 76px; z-index: 5; box-shadow: 0 4px 18px rgba(16,16,20,0.05);
  }
  .bstore-doc .counts { display: flex; gap: 6px; flex-wrap: wrap; flex: 1; }
  .bstore-doc .count { font-size: 12px; font-weight: 600; color: var(--muted); padding: 3px 10px; border-radius: 99px; background: #f2f4f7; }
  .bstore-doc .btn {
    font-family: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
    border-radius: 99px; padding: 8px 16px; border: 1px solid var(--accent);
    background: var(--accent); color: #fff; transition: opacity 0.12s ease;
  }
  .bstore-doc .btn:hover { opacity: 0.9; }
  .bstore-doc .btn.ghost { background: #fff; color: var(--accent); }
  .bstore-doc footer { text-align: center; color: var(--muted); font-size: 13px; margin-top: 8px; }
  .bstore-doc .dm-flow { display: flex; gap: 12px; align-items: stretch; margin: 14px 0 10px; }
  .bstore-doc .dm-col { flex: 1; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
  .bstore-doc .dm-col-label {
    font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
    color: var(--muted); text-align: center; margin-bottom: 2px;
  }
  .bstore-doc .dm-box {
    border: 1px solid var(--border); border-radius: 10px; padding: 8px 11px;
    font-size: 13px; font-weight: 600; background: #fff; text-align: center;
  }
  .bstore-doc .dm-box small { display: block; font-weight: 500; color: var(--muted); font-size: 11px; }
  .bstore-doc .dm-core {
    border: 2px solid var(--accent); border-radius: 14px; padding: 12px;
    background: var(--accent-soft); display: flex; flex-direction: column; gap: 8px;
    justify-content: center;
  }
  .bstore-doc .dm-core-title { text-align: center; font-weight: 700; font-size: 14px; color: var(--accent); }
  .bstore-doc .dm-core .dm-box { border-color: rgba(40,123,232,0.35); }
  .bstore-doc .dm-arrow {
    flex: none; align-self: center; display: flex; flex-direction: column; align-items: center;
    gap: 4px; color: var(--muted); font-size: 11px; font-weight: 600; text-align: center;
    width: 84px;
  }
  .bstore-doc .dm-arrow .ar { color: var(--accent); font-size: 20px; line-height: 1; }
  .bstore-doc .dm-arrow .ar.back { color: #b06508; }
  @media (max-width: 720px) {
    .bstore-doc .dm-flow { flex-direction: column; }
    .bstore-doc .dm-arrow { width: auto; transform: rotate(90deg); margin: 2px 0; }
  }
`;

export default function BstoreBacklogPage() {
  const [entered, setEntered] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState(false);
  const [prios, setPrios] = useState<Record<string, Priority>>({});
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      setPrios(JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"));
    } catch {
      setPrios({});
    }
  }, []);

  function priorityOf(item: Item): Priority {
    return prios[item.id] || item.def;
  }

  function setPriority(id: string, p: Priority) {
    setPrios((prev) => {
      const next = { ...prev, [id]: p };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function resetAll() {
    setPrios({});
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  const counts = useMemo(() => {
    const c: Record<Priority, number> = { now: 0, next: 0, later: 0, park: 0 };
    for (const it of ALL_ITEMS) c[prios[it.id] || it.def] += 1;
    return c;
  }, [prios]);

  function copySummary() {
    const lines: string[] = [
      `Bstore automation backlog - priorities (${new Date().toISOString().slice(0, 10)})`,
      "",
    ];
    for (const p of PRIORITIES) {
      const items = ALL_ITEMS.filter((it) => (prios[it.id] || it.def) === p.key);
      if (items.length === 0) continue;
      lines.push(`${p.label.toUpperCase()}:`);
      for (const it of items) {
        const changed = prios[it.id] && prios[it.id] !== it.def ? " *" : "";
        lines.push(`- ${it.id} ${it.title}${changed}`);
      }
      lines.push("");
    }
    lines.push("* changed from Edge8's proposed priority");
    navigator.clipboard
      .writeText(lines.join("\n"))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        /* ignore */
      });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (entered === PASSWORD) {
      setUnlocked(true);
      setError(false);
    } else {
      setError(true);
    }
  }

  if (!unlocked) {
    return (
      <div
        style={{
          minHeight: "100vh",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "108px 24px 56px",
          fontFamily: "'Manrope', 'Helvetica Neue', Arial, sans-serif",
          background: "#ffffff",
        }}
      >
        <form
          onSubmit={handleSubmit}
          style={{
            width: "100%",
            maxWidth: "360px",
            background: "#fff",
            border: "1px solid #E6E6E6",
            borderRadius: "20px",
            padding: "28px 26px",
            boxShadow: "0 4px 24px rgba(16,16,20,0.06)",
          }}
        >
          <h1 style={{ margin: "0 0 4px", fontSize: "20px", color: "#101014" }}>
            Bstore - AI Program
          </h1>
          <p style={{ margin: "0 0 18px", fontSize: "14px", color: "#797c82" }}>
            Enter the access code to view this document.
          </p>
          <PasswordInput
            value={entered}
            onChange={(e) => setEntered(e.target.value)}
            placeholder="Access code"
            autoFocus
            wrapperStyle={{ marginBottom: error ? "8px" : "16px" }}
            inputStyle={{
              padding: "11px 12px",
              fontSize: "15px",
              border: `1px solid ${error ? "#e0564f" : "#A8B2BD"}`,
              borderRadius: "10px",
              outline: "none",
            }}
          />
          {error && (
            <p style={{ margin: "0 0 14px", fontSize: "13px", color: "#e0564f" }}>
              Incorrect code. Try again.
            </p>
          )}
          <button
            type="submit"
            style={{
              width: "100%",
              padding: "11px 12px",
              fontSize: "15px",
              fontWeight: 600,
              color: "#fff",
              background: "#287BE8",
              border: "none",
              borderRadius: "40px",
              cursor: "pointer",
            }}
          >
            Unlock
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="bstore-doc">
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <div className="wrap">
        <header className="bl-head">
          <h1>Bstore &middot; AI Program</h1>
          <div className="meta">
            Every opportunity from your Step 1 AI Framework audits, consolidated and grouped.
            <br />
            <strong>Sources:</strong> Retail Manager, Customer Service, Dispatch, Ecomm, Marketing
            and Stock Team audits &middot; Tech Stack list &middot; project scope call (Jul 31)
            <br />
            <a href="/private/bstore" style={{ color: "#fff", textDecoration: "underline" }}>
              &larr; Back to Project Scope Summary
            </a>
          </div>
        </header>

        <section className="bl-section">
          <h2>How to use this</h2>
          <p>
            This is the working backlog behind the Foundation roadmap. Edge8 has proposed a
            priority for every item; the pills are yours to change. Your edits save in this
            browser. When you are happy, hit <strong>Copy summary</strong> and email it back, and
            we lock the roadmap together.
          </p>
          <ul>
            <li>
              <strong>Now</strong> - part of the Foundation build starting immediately.
            </li>
            <li>
              <strong>Next</strong> - queued behind Now; mostly waiting on a sync or an API
              answer.
            </li>
            <li>
              <strong>Later</strong> - real, but after the foundation proves itself (Step 2
              candidates).
            </li>
            <li>
              <strong>Park</strong> - visible but not planned.
            </li>
          </ul>
          <p className="lead">
            <strong>The two-step logic:</strong> Step 1 syncs data one way, read-only and masked,
            out of your systems into your own central database. That alone unlocks every report
            here. Step 2 picks a short list of workflows to automate properly, which needs two-way
            sync and per-system API research. We choose Step 2 items together once Step 1 is live.
          </p>
          <p style={{ fontSize: 14, color: "#797c82", marginBottom: 0 }}>
            <strong>Token estimates</strong> are pre-research ranges (1 token = 1 hour of Edge8
            expert time). The Foundation fee covers the database, the first syncs and 2 to 4
            builds chosen from this backlog; beyond that, work draws on prepaid token packs with a
            written estimate approved before each build.
          </p>
        </section>

        <section className="bl-section">
          <h2>The central database at the core</h2>
          <p className="group-intro" style={{ margin: "8px 0 0" }}>
            Data sync is required for everything on this page. The centralized database is the
            core: sources feed it one way, everything you get out of it reads from it. The schema
            starts from Edge8&apos;s Company OS template (about 80 tables covering CRM, HR,
            commerce, content and reporting), trimmed and fitted to a retailer.
          </p>
          <div className="dm-flow">
            <div className="dm-col">
              <div className="dm-col-label">Your systems</div>
              <div className="dm-box">MYOB Acumatica<small>ERP: sales, stock, POs, payroll</small></div>
              <div className="dm-box">Wageloch<small>hours &amp; rosters</small></div>
              <div className="dm-box">Shopify<small>online orders</small></div>
              <div className="dm-box">REDO<small>returns</small></div>
              <div className="dm-box">Klaviyo + ad platforms<small>marketing metrics</small></div>
            </div>
            <div className="dm-arrow">
              <span className="ar">&rarr;</span>
              Step 1<br />one-way sync, masked in transit
            </div>
            <div className="dm-col">
              <div className="dm-core">
                <div className="dm-core-title">Bstore central database (your Supabase)</div>
                <div className="dm-box">People &amp; org<small>employees, stores, roles</small></div>
                <div className="dm-box">Products &amp; stock<small>styles, SOH by store, POs</small></div>
                <div className="dm-box">Sales &amp; orders<small>POS + online, fulfilment</small></div>
                <div className="dm-box">Customers &amp; returns<small>orders, returns, tickets</small></div>
                <div className="dm-box">Labour &amp; marketing<small>hours, cost, campaign metrics</small></div>
              </div>
            </div>
            <div className="dm-arrow">
              <span className="ar">&rarr;</span>
              reads
              <span className="ar back">&#8617;</span>
              Step 2<br />approved write-backs
            </div>
            <div className="dm-col">
              <div className="dm-col-label">What you get</div>
              <div className="dm-box">Reports on demand<small>R1&ndash;R8</small></div>
              <div className="dm-box">Q&amp;A assistants<small>ask the database directly</small></div>
              <div className="dm-box">Automations<small>A1&ndash;A10, human-approved</small></div>
              <div className="dm-box">Bstore portal<small>role-based views (N1)</small></div>
            </div>
          </div>
          <p style={{ fontSize: 13, color: "#797c82", marginBottom: 0 }}>
            One direction in Step 1: nothing writes back to your systems until a Step 2 automation
            is chosen, researched and approved. Bstore owns the database and every credential.
          </p>
        </section>

        <div className="toolbar">
          <div className="counts">
            {PRIORITIES.map((p) => (
              <span key={p.key} className="count">
                {p.label}: {counts[p.key]}
              </span>
            ))}
          </div>
          <button type="button" className="btn ghost" onClick={resetAll}>
            Reset to proposed
          </button>
          <button type="button" className="btn" onClick={copySummary}>
            {copied ? "Copied!" : "Copy summary"}
          </button>
        </div>

        {GROUPS.map((g) => (
          <section key={g.key} className="bl-section">
            <h2>
              <span className="step-tag">{g.step}</span>
              {g.title}
            </h2>
            <p className="group-intro">{g.intro}</p>
            {g.items.map((it) => {
              const p = priorityOf(it);
              const edited = !!prios[it.id] && prios[it.id] !== it.def;
              return (
                <div key={it.id} className="item">
                  <div className="item-top">
                    <span className="item-id">{it.id}</span>
                    <span className="item-title">{it.title}</span>
                    <span className="pills">
                      {PRIORITIES.map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          className={`pill${p === opt.key ? ` on-${opt.key}` : ""}`}
                          onClick={() => setPriority(it.id, opt.key)}
                          aria-pressed={p === opt.key}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </span>
                  </div>
                  <div className="item-body">
                    <div className="row">
                      <span className="k">Who: </span>
                      {it.who}
                    </div>
                    <div className="row">
                      <span className="k">Today: </span>
                      {it.today}
                    </div>
                    <div className="row">
                      <span className="k">The build: </span>
                      {it.build}
                    </div>
                    <div className="chips">
                      {it.needs.map((n) => (
                        <span key={n} className="chip">
                          {n}
                        </span>
                      ))}
                      {it.tokens && <span className="chip tok">est. {it.tokens} tokens</span>}
                      {edited && (
                        <span className="edited">
                          edited (Edge8 proposed {PRIORITY_LABEL[it.def]})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        ))}

        <section className="bl-section">
          <h2>Open questions for Bstore</h2>
          <ul style={{ marginBottom: 0 }}>
            <li>
              The Core Workflow diagrams in the audit documents came through as embedded images.
              Please send the originals (or the source files) so nothing is lost in translation.
            </li>
            <li>
              Warehouse (Miles, Harsh) and Finance (Shannon) have no Step 1 audits yet. Both teams
              are on the certification list; running the same audit closes the loop (N3, N4).
            </li>
            <li>
              MYOB Acumatica, Wageloch, REDO and Axonify API access are research items in week
              one. Estimates firm up as each answer lands.
            </li>
          </ul>
        </section>

        <footer>
          Compiled by Edge8 from Bstore&apos;s Step 1 AI Framework audits &middot; August 2026
        </footer>
      </div>
    </div>
  );
}
