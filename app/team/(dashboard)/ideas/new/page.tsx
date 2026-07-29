import Link from "next/link";
import { requireTeamMember } from "@/lib/team-auth";
import { PageHead } from "@/components/admin/PageHead";
import { firstParam, type SearchParamsObj } from "@/lib/admin/url";
import { IdeaForm } from "./IdeaForm";
import { LearningForm } from "./LearningForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Share an idea",
  description:
    "What should we build? What have I learned? Share either with the team.",
};

// Two ways in, matching the onboarding deck's closing slide: "What should we
// build?" (the 5D wizard) and "What have I learned?" (the light learning
// form). No ?kind → the chooser.

export default async function NewIdeaPage({ searchParams }: { searchParams: SearchParamsObj }) {
  await requireTeamMember();
  const kind = firstParam(searchParams.kind);

  if (kind === "build") {
    return (
      <>
        <PageHead
          eyebrow="Ideas"
          title="What should we build?"
          sub="Walk the 5D framework: Define the problem, Discover the data, Design the workflow, Determine the ROI. Claude turns it into a product plan you keep."
        />
        <div style={{ maxWidth: 720 }}>
          <IdeaForm />
        </div>
      </>
    );
  }

  if (kind === "learning") {
    return (
      <>
        <PageHead
          eyebrow="Ideas"
          title="What have I learned?"
          sub="Share a lesson from your work — Learn and Share in action. It lands on the team feed for everyone to use."
        />
        <div style={{ maxWidth: 720 }}>
          <LearningForm />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHead
        eyebrow="Ideas"
        title="Ideas that Spark Solutions"
        sub="Two questions power this page. Pick the one you're here to answer."
      />
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", maxWidth: 720 }}>
        <Link href="/team/ideas/new?kind=build" className="admin-card" style={{ padding: "22px 24px", display: "block" }}>
          <h2 className="admin-card-title">What should we build?</h2>
          <p className="admin-page-sub" style={{ marginTop: 0, marginBottom: 0 }}>
            A workflow AI should own. Walk the 5D framework and get a product plan back in seconds.
          </p>
        </Link>
        <Link href="/team/ideas/new?kind=learning" className="admin-card" style={{ padding: "22px 24px", display: "block" }}>
          <h2 className="admin-card-title">What have I learned?</h2>
          <p className="admin-page-sub" style={{ marginTop: 0, marginBottom: 0 }}>
            A lesson worth sharing. Two minutes, no framework — it goes straight onto the team feed.
          </p>
        </Link>
      </div>
    </>
  );
}
