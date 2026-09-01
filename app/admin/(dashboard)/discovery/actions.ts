"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { discoveryDb } from "@/lib/discovery/data";

type Result = { ok: true } | { ok: false; error: string };

function generateAccessToken(): string {
  return randomBytes(24).toString("base64url");
}

export async function createEngagement(input: { clientName: string; consultantPersonId: string }): Promise<Result> {
  const admin = await requireAdmin();
  const clientName = input.clientName.trim();
  if (!clientName) return { ok: false, error: "Client name is required." };

  const { data, error } = await discoveryDb
    .from("discovery_engagements")
    .insert({
      client_name: clientName,
      consultant_person_id: input.consultantPersonId || null,
      access_token: generateAccessToken(),
      created_by: admin.email,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Something went wrong creating the review." };

  await discoveryDb.from("discovery_events").insert({
    engagement_id: data.id,
    actor_type: "admin",
    actor: admin.email,
    type: "created",
  });

  redirect(`/admin/discovery/${data.id}`);
}
