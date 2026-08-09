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
  const [metricsRes, readingsRes, krRes] = await Promise.all([
    companyOs.from("metrics").select(METRIC_SELECT).order("office").order("name"),
    companyOs.from("metric_readings").select("metric_id, week_start, value, collected_by").order("week_start", { ascending: false }),
    companyOs.from("key_results").select("id, title"),
  ]);

  const error = metricsRes.error?.message ?? readingsRes.error?.message ?? krRes.error?.message ?? null;
  const metrics = (metricsRes.data ?? []) as MetricRow[];
  const readings = (readingsRes.data ?? []) as { metric_id: string; week_start: string; value: number; collected_by: string }[];
  const krTitles = new Map(((krRes.data ?? []) as { id: string; title: string }[]).map((k) => [k.id, k.title]));

  const thisWeek = weekStartISO();
  const views: MetricView[] = metrics.map((m) => {
    const mine = readings.filter((r) => r.metric_id === m.id);
    const latest = mine[0] ?? null;
    const previous = mine[1] ?? null;
    return {
      ...m,
      kr_title: m.key_result_id ? (krTitles.get(m.key_result_id) ?? null) : null,
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
        sub="The weekly numbers behind the goals. Agent-sourced numbers arrive Monday 06:00; manual ones are typed here and labeled honestly."
      />
      {error && (
        <div className="admin-alert admin-alert--err" style={{ marginBottom: 14 }}>
          {error}
        </div>
      )}
      <MetricsTable metrics={views} thisWeek={thisWeek} />
    </>
  );
}
