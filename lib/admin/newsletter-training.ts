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
  /** Start time as printed, e.g. "8:45am AEST". Null when the detail page did not give one. */
  time: string | null;
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
      // The listing page carries Date and Format and nothing else. Times live
      // one page deeper, and are filled in by fetchSessionTimes.
      time: null,
      format,
      price: /mv-pill[^>]*>(\$[\d,]+)/.exec(block)?.[1] ?? null,
      url: /href="(https:\/\/austpayroll\.com\.au\/training\/detail\/[^"]+)"/.exec(block)?.[1] ?? null,
      description: clean(/course-card--description">([\s\S]*?)<\/div>/.exec(block)?.[1] ?? "") || null,
    });
  }
  return courses;
}

// A course whose date resolved inside the window. Narrowing is kept in the
// type so callers do not have to re-assert it.
export type DatedCourse = SiteCourse & { date: Date };

// One scheduled run of a course, from its detail page.
export type CourseSession = {
  date: Date;
  /** As printed, e.g. "8:45am AEDT". Null when the page gives no time. */
  time: string | null;
  /** The page's own label, e.g. "October 29th". Kept for reporting. */
  label: string;
};

// Every session a course detail page advertises.
//
// This replaced reading the single date on the listing page, which turned out
// to show only ONE date per course: a live comparison found 9 dates listed
// against 16 real sessions, so the newsletter was advertising well under half
// of APA's training. Reading the detail pages is also what makes a date
// unambiguous — the checkout link carries 2026-10-29, so there is no month
// name to match and no year to infer from the window.
//
// Sessions are NOT in date order on the page (SCHADS lists December before
// October), so the caller sorts.
export function parseSessions(html: string, from: Date, to: Date): CourseSession[] {
  const sessions: CourseSession[] = [];

  for (const block of html.split(/<div class="session-list-card--item/).slice(1)) {
    const time = clean(/session-list-card--date_time">([\s\S]*?)<\/span>/.exec(block)?.[1] ?? "");
    const label = clean(/session-list-card--date_date">([\s\S]*?)<\/h5>/.exec(block)?.[1] ?? "");

    // The day is not always zero-padded — the Hospitality Award course's link
    // reads "--2026-10-1" — so the parts are matched loosely and padded here
    // rather than requiring a shape the site does not consistently emit.
    const parts = /\/training\/checkout\/[^"]*?--(\d{4})-(\d{1,2})-(\d{1,2})/.exec(block);

    let date: Date | null = null;
    if (parts) {
      date = new Date(
        Date.UTC(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3])),
      );
    } else if (label) {
      // A session with no Book Now link — sold out, or bookings closed. It is
      // still a real session members may ask about, so fall back to the
      // printed label with the year resolved from the window.
      date = resolveCourseDate(label, from, to);
    }
    if (!date || Number.isNaN(date.getTime())) continue;

    sessions.push({ date, time: time || null, label });
  }
  return sessions;
}

export async function fetchCourseSessions(
  url: string,
  from: Date,
  to: Date,
): Promise<CourseSession[]> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    return parseSessions(await res.text(), from, to);
  } catch {
    // One unreachable detail page loses that course's sessions, not the sync.
    return [];
  }
}

export type FetchResult =
  | { ok: true; courses: DatedCourse[] }
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

  // The listing is the CATALOGUE — which courses exist, their format, price
  // and description. It is not the schedule: it prints one date per course,
  // and a live comparison found 9 dates listed against 16 real sessions. The
  // schedule comes from the detail pages below.
  //
  // Deduped by URL because the listing can show the same course twice with
  // different dates; the Superannuation course does exactly that, and without
  // this its detail page would be fetched and expanded twice.
  const catalogue = new Map<string, SiteCourse>();
  for (const c of parsed) {
    if (!c.format.toLowerCase().includes(CLASSROOM_FORMAT.toLowerCase())) continue;
    if (!c.url || catalogue.has(c.url)) continue;
    catalogue.set(c.url, c);
  }
  if (catalogue.size === 0) {
    return {
      ok: false,
      error: `No ${CLASSROOM_FORMAT} courses on the training page. Its layout may have changed — check ${TRAINING_URL}.`,
    };
  }

  // One request per course, all at once.
  const sessionsByUrl = new Map<string, CourseSession[]>();
  await Promise.all(
    [...catalogue.keys()].map(async (u) => {
      sessionsByUrl.set(u, await fetchCourseSessions(u, from, to));
    }),
  );

  // One row per SESSION, not per course: a course running in October and again
  // in December is two things a member can book, and the newsletter's table
  // has a row for each.
  const courses: DatedCourse[] = [];
  for (const [url, course] of catalogue) {
    for (const session of sessionsByUrl.get(url) ?? []) {
      if (session.date < from || session.date > to) continue;
      courses.push({
        ...course,
        date: session.date,
        time: session.time,
        // The session's own printed date, not the listing's.
        dateLabel: session.label || course.dateLabel,
      });
    }
  }

  courses.sort((a, b) => a.date.getTime() - b.date.getTime());
  return { ok: true, courses };
}

// How the course reads in the newsletter's training table: the site's own
// wording for date and format, so the edition matches what a member sees when
// they follow the link.
export function courseBody(c: SiteCourse): string {
  const parts = [`Date: ${c.dateLabel}`];
  if (c.time) parts.push(`Time: ${c.time}`);
  parts.push(`Format: ${c.format}`);
  if (c.price) parts.push(`Price: ${c.price}`);
  return parts.join("\n");
}
