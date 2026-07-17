"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { addGalleryPhoto, updateGalleryPhoto, deleteGalleryPhoto, type Result } from "@/lib/gallery";

// All gallery writes are admin-only. The team side is read-only.

function revalidate() {
  revalidatePath("/admin/operations/gallery");
  revalidatePath("/team/gallery");
  revalidatePath("/team");
}

export async function uploadGalleryPhoto(formData: FormData): Promise<Result> {
  const admin = await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "No file received." };
  const res = await addGalleryPhoto(file, admin.email);
  if (res.ok) revalidate();
  return res;
}

export async function saveGalleryPhoto(id: string, caption: string, takenOn: string): Promise<Result> {
  await requireAdmin();
  const res = await updateGalleryPhoto(id, { caption, taken_on: takenOn });
  if (res.ok) revalidate();
  return res;
}

export async function removeGalleryPhoto(id: string): Promise<Result> {
  await requireAdmin();
  const res = await deleteGalleryPhoto(id);
  if (res.ok) revalidate();
  return res;
}
