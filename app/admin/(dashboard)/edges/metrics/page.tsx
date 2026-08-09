import { companyOs } from "@/lib/supabase";
import { PageHead } from "@/components/admin/PageHead";
import { METRIC_SELECT, weekStartISO, type MetricRow } from "../edges-shared";
import { MetricsTable, type MetricView } from "./MetricsTable";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Metrics",
  description: "Eight Edges: the weekly numbers behind the goals, agent-pulled where a source exists.",
};

export default async function MetricsPage() {
  const [metricsRes, readingsRes, krRes, teamRes] = await Promise.all([
    companyOs.from("metrics").select(METRIC_SELECT).order("office").order("name"),
    companyOs
      .from("metric_readings")
      .select("metric_id, week_start, value, collected_by")
      .order("week_start", { ascending: false }),
    companyOs.from("key_results").select("id, title"),
    companyOs.from("team_members").select("person_id, status"),
  ]);

  const metrics = (metricsRes.data ?? []) as MetricRow[];
  const teamRows = (teamRes.data ?? []) as { person_id: string; status: string | null }[];
  const activeTeamIds = teamRows
    .filter((t) => !["inactive", "offboarded"].includes(t.status ?? "active"))
    .map((t) => t.person_id);

  // People needed for display (metric owners) plus the active team for the picker.
  const personIds = Array.from(
    new Set([...activeTeamIds, ...metrics.map((m) => m.owner_person_id).filter(Boolean)]),
  ) as string[];
  const peopleRes = personIds.length
    ? await companyOs.from("people").select("id, full_name").in("id", personIds)
    : { data: [], error: null };
  const people = ((peopleRes.data ?? []) as { id: string; full_name: string }[]).sort((a, b) =>
    a.full_name.localeCompare(b.full_name),
  );
  const nameById = Object.fromEntries(people.map((p) => [p.id, p.full_name]));
  const teamOptions = people.filter((p) => activeTeamIds.includes(p.id));

  const error =
    metricsRes.error?.message ??
    readingsRes.error?.message ??
    krRes.error?.message ??
    teamRes.error?.message ??
    peopleRes.error?.message ??
    null;

  const readings = (readingsRes.data ?? []) as {
    metric_id: string;
    week_start: string;
    value: number;
    collected_by: string;
  }[];
  const krTitles = new Map(((krRes.data ?? []) as { id: string; title: string }[]).map((k) => [k.id, k.title]));

  const thisWeek = weekStartISO();
  const views: MetricView[] = metrics.map((m) => {
    const mine = readings.filter((r) => r.metric_id === m.id);
    const latest = mine[0] ?? null;
    const previous = mine[1] ?? null;
    return {
      ...m,
      kr_title: m.key_result_id ? (krTitles.get(m.key_result_id) ?? null) : null,
      owner_name: m.owner_person_id ? (nameById[m.owner_person_id] ?? null) : null,
      latest_value: latest ? Number(latest.value) : null,
      latest_week: latest?.week_start ?? null,
      previous_value: previous ? Number(previous.value) : null,
      has_this_week: latest?.week_start === thisWeek,
    };
  });

  return (
    <>
      <PageHead
        eyebrow="Eight Edges"
        title="Metrics"
        sub="The weekly numbers behind the goals. Every metric has one owner; agent-sourced numbers arrive Monday 06:00, manual ones are typed here and labeled honestly."
      />
      {error && (
        <div className="admin-alert admin-alert--err" style={{ marginBottom: 14 }}>
          {error}
        </div>
      )}
      <MetricsTable metrics={views} thisWeek={thisWeek} teamOptions={teamOptions} />
    </>
  );
}
