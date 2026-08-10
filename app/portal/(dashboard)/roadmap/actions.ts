"use server";

import { revalidatePath } from "next/cache";
import { requirePortalMember } from "@/lib/portal-auth";
import {
  setClientPriorityForActor,
  setClientNoteForActor,
  proposeItemForActor,
} from "@/lib/portal/backlog";
import type { BacklogGroupKey } from "@/lib/client-backlog";

const BASE = "/portal/roadmap";

export async function setMyPriority(itemId: string, priority: string | null) {
  const actor = await requirePortalMember();
  const r = await setClientPriorityForActor(actor, itemId, priority);
  if (r.ok) revalidatePath(BASE);
  return r;
}

export async function setMyNote(itemId: string, note: string) {
  const actor = await requirePortalMember();
  const r = await setClientNoteForActor(actor, itemId, note);
  if (r.ok) revalidatePath(BASE);
  return r;
}

export async function proposeMyItem(input: {
  companyId: string;
  groupKey: BacklogGroupKey;
  title: string;
  note?: string;
  priority?: string;
}) {
  const actor = await requirePortalMember();
  const r = await proposeItemForActor(actor, input);
  if (r.ok) revalidatePath(BASE);
  return r;
}
