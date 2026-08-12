import { NextResponse } from "next/server";
import { companyOs } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// Exports the AI screening training set as JSONL: every human correction paired
// with the AI value it overrode (snapshotted at correction time) and the
// application's outcome. Feeds prompt/eval tuning for lib/resume-screen.ts.
// Admin-gated; the source table is append-only. Static segment, so it takes
// precedence over the sibling [id] page for /training-export.
type Outcome = { status: string | null; rating: number | null; ai_rating: number | null };
type Row = {
  id: string;
  application_id: string;
  person_id: string | null;
  ai_model: string | null;
  field: string;
  ai_value: string | null;
  human_value: string | null;
  corrected_by: string | null;
  created_at: string;
  applications: Outcome | Outcome[] | null;
};

export async function GET() {
  await requireAdmin();
  const { data, error } = await companyOs
    .from("ai_screen_corrections")
    .select(
      "id, application_id, person_id, ai_model, field, ai_value, human_value, corrected_by, created_at, applications(status, rating, ai_rating)",
    )
    .order("created_at", { ascending: true })
    .limit(10000);
  if (error) return new NextResponse(error.message, { status: 500 });

  const rows = (data ?? []) as unknown as Row[];
  const lines = rows.map((r) => {
    const a = Array.isArray(r.applications) ? r.applications[0] ?? null : r.applications;
    return JSON.stringify({
      id: r.id,
      application_id: r.application_id,
      person_id: r.person_id,
      ai_model: r.ai_model,
      field: r.field,
      ai_value: r.ai_value,
      human_value: r.human_value,
      corrected_by: r.corrected_by,
      created_at: r.created_at,
      outcome_status: a?.status ?? null,
      recruiter_rating: a?.rating ?? null,
      ai_rating: a?.ai_rating ?? null,
    });
  });

  const body = lines.length ? lines.join("\n") + "\n" : "";
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Content-Disposition": 'attachment; filename="ai-screen-training.jsonl"',
      "Cache-Control": "no-store",
    },
  });
}
