// One-off importer for the Team Coaching Cycle (docs/plans/2026-07-25-team-coaching-cycle.md):
// seeds coaching_profiles for Dave's roster and migrates the pre-app history
// out of the Lark wiki dashboard + the local leadership-coach folders.
//
//   npx tsx scripts/coaching-import-run.ts
//
// Sources:
//   - Roster, FAST goals and last-1-1 dates: the Lark "Team Coaching" dashboard
//     (read 2026-07-25, transcribed into ROSTER below).
//   - Meeting notes/transcripts/check-ins, person profiles and OKRs:
//     ~/code-projects/leadership-coach/1-1-coach/people/<name>/
//   - Foundation docs (the AI's coaching voice):
//     ~/code-projects/leadership-coach/foundation/ + 1-1-coach/context/
//
// Idempotent: profiles are keyed by team_member (unique), meetings by
// (profile, held_on), check-ins by (profile, sent date), context docs by
// (coach, title). Re-running fills gaps, never duplicates. Historical
// check-ins import as already-responded so they never trip the
// "unanswered" attention flag. Trác is on notice and off the Lark roster,
// so his profile imports with active=false: history retained, no cron.
//
// Second pass pending: recaps that exist only on the Lark per-person child
// pages (e.g. most of Mai's 8 logged 1-1s) — import the same way once Dave
// shares those page links.

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  const file = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of file.split("\n")) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    const [, k, raw] = m;
    if (process.env[k] !== undefined) continue;
    process.env[k] = raw.replace(/^"(.*)"$/, "$1").trim();
  }
}

const COACH_ROOT = resolve(process.env.HOME ?? "~", "code-projects/leadership-coach");
const PEOPLE_DIR = resolve(COACH_ROOT, "1-1-coach/people");

const read = (p: string): string | null => (existsSync(p) ? readFileSync(p, "utf8") : null);

