// Actionable coaching-session summariser. Turns a raw transcript into an
// internal summary written for two audiences at Edge8: the engineers who were
// coached and the leaders who need to act. This is deliberately NOT the
// client-facing summary in lib/ai/meeting-summary.ts (neutral and short, for the
// portal). Here we want decisions, per-person blockers, and action items with
// owners.
//
// Calls a model through OpenRouter (OpenAI-compatible chat completions), so it
// is provider-neutral and needs no Anthropic SDK. The caller writes the markdown
// to meetings.summary and the action items to company_os.meeting_action_items.
//
// Env (read from the shell or .env.local by zoom-ingest.mjs):
//   OPENROUTER_API_KEY  (required)
//   OPENROUTER_MODEL    (optional; defaults below, override with any OpenRouter slug)

// Resolved inside summarizeTranscript (not at module load) so it picks up
// OPENROUTER_MODEL after the caller has loaded .env.local into process.env.
const DEFAULT_MODEL = 'anthropic/claude-sonnet-5';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

// Meetings rarely exceed this; if one does, the tail is dropped and the summary
// of the bulk still lands.
const MAX_TRANSCRIPT_CHARS = 150_000;

const SYSTEM =
  'You are an assistant for Edge8, an AI enablement company that coaches client engineers and ' +
  'leaders. You turn a raw coaching-session transcript into an internal, actionable summary. Two ' +
  'audiences read it: the engineers who were coached (they need clear next steps) and the leaders ' +
  'who run the program (they need decisions, blockers, and escalations). Work only from the ' +
  'transcript. Never invent decisions, action items, owners, figures, or advice that was not said; ' +
  'if something is unclear, leave it out rather than guessing. Speech-to-text garbles product and ' +
  'tool names, so normalise obvious ones to the real name. Never use em dashes; use commas, colons, ' +
  'periods, or parentheses (Edge8 brand rule).';

// The exact JSON contract. json_object mode does not enforce a schema, so the
// contract lives in the prompt and we validate the parsed object ourselves.
const CONTRACT = `Return ONLY a JSON object (no prose, no code fences) with exactly these keys:

{
  "title": string,            // short, specific, max ~8 words; no date or filler
  "meeting_date": string|null,// YYYY-MM-DD if stated or clearly derivable, else null (do not guess)
  "attendees": string[],      // names of people who spoke or were clearly present; names only
  "summary_markdown": string, // Markdown, sections in this order, omit a section only if empty:
                              //   ## TL;DR: 1-2 sentences.
                              //   ## Decisions: bullets of what was decided or agreed.
                              //   ## Blockers: bullets as "Person: what is blocking them".
                              //   ## For engineers: concrete next steps and coaching advice given.
                              //   ## For leaders: themes, risks, anything needing a leader to act or escalate.
  "action_items": [           // concrete follow-ups stated or clearly implied; [] if none
    {
      "title": string,        // the task in a few words, imperative
      "owner": string,        // person responsible as named, or "Unassigned"
      "detail": string,       // one sentence of context, or ""
      "due_date": string|null // YYYY-MM-DD if a deadline was stated, else null
    }
  ]
}

Ground everything in the transcript. Do not manufacture action items to fill the list.`;

// Summarise a transcript. Returns the parsed structured object plus the model
// used. Throws on a hard failure so the caller can record it (the ingest keeps
// the transcript regardless).
export async function summarizeTranscript(transcript) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured.');
  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
  const text = (transcript || '').slice(0, MAX_TRANSCRIPT_CHARS);
  if (!text.trim()) throw new Error('Transcript is empty.');

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-Title': 'Edge8 coaching ingest',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `${SYSTEM}\n\n${CONTRACT}` },
        { role: 'user', content: `Coaching session transcript:\n\n${text}` },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenRouter HTTP ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenRouter returned no content.');

  // Some models wrap JSON in a code fence despite instructions; strip it.
  const jsonText = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error(`Model output was not valid JSON: ${jsonText.slice(0, 200)}`);
  }
  if (!parsed.summary_markdown?.trim()) throw new Error('Model output was missing the summary.');

  return {
    title: (parsed.title || '').trim(),
    meeting_date: parsed.meeting_date || null,
    attendees: Array.isArray(parsed.attendees) ? parsed.attendees : [],
    summary_markdown: parsed.summary_markdown,
    action_items: Array.isArray(parsed.action_items) ? parsed.action_items : [],
    model,
  };
}
