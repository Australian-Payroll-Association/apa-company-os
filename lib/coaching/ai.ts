// Team Coaching Cycle AI generators (docs/plans/2026-07-25-team-coaching-cycle.md).
// Four generators for the biweekly loop: prep before the meeting, the two-tier
// summary + commitment extraction after it, the mid-cycle check-in nudge, and
// the monthly trend report. Same shape as lib/ai/idea-plan.ts: fail-soft
// (ai_error on the row, never throws to the caller), structured output where
// the result is written to more than one field.
//
// AUTHORIZATION IS THE CALLER'S JOB. Callers are coach-gated server actions
// (which asserted profile/meeting ownership via lib/coaching/data.ts) and the
// bearer-authed cron. Everything here runs on the service-role client.
//
// The coach's voice comes from coaching_context: the foundation documents
// (leadership brand, coaching profile, EQ guide, communication style),
// company context, and company OKRs, loaded per coach (coach_id = the
// profile's coach, plus company-wide rows where coach_id is null).

import Anthropic from "@anthropic-ai/sdk";
import { companyOs } from "@/lib/supabase";
import { OPEN_COMMITMENT_STATUSES, saigonToday } from "@/lib/coaching/data";

const MODEL = process.env.COACHING_CLAUDE_MODEL || "claude-opus-4-8";

// Input clamps: keep any one document from flooding the context window.
const MAX_DOC_CHARS = 20_000;
const MAX_TRANSCRIPT_CHARS = 150_000;

type Ok = { ok: true };
type Err = { ok: false; error: string };

const clip = (s: string, max: number): string =>
  s.length > max ? `${s.slice(0, max)}\n\n[...truncated]` : s;

// ---- context assembly -------------------------------------------------------

type ProfileContext = {
  profileId: string;
  coachId: string;
  memberName: string;
  positionTitle: string | null;
  fastGoal: string | null;
  fastGoalStatus: string;
  okrsMarkdown: string | null;
  privateProfileMarkdown: string | null;
  cadenceDays: number;
};

const one = <T,>(e: T | T[] | null | undefined): T | null =>
  Array.isArray(e) ? e[0] ?? null : e ?? null;

async function loadProfileContext(profileId: string): Promise<ProfileContext | null> {
  const { data } = await companyOs
    .from("coaching_profiles")
    .select(
      "id, coach_id, fast_goal, fast_goal_status, okrs_markdown, private_profile_markdown, cadence_days, " +
        "team_members:team_members!team_member_id(people:people!person_id(full_name, preferred_name), " +
        "positions:positions!position_id(title))",
    )
    .eq("id", profileId)
    .maybeSingle();
  if (!data) return null;
  const r = data as unknown as Record<string, unknown>;
  const tm = one(r.team_members as Record<string, unknown> | Record<string, unknown>[] | null);
  const person = one(
    (tm?.people ?? null) as { full_name: string | null; preferred_name: string | null } | Array<{
      full_name: string | null;
      preferred_name: string | null;
    }> | null,
  );
  const pos = one((tm?.positions ?? null) as { title: string | null } | { title: string | null }[] | null);
  return {
    profileId,
    coachId: r.coach_id as string,
    memberName: person?.preferred_name || person?.full_name || "the team member",
    positionTitle: pos?.title ?? null,
    fastGoal: (r.fast_goal as string | null) ?? null,
    fastGoalStatus: (r.fast_goal_status as string) ?? "not_set",
    okrsMarkdown: (r.okrs_markdown as string | null) ?? null,
    privateProfileMarkdown: (r.private_profile_markdown as string | null) ?? null,
    cadenceDays: (r.cadence_days as number) ?? 14,
  };
}

