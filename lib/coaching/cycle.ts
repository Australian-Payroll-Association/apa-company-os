// Team Coaching Cycle — the daily pass (docs/plans/2026-07-25-team-coaching-cycle.md).
// Mirrors lib/onboarding-cycle.ts: one bearer-authed cron walks every active
// coaching profile and runs four steps, each idempotent so a missed day
// self-heals:
//   1) Prep: a 1-1 is coming up (<= 4 days) -> make sure the scheduled row
//      exists, generate the AI prep once (stamped via prep_generated_at), and
//      email the coach.
//   2) Overdue: the cadence has lapsed with nothing scheduled -> nudge the
//      coach (repeats weekly, deterministically, not daily).
//   3) Mid-cycle check-in: halfway through the cycle with open commitments and
//      no check-in since the last 1-1 -> AI-written nudge to the member,
//      recorded on coaching_checkins ("one per cycle" = the idempotence).
//   4) Monthly trends: first days of the month -> prior month's report per
//      profile with summarized 1-1s, once (the coaching_trends row is the stamp).
//
// Everything runs on the service-role client; the only caller is the cron
// route. Emails go through sendTransactionalEmail (fail-soft).

import { companyOs } from "@/lib/supabase";
import { sendTransactionalEmail } from "@/lib/email";
import { getSiteOrigin } from "@/lib/site-origin";
import { addDays, diffDays } from "@/lib/coaching/data";
import { generateCheckinMessage, generatePrep, generateTrendReport } from "@/lib/coaching/ai";
import { coachingMarkdownToHtml } from "@/lib/coaching/markdown";

type PersonEmbed = {
  full_name: string | null;
  preferred_name: string | null;
  email: string | null;
};

const one = <T,>(e: T | T[] | null | undefined): T | null =>
  Array.isArray(e) ? e[0] ?? null : e ?? null;

const nameOf = (p: PersonEmbed | null): string =>
  p?.preferred_name || p?.full_name || p?.email || "—";

type ProfileRow = {
  id: string;
  coach_id: string;
  cadence_days: number;
  next_one_on_one_on: string | null;
  memberName: string;
  memberEmail: string | null;
};

async function loadActiveProfiles(): Promise<ProfileRow[]> {
  const { data } = await companyOs
    .from("coaching_profiles")
    .select(
      "id, coach_id, cadence_days, next_one_on_one_on, " +
        "team_members:team_members!team_member_id(status, people:people!person_id(full_name, preferred_name, email))",
    )
    .eq("active", true);
  const LIVE = ["active", "pre_start", "on_leave", "notice"];
  return ((data ?? []) as unknown as Record<string, unknown>[])
    .filter((r) => {
      const tm = one(r.team_members as Record<string, unknown> | Record<string, unknown>[] | null);
      return LIVE.includes((tm?.status as string) ?? "");
    })
    .map((r) => {
      const tm = one(r.team_members as Record<string, unknown> | Record<string, unknown>[] | null);
      const person = one((tm?.people ?? null) as PersonEmbed | PersonEmbed[] | null);
      return {
        id: r.id as string,
        coach_id: r.coach_id as string,
        cadence_days: (r.cadence_days as number) ?? 14,
        next_one_on_one_on: (r.next_one_on_one_on as string | null) ?? null,
        memberName: nameOf(person),
        memberEmail: person?.email ?? null,
      };
    });
}

// Coach contacts by team_members id — forward lookup, never the self-FK embed.
async function loadCoachContacts(ids: string[]): Promise<Map<string, { name: string; email: string | null }>> {
  const map = new Map<string, { name: string; email: string | null }>();
  const unique = [...new Set(ids)];
  if (unique.length === 0) return map;
  const { data } = await companyOs
    .from("team_members")
    .select("id, people:people!person_id(full_name, preferred_name, email)")
    .in("id", unique);
  for (const r of (data ?? []) as Array<{ id: string; people: PersonEmbed | PersonEmbed[] | null }>) {
    const p = one(r.people);
    map.set(r.id, { name: nameOf(p), email: p?.email ?? null });
  }
  return map;
}

export type CoachingRunSummary = {
  date: string;
  profiles: number;
  prepsGenerated: number;
  overdueNudges: number;
  checkinsSent: number;
  trendsGenerated: number;
};

