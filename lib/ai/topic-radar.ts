import Anthropic from "@anthropic-ai/sdk";
import { readTextOutput } from "@/lib/ai/response";

// Scans the regulators for changes worth an article in the members' update.
//
// The whole design turns on one thing: the model must never propose a topic it
// has not actually retrieved. Two mechanisms enforce that, and neither is a
// prompt instruction.
//
//   1. `allowed_domains` on the search tool. This is enforced server-side, so a
//      result from outside APA's source-of-truth list is not something the
//      model can return even if it wants to. No amount of prompt drift gets a
//      blog post or a competitor's summary into the list.
//
//   2. One request PER AREA rather than one request for everything. A single
//      call with a shared search budget spends it on whatever it looks at
//      first — a trial run exhausted 14 searches on super and awards and never
//      reached FBT or long service leave, then correctly reported those as
//      unsearched. Splitting the areas makes coverage a property of the code
//      instead of the model's budgeting.
//
// Same contract as the other writers here: never throws, no-ops without a key.

const MODEL = process.env.RADAR_CLAUDE_MODEL || "claude-opus-5";

// Commonwealth regulators. Split out because several areas share them.
const ATO = ["ato.gov.au", "softwaredevelopers.ato.gov.au"];
const FAIR_WORK = ["fairwork.gov.au", "fwc.gov.au"];

// The eight state and territory revenue offices. Payroll tax is set
// jurisdiction by jurisdiction, so a scan that checks only the big three
// misses exactly the changes a national membership needs told about.
const REVENUE_OFFICES = [
  "revenue.nsw.gov.au",
  "sro.vic.gov.au",
  "qro.qld.gov.au",
  "revenuesa.sa.gov.au",
  "wa.gov.au",
  "sro.tas.gov.au",
  "revenue.act.gov.au",
  "treasury.nt.gov.au",
];

const WORKERS_COMP = [
  "safeworkaustralia.gov.au",
  "icare.nsw.gov.au",
  "worksafe.vic.gov.au",
  "worksafe.qld.gov.au",
  "rtwsa.com",
  "workcover.wa.gov.au",
  "worksafe.tas.gov.au",
  "worksafe.act.gov.au",
];

const LONG_SERVICE_LEAVE = [
  "fairwork.gov.au",
  "nsw.gov.au",
  "vic.gov.au",
  "qld.gov.au",
  "sa.gov.au",
  "wa.gov.au",
  "myleave.wa.gov.au",
  "portableleave.act.gov.au",
];

// Each area is searched on its own budget. `focus` is the area's brief, not a
// query string — the model writes the queries, which is the part it is good at.
export type RadarArea = {
  key: string;
  label: string;
  domains: string[];
  focus: string;
};

export const RADAR_AREAS: RadarArea[] = [
  {
    key: "payg",
    label: "PAYG withholding and STP",
    domains: ATO,
    focus:
      "PAYG withholding tax tables and coefficients, withholding schedules, study and training support loan rates, Single Touch Payroll reporting requirements and STP Phase 2 guidance.",
  },
  {
    key: "super",
    label: "Superannuation",
    domains: ATO,
    focus:
      "Superannuation guarantee rate and charge, payday super obligations and deadlines, maximum contributions base, concessional contributions cap, qualifying earnings, and ATO compliance approach for employers.",
  },
  {
    key: "fbt",
    label: "Fringe benefits tax",
    domains: ATO,
    focus:
      "Fringe benefits tax rates, thresholds, exemptions and reporting that a payroll team administers — car parking, novated leases, electric vehicles, reportable fringe benefits amounts.",
  },
  {
    key: "awards",
    label: "Modern awards and wage review",
    domains: FAIR_WORK,
    focus:
      "Annual wage review outcomes, national minimum wage orders, modern award variations and determinations, classification changes, penalty rates, allowances and casual loading.",
  },
  {
    key: "payroll_tax",
    label: "State payroll tax",
    domains: REVENUE_OFFICES,
    focus:
      "Payroll tax rates, thresholds, exemptions, rebates, grouping provisions and lodgement changes in any Australian state or territory.",
  },
  {
    key: "workers_comp",
    label: "Workers compensation",
    domains: WORKERS_COMP,
    focus:
      "Workers compensation premium rates and settings, wage declaration requirements, and changes to what counts as remuneration for premium purposes.",
  },
  {
    key: "lsl",
    label: "Long service leave",
    domains: LONG_SERVICE_LEAVE,
    focus:
      "Long service leave entitlements, accrual rules, portability schemes and levy rates in any Australian state or territory.",
  },
];