// The coach's context documents: their own rows plus company-wide (null coach).
async function loadCoachDocs(coachId: string): Promise<string> {
  const { data } = await companyOs
    .from("coaching_context")
    .select("coach_id, kind, title, markdown")
    .or(`coach_id.eq.${coachId},coach_id.is.null`)
    .order("kind", { ascending: true });
  const docs = (data ?? []) as Array<{ kind: string; title: string; markdown: string }>;
  if (docs.length === 0) return "(no coaching context documents on file)";
  return docs
    .map((d) => `<doc kind="${d.kind}" title="${d.title}">\n${clip(d.markdown, MAX_DOC_CHARS)}\n</doc>`)
    .join("\n\n");
}

// Recent held meetings, newest first (private summaries — coach-tier callers only).
async function loadRecentSummaries(profileId: string, limit: number): Promise<string> {
  const { data } = await companyOs
    .from("coaching_one_on_ones")
    .select("held_on, summary_markdown")
    .eq("coaching_profile_id", profileId)
    .eq("status", "held")
    .is("archived_at", null)
    .not("summary_markdown", "is", null)
    .order("held_on", { ascending: false })
    .limit(limit);
  const rows = (data ?? []) as Array<{ held_on: string; summary_markdown: string }>;
  if (rows.length === 0) return "(no prior meeting summaries on file)";
  return rows
    .map((m) => `<meeting held_on="${m.held_on}">\n${clip(m.summary_markdown, MAX_DOC_CHARS)}\n</meeting>`)
    .join("\n\n");
}

async function loadOpenCommitments(profileId: string): Promise<string> {
  const { data } = await companyOs
    .from("coaching_commitments")
    .select("title, owner, due_on, status, status_note, created_at")
    .eq("coaching_profile_id", profileId)
    .in("status", OPEN_COMMITMENT_STATUSES)
    .order("created_at", { ascending: true });
  const rows = (data ?? []) as Array<{
    title: string;
    owner: string;
    due_on: string | null;
    status: string;
    status_note: string | null;
  }>;
  if (rows.length === 0) return "(no open commitments)";
  return rows
    .map(
      (c) =>
        `- [${c.status}] (${c.owner}) ${c.title}${c.due_on ? ` — due ${c.due_on}` : ""}${
          c.status_note ? ` — latest note: ${c.status_note}` : ""
        }`,
    )
    .join("\n");
}

function personBlock(p: ProfileContext): string {
  return [
    `Name: ${p.memberName}`,
    p.positionTitle ? `Role: ${p.positionTitle}` : null,
    `FAST goal (${p.fastGoalStatus}): ${p.fastGoal ?? "not set yet"}`,
    p.okrsMarkdown ? `\n<okrs>\n${clip(p.okrsMarkdown, MAX_DOC_CHARS)}\n</okrs>` : null,
    p.privateProfileMarkdown
      ? `\n<coaching-reads>\n${clip(p.privateProfileMarkdown, MAX_DOC_CHARS)}\n</coaching-reads>`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}

const VOICE_RULES = `Ground rules:
- Write in the coach's voice, guided by the communication style and coaching profile in the context documents. Warm, direct, growth-oriented — never corporate, never clinical.
- They are COMMITMENTS, never "tasks" or "action items".
- Never invent information. If notes are missing, work with what exists and say so.
- Handle personal or emotional context with care, per the emotional intelligence guide.`;

function client(): Anthropic | null {
  return process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
}

async function textCompletion(system: string, user: string, maxTokens: number): Promise<string> {
  const anthropic = client();
  if (!anthropic) throw new Error("ANTHROPIC_API_KEY is not configured.");
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });
  if (response.stop_reason === "refusal") throw new Error("The model declined this request.");
  const block = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!block?.text.trim()) throw new Error("Model returned no text output.");
  return block.text.trim();
}

// ---- 1) prep (Friday before the meeting) ------------------------------------

