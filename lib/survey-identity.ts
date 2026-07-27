// Server-only: resolve the current visitor to a person for survey attribution.
// NEVER import from a client component.
//
// Anyone logged in (team member OR portal client — both hold a Supabase
// session) is matched on people.auth_user_id (cryptographic, never email).
// Admins may have no linked people row, so they fall back to an email match
// against people. Anyone else (no session, or a session we can't map) is
// external: the runner collects name + email instead.

import { createSessionClient } from "@/lib/supabase/server";
import { companyOs } from "@/lib/supabase";
import { isAdminEmail } from "@/lib/admin-auth";
import { PORTAL_STATUSES } from "@/lib/team-auth";

export type SurveyActor = {
  personId: string | null; // null only for admins without a people row
  name: string;
  email: string;
  // True for staff (a team_members row that grants /team access) and admins.
  // A logged-in portal CLIENT resolves with isTeam=false: identified, but an
  // external respondent for respondent_kind purposes.
  isTeam: boolean;
};

export async function resolveSurveyActor(): Promise<SurveyActor | null> {
  const supabase = createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase();
  if (!user || !email) return null;

  const { data: person } = await companyOs
    .from("people")
    .select("id, full_name, first_name, preferred_name, email")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (person) {
    const { data: memberships } = await companyOs
      .from("team_members")
      .select("id")
      .eq("person_id", person.id)
      .in("status", PORTAL_STATUSES)
      .limit(1);
    return {
      personId: person.id,
      name: person.preferred_name || person.first_name || person.full_name || person.email,
      email: person.email,
      isTeam: (memberships ?? []).length > 0,
    };
  }

  if (await isAdminEmail(email)) {
    const { data: byEmail } = await companyOs
      .from("people")
      .select("id, full_name")
      .eq("email", email)
      .maybeSingle();
    return { personId: byEmail?.id ?? null, name: byEmail?.full_name || email, email, isTeam: true };
  }

  return null;
}
