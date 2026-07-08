import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { companyOs } from "@/lib/supabase";
import { resolveSurveyActor } from "@/lib/survey-identity";
import type { SurveyFieldRow, SurveyRow } from "@/lib/admin/surveys";
import { SurveyRunner } from "./SurveyRunner";
import styles from "./survey.module.css";

export const dynamic = "force-dynamic";

// Survey links are shared directly; keep them out of search engines.
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const { data } = await companyOs
    .from("surveys")
    .select("name, description")
    .eq("slug", params.slug)
    .maybeSingle();
  return {
    title: data ? `${data.name} — Edge8` : "Survey — Edge8",
    description: data?.description ?? undefined,
    robots: { index: false },
  };
}

export default async function PublicSurveyPage({ params }: { params: { slug: string } }) {
  const { data } = await companyOs
    .from("surveys")
    .select(
      "id, slug, name, description, status, is_anonymous, intro_text, thank_you_text, created_at, updated_at, archived_at",
    )
    .eq("slug", params.slug)
    .maybeSingle();

  const survey = data as (SurveyRow & { archived_at: string | null }) | null;
  if (!survey || survey.archived_at || survey.status === "draft") notFound();

  if (survey.status !== "published") {
    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>{survey.name}</h1>
          <p className={styles.sub}>This survey is closed. Thanks for your interest.</p>
        </div>
      </main>
    );
  }

  const [fieldsRes, actor] = await Promise.all([
    companyOs
      .from("survey_fields")
      .select("id, survey_id, position, type, label, help_text, required, config")
      .eq("survey_id", survey.id)
      .order("position", { ascending: true }),
    resolveSurveyActor(),
  ]);
  const fields = (fieldsRes.data ?? []) as SurveyFieldRow[];

  return (
    <main className={styles.page}>
      <SurveyRunner
        slug={survey.slug}
        name={survey.name}
        introText={survey.intro_text ?? survey.description}
        thankYouText={survey.thank_you_text}
        isAnonymous={survey.is_anonymous}
        fields={fields}
        actorName={survey.is_anonymous ? null : actor?.name ?? null}
        needIdentity={!survey.is_anonymous && !actor}
      />
    </main>
  );
}
