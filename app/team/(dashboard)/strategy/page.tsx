import { remark } from "remark";
import remarkHtml from "remark-html";
import { requireTeamMember } from "@/lib/team-auth";
import { companyOs } from "@/lib/supabase";
import { PageHead } from "@/components/admin/PageHead";
import type { StrategyRow } from "@/app/admin/(dashboard)/edges/edges-shared";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Strategy",
  description: "The company strategy for the year, visible to the whole team.",
};

// /team/strategy — read-only, company-visible view of the latest strategies
// row. Content is edited from /admin/edges/goals (title + body_md); this page
// parses body_md's `##` sections into designed blocks instead of dumping
// markdown: Ambition / Purpose / Value Proposition become statement cards,
// Themes becomes the hero's year pills + slides CTA, Business Lines becomes a
// card row. Unrecognized sections still render, as prose, so admin edits never
// silently disappear.
type Section = { heading: string; body: string };

function parseSections(md: string): Section[] {
  const out: Section[] = [];
  let current: Section | null = null;
  for (const line of md.split("\n")) {
    const h = line.match(/^##\s+(.+)$/);
    if (h) {
      if (current) out.push(current);
      current = { heading: h[1].trim(), body: "" };
    } else if (current) {
      current.body += line + "\n";
    }
  }
  if (current) out.push(current);
  return out.map((s) => ({ ...s, body: s.body.trim() }));
}

function parseThemes(body: string): { year: number; title: string }[] {
  return [...body.matchAll(/^[-*]\s+(\d{4}):\s+(.+)$/gm)]
    .map((m) => ({ year: Number(m[1]), title: m[2].trim() }))
    .sort((a, b) => b.year - a.year);
}

function parseLink(body: string): { label: string; url: string } | null {
  const m = body.match(/\[([^\]]+)\]\((https?:[^)\s]+)\)/);
  return m ? { label: m[1], url: m[2] } : null;
}

function parseSubsections(body: string): Section[] {
  const out: Section[] = [];
  let current: Section | null = null;
  for (const line of body.split("\n")) {
    const h = line.match(/^###\s+(.+)$/);
    if (h) {
      if (current) out.push(current);
      current = { heading: h[1].trim(), body: "" };
    } else if (current) {
      current.body += line + "\n";
    }
  }
  if (current) out.push(current);
  return out.map((s) => ({ ...s, body: s.body.trim() }));
}

const STATEMENT_ICONS: Record<string, string> = {
  ambition: "◆",
  purpose: "◎",
  "value proposition": "✦",
};
const LINE_ICONS = ["◈", "◐", "☷"];

export default async function TeamStrategyPage() {
  await requireTeamMember();

  const res = await companyOs
    .from("strategies")
    .select("id, year, title, body_md")
    .order("year", { ascending: false })
    .limit(1);
  const strategy = (res.data?.[0] as StrategyRow | undefined) ?? null;

  const sections = strategy?.body_md ? parseSections(strategy.body_md) : [];
  const byName = new Map(sections.map((s) => [s.heading.toLowerCase(), s]));

  const statements = ["ambition", "purpose", "value proposition"]
    .map((key) => {
      const s = byName.get(key);
      return s ? { label: s.heading, body: s.body, ico: STATEMENT_ICONS[key] } : null;
    })
    .filter(Boolean) as { label: string; body: string; ico: string }[];

  const themesSection = byName.get("themes");
  const themes = themesSection ? parseThemes(themesSection.body) : [];
  const slides = themesSection ? parseLink(themesSection.body) : null;
  const currentTheme = themes.find((t) => t.year === strategy?.year) ?? themes[0] ?? null;

  const lines = byName.get("business lines") ? parseSubsections(byName.get("business lines")!.body) : [];

  // The `## Overview` section is the hero message; the title stays the
  // aspirational line on /admin/edges/goals.
  const overview = byName.get("overview")?.body ?? null;

  // Anything beyond the sections this page knows how to design renders as
  // prose below, so a new `##` heading added in the admin still shows up.
  const known = new Set(["overview", "ambition", "purpose", "value proposition", "themes", "business lines"]);
  const extras = sections.filter((s) => !known.has(s.heading.toLowerCase()));
  const extraHtml = await Promise.all(
    extras.map(async (s) => ({
      heading: s.heading,
      html: String(await remark().use(remarkHtml, { sanitize: true }).process(s.body)),
    })),
  );

  return (
    <>
      <PageHead
        eyebrow="Company"
        title="Strategy"
        sub={strategy ? `The plan we're running for ${strategy.year}` : undefined}
      />

      {!strategy && <div className="admin-empty">No strategy published yet.</div>}

      {strategy && (
        <>
          <div className="team-strat-hero">
            <div className="team-strat-hero-main">
              {currentTheme && (
                <span className="ts-kicker">
                  {currentTheme.year} · {currentTheme.title}
                </span>
              )}
              <p className={`team-strat-north${overview ? " team-strat-north--overview" : ""}`}>
                {overview ?? strategy.title}
              </p>
              {/* The current year's theme is the kicker above; older themes
                  trail behind it as a quiet timeline. */}
              {themes.filter((t) => t !== currentTheme).length > 0 && (
                <div className="team-strat-themes">
                  {themes
                    .filter((t) => t !== currentTheme)
                    .map((t) => (
                      <span key={t.year} className="team-strat-theme">
                        {t.year} · {t.title}
                      </span>
                    ))}
                </div>
              )}
            </div>
            {slides && (
              <div className="team-strat-hero-side">
                <a href={slides.url} target="_blank" rel="noopener noreferrer" className="admin-btn admin-btn--primary">
                  {slides.label} →
                </a>
              </div>
            )}
          </div>

          {statements.length > 0 && (
            <div className="team-strat-grid">
              {statements.map((s) => (
                <div key={s.label} className="team-strat-card">
                  <span className="team-hub-ico" aria-hidden>
                    {s.ico}
                  </span>
                  <span className="team-strat-card-label">{s.label}</span>
                  <span className="team-strat-card-body">{s.body}</span>
                </div>
              ))}
            </div>
          )}

          {lines.length > 0 && (
            <>
              <h2 className="admin-section-label">How we win: three business lines</h2>
              <div className="team-strat-grid">
                {lines.map((line, i) => (
                  <div key={line.heading} className="team-strat-card">
                    <span className="team-strat-card-head">
                      <span className="team-hub-ico" aria-hidden>
                        {LINE_ICONS[i % LINE_ICONS.length]}
                      </span>
                      <span className="team-strat-line-num">{String(i + 1).padStart(2, "0")}</span>
                    </span>
                    <span className="team-strat-card-label">{line.heading}</span>
                    <span className="team-strat-card-body">{line.body}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {extraHtml.map((s) => (
            <div key={s.heading}>
              <h2 className="admin-section-label">{s.heading}</h2>
              <div className="admin-card admin-section-card">
                <div className="idea-plan" dangerouslySetInnerHTML={{ __html: s.html }} />
              </div>
            </div>
          ))}
        </>
      )}
    </>
  );
}
