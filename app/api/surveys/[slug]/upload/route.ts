import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { companyOs, supabase } from "@/lib/supabase";
import type { FieldConfig } from "@/lib/admin/surveys";

// Upload endpoint for survey `file` fields. The runner posts one file here as
// soon as it is picked, and the returned object path becomes that field's
// answer. Public by design (surveys are unauthenticated) but tightly scoped: we
// only accept an upload for a real, published survey's real `file` field, and
// enforce that field's own mime/size limits. Files land in the private bucket
// named in the field config (e.g. `id-documents`); the path is never public.

export const runtime = "nodejs";

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_ACCEPT = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const form = await req.formData();
    const fieldId = String(form.get("field_id") ?? "");
    const file = form.get("file");

    if (!fieldId) return NextResponse.json({ error: "Missing field." }, { status: 400 });
    if (!(file instanceof File) || file.size === 0)
      return NextResponse.json({ error: "No file." }, { status: 400 });

    // The survey must exist, be published, and own a `file` field with this id.
    const { data: survey } = await companyOs
      .from("surveys")
      .select("id, status, archived_at")
      .eq("slug", params.slug)
      .maybeSingle();
    if (!survey || survey.archived_at || survey.status !== "published")
      return NextResponse.json({ error: "Survey not accepting responses." }, { status: 410 });

    const { data: field } = await companyOs
      .from("survey_fields")
      .select("id, type, config")
      .eq("id", fieldId)
      .eq("survey_id", survey.id)
      .maybeSingle();
    if (!field || field.type !== "file")
      return NextResponse.json({ error: "Not a file question." }, { status: 400 });

    const config = (field.config ?? {}) as FieldConfig;
    const bucket = config.bucket || "survey-uploads";
    const accept = config.accept && config.accept.length > 0 ? config.accept : DEFAULT_ACCEPT;
    const maxBytes = config.max_bytes ?? DEFAULT_MAX_BYTES;

    if (!accept.includes(file.type))
      return NextResponse.json({ error: "Unsupported file type." }, { status: 400 });
    if (file.size > maxBytes)
      return NextResponse.json(
        { error: `File is too large (max ${Math.round(maxBytes / 1024 / 1024)} MB).` },
        { status: 400 },
      );

    const ext = EXT[file.type] ?? "bin";
    const path = `${params.slug}/${fieldId}/${randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await supabase.storage
      .from(bucket)
      .upload(path, buffer, { contentType: file.type, upsert: false });
    if (upErr) {
      console.error("[survey upload] failed:", upErr.message);
      return NextResponse.json({ error: "Upload failed. Try again." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, path, name: file.name });
  } catch (err) {
    console.error("[survey upload] error:", err);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}
