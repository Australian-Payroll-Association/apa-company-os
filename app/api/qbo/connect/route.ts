import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminUser } from "@/lib/admin-auth";
import { buildQboAuthUrl, qboConfigured } from "@/lib/qbo";
import { getSiteOrigin } from "@/lib/site-origin";

export const dynamic = "force-dynamic";

// Starts the QuickBooks OAuth flow (admin-only). The random state lands in an
// httpOnly cookie and is verified by /api/qbo/callback — standard CSRF guard.
export async function GET() {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.redirect(`${getSiteOrigin()}/admin/login`);
  if (!qboConfigured()) {
    return NextResponse.redirect(`${getSiteOrigin()}/admin/settings/quickbooks?status=unconfigured`);
  }

  const state = crypto.randomUUID();
  cookies().set("qbo_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });
  return NextResponse.redirect(buildQboAuthUrl(state));
}
