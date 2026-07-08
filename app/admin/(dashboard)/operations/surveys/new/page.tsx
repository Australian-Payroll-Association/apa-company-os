import { PageHead } from "@/components/admin/PageHead";
import { SurveyCreateForm } from "./SurveyCreateForm";

export const dynamic = "force-dynamic";

export default function NewSurveyPage() {
  return (
    <>
      <PageHead
        eyebrow="Operations · Surveys"
        title="New survey"
        sub="Name it and set anonymity now; questions come next."
      />
      <SurveyCreateForm />
    </>
  );
}
