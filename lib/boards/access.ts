// Shared write gate for task boards. A board mutation is allowed for an admin,
// or for a team member who is a member of that board. Non-redirecting: returns
// null when neither holds, so server actions can surface a clean error rather
// than bouncing a team member to /admin/login. This is the security boundary for
// board writes from both /admin/boards and /team/boards.

import { getAdminUser } from "@/lib/admin-auth";
import { getTeamActor } from "@/lib/team-auth";
import { companyOs } from "@/lib/supabase";

export type BoardActor = { label: string; personId: string | null; isAdmin: boolean };

export async function boardActorFor(boardId: string): Promise<BoardActor | null> {
  const admin = await getAdminUser();
  if (admin) return { label: admin.email, personId: null, isAdmin: true };

  const { actor } = await getTeamActor();
  if (!actor) return null;
  if (actor.isAdmin) return { label: actor.displayName, personId: actor.personId, isAdmin: true };

  const { data } = await companyOs
    .from("board_members")
    .select("id")
    .eq("board_id", boardId)
    .eq("person_id", actor.personId)
    .maybeSingle();
  if (!data) return null;
  return { label: actor.displayName, personId: actor.personId, isAdmin: false };
}
