// Team photo gallery: upload to the public `gallery` bucket and track each
// photo in company_os.gallery_photos. Admin-managed (add/caption/delete),
// team-visible (browse + the home collage). Authorization is the caller's job —
// admin actions call requireAdmin() first.

import { supabase, companyOs } from "@/lib/supabase";

const MIME_EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

// The three photo categories (null = untagged). One shared source of truth.
export const GALLERY_CATEGORIES = [
  { key: "workshops", label: "Workshops" },
  { key: "clients", label: "Clients" },
  { key: "team", label: "Team" },
] as const;
export type GalleryCategory = (typeof GALLERY_CATEGORIES)[number]["key"];
const CATEGORY_KEYS = new Set<string>(GALLERY_CATEGORIES.map((c) => c.key));
export function cleanCategory(v: string | null | undefined): GalleryCategory | null {
  return v && CATEGORY_KEYS.has(v) ? (v as GalleryCategory) : null;
}

export type GalleryPhoto = {
  id: string;
  image_url: string;
  caption: string | null;
  taken_on: string | null;
  category: GalleryCategory | null;
  created_at: string;
};
export type Result = { ok: true } | { ok: false; error: string };

const SELECT = "id, image_url, caption, taken_on, category, created_at";

// Newest upload first.
export async function listGalleryPhotos(): Promise<GalleryPhoto[]> {
  const { data } = await companyOs
    .from("gallery_photos")
    .select(SELECT)
    .order("created_at", { ascending: false });
  return (data ?? []) as GalleryPhoto[];
}

// Fisher–Yates. The home page renders per-request (force-dynamic), so a plain
// Math.random here is what makes the collage rotate on every load.
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// A fresh random draw from the whole gallery on every load. The table is small
// (admin-curated), so shuffling in memory beats a DB-side random order.
export async function randomGalleryPhotos(limit: number): Promise<GalleryPhoto[]> {
  const { data } = await companyOs.from("gallery_photos").select(SELECT);
  return shuffle((data ?? []) as GalleryPhoto[]).slice(0, limit);
}

export type CollageAvatar = { id: string; name: string; avatarUrl: string | null };

// A random draw of current team members for the home collage; members with a
// photo fill the band first so it's faces, not initials.
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
  const withAvatar = shuffle(rows.filter((r) => r.avatarUrl));
  const withoutAvatar = shuffle(rows.filter((r) => !r.avatarUrl));
  return [...withAvatar, ...withoutAvatar].slice(0, limit);
}

// Photos upload straight from the browser to storage so there's no serverless
// body limit and no file goes through our functions. Step 1: mint a one-shot
// signed upload URL for a fresh path (service-role). The client PUTs the file
// to it (with progress); then step 2 records the row.
export async function signedGalleryUpload(
  contentType: string,
): Promise<{ ok: true; signedUrl: string; path: string } | { ok: false; error: string }> {
  const ext = MIME_EXT[contentType];
  if (!ext) return { ok: false, error: "Use a JPG, PNG, or WebP image." };
  const path = `photos/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await supabase.storage.from("gallery").createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "Could not start the upload." };
  return { ok: true, signedUrl: data.signedUrl, path };
}

// Step 2: once the object is in the bucket, record it. The bucket is public, so
// the row just stores its public URL.
export async function recordGalleryPhoto(
  path: string,
  uploadedBy: string,
  category?: string | null,
): Promise<Result> {
  const { data: pub } = supabase.storage.from("gallery").getPublicUrl(path);
  const { error } = await companyOs
    .from("gallery_photos")
    .insert({ image_url: pub.publicUrl, storage_path: path, uploaded_by: uploadedBy, category: cleanCategory(category) });
  if (error) {
    await supabase.storage.from("gallery").remove([path]); // don't orphan the object
    return { ok: false, error: "Could not save the photo." };
  }
  return { ok: true };
}

export async function updateGalleryPhoto(
  id: string,
  fields: { caption?: string | null; taken_on?: string | null; category?: string | null },
): Promise<Result> {
  const patch: Record<string, unknown> = {};
  if ("caption" in fields) patch.caption = fields.caption?.trim() || null;
  if ("taken_on" in fields) patch.taken_on = fields.taken_on || null;
  if ("category" in fields) patch.category = cleanCategory(fields.category);
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
