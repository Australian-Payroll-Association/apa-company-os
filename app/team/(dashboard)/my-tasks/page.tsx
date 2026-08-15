import { requireTeamMember } from "@/lib/team-auth";
import { getMyWork, getActorBoards } from "@/lib/team/boards";
import { PageHead } from "@/components/admin/PageHead";
import { MyTasks } from "./MyTasks";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata = { title: "My Tasks" };

export default async function MyTasksPage() {
  const actor = await requireTeamMember();
  const [work, boards] = await Promise.all([getMyWork(actor), getActorBoards(actor)]);

  return (
    <>
      <PageHead
        eyebrow="Me"
        title="My Tasks"
        sub="Your boards, everything assigned to you across them, and your open commitments."
      />
      <MyTasks work={work} boards={boards} />
    </>
  );
}