const PREP_SYSTEM = `You prepare a leader for a biweekly 1-1 coaching conversation with one of their people. You write the prep the leader skims in two minutes before walking into the room.

Produce Markdown with exactly these ## sections, in order:
## Focus areas — 2-3 topics to prioritize, one-sentence rationale each, based on open commitments, goal/OKR progress, and recent context.
## Coaching questions — 3-5 open-ended questions tailored to this person right now. They must reflect the coaching profile and sound like the coach, not a template.
## Context reminders — bullets: status of previous commitments, personal context to handle with care, upcoming milestones, relevant company context.
## Open commitments — carry forward each open commitment with whatever status is known.

${VOICE_RULES}`;

export async function generatePrep(meetingId: string): Promise<Ok | Err> {
  const fail = async (error: string): Promise<Err> => {
    await companyOs
      .from("coaching_one_on_ones")
      .update({ ai_error: error.slice(0, 500), updated_at: new Date().toISOString() })
      .eq("id", meetingId);
    return { ok: false, error };
  };
  try {
    const { data: meeting } = await companyOs
      .from("coaching_one_on_ones")
      .select("id, coaching_profile_id, held_on")
      .eq("id", meetingId)
      .is("archived_at", null)
      .maybeSingle();
    if (!meeting) return { ok: false, error: "Meeting not found." };
    const m = meeting as { coaching_profile_id: string; held_on: string };

    const profile = await loadProfileContext(m.coaching_profile_id);
    if (!profile) return { ok: false, error: "Profile not found." };
    const [docs, summaries, commitments] = await Promise.all([
      loadCoachDocs(profile.coachId),
      loadRecentSummaries(m.coaching_profile_id, 2),
      loadOpenCommitments(m.coaching_profile_id),
    ]);

    const prep = await textCompletion(
      PREP_SYSTEM,
      `# Coaching context documents\n${docs}\n\n# The person\n${personBlock(profile)}\n\n# Last meetings\n${summaries}\n\n# Open commitments\n${commitments}\n\n# The upcoming 1-1\nScheduled for ${m.held_on} (today is ${saigonToday()}). Write the prep.`,
      4000,
    );

    const { error } = await companyOs
      .from("coaching_one_on_ones")
      .update({
        prep_markdown: prep,
        prep_generated_at: new Date().toISOString(),
        ai_model: MODEL,
        ai_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", meetingId);
    if (error) return fail(error.message);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[coaching-ai] prep ${meetingId} failed:`, msg);
    return fail(msg);
  }
}

// ---- 2) summary + commitments (right after the meeting) ---------------------

const SUMMARY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary_markdown", "shared_summary_markdown", "commitments"],
  properties: {
    summary_markdown: {
      type: "string",
      description:
        "The PRIVATE summary for the coach's eyes only. Markdown with ## sections in order: 'Meeting summary' (3-5 paragraphs of substance — decisions, concerns, energy and tone); 'Commitments' (each commitment, its owner, timeline, and any OKR connection); 'Emotional and personal notes' (anything personal or emotionally significant, handled with care — this informs future prep, it is not a report; omit the section if nothing came up); 'Connections' (links to previous meetings, goals/OKRs, and company context).",
    },
    shared_summary_markdown: {
      type: "string",
      description:
        "The recap SHARED WITH THE TEAM MEMBER. Markdown with ## sections: 'What we covered' (the discussion, decisions, and wins — honest but constructive, written TO the team member in second person); 'Commitments' (the same commitments, phrased as what each side agreed to). NO private coaching observations, NO emotional read-outs, NO assessments of the person — only what both people in the room already know was said.",
    },
    commitments: {
      type: "array",
      description:
        "Every specific commitment made in the meeting by either side. Empty array if none were made.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "owner"],
        properties: {
          title: { type: "string", description: "The commitment, one sentence, concrete." },
          owner: {
            type: "string",
            enum: ["coach", "member"],
            description: "'member' if the team member owns it, 'coach' if the leader does.",
          },
          due_on: {
            type: "string",
            description: "YYYY-MM-DD deadline if one was stated; omit otherwise.",
          },
        },
      },
    },
  },
} as const;

const SUMMARY_SYSTEM = `You turn a 1-1 coaching meeting transcript into two summaries and a commitment log.

The private summary is for the coach alone and captures everything, including emotional undercurrents. The shared summary goes to the team member — it must contain nothing the member would be surprised or hurt to read, only the substance both people already voiced in the room.

${VOICE_RULES}`;

export async function summarizeMeeting(meetingId: string): Promise<Ok | Err> {
  const fail = async (error: string): Promise<Err> => {
    await companyOs
      .from("coaching_one_on_ones")
      .update({ ai_error: error.slice(0, 500), updated_at: new Date().toISOString() })
      .eq("id", meetingId);
    return { ok: false, error };
  };
  try {
    const anthropic = client();
    if (!anthropic) return fail("ANTHROPIC_API_KEY is not configured.");

    const { data: meeting } = await companyOs
      .from("coaching_one_on_ones")
      .select("id, coaching_profile_id, held_on, transcript, prep_markdown")
      .eq("id", meetingId)
      .is("archived_at", null)
      .maybeSingle();
    if (!meeting) return { ok: false, error: "Meeting not found." };
    const m = meeting as {
      coaching_profile_id: string;
      held_on: string;
      transcript: string | null;
      prep_markdown: string | null;
    };
    if (!m.transcript?.trim()) return { ok: false, error: "No transcript on this meeting yet." };

    const profile = await loadProfileContext(m.coaching_profile_id);
    if (!profile) return { ok: false, error: "Profile not found." };
    const [docs, commitments] = await Promise.all([
      loadCoachDocs(profile.coachId),
      loadOpenCommitments(m.coaching_profile_id),
    ]);

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: SUMMARY_SYSTEM,
      output_config: { format: { type: "json_schema", schema: SUMMARY_SCHEMA } },
      messages: [
        {
          role: "user",
          content: `# Coaching context documents\n${docs}\n\n# The person\n${personBlock(profile)}\n\n# Open commitments going into this meeting\n${commitments}\n\n# The prep for this meeting\n${m.prep_markdown ? clip(m.prep_markdown, MAX_DOC_CHARS) : "(none)"}\n\n# Transcript of the 1-1 on ${m.held_on}\n${clip(m.transcript, MAX_TRANSCRIPT_CHARS)}\n\nWrite the private summary, the shared recap, and extract every commitment.`,
        },
      ],
    });
    if (response.stop_reason === "refusal") return fail("The model declined this transcript.");
    const block = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    if (!block) return fail("Model returned no output.");
    const parsed = JSON.parse(block.text) as {
      summary_markdown: string;
      shared_summary_markdown: string;
      commitments: Array<{ title: string; owner: "coach" | "member"; due_on?: string }>;
    };
    if (!parsed.summary_markdown?.trim() || !parsed.shared_summary_markdown?.trim())
      return fail("Model output was missing a summary tier.");

    // The shared recap stays a DRAFT (shared_published_at untouched) — the
    // coach reviews and publishes explicitly.
    const { error: upErr } = await companyOs
      .from("coaching_one_on_ones")
      .update({
        summary_markdown: parsed.summary_markdown,
        shared_summary_markdown: parsed.shared_summary_markdown,
        status: "held",
        ai_model: MODEL,
        ai_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", meetingId);
    if (upErr) return fail(upErr.message);

    // Insert extracted commitments once per meeting: re-running the summary
    // must not duplicate the ledger.
    const { data: existing } = await companyOs
      .from("coaching_commitments")
      .select("id")
      .eq("one_on_one_id", meetingId)
      .limit(1);
    if ((existing ?? []).length === 0 && parsed.commitments.length > 0) {
      const rows = parsed.commitments
        .filter((c) => c.title?.trim())
        .slice(0, 20)
        .map((c) => ({
          coaching_profile_id: m.coaching_profile_id,
          one_on_one_id: meetingId,
          title: c.title.trim().slice(0, 500),
          owner: c.owner === "coach" ? "coach" : "member",
          due_on: c.due_on && /^\d{4}-\d{2}-\d{2}$/.test(c.due_on) ? c.due_on : null,
        }));
      if (rows.length > 0) {
        const { error } = await companyOs.from("coaching_commitments").insert(rows);
        if (error) console.error("[coaching-ai] commitment insert failed:", error.message);
      }
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[coaching-ai] summary ${meetingId} failed:`, msg);
    return fail(msg);
  }
}

// ---- 3) mid-cycle check-in message ------------------------------------------
// Returns the message markdown instead of writing it: the cron records it on
// coaching_checkins and sends the email in one place. Falls back to a plain
// template when the model is unavailable — the nudge must still go out.

const CHECKIN_SYSTEM = `You write a short mid-cycle check-in message from a coach to their team member, halfway between biweekly 1-1s.

The message must:
- Reference each open commitment by name and ask for a brief status update on each.
- Feel like a nudge from a coach who pays attention — not a project manager chasing tickets.
- Be brief: a few warm sentences plus the commitment list. Write in second person, to the member.
- End by pointing them to their coaching page to update statuses.

${VOICE_RULES}`;

export async function generateCheckinMessage(
  profileId: string,
): Promise<{ markdown: string; ai: boolean }> {
  const profile = await loadProfileContext(profileId);
  const commitments = await loadOpenCommitments(profileId);
  const fallback = [
    `Quick mid-cycle check-in — how are these coming along?`,
    ``,
    commitments,
    ``,
    `Update each one on your coaching page — even a one-line status helps our next 1-1.`,
  ].join("\n");
  if (!profile) return { markdown: fallback, ai: false };
  try {
    const docs = await loadCoachDocs(profile.coachId);
    const markdown = await textCompletion(
      CHECKIN_SYSTEM,
      `# Coaching context documents\n${docs}\n\n# The person\n${personBlock(profile)}\n\n# Their open commitments\n${commitments}\n\nWrite the check-in message.`,
      1500,
    );
    return { markdown, ai: true };
  } catch (err) {
    console.error(`[coaching-ai] checkin ${profileId} failed:`, err instanceof Error ? err.message : err);
    return { markdown: fallback, ai: false };
  }
}

