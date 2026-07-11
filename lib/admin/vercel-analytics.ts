const TEAM_ID = "team_d4UiCMTHURZQlqlxjr8riwQD";
const PROJECT_ID = "prj_LzyuOkqtS1ttYk56LF1wd0Q6XSo4";
const API_BASE = "https://api.vercel.com/v1/query/web-analytics";
const WINDOW_DAYS = 30;
const TOP_N = 8;

type CountResponse = { data: { pageviews: number; visitors: number } };
type AggregateRow = { timestamp?: string; pageviews: number; visitors: number } & Record<string, unknown>;
type AggregateResponse = { data: AggregateRow[] };

export type AnalyticsBar = { label: string; value: number };

export type AnalyticsOverview = {
  totals: { pageviews: number; visitors: number };
  daily: AnalyticsBar[];
  topPages: AnalyticsBar[];
  topReferrers: AnalyticsBar[];
};

export type AnalyticsResult = AnalyticsOverview | { error: string };

function buildUrl(path: string, params: Record<string, string>) {
  const url = new URL(`${API_BASE}/${path}`);
  url.searchParams.set("teamId", TEAM_ID);
  url.searchParams.set("projectId", PROJECT_ID);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

async function query<T>(path: string, params: Record<string, string>, token: string): Promise<T> {
  const res = await fetch(buildUrl(path, params), {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 300 },
  });
  if (!res.ok) {
    throw new Error(`Vercel Web Analytics API (${path}) returned ${res.status}`);
  }
  return res.json();
}

function formatDay(timestamp?: string) {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export async function getAnalyticsOverview(): Promise<AnalyticsResult> {
  const token = process.env.VERCEL_ANALYTICS_TOKEN;
  if (!token) {
    return { error: "VERCEL_ANALYTICS_TOKEN is not set. Add it as a project environment variable to enable this page." };
  }

  const until = new Date();
  const since = new Date(until.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const sinceStr = since.toISOString();
  const untilStr = until.toISOString();
  const filter = "environment eq 'production'";

  try {
    const [count, daily, pages, referrers] = await Promise.all([
      query<CountResponse>("visits/count", { since: sinceStr, until: untilStr, filter }, token),
      query<AggregateResponse>(
        "visits/aggregate",
        { since: sinceStr, until: untilStr, by: "day", filter },
        token,
      ),
      query<AggregateResponse>(
        "visits/aggregate",
        { since: sinceStr, until: untilStr, by: "requestPath", limit: String(TOP_N), filter },
        token,
      ),
      query<AggregateResponse>(
        "visits/aggregate",
        { since: sinceStr, until: untilStr, by: "referrerHostname", limit: String(TOP_N), filter },
        token,
      ),
    ]);

    return {
      totals: count.data,
      daily: daily.data.map((row) => ({ label: formatDay(row.timestamp), value: row.pageviews })),
      topPages: pages.data.map((row) => ({
        label: (row.requestPath as string) || "/",
        value: row.pageviews,
      })),
      topReferrers: referrers.data.map((row) => ({
        label: (row.referrerHostname as string) || "Direct",
        value: row.pageviews,
      })),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to load Vercel Analytics data." };
  }
}