export async function runCoachingCycle(todayISO: string): Promise<CoachingRunSummary> {
  const profiles = await loadActiveProfiles();
  const coaches = await loadCoachContacts(profiles.map((p) => p.coach_id));
  const origin = getSiteOrigin();

  const summary: CoachingRunSummary = {
    date: todayISO,
    profiles: profiles.length,
    prepsGenerated: 0,
    overdueNudges: 0,
    checkinsSent: 0,
    trendsGenerated: 0,
  };

  for (const p of profiles) {
    const coach = coaches.get(p.coach_id);
    const profileLink = `${origin}/team/coaching/${p.id}`;

    // Last held 1-1 (the cycle clock).
    const { data: lastData } = await companyOs
      .from("coaching_one_on_ones")
      .select("held_on")
      .eq("coaching_profile_id", p.id)
      .eq("status", "held")
      .is("archived_at", null)
      .order("held_on", { ascending: false })
      .limit(1)
      .maybeSingle();
    const lastHeld = (lastData as { held_on: string } | null)?.held_on ?? null;

    // 1) Upcoming 1-1 within 4 days -> ensure the scheduled row + prep + email.
    const next = p.next_one_on_one_on;
    if (next && next >= todayISO && next <= addDays(todayISO, 4)) {
      let { data: meeting } = await companyOs
        .from("coaching_one_on_ones")
        .select("id, prep_markdown, prep_generated_at")
        .eq("coaching_profile_id", p.id)
        .eq("held_on", next)
        .is("archived_at", null)
        .maybeSingle();
      if (!meeting) {
        const { data: created } = await companyOs
          .from("coaching_one_on_ones")
          .insert({ coaching_profile_id: p.id, held_on: next, status: "scheduled" })
          .select("id, prep_markdown, prep_generated_at")
          .maybeSingle();
        meeting = created;
      }
      const m = meeting as { id: string; prep_generated_at: string | null } | null;
      if (m && !m.prep_generated_at) {
        const res = await generatePrep(m.id);
        if (res.ok) {
          summary.prepsGenerated += 1;
          if (coach?.email) {
            await sendTransactionalEmail({
              to: coach.email,
              subject: `1-1 prep ready: ${p.memberName} on ${next}`,
              html:
                `<p>Your 1-1 with <strong>${p.memberName}</strong> is on <strong>${next}</strong>. The prep is ready — two minutes to skim it:</p>` +
                `<p><a href="${profileLink}">Open ${p.memberName}'s coaching page</a></p>`,
              logMeta: { source: "coaching-cycle", kind: "prep_ready" },
            });
          }
        }
      }
    }

    // 2) Cadence lapsed with nothing on the calendar -> weekly coach nudge.
    if (lastHeld && (!next || next < todayISO)) {
      const since = diffDays(lastHeld, todayISO);
      const lapse = since - p.cadence_days - 3;
      if (lapse >= 0 && lapse % 7 === 0 && coach?.email) {
        const ok = await sendTransactionalEmail({
          to: coach.email,
          subject: `1-1 overdue: ${p.memberName} (${since} days since the last one)`,
          html:
            `<p>Your last 1-1 with <strong>${p.memberName}</strong> was <strong>${lastHeld}</strong> — ${since} days ago on a ${p.cadence_days}-day cadence, and nothing is scheduled.</p>` +
            `<p><a href="${profileLink}">Schedule the next one</a>. This reminder repeats weekly.</p>`,
          logMeta: { source: "coaching-cycle", kind: "overdue_nudge" },
        });
        if (ok) summary.overdueNudges += 1;
      }
    }

    // 3) Mid-cycle check-in: halfway through the cycle, open commitments, and
    //    no check-in since the last held 1-1.
    if (lastHeld && p.memberEmail) {
      const half = Math.floor(p.cadence_days / 2);
      const d = diffDays(lastHeld, todayISO);
      if (d >= half && d < p.cadence_days) {
        const { count: openCount } = await companyOs
          .from("coaching_commitments")
          .select("id", { count: "exact", head: true })
          .eq("coaching_profile_id", p.id)
          .in("status", ["open", "on_track", "needs_attention", "blocked"]);
        const { data: recent } = await companyOs
          .from("coaching_checkins")
          .select("id")
          .eq("coaching_profile_id", p.id)
          .gte("sent_at", `${lastHeld}T00:00:00Z`)
          .limit(1);
        if ((openCount ?? 0) > 0 && (recent ?? []).length === 0) {
          const { markdown } = await generateCheckinMessage(p.id);
          const { error } = await companyOs
            .from("coaching_checkins")
            .insert({ coaching_profile_id: p.id, message_markdown: markdown });
          if (!error) {
            const html = await coachingMarkdownToHtml(markdown);
            const ok = await sendTransactionalEmail({
              to: p.memberEmail,
              subject: `Mid-cycle check-in${coach ? ` from ${coach.name}` : ""}`,
              html:
                html +
                `<p><a href="${origin}/team/my-coaching">Update your commitments</a></p>`,
              logMeta: { source: "coaching-cycle", kind: "checkin" },
            });
            if (ok) summary.checkinsSent += 1;
          }
        }
      }
    }

    // 4) Monthly trend report for the prior month, in the first 3 days of the
    //    month (self-heals a missed 1st). The trends row is the once-only stamp.
    const dayOfMonth = Number(todayISO.slice(8, 10));
    if (dayOfMonth <= 3) {
      const priorMonthLastDay = addDays(`${todayISO.slice(0, 7)}-01`, -1);
      const period = priorMonthLastDay.slice(0, 7);
      const { data: existing } = await companyOs
        .from("coaching_trends")
        .select("id, report_markdown")
        .eq("coaching_profile_id", p.id)
        .eq("period", period)
        .maybeSingle();
      const hasReport = Boolean((existing as { report_markdown: string | null } | null)?.report_markdown);
      if (!hasReport) {
        const { data: monthMeetings } = await companyOs
          .from("coaching_one_on_ones")
          .select("id")
          .eq("coaching_profile_id", p.id)
          .eq("status", "held")
          .is("archived_at", null)
          .not("summary_markdown", "is", null)
          .gte("held_on", `${period}-01`)
          .lt("held_on", `${period}-32`)
          .limit(1);
        if ((monthMeetings ?? []).length > 0) {
          const res = await generateTrendReport(p.id, period);
          if (res.ok) {
            summary.trendsGenerated += 1;
            if (coach?.email) {
              await sendTransactionalEmail({
                to: coach.email,
                subject: `Monthly coaching trends: ${p.memberName} (${period})`,
                html:
                  `<p>The ${period} trend report for <strong>${p.memberName}</strong> is ready — growth trajectory, recurring themes, follow-through, and flags.</p>` +
                  `<p><a href="${profileLink}">Read it on their coaching page</a></p>`,
                logMeta: { source: "coaching-cycle", kind: "trend_ready" },
              });
            }
          }
        }
      }
    }
  }

  return summary;
}
