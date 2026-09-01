"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { discoveryDb } from "@/lib/discovery/data";
import { sendClientInvite } from "@/lib/discovery/notify";
import { getSiteOrigin } from "@/lib/site-origin";

type Result = { ok: true } | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function generateAccessToken(): string {
  return randomBytes(24).toString("base64url");
}

export async function createEngagement(input: {
  clientName: string;
  consultantPersonId: string;
  clientEmail: string;
  clientContactName: string;
  consultantEmail: string;
}): Promise<Result> {
  const admin = await requireAdmin();
  const clientName = input.clientName.trim();
  const clientEmail = input.clientEmail.trim();
  const clientContactName = input.clientContactName.trim();
  const consultantEmail = input.consultantEmail.trim();
  if (!clientName) return { ok: false, error: "Client name is required." };
  if (!clientEmail || !EMAIL_RE.test(clientEmail)) return { ok: false, error: "A valid client email is required to send the invite." };

  const accessToken = generateAccessToken();
  const { data, error } = await discoveryDb
    .from("discovery_engagements")
    .insert({
      client_name: clientName,
      consultant_person_id: input.consultantPersonId || null,
      client_email: clientEmail,
      client_contact_name: clientContactName || null,
      consultant_email: consultantEmail || null,
      access_token: accessToken,
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

  const sent = await sendClientInvite({
    engagementId: data.id,
    clientName,
    clientEmail,
    contactName: clientContactName || null,
    senderEmail: consultantEmail || null,
    discoveryUrl: `${getSiteOrigin()}/discovery/${accessToken}`,
  });
  await discoveryDb.from("discovery_events").insert({
    engagement_id: data.id,
    actor_type: "system",
    type: "note",
    body: sent ? `Invite emailed to ${clientEmail}.` : `Invite email to ${clientEmail} failed to send — copy the link and send it manually.`,
  });

  redirect(`/admin/discovery/${data.id}${sent ? "" : "?inviteFailed=1"}`);
}
