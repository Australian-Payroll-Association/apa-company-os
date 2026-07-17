// Team photo gallery: upload to the public `gallery` bucket and track each
// photo in company_os.gallery_photos. Admin-managed (add/caption/delete),
// team-visible (browse + the home collage). Authorization is the caller's job —
// admin actions call requireAdmin() first.

import { supabase, companyOs } from "@/lib/supabase";

export const GALLERY_MAX_BYTES = 10 * 1024 * 1024;
const MIME_EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export type GalleryPhoto = {
  id: string;
  image_url: string;
  caption: string | null;
  taken_on: string | null;
  created_at: string;
};
export type Result = { ok: true } | { ok: false; error: string };

const SELECT = "id, image_url, caption, taken_on, created_at";

// Newest first: by the optional "taken on" date, then upload time.
export async function listGalleryPhotos(): Promise<GalleryPhoto[]> {
  const { data } = await companyOs
    .from("gallery_photos")
    .select(SELECT)
    .order("taken_on", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  return (data ?? []) as GalleryPhoto[];
}

export async function recentGalleryPhotos(limit: number): Promise<GalleryPhoto[]> {
  const { data } = await companyOs
    .from("gallery_photos")
    .select(SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as GalleryPhoto[];
}

export type CollageAvatar = { id: string; name: string; avatarUrl: string | null };

// Current team members for the home collage; those with a photo come first so
// the band is mostly faces, not initials.
export async function collageAvatars(limit: number): Promise<CollageAvatar[]> {
  const { data } = await companyOs
    .from("team_members")
    .select("id, people:people!person_id(full_name, preferred_name, avatar_url)")
    .in("status", ["active", "on_leave", "notice"]);
  type P = { full_name: string | null; preferred_name: string | null; avatar_url: string | null };
  const rows = ((data ?? []) as Record<string, unknown>[]).map((r) => {
    const raw = r.people as P | P[] | null;
    const p = Array.isArray(raw) ? raw[0] ?? null : raw;
    return { id: r.id as string, name: p?.preferred_name || p?.full_name || "?", avatarUrl: p?.avatar_url ?? null };
  });
  const withAvatar = rows.filter((r) => r.avatarUrl);
  const pool = withAvatar.length >= limit ? withAvatar : [...withAvatar, ...rows.filter((r) => !r.avatarUrl)];
  return pool.slice(0, limit);
}

export async function addGalleryPhoto(file: File, uploadedBy: string): Promise<Result> {
  const ext = MIME_EXT[file.type];
  if (!ext) return { ok: false, error: "Use a JPG, PNG, or WebP image." };
  if (file.size > GALLERY_MAX_BYTES) return { ok: false, error: "Image is too large (max 10 MB)." };
  if (file.size === 0) return { ok: false, error: "That file is empty." };

  const path = `photos/${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage.from("gallery").upload(path, buffer, { contentType: file.type });
  if (upErr) return { ok: false, error: "Upload failed. Try again." };

  const { data: pub } = supabase.storage.from("gallery").getPublicUrl(path);
  const { error: dbErr } = await companyOs
    .from("gallery_photos")
    .insert({ image_url: pub.publicUrl, storage_path: path, uploaded_by: uploadedBy });
  if (dbErr) {
    await supabase.storage.from("gallery").remove([path]); // don't orphan the object
    return { ok: false, error: "Could not save the photo." };
  }
  return { ok: true };
}

export async function updateGalleryPhoto(
  id: string,
  fields: { caption?: string | null; taken_on?: string | null },
): Promise<Result> {
  const patch: Record<string, unknown> = {};
  if ("caption" in fields) patch.caption = fields.caption?.trim() || null;
  if ("taken_on" in fields) patch.taken_on = fields.taken_on || null;
  if (Object.keys(patch).length === 0) return { ok: true };
  const { error } = await companyOs.from("gallery_photos").update(patch).eq("id", id);
  return error ? { ok: false, error: "Could not save." } : { ok: true };
}

export async function deleteGalleryPhoto(id: string): Promise<Result> {
  const { data } = await companyOs.from("gallery_photos").select("storage_path").eq("id", id).maybeSingle();
  const path = (data as { storage_path: string } | null)?.storage_path;
  const { error } = await companyOs.from("gallery_photos").delete().eq("id", id);
  if (error) return { ok: false, error: "Could not delete." };
  if (path) await supabase.storage.from("gallery").remove([path]);
  return { ok: true };
}
