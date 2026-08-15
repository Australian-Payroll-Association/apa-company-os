import { requireTeamMember } from "@/lib/team-auth";
import { getMyWork } from "@/lib/team/boards";
import { PageHead } from "@/components/admin/PageHead";
import { MyTasks } from "./MyTasks";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata = { title: "My Tasks" };

export default async function MyTasksPage() {
  const actor = await requireTeamMember();
  const work = await getMyWork(actor);

  return (
    <>
      <PageHead
        eyebrow="Me"
        title="My Tasks"
        sub="Everything with your name on it, across every board, plus your open commitments."
      />
      <MyTasks work={work} />
    </>
  );
}