export type TopicSuggestion = {
  title: string;
  url: string;
  sourceName: string | null;
  dateLabel: string | null;
  category: string;
  summary: string;
  /** "in_window" when the scan is confident the change falls in the period, else "unclear". */
  confidence: "in_window" | "unclear";
};

export type RadarAreaResult = {
  area: string;
  label: string;
  suggestions: TopicSuggestion[];
  /** Set when this area failed. The scan continues; the caller reports which areas are missing. */
  error?: string;
};

const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["searched_ok", "coverage_note", "suggestions"],
  properties: {
    // Without this, a scan that never managed to search returns an empty
    // suggestions array — identical on the wire to a scan that searched
    // properly and found nothing changed. A trial run hit exactly that: the
    // search budget was exhausted before any result came back and the area
    // reported clean. "Nothing happened this month" and "I could not look" are
    // opposite facts and the caller has to be able to tell them apart.
    searched_ok: {
      type: "boolean",
      description:
        "True only if you completed your searches and are reporting on what you actually saw. False if searches failed, the tool limit was hit before you had results, or you could not retrieve pages.",
    },
    coverage_note: {
      type: "string",
      description:
        "One line on what you covered, or on what stopped you. Say plainly if part of the area went unsearched.",
    },
    suggestions: {
      type: "array",
      description:
        "Candidate topics, each from a page actually retrieved in this request. Empty when nothing in the area changed in the window — an empty list is a valid and useful answer.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "url", "date_label", "summary", "confidence"],
        properties: {
          title: {
            type: "string",
            description: "The source page's own heading, not a rewritten one.",
          },
          url: {
            type: "string",
            description: "The exact URL retrieved. Never constructed or guessed.",
          },
          source_name: {
            type: "string",
            description: "Who published it, as a reader would name them, e.g. 'ATO' or 'Fair Work Commission'.",
          },
          date_label: {
            type: "string",
            description:
              "Publication or effective date as the page states it. The exact string 'date not stated' when the page carries none.",
          },
          summary: {
            type: "string",
            description:
              "What the page says changes, in two sentences, for a payroll practitioner. Only what is on the page. Where the page announces a change without giving the new figure, say the figure is not stated.",
          },
          confidence: {
            type: "string",
            enum: ["in_window", "unclear"],
            description:
              "'in_window' when the page establishes the change falls in the period scanned; 'unclear' when it might not.",
          },
        },
      },
    },
  },
} as const;

function systemPrompt(area: RadarArea, from: string, to: string): string {
  return `You find candidate article topics for the Australian Payroll Association's monthly members' update. The readers are Australian payroll professionals who run pay runs and answer for compliance.

# This scan
Area: ${area.label}
In scope: ${area.focus}
Window: changes announced, published or taking effect between ${from} and ${to}.

Search this area only. Run several different queries — a single query will miss most of it.

Issue your searches one at a time and read each result before the next. Do NOT write code that loops over a list of queries: the search budget is per request, and a loop that calls the tool more than once per iteration exhausts it before anything comes back. That has happened; it produced a scan that reported nothing found when in fact nothing had been looked at.

# What counts
A topic earns a place only if it changes what a payroll practitioner does, checks, or pays. A page that restates existing rules is not a topic. Neither is a page whose only change is a routine annual refresh with no figure movement, unless the figures moved.

# Rules you do not break
1. Every suggestion must come from a page you retrieved in this request. Never propose one from memory, and never from a search result you did not open when its substance matters.
2. Give the page's own URL, exactly as retrieved. Do not construct, shorten, or guess a URL.
3. Where the page carries no publication or effective date, write "date not stated". Never estimate one.
4. Report only what the page says. If it announces a change without stating the new rate, threshold or figure, say the figure is not stated on the page. A plausible number is worse than no number: members act on these.
5. If you cannot establish that a change falls inside the window, still return it, with confidence "unclear". Do not silently drop it and do not silently include it.
6. Finding nothing is a real result. Return an empty list rather than padding it with pages that did not change — but set searched_ok false if the reason the list is empty is that you could not search, rather than that nothing changed.

Return through the provided schema only.`;
}