// ---- 4) monthly trend report ------------------------------------------------

const TREND_SYSTEM = `You write a monthly coaching trend report about one team member, for their coach's eyes only. You look across the month's 1-1 summaries, the commitment ledger, and check-ins, and surface what meeting-to-meeting attention misses.

Produce Markdown with exactly these ## sections, in order:
## Growth trajectory — growing, plateauing, or struggling, with specific evidence.
## Recurring themes — topics and patterns that keep coming up.
## Commitment follow-through — completed vs in progress vs dropped, and the pattern in what gets done.
## Coaching opportunities — specific things to coach next cycle (never generic "develop leadership skills"; name the observed behavior and the move).
## Flags — burnout signals, disengagement, recurring blockers, escalating personal situations. Omit the section if there are none.
## Quarter comparison — better, worse, or flat vs the prior period, if prior data exists.

${VOICE_RULES}`;

export async function generateTrendReport(profileId: string, period: string): Promise<Ok | Err> {
  const stamp = async (patch: Record<string, unknown>): Promise<void> => {
    await companyOs
      .from("coaching_trends")
      .upsert(
        { coaching_profile_id: profileId, period, ...patch },
        { onConflict: "coaching_profile_id,period" },
      );
  };
  try {
    if (!/^\d{4}-\d{2}$/.test(period)) return { ok: false, error: "Bad period." };
    const profile = await loadProfileContext(profileId);
    if (!profile) return { ok: false, error: "Profile not found." };

    // The month's summaries plus the two before them for trajectory contrast.
    const monthStart = `${period}-01`;
    const { data: monthMeetings } = await companyOs
      .from("coaching_one_on_ones")
      .select("held_on, summary_markdown")
      .eq("coaching_profile_id", profileId)
      .eq("status", "held")
      .is("archived_at", null)
      .not("summary_markdown", "is", null)
      .gte("held_on", monthStart)
      .lt("held_on", `${period}-32`)
      .order("held_on", { ascending: true });
    const inMonth = (monthMeetings ?? []) as Array<{ held_on: string; summary_markdown: string }>;
    if (inMonth.length === 0) return { ok: false, error: `No summarized 1-1s in ${period}.` };

    const [docs, commitments, priorTrend, checkins] = await Promise.all([
      loadCoachDocs(profile.coachId),
      loadAllCommitmentsBlock(profileId),
      loadPriorTrend(profileId, period),
      loadCheckinsBlock(profileId, monthStart),
    ]);

    const meetingsBlock = inMonth
      .map((m) => `<meeting held_on="${m.held_on}">\n${clip(m.summary_markdown, MAX_DOC_CHARS)}\n</meeting>`)
      .join("\n\n");

    const report = await textCompletion(
      TREND_SYSTEM,
      `# Coaching context documents\n${docs}\n\n# The person\n${personBlock(profile)}\n\n# This month's 1-1 summaries (${period})\n${meetingsBlock}\n\n# The commitment ledger\n${commitments}\n\n# Check-ins this month\n${checkins}\n\n# Prior trend report\n${priorTrend}\n\nWrite the ${period} trend report.`,
      8000,
    );

    await stamp({ report_markdown: report, ai_model: MODEL, ai_error: null });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[coaching-ai] trend ${profileId} ${period} failed:`, msg);
    await stamp({ ai_error: msg.slice(0, 500) });
    return { ok: false, error: msg };
  }
}

// Full ledger (open and closed) for follow-through analysis.
async function loadAllCommitmentsBlock(profileId: string): Promise<string> {
  const { data } = await companyOs
    .from("coaching_commitments")
    .select("title, owner, due_on, status, status_note, created_at, closed_at")
    .eq("coaching_profile_id", profileId)
    .order("created_at", { ascending: true });
  const rows = (data ?? []) as Array<{
    title: string;
    owner: string;
    due_on: string | null;
    status: string;
    status_note: string | null;
    created_at: string;
    closed_at: string | null;
  }>;
  if (rows.length === 0) return "(no commitments recorded)";
  return rows
    .map(
      (c) =>
        `- [${c.status}] (${c.owner}, made ${c.created_at.slice(0, 10)}${
          c.closed_at ? `, closed ${c.closed_at.slice(0, 10)}` : ""
        }) ${c.title}${c.status_note ? ` — note: ${c.status_note}` : ""}`,
    )
    .join("\n");
}

async function loadPriorTrend(profileId: string, period: string): Promise<string> {
  const { data } = await companyOs
    .from("coaching_trends")
    .select("period, report_markdown")
    .eq("coaching_profile_id", profileId)
    .lt("period", period)
    .not("report_markdown", "is", null)
    .order("period", { ascending: false })
    .limit(1)
    .maybeSingle();
  const t = data as { period: string; report_markdown: string } | null;
  return t ? `<trend period="${t.period}">\n${clip(t.report_markdown, MAX_DOC_CHARS)}\n</trend>` : "(none)";
}

async function loadCheckinsBlock(profileId: string, monthStart: string): Promise<string> {
  const { data } = await companyOs
    .from("coaching_checkins")
    .select("sent_at, responded_at")
    .eq("coaching_profile_id", profileId)
    .gte("sent_at", monthStart)
    .order("sent_at", { ascending: true });
  const rows = (data ?? []) as Array<{ sent_at: string; responded_at: string | null }>;
  if (rows.length === 0) return "(no check-ins this month)";
  return rows
    .map((c) => `- sent ${c.sent_at.slice(0, 10)} — ${c.responded_at ? "responded" : "no response"}`)
    .join("\n");
}
