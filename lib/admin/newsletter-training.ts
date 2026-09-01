// Training courses, read from the public APA training page.
//
// This replaced an auto-pull from company_os.events. The events table is empty
// and always has been; austpayroll.com.au/training is where training actually
// lives, and it is the page members are sent to. The markup is HubSpot's and
// server-rendered, so a fetch plus a parse is enough — no browser needed.
//
// Scraping our own marketing site is a deliberate trade: it is the source of
// truth, but the selectors below are coupled to HubSpot's template. If the
// course cards stop parsing, `parseCourses` returns an empty list and the
// caller reports "found nothing" rather than failing silently — check the
// markup before assuming there are no courses.

export const TRAINING_URL = "https://austpayroll.com.au/training";

// Only classroom-style sessions belong in the newsletter table. The page also
// lists self-paced products ("Via our online learning portal"), which are not
// dated and are not what the training section advertises.
export const CLASSROOM_FORMAT = "Virtual Classroom";

export type SiteCourse = {
  title: string;
  /** As printed on the site, e.g. "September 3rd". */
  dateLabel: string;
  /** Resolved calendar date, or null when the label is not a date. */
  date: Date | null;
  format: string;
  price: string | null;
  url: string | null;
  description: string | null;
};

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function clean(s: string): string {
  return decodeEntities(s.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
}

// "September 3rd" carries no year, so the year comes from the window being
// filled rather than from the page. Both boundary years are tried and the first
// that lands inside the window wins — which is what makes a December edition
// advertising January courses resolve correctly instead of jumping back a year.
export function resolveCourseDate(label: string, from: Date, to: Date): Date | null {
  const m = /^([A-Za-z]+)\s+(\d{1,2})/.exec(label.trim());
  if (!m) return null;
  const monthIndex = MONTHS.indexOf(m[1].toLowerCase());
  if (monthIndex < 0) return null;
  const day = Number(m[2]);
  if (!Number.isFinite(day) || day < 1 || day > 31) return null;

  for (let year = from.getUTCFullYear(); year <= to.getUTCFullYear() + 1; year += 1) {
    const candidate = new Date(Date.UTC(year, monthIndex, day));
    if (candidate >= from && candidate <= to) return candidate;
  }
  return null;
}

export function parseCourses(html: string): SiteCourse[] {
  const blocks = html.split(/<div class="mv-card tile-card course-card/).slice(1);
  const courses: SiteCourse[] = [];

  for (const block of blocks) {
    const title = clean(/course-card--title">([\s\S]*?)<\/h3>/.exec(block)?.[1] ?? "");
    if (!title) continue;

    // Label/value pairs, so Date and Format are read by name rather than by
    // position — the page does not always emit them in the same order.
    let dateLabel = "";
    let format = "";
    const metaRe =
      /course-card__meta--label">([\s\S]*?)<\/span>\s*<span class="course-card__meta--value">([\s\S]*?)<\/span>/g;
    let meta: RegExpExecArray | null;
    while ((meta = metaRe.exec(block)) !== null) {
      const label = clean(meta[1]);
      const value = clean(meta[2]);
      if (label === "Date") dateLabel = value;
      else if (label === "Format") format = value;
    }

    courses.push({
      title,
      dateLabel,
      date: null,
      format,
      price: /mv-pill[^>]*>(\$[\d,]+)/.exec(block)?.[1] ?? null,
      url: /href="(https:\/\/austpayroll\.com\.au\/training\/detail\/[^"]+)"/.exec(block)?.[1] ?? null,
      description: clean(/course-card--description">([\s\S]*?)<\/div>/.exec(block)?.[1] ?? "") || null,
    });
  }
  return courses;
}

export type FetchResult =
  | { ok: true; courses: SiteCourse[] }
  | { ok: false; error: string };

// Courses in the window, in date order. `no-store` because the point of
// pressing the button is to see what the site says right now.
export async function fetchCoursesInWindow(from: Date, to: Date): Promise<FetchResult> {
  let html: string;
  try {
    const res = await fetch(TRAINING_URL, { cache: "no-store" });
    if (!res.ok) return { ok: false, error: `The training page returned ${res.status}.` };
    html = await res.text();
  } catch (e) {
    return { ok: false, error: `Could not reach the training page: ${(e as Error).message}` };
  }

  const parsed = parseCourses(html);
  if (parsed.length === 0) {
    return {
      ok: false,
      error:
        "No course cards could be read from the training page. Its layout may have changed — check austpayroll.com.au/training.",
    };
  }

  const courses = parsed
    .filter((c) => c.format.toLowerCase().includes(CLASSROOM_FORMAT.toLowerCase()))
    .map((c) => ({ ...c, date: resolveCourseDate(c.dateLabel, from, to) }))
    .filter((c): c is SiteCourse & { date: Date } => c.date !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  return { ok: true, courses };
}

// How the course reads in the newsletter's training table: the site's own
// wording for date and format, so the edition matches what a member sees when
// they follow the link.
export function courseBody(c: SiteCourse): string {
  const parts = [`Date: ${c.dateLabel}`, `Format: ${c.format}`];
  if (c.price) parts.push(`Price: ${c.price}`);
  return parts.join("\n");
}
