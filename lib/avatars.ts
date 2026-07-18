// Profile photo upload: validate -> store in the public `avatars` bucket ->
// point people.avatar_url at it. AUTHORIZATION IS THE CALLER'S JOB — the /team
// action passes only the actor's own personId; the admin action passes any
// person after requireAdmin(). Old objects for the person are removed
// best-effort so the bucket doesn't accumulate stale photos.

import { supabase, companyOs } from "@/lib/supabase";

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type AvatarResult = { ok: true; url: string } | { ok: false; error: string };

export async function setPersonAvatar(personId: string, file: File): Promise<AvatarResult> {
  const ext = MIME_EXT[file.type];
  if (!ext) return { ok: false, error: "Use a JPG, PNG, or WebP image." };
  if (file.size > AVATAR_MAX_BYTES) return { ok: false, error: "Image is too large (max 5 MB)." };
  if (file.size === 0) return { ok: false, error: "That file is empty." };

  const folder = `people/${personId}`;
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from("avatars")
    .upload(path, buffer, { contentType: file.type });
  if (upErr) return { ok: false, error: "Upload failed. Try again." };

  const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
  const url = pub.publicUrl;

  const { error: dbErr } = await companyOs
    .from("people")
    .update({ avatar_url: url, updated_at: new Date().toISOString() })
    .eq("id", personId);
  if (dbErr) return { ok: false, error: "Could not save the photo." };

  // Best-effort cleanup of previous photos; the new one is already live.
  const { data: existing } = await supabase.storage.from("avatars").list(folder);
  const stale = (existing ?? [])
    .map((o) => `${folder}/${o.name}`)
    .filter((p) => p !== path);
  if (stale.length > 0) await supabase.storage.from("avatars").remove(stale);

  return { ok: true, url };
}
