import { companyOs } from "@/lib/supabase";
import { scanTopics, type TopicSuggestion } from "@/lib/ai/topic-radar";
import { getEdition } from "@/lib/admin/newsletter";

// Topic radar, admin side. Persists what a scan found and turns an accepted
// suggestion into an Article submission.

export type SuggestionRow = {
  id: string;
  title: string;
  url: string;
  sourceName: string | null;
  dateLabel: string | null;
  category: string | null;
  summary: string | null;
  confidence: string;
  status: string;
  createdAt: string | null;
};

type Row = {
  id: string;
  title: string;
  url: string;
  source_name: string | null;
  date_label: string | null;
  category: string | null;
  summary: string | null;
  confidence: string | null;
  status: string | null;
  created_at: string | null;
};

function toSuggestion(r: Row): SuggestionRow {
  return {
    id: r.id,
    title: r.title,
    url: r.url,
    sourceName: r.source_name,
    dateLabel: r.date_label,
    category: r.category,
    summary: r.summary,
    confidence: r.confidence ?? "in_window",
    status: r.status ?? "new",
    createdAt: r.created_at,
  };
}

export async function getSuggestions(editionId: string): Promise<SuggestionRow[]> {
  const { data } = await companyOs
    .from("newsletter_topic_suggestions")
    .select("id, title, url, source_name, date_label, category, summary, confidence, status, created_at")
    .eq("edition_id", editionId)
    .order("category", { ascending: true })
    .order("created_at", { ascending: true });
  return ((data ?? []) as Row[]).map(toSuggestion);
}

export type ScanResult =
  | { ok: true; found: number; added: number; areasFailed: string[] }
  | { ok: false; error: string };

// The window scanned is the edition's own period. An edition covering September
// wants September's changes; widening it to "everything recent" would re-offer
// what the August edition already covered.
export async function scanTopicsForEdition(editionId: string): Promise<ScanResult> {
  const edition = await getEdition(editionId);
  if (!edition) return { ok: false, error: "Edition not found." };

  const from = edition.periodStart;
  const to = edition.periodEnd;
  if (!from || !to) return { ok: false, error: "This edition has no period set, so there is no window to scan." };

  const result = await scanTopics(from, to);
  if (!result.ok) return { ok: false, error: result.error };

  const areasFailed = result.areas.filter((a) => a.error).map((a) => a.label);
  const all: TopicSuggestion[] = result.areas.flatMap((a) => a.suggestions);
  if (all.length === 0) {
    return { ok: true, found: 0, added: 0, areasFailed };
  }

  // Existing rows are left exactly as they are, including dismissed ones. A
  // re-scan is meant to be additive: re-offering something already rejected
  // would make the second scan of a month worse than the first.
  const { data: existingData, error: readError } = await companyOs
    .from("newsletter_topic_suggestions")
    .select("url")
    .eq("edition_id", editionId);
  if (readError) return { ok: false, error: readError.message };
  const seen = new Set(((existingData ?? []) as { url: string }[]).map((r) => r.url));

  // Two scans in one run can return the same page from different areas — state
  // payroll tax and long service leave share several domains — so the batch is
  // deduped against itself as well as against what is stored.
  const fresh: TopicSuggestion[] = [];
  for (const s of all) {
    if (seen.has(s.url)) continue;
    seen.add(s.url);
    fresh.push(s);
  }
  if (fresh.length === 0) {
    return { ok: true, found: all.length, added: 0, areasFailed };
  }

  const { error } = await companyOs.from("newsletter_topic_suggestions").insert(
    fresh.map((s) => ({
      edition_id: editionId,
      title: s.title,
      url: s.url,
      source_name: s.sourceName,
      date_label: s.dateLabel,
      category: s.category,
      summary: s.summary,
      confidence: s.confidence,
      status: "new",
    })),
  );
  if (error) return { ok: false, error: error.message };

  return { ok: true, found: all.length, added: fresh.length, areasFailed };
}

export type PromoteResult = { ok: true; title: string } | { ok: false; error: string };

// Accepting a suggestion. It becomes an Article submission carrying the source
// link, switched OFF — a topic that has been noticed is not yet a topic that
// has been written, and the draft path would otherwise pick it up unwritten.
//
// The body is deliberately the scan's summary plus a standing instruction, not
// finished copy. The writer fetches the link and works from the page itself;
// this text is the brief, not the article.
export async function promoteSuggestion(
  suggestionId: string,
  actor: string,
): Promise<PromoteResult> {
  const { data, error: readError } = await companyOs
    .from("newsletter_topic_suggestions")
    .select("id, edition_id, title, url, source_name, date_label, summary, status")
    .eq("id", suggestionId)
    .maybeSingle();
  if (readError) return { ok: false, error: readError.message };
  if (!data) return { ok: false, error: "Suggestion not found." };

  const row = data as Row & { edition_id: string };
  if (row.status === "added") return { ok: false, error: "That suggestion is already in the edition." };

  const brief = [
    row.summary?.trim() || "",
    row.date_label ? `Source states: ${row.date_label}.` : "",
    "Write this up from the linked page. Do not state a figure the page does not give.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const { data: inserted, error } = await companyOs
    .from("newsletter_submissions")
    .insert({
      edition_id: row.edition_id,
      person_id: null,
      section_type: "article",
      title: row.title,
      body: brief,
      link_url: row.url,
      // A third source alongside 'team' and 'events'. The column has no CHECK
      // constraint, matching how section types are kept in code rather than in
      // the database.
      source: "radar",
      details: {},
    })
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };

  const { error: markError } = await companyOs
    .from("newsletter_topic_suggestions")
    .update({
      status: "added",
      submission_id: (inserted as { id: string } | null)?.id ?? null,
      decided_at: new Date().toISOString(),
      decided_by: actor,
    })
    .eq("id", suggestionId);
  if (markError) return { ok: false, error: markError.message };

  return { ok: true, title: row.title };
}

export async function dismissSuggestion(
  suggestionId: string,
  actor: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await companyOs
    .from("newsletter_topic_suggestions")
    .update({ status: "dismissed", decided_at: new Date().toISOString(), decided_by: actor })
    .eq("id", suggestionId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
