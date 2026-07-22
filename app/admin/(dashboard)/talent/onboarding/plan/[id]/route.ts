import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { companyOs } from "@/lib/supabase";
import { signedPlanUrl } from "@/lib/onboarding-cycle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin view of a journey's plan document — requireAdmin, then a 60-second
// signed URL. Mirror of the scoped route at /team/onboarding/plan/[id].
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  await requireAdmin();

  const { data } = await companyOs
    .from("onboarding_plans")
    .select("plan_path")
    .eq("id", params.id)
    .maybeSingle();
  const path = (data as { plan_path: string | null } | null)?.plan_path ?? null;
  if (!path) return NextResponse.json({ error: "No plan uploaded" }, { status: 404 });

  const url = await signedPlanUrl(path);
  if (!url) return NextResponse.json({ error: "Could not sign URL" }, { status: 500 });
  return NextResponse.redirect(url);
}
