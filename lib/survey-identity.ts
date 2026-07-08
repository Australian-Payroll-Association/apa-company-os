// Server-only: resolve the current visitor to a person for survey attribution.
// NEVER import from a client component.
//
// Team members are matched on people.auth_user_id (the /team portal identity —
// cryptographic, never email). Admins may have no linked people row, so they
// fall back to an email match against people. Anyone else (no session, or a
// session we can't map) is external: the runner collects name + email instead.

import { createSessionClient } from "@/lib/supabase/server";
import { companyOs } from "@/lib/supabase";
import { isAdminEmail } from "@/lib/admin-auth";

export type SurveyActor = {
  personId: string | null; // null only for admins without a people row
  name: string;
  email: string;
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
    return {
      personId: person.id,
      name: person.preferred_name || person.first_name || person.full_name || person.email,
      email: person.email,
    };
  }

  if (await isAdminEmail(email)) {
    const { data: byEmail } = await companyOs
      .from("people")
      .select("id, full_name")
      .eq("email", email)
      .maybeSingle();
    return { personId: byEmail?.id ?? null, name: byEmail?.full_name || email, email };
  }

  return null;
}
