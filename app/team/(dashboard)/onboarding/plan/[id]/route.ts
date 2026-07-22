import { NextResponse } from "next/server";
import { requireTeamMember } from "@/lib/team-auth";
import { assertInScope, teamRead } from "@/lib/team/data";
import { signedPlanUrl } from "@/lib/onboarding-cycle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Serves a journey's plan document via a short-lived signed URL. Same shape as
// the profile ID-image route: gate first, assert the journey is in the actor's
// scope, then redirect to a 60-second signed URL — the bucket is private and
// paths never leave the server.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const actor = await requireTeamMember();

  const owner = await assertInScope(actor, "onboarding_plans", params.id);
  if (!owner) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data } = await teamRead(actor, "onboarding_plans", "plan_path")
    .eq("id", params.id)
    .maybeSingle();
  const path = (data as { plan_path: string | null } | null)?.plan_path ?? null;
  if (!path) return NextResponse.json({ error: "No plan uploaded" }, { status: 404 });

  const url = await signedPlanUrl(path);
  if (!url) return NextResponse.json({ error: "Could not sign URL" }, { status: 500 });
  return NextResponse.redirect(url);
}
