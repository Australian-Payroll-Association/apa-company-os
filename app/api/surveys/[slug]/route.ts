import { NextRequest, NextResponse } from "next/server";
import { companyOs } from "@/lib/supabase";
import { getOrCreatePerson } from "@/lib/company-os";
import { resolveSurveyActor } from "@/lib/survey-identity";
import { notifyOps } from "@/lib/lark";
import { validateAnswer, type SurveyFieldRow } from "@/lib/admin/surveys";
import { processOnboardingSubmission } from "@/lib/onboarding";
import { processProbationReview, recordDay8Response } from "@/lib/onboarding-cycle";
import { backfillCompanyIndustry, isAiJourneyPurpose, resolveCompanyPrefill } from "@/lib/ai-journey";

export const runtime = "nodejs";

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
      .select("id, name, status, is_anonymous, archived_at, purpose")
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

    // Identity. Onboarding is for a new hire not in the system, so we must
    // resolve them by the email they TYPE, never by a logged-in session (a
    // recruiter previewing the link would otherwise get mapped as the person).
    const isOnboarding = surveyData.purpose === "onboarding";
    const actor = isOnboarding ? null : await resolveSurveyActor();

    // AI Journey: the page hides questions whose config.maps_to value the CRM
    // already knows for a logged-in respondent. Inject those values here so the
    // stored response is complete and required-field validation still holds.
    const rawAnswers = (body.answers ?? {}) as Record<string, unknown>;
    if (isAiJourneyPurpose(surveyData.purpose) && !surveyData.is_anonymous && actor?.personId) {
      const prefill = await resolveCompanyPrefill(actor.personId);
      for (const field of fields) {
        const mapsTo = field.config?.maps_to;
        const raw = rawAnswers[field.id];
        const empty = raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "");
        if (mapsTo && prefill[mapsTo] !== undefined && empty) rawAnswers[field.id] = prefill[mapsTo];
      }
    }

    // Validate every answer server-side.
    const answerRows: { field_id: string; value: string; value_json: unknown }[] = [];
    for (const field of fields) {
      const v = validateAnswer(field, rawAnswers[field.id]);
      if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
      if (v.skip) continue;
      answerRows.push({ field_id: field.id, value: v.text, value_json: v.json });
    }
    if (answerRows.length === 0)
      return NextResponse.json({ error: "The response is empty." }, { status: 400 });

    let personId: string | null = null;
    let respondentName: string | null = null;
    let respondentEmail: string | null = null;
    // "team" means actual staff or admins. A logged-in portal CLIENT is still
    // identified (person_id, name, email from the session) but stamped
    // "external" so attendee roll-ups aren't polluted with mislabeled rows.
    let kind: "team" | "external";

    if (surveyData.is_anonymous) {
      kind = actor?.isTeam ? "team" : "external";
    } else if (actor) {
      kind = actor.isTeam ? "team" : "external";
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

    // Event attribution: ?cohort=<event-slug> arrives via an event's feedback
    // QR. Only stamped when it matches a real event, so junk query params
    // can't pollute the column (which trend reporting groups by).
    let cohortSlug: string | null = null;
    const cohortRaw = typeof body.cohort === "string" ? body.cohort.trim().slice(0, 120) : "";
    if (cohortRaw) {
      const { data: eventRow } = await companyOs
        .from("events")
        .select("slug")
        .eq("slug", cohortRaw)
        .maybeSingle();
      cohortSlug = eventRow?.slug ?? null;
    }

    // Review subject: ?subject=<team_members id> rides the probation-review
    // link so the processor knows who the review is ABOUT. Only accepted for
    // that purpose and only when it looks like a UUID; stamped into the
    // response metadata for auditability.
    const subjectRaw = typeof body.subject === "string" ? body.subject.trim() : "";
    const subjectTeamMemberId =
      surveyData.purpose === "probation_review" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(subjectRaw)
        ? subjectRaw
        : null;

    const { data: response, error: rErr } = await companyOs
      .from("survey_responses")
      .insert({
        survey_id: surveyData.id,
        respondent_kind: kind,
        person_id: personId,
        respondent_name: respondentName,
        respondent_email: respondentEmail,
        ...(cohortSlug ? { cohort_slug: cohortSlug } : {}),
        ...(subjectTeamMemberId ? { metadata: { subject_team_member_id: subjectTeamMemberId } } : {}),
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

    // Purpose-driven post-processing. Onboarding maps the answers into the CRM,
    // moves the person to pre-boarding, and provisions the portal account. Runs
    // after the response is safely saved; a failure here never fails the submit.
    if (surveyData.purpose === "onboarding" && personId) {
      const answers = new Map(
        answerRows.map((a) => [a.field_id, (a.value_json ?? a.value) as string | string[] | number | boolean | null]),
      );
      try {
        await processOnboardingSubmission({
          personId,
          email: respondentEmail ?? "",
          name: respondentName,
          fields,
          answers,
        });
      } catch (err) {
        console.error("[survey] onboarding post-process failed:", err);
      }
    }

    // AI Journey pre-survey: adopt the respondent's industry answer when their
    // company has none on file. Same contract: never fails the submit.
    if (surveyData.purpose === "ai_journey_pre" && personId) {
      try {
        await backfillCompanyIndustry(personId, fields, answerRows);
      } catch (err) {
        console.error("[survey] ai-journey post-process failed:", err);
      }
    }

    // Onboarding-cycle hooks. Same contract as the onboarding processor: they
    // run after the response is safely saved and never fail the submit.
    if (surveyData.purpose === "onboarding_day8" && personId) {
      try {
        await recordDay8Response(personId, response.id);
      } catch (err) {
        console.error("[survey] day8 post-process failed:", err);
      }
    }
    if (surveyData.purpose === "probation_review" && subjectTeamMemberId) {
      const decisionField = fields.find((f) => f.type === "single_choice");
      const decisionLabel = decisionField
        ? answerRows.find((a) => a.field_id === decisionField.id)?.value ?? ""
        : "";
      try {
        await processProbationReview({
          subjectTeamMemberId,
          responseId: response.id,
          decisionLabel,
          respondentEmail,
        });
      } catch (err) {
        console.error("[survey] probation-review post-process failed:", err);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Survey submit error:", err);
    return NextResponse.json({ error: "Failed to submit." }, { status: 500 });
  }
}
