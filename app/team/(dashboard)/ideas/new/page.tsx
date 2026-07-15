import { requireTeamMember } from "@/lib/team-auth";
import { PageHead } from "@/components/admin/PageHead";
import { IdeaForm } from "./IdeaForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Submit an idea",
  description: "Turn a problem on your team into an AI program idea with the 5D framework.",
};

export default async function NewIdeaPage() {
  await requireTeamMember();

  return (
    <>
      <PageHead
        eyebrow="Ideas"
        title="Submit an idea"
        sub="Walk the 5D framework: Define the problem, Discover the data, Design the workflow, Determine the ROI. Claude turns it into a product plan you keep."
      />
      <div style={{ maxWidth: 720 }}>
        <IdeaForm />
      </div>
    </>
  );
}
