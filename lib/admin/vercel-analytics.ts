const TEAM_ID = "team_d4UiCMTHURZQlqlxjr8riwQD";
const PROJECT_ID = "prj_LzyuOkqtS1ttYk56LF1wd0Q6XSo4";
const API_BASE = "https://api.vercel.com/v1/query/web-analytics";
// Web Analytics was enabled on 2026-07-11 — there's no data before this date.
const TRACKING_START = "2026-07-11T00:00:00.000Z";
const TOP_N = 8;
// Hard ceiling on any single Vercel Analytics call so a slow/hung upstream can
// never gate a page render. The dashboard streams these tiles behind Suspense,
// so on timeout the tile just shows "—" while the rest of the page is unaffected.
const ANALYTICS_TIMEOUT_MS = 3500;

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
    signal: AbortSignal.timeout(ANALYTICS_TIMEOUT_MS),
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

// Totals only — one API call, for the dashboard's two traffic tiles. The full
// getAnalyticsOverview() (4 calls) is for the dedicated /operations/analytics page.
export async function getAnalyticsTotals(): Promise<
  { totals: { pageviews: number; visitors: number } } | { error: string }
> {
  const token = process.env.VERCEL_ANALYTICS_TOKEN;
  if (!token) {
    return { error: "VERCEL_ANALYTICS_TOKEN is not set. Add it as a project environment variable to enable this page." };
  }
  const filter = "environment eq 'production'";
  try {
    const count = await query<CountResponse>(
      "visits/count",
      { since: TRACKING_START, until: new Date().toISOString(), filter },
      token,
    );
    return { totals: count.data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to load Vercel Analytics data." };
  }
}

export async function getAnalyticsOverview(): Promise<AnalyticsResult> {
  const token = process.env.VERCEL_ANALYTICS_TOKEN;
  if (!token) {
    return { error: "VERCEL_ANALYTICS_TOKEN is not set. Add it as a project environment variable to enable this page." };
  }

  const sinceStr = TRACKING_START;
  const untilStr = new Date().toISOString();
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
