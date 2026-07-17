import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin-auth";
import { addGalleryPhoto } from "@/lib/gallery";

// One-photo upload endpoint for the drag-and-drop gallery uploader. Exists as an
// API route (not a server action) so the client can stream it with XHR and show
// a real per-file progress bar. Admin-only; returns JSON, never a redirect.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ ok: false, error: "Not authorized." }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "No file received." }, { status: 400 });
  }

  const res = await addGalleryPhoto(file, admin.email);
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
