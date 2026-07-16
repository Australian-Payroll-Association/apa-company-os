"use server";

import { revalidatePath } from "next/cache";
import { requireTeamMember } from "@/lib/team-auth";
import { updateOwnContact } from "@/lib/team/data";
import { setPersonAvatar, type AvatarResult } from "@/lib/avatars";

// Self-service avatar: writes ONLY the actor's own person row (personId comes
// from the JWT-derived actor, never the client).
export async function saveOwnAvatar(formData: FormData): Promise<AvatarResult> {
  const actor = await requireTeamMember();
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "No file received." };
  const res = await setPersonAvatar(actor.personId, file);
  if (res.ok) {
    revalidatePath("/team/profile");
    revalidatePath("/team");
  }
  return res;
}

// Self-service profile edit. The actor comes from requireTeamMember() and
// updateOwnContact writes only their own people row with a fixed field
// allowlist — no ids and no other fields are accepted from the client.

type Result = { ok: true } | { ok: false; error: string };

const MAX_LEN = 120;

function clean(value: string): string | null {
  const v = value.trim();
  return v ? v : null;
}

export async function saveOwnContact(input: {
  preferredName: string;
  phone: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
}): Promise<Result> {
  const actor = await requireTeamMember();

  for (const [label, v] of [
    ["Preferred name", input.preferredName],
    ["Phone", input.phone],
    ["Emergency contact name", input.emergencyContactName],
    ["Emergency contact phone", input.emergencyContactPhone],
  ] as const) {
    if (v.trim().length > MAX_LEN) return { ok: false, error: `${label} is too long.` };
  }

  const { ok, error } = await updateOwnContact(actor, {
    preferred_name: clean(input.preferredName),
    phone: clean(input.phone),
    emergency_contact_name: clean(input.emergencyContactName),
    emergency_contact_phone: clean(input.emergencyContactPhone),
  });
  if (!ok) return { ok: false, error: error ?? "Could not save changes." };

  revalidatePath("/team/profile");
  revalidatePath("/team");
  return { ok: true };
}