async function scanArea(area: RadarArea, from: string, to: string): Promise<RadarAreaResult> {
  const base = { area: area.key, label: area.label };
  try {
    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
      tools: [
        {
          type: "web_search_20260209",
          name: "web_search",
          // The hard boundary. Enforced server-side, so this is a guarantee
          // about where topics come from rather than a request.
          allowed_domains: area.domains,
          // Generous on purpose. An area spanning eight jurisdictions needs a
          // query per jurisdiction plus follow-ups, and a budget that runs out
          // mid-scan is the failure that looks like success.
          max_uses: 12,
          user_location: { type: "approximate", country: "AU", timezone: "Australia/Sydney" },
        },
        {
          // Search alone yields titles and index dates. Without fetch the model
          // cannot confirm a date or see that a figure is absent, which is
          // exactly the judgement the rules above ask it to make.
          type: "web_fetch_20260209",
          name: "web_fetch",
          allowed_domains: area.domains,
          max_uses: 8,
          citations: { enabled: true },
          // Every fetched page stays in context for the rest of the tool loop,
          // so an uncapped scan of eight jurisdictions ran to 950k input
          // tokens — most of it navigation chrome and unrelated tax types.
          // What this task needs off a page is the rate, the date and the
          // scope, which sit near the top. Capping cut the bill by roughly
          // three quarters with no loss in what came back.
          max_content_tokens: 12000,
        },
      ],
      system: systemPrompt(area, from, to),
      messages: [
        {
          role: "user",
          content: `Find ${area.label.toLowerCase()} changes for the ${from} to ${to} window. Search, then open the pages that look like real changes and confirm what they say before listing them.`,
        },
      ],
    });

    const out = readTextOutput(
      "topic-radar",
      MODEL,
      response,
      `The model declined to scan ${area.label}.`,
    );
    if (!out.ok) return { ...base, suggestions: [], error: out.error };

    let parsed: { suggestions?: unknown; searched_ok?: unknown; coverage_note?: unknown };
    try {
      parsed = JSON.parse(out.text);
    } catch {
      return { ...base, suggestions: [], error: "The scan returned something that was not valid JSON." };
    }

    // A scan that could not search is a failed area, not an empty one. Treating
    // it as empty is how a silent miss reaches the edition.
    if (parsed.searched_ok === false) {
      const note = typeof parsed.coverage_note === "string" ? parsed.coverage_note.trim() : "";
      return {
        ...base,
        suggestions: [],
        error: note || "The scan could not complete its searches for this area.",
      };
    }

    const rows = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
    const suggestions: TopicSuggestion[] = [];
    for (const raw of rows) {
      const r = raw as Record<string, unknown>;
      const url = typeof r.url === "string" ? r.url.trim() : "";
      const title = typeof r.title === "string" ? r.title.trim() : "";
      if (!url || !title) continue;

      // A URL outside the allow-list should be impossible — the tool enforces
      // it — but this is the one field the whole feature's trustworthiness
      // rests on, so it is checked here too rather than assumed.
      let host: string;
      try {
        const parsedUrl = new URL(url);
        if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") continue;
        host = parsedUrl.hostname.toLowerCase();
      } catch {
        continue;
      }
      const allowed = area.domains.some((d) => host === d || host.endsWith(`.${d}`));
      if (!allowed) continue;

      suggestions.push({
        title: title.slice(0, 300),
        url,
        sourceName: typeof r.source_name === "string" ? r.source_name.trim().slice(0, 120) || null : null,
        dateLabel: typeof r.date_label === "string" ? r.date_label.trim().slice(0, 120) || null : null,
        category: area.label,
        summary: typeof r.summary === "string" ? r.summary.trim().slice(0, 2000) : "",
        confidence: r.confidence === "unclear" ? "unclear" : "in_window",
      });
    }
    return { ...base, suggestions };
  } catch (e) {
    return { ...base, suggestions: [], error: (e as Error).message };
  }
}

export type RadarResult =
  | { ok: true; areas: RadarAreaResult[] }
  | { ok: false; error: string };

// Scans every area. Areas run concurrently and one failing does not fail the
// scan: a run that covers six of seven areas and says which one is missing is
// far more useful than no run at all.
export async function scanTopics(from: string, to: string): Promise<RadarResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: "ANTHROPIC_API_KEY is not configured." };
  }
  const areas = await Promise.all(RADAR_AREAS.map((a) => scanArea(a, from, to)));
  return { ok: true, areas };
}
