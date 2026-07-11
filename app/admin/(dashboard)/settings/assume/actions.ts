"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { companyOs } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";
import { recordAudit } from "@/lib/admin/audit";
import { ASSUME_COOKIE, ASSUME_SESSION_MINUTES } from "@/lib/portal-auth";

type Result = { ok: true } | { ok: false; error: string };

// Starts an Assume session: view /portal scoped to one client company, as its
// best-known contact, WITHOUT touching the admin's real Supabase session (see
// lib/portal-auth.ts for how requirePortalMember() reads this back). The
// cookie holds only an opaque session id — nothing forgeable, nothing to leak
// beyond a reference to a row that expires in ASSUME_SESSION_MINUTES and can
// be ended early from the /portal banner.
export async function startAssumeSession(companyId: string): Promise<Result> {
  const admin = await requireAdmin();
  if (!companyId) return { ok: false, error: "Missing company." };

  const { data: link } = await companyOs
    .from("person_companies")
    .select("person_id")
    .eq("company_id", companyId)
    .order("is_primary", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!link) return { ok: false, error: "This company has no linked contact to view as." };

  const expiresAt = new Date(Date.now() + ASSUME_SESSION_MINUTES * 60 * 1000);
  const { data: session, error } = await companyOs
    .from("portal_assume_sessions")
    .insert({
      company_id: companyId,
      person_id: link.person_id,
      started_by: admin.email,
      expires_at: expiresAt.toISOString(),
    })
    .select("id")
    .single();
  if (error || !session) return { ok: false, error: error?.message ?? "Could not start session." };

  cookies().set(ASSUME_COOKIE, session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  await recordAudit({
    table: "portal_assume_sessions",
    recordId: session.id,
    operation: "insert",
    actor: admin.email,
    context: { action: "assume_start", company_id: companyId, person_id: link.person_id },
  });

  redirect("/portal");
}