// Rough HTML -> readable text for the one GROW prep that exists as HTML.
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<(h[1-6])[^>]*>/gi, "\n\n## ")
    .replace(/<(li)[^>]*>/gi, "\n- ")
    .replace(/<(p|div|br|tr)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type MeetingSeed = {
  heldOn: string;
  transcriptFile?: string;
  summaryFile?: string;
  sharedFile?: string;
  prepHtmlFile?: string;
};

type PersonSeed = {
  email: string;
  label: string;
  active: boolean;
  fastGoal?: string;
  fastGoalStatus?: "draft" | "set";
  dir?: string; // folder under people/
  profileFile?: string;
  okrsFile?: string;
  meetings: MeetingSeed[];
  checkins: { sentOn: string; file: string }[];
};

// The Lark dashboard roster (Dave coaches all five) + Trác's history.
const ROSTER: PersonSeed[] = [
  {
    email: "mai@edge8.ai",
    label: "Mai Dang",
    active: true,
    fastGoal: "Automate every repetitive task",
    fastGoalStatus: "draft",
    dir: "mai",
    profileFile: "mai-profile.md",
    okrsFile: "mai-okrs.md",
    meetings: [
      {
        heldOn: "2025-08-27",
        transcriptFile: "notes/1-1 Dave __ Mai.txt",
        summaryFile: "notes/2025-08-27 Summary - Mai.md",
        sharedFile: "notes/2025-08-27 Summary (Team Member) - Mai.md",
      },
      { heldOn: "2026-03-05", transcriptFile: "notes/03-05 _ 1-1 Mai __ Dave.txt" },
      { heldOn: "2026-06-23" }, // last 1-1 per the Lark dashboard; recap on the Lark child page
    ],
    checkins: [{ sentOn: "2026-04-15", file: "notes/2026-04-15 Check-in - Mai.md" }],
  },
  {
    email: "khoa.doan@edge8.ai",
    label: "Khoa Doan",
    active: true,
    dir: "khoa",
    profileFile: "khoa-profile.md",
    meetings: [{ heldOn: "2026-06-26", prepHtmlFile: "notes/khoa-grow-2026-06-26.html" }],
    checkins: [],
  },
  {
    email: "ginny.vo@edge8.ai",
    label: "Ginny",
    active: true,
    meetings: [{ heldOn: "2026-04-20" }], // last 1-1 per the Lark dashboard
    checkins: [],
  },
  { email: "quan@edge8.ai", label: "Quan Chau", active: true, meetings: [], checkins: [] },
  { email: "my.pham@edge8.ai", label: "My Pham", active: true, meetings: [], checkins: [] },
  {
    email: "trac.nguyen@edge8.ai",
    label: "Trác",
    active: false, // on notice, off the roster — history only
    dir: "trac",
    profileFile: "trac-profile.md",
    okrsFile: "trac-okrs.md",
    meetings: [
      {
        heldOn: "2026-03-04",
        transcriptFile: "notes/1-1 Trac __ Dave.txt",
        summaryFile: "notes/2026-03-04 Summary - Trac.md",
        sharedFile: "notes/2026-03-04 Summary (Team Member) - Trac.md",
      },
      // Despite the filename, "copy" is a different meeting (header says 2026-04-13).
      { heldOn: "2026-04-13", transcriptFile: "notes/1-1 Trac __ Dave copy.txt" },
    ],
    checkins: [{ sentOn: "2026-04-15", file: "notes/2026-04-15 Check-in - Trac.md" }],
  },
];

const CONTEXT_DOCS: { kind: "foundation" | "company" | "okrs"; title: string; path: string }[] = [
  { kind: "foundation", title: "Leadership brand identity", path: "foundation/leadership-brand-identity.md" },
  { kind: "foundation", title: "Coaching profile", path: "foundation/coaching-profile.md" },
  { kind: "foundation", title: "Emotional intelligence guide", path: "foundation/emotional-intelligence-guide.md" },
  { kind: "foundation", title: "Communication style guide", path: "foundation/communication-style-guide.md" },
  { kind: "foundation", title: "Operating system", path: "foundation/operating-system.md" },
  { kind: "okrs", title: "Edge8 2026 OKRs", path: "foundation/edge8-2026-okrs.md" },
  { kind: "company", title: "Company context", path: "1-1-coach/context/company-context.md" },
];

const COACH_EMAIL = "dave@edge8.ai";

async function main() {
  loadEnvLocal();
  const { companyOs } = await import("../lib/supabase");

  // team_members by person email (live rows only; Trác is 'notice' which counts).
  async function memberIdByEmail(email: string): Promise<string | null> {
    const { data: person } = await companyOs
      .from("people")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    if (!person) return null;
    const { data: tms } = await companyOs
      .from("team_members")
      .select("id, status")
      .eq("person_id", (person as { id: string }).id)
      .in("status", ["active", "pre_start", "on_leave", "notice"]);
    const rows = (tms ?? []) as { id: string; status: string }[];
    return (rows.find((r) => r.status === "active") ?? rows[0])?.id ?? null;
  }

  const coachId = await memberIdByEmail(COACH_EMAIL);
  if (!coachId) throw new Error(`Coach ${COACH_EMAIL} not found in company_os`);

  const log: string[] = [];
  const skip: string[] = [];

  // ---- context docs ---------------------------------------------------------
  for (const doc of CONTEXT_DOCS) {
    const markdown = read(resolve(COACH_ROOT, doc.path));
    if (!markdown?.trim()) {
      skip.push(`context "${doc.title}": file missing (${doc.path})`);
      continue;
    }
    const { data: existing } = await companyOs
      .from("coaching_context")
      .select("id")
      .eq("coach_id", coachId)
      .eq("title", doc.title)
      .maybeSingle();
    if (existing) {
      const { error } = await companyOs
        .from("coaching_context")
        .update({ markdown, kind: doc.kind, updated_at: new Date().toISOString() })
        .eq("id", (existing as { id: string }).id);
      if (error) throw new Error(`context update "${doc.title}": ${error.message}`);
      log.push(`context updated: ${doc.title}`);
    } else {
      const { error } = await companyOs
        .from("coaching_context")
        .insert({ coach_id: coachId, kind: doc.kind, title: doc.title, markdown });
      if (error) throw new Error(`context insert "${doc.title}": ${error.message}`);
      log.push(`context added: ${doc.title}`);
    }
  }

  // ---- people ---------------------------------------------------------------
  for (const seed of ROSTER) {
    const teamMemberId = await memberIdByEmail(seed.email);
    if (!teamMemberId) {
      skip.push(`${seed.label}: no live team_members row for ${seed.email} — NOT imported`);
      continue;
    }
    const base = seed.dir ? resolve(PEOPLE_DIR, seed.dir) : null;
    const fileOf = (rel?: string): string | null => (rel && base ? read(resolve(base, rel)) : null);

    // Profile (unique on team_member_id).
    let { data: profile } = await companyOs
      .from("coaching_profiles")
      .select("id")
      .eq("team_member_id", teamMemberId)
      .maybeSingle();
    if (!profile) {
      const { data: created, error } = await companyOs
        .from("coaching_profiles")
        .insert({
          team_member_id: teamMemberId,
          coach_id: coachId,
          fast_goal: seed.fastGoal ?? null,
          fast_goal_status: seed.fastGoal ? seed.fastGoalStatus ?? "draft" : "not_set",
          okrs_markdown: fileOf(seed.okrsFile),
          private_profile_markdown: fileOf(seed.profileFile),
          active: seed.active,
        })
        .select("id")
        .maybeSingle();
      if (error || !created) throw new Error(`${seed.label}: profile insert failed: ${error?.message}`);
      profile = created;
      log.push(`profile created: ${seed.label}${seed.active ? "" : " (inactive)"}`);
    } else {
      log.push(`profile exists: ${seed.label}`);
    }
    const profileId = (profile as { id: string }).id;

    // Meetings, keyed by held_on.
    for (const m of seed.meetings) {
      const { data: existing } = await companyOs
        .from("coaching_one_on_ones")
        .select("id")
        .eq("coaching_profile_id", profileId)
        .eq("held_on", m.heldOn)
        .maybeSingle();
      if (existing) {
        log.push(`  1-1 ${m.heldOn} exists`);
        continue;
      }
      const transcript = fileOf(m.transcriptFile);
      const summary = fileOf(m.summaryFile);
      const shared = fileOf(m.sharedFile);
      const prepHtml = fileOf(m.prepHtmlFile);
      const { error } = await companyOs.from("coaching_one_on_ones").insert({
        coaching_profile_id: profileId,
        held_on: m.heldOn,
        status: "held",
        transcript,
        summary_markdown: summary,
        shared_summary_markdown: shared,
        // The "(Team Member)" variant was already shared in the old system.
        shared_published_at: shared ? `${m.heldOn}T12:00:00Z` : null,
        prep_markdown: prepHtml ? htmlToText(prepHtml) : null,
      });
      if (error) throw new Error(`${seed.label} 1-1 ${m.heldOn}: ${error.message}`);
      log.push(
        `  1-1 ${m.heldOn} imported (${[
          transcript && "transcript",
          summary && "summary",
          shared && "shared recap",
          prepHtml && "prep",
        ]
          .filter(Boolean)
          .join(", ") || "date only"})`,
      );
    }

    // Check-ins, keyed by sent date; historical -> responded.
    for (const c of seed.checkins) {
      const message = fileOf(c.file);
      if (!message?.trim()) {
        skip.push(`${seed.label} check-in ${c.sentOn}: file missing`);
        continue;
      }
      const sentAt = `${c.sentOn}T09:00:00Z`;
      const { data: existing } = await companyOs
        .from("coaching_checkins")
        .select("id")
        .eq("coaching_profile_id", profileId)
        .gte("sent_at", `${c.sentOn}T00:00:00Z`)
        .lte("sent_at", `${c.sentOn}T23:59:59Z`)
        .limit(1);
      if ((existing ?? []).length > 0) {
        log.push(`  check-in ${c.sentOn} exists`);
        continue;
      }
      const { error } = await companyOs.from("coaching_checkins").insert({
        coaching_profile_id: profileId,
        sent_at: sentAt,
        message_markdown: message,
        responded_at: sentAt,
      });
      if (error) throw new Error(`${seed.label} check-in ${c.sentOn}: ${error.message}`);
      log.push(`  check-in ${c.sentOn} imported`);
    }
  }

  console.log(log.map((l) => `✓ ${l}`).join("\n"));
  if (skip.length > 0) console.log("\n" + skip.map((s) => `⚠ ${s}`).join("\n"));
}

main().catch((err) => {
  console.error("IMPORT FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
