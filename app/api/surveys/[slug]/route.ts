import { NextRequest, NextResponse } from "next/server";
import { companyOs } from "@/lib/supabase";
import { getOrCreatePerson } from "@/lib/company-os";
import { resolveSurveyActor } from "@/lib/survey-identity";
import { notifyOps } from "@/lib/lark";
import { validateAnswer, type SurveyFieldRow } from "@/lib/admin/surveys";

// Public survey submission. Unauthenticated by design; the server re-validates
// every answer against the question set and resolves identity itself — the
// client's name/email are only used for external respondents. Anonymous
// surveys never store person_id / name / email, only the team-vs-external kind.

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const body = await req.json();

    // Honeypot: bots fill the hidden field; pretend success.
    if (body.website) return NextResponse.json({ ok: true });

    const { data: surveyData } = await companyOs
      .from("surveys")
      .select("id, name, status, is_anonymous, archived_at")
      .eq("slug", params.slug)
      .maybeSingle();
    if (!surveyData || surveyData.archived_at)
      return NextResponse.json({ error: "Survey not found." }, { status: 404 });
    if (surveyData.status !== "published")
      return NextResponse.json({ error: "This survey is not accepting responses." }, { status: 410 });

    const { data: fieldsData, error: fieldsErr } = await companyOs
      .from("survey_fields")
      .select("id, survey_id, position, type, label, help_text, required, config")
      .eq("survey_id", surveyData.id)
      .order("position", { ascending: true });
    if (fieldsErr) return NextResponse.json({ error: "Could not load the survey." }, { status: 500 });
    const fields = (fieldsData ?? []) as SurveyFieldRow[];
    if (fields.length === 0)
      return NextResponse.json({ error: "This survey has no questions." }, { status: 410 });

    // Validate every answer server-side.
    const rawAnswers = (body.answers ?? {}) as Record<string, unknown>;
    const answerRows: { field_id: string; value: string; value_json: unknown }[] = [];
    for (const field of fields) {
      const v = validateAnswer(field, rawAnswers[field.id]);
      if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
      if (v.skip) continue;
      answerRows.push({ field_id: field.id, value: v.text, value_json: v.json });
    }
    if (answerRows.length === 0)
      return NextResponse.json({ error: "The response is empty." }, { status: 400 });

    // Identity.
    const actor = await resolveSurveyActor();
    let personId: string | null = null;
    let respondentName: string | null = null;
    let respondentEmail: string | null = null;
    let kind: "team" | "external";

    if (surveyData.is_anonymous) {
      kind = actor ? "team" : "external";
    } else if (actor) {
      kind = "team";
      personId = actor.personId;
      respondentName = actor.name;
      respondentEmail = actor.email;
    } else {
      kind = "external";
      const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      if (!name || !email.includes("@"))
        return NextResponse.json({ error: "Name and a valid email are required." }, { status: 400 });
      respondentName = name;
      respondentEmail = email;
      const person = await getOrCreatePerson({ email, name, source: "survey" });
      if (person.ok) personId = person.id;
    }

    const { data: response, error: rErr } = await companyOs
      .from("survey_responses")
      .insert({
        survey_id: surveyData.id,
        respondent_kind: kind,
        person_id: personId,
        respondent_name: respondentName,
        respondent_email: respondentEmail,
      })
      .select("id")
      .single();
    if (rErr || !response)
      return NextResponse.json({ error: "Could not save your response." }, { status: 500 });

    const { error: aErr } = await companyOs
      .from("survey_answers")
      .insert(answerRows.map((a) => ({ ...a, response_id: response.id })));
    if (aErr) {
      // Don't leave a half-saved response behind.
      await companyOs.from("survey_responses").delete().eq("id", response.id);
      console.error("survey answers insert failed:", aErr.message);
      return NextResponse.json({ error: "Could not save your response." }, { status: 500 });
    }

    const who = surveyData.is_anonymous
      ? `anonymous (${kind})`
      : `${respondentName ?? "Unknown"}${respondentEmail ? ` <${respondentEmail}>` : ""} (${kind})`;
    void notifyOps(`📋 Survey response — ${surveyData.name}\n${who} · ${answerRows.length} answers`);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Survey submit error:", err);
    return NextResponse.json({ error: "Failed to submit." }, { status: 500 });
  }
}
