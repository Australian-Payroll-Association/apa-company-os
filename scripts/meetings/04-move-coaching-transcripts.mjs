// PR4: make company_os.meetings (+ call_transcripts) the one home for coaching
// 1-1 transcripts, and link each coaching session to its meeting.
//
//   - Adds coaching_one_on_ones.meeting_id (FK -> meetings) and allows
//     source='coaching' on meetings.
//   - Links the coaching sessions that clearly ARE an existing meeting (member
//     given-name + exact held_on date, single hit) to that row.
//   - For a transcribed session with no existing meeting, creates a coaching-
//     origin meeting (source='coaching', type '1-1').
//   - Moves every coaching transcript into call_transcripts (one per meeting).
//
// The thorough reconciliation of the remaining sessions (esp. the ones with no
// team member recorded) is a separate follow-up task. Transcript-less sessions
// with no clean match are left unlinked for that task.
//
// Idempotent. Pass --apply.
import { sql } from "../crm/db.mjs";

const APPLY = process.argv.includes("--apply");
const log = (...a) => console.log(...a);
const strip = (s) =>
  (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

const SCHEMA = `
alter table company_os.meetings drop constraint if exists meetings_source_check;
alter table company_os.meetings add constraint meetings_source_check
  check (source = any (array['lark','thoughtflow','manual','zoom','google','other','notes','coaching']));
alter table company_os.coaching_one_on_ones
  add column if not exists meeting_id uuid references company_os.meetings(id);
create index if not exists coaching_one_on_ones_meeting_idx
  on company_os.coaching_one_on_ones (meeting_id);
`;

async function main() {
  log(`\n=== PR4 move coaching transcripts -> meetings/call_transcripts  (${APPLY ? "APPLY" : "DRY RUN"}) ===\n`);

  const coaching = await sql`
    select co.id, co.held_on, co.transcript, co.minutes_token,
           co.coaching_profile_id, cp.coach_id, p.full_name
    from company_os.coaching_one_on_ones co
    join company_os.coaching_profiles cp on cp.id = co.coaching_profile_id
    left join company_os.people p on p.id = cp.team_member_id
    where co.archived_at is null
    order by co.held_on`;
  const meetings11 = await sql`select id, title, started_at::date d from company_os.meetings where meeting_type = '1-1'`;

  const plan = coaching.map((c) => {
    const given = c.full_name ? strip(c.full_name).split(/\s+/).pop() : null;
    const day = String(c.held_on).slice(0, 10);
    const hits = given
      ? meetings11.filter((m) => String(m.d).slice(0, 10) === day && strip(m.title).includes(given))
      : [];
    const hasTranscript = !!(c.transcript && c.transcript.trim());
    return {
      c, given, day, hasTranscript,
      match: hits.length === 1 ? hits[0] : null,
      ambiguous: hits.length > 1,
    };
  });

  const willLink = plan.filter((p) => p.match);
  const willCreate = plan.filter((p) => !p.match && p.hasTranscript);
  const skip = plan.filter((p) => !p.match && !p.hasTranscript);
  log(`Coaching sessions: ${plan.length}`);
  log(`  link to existing meeting: ${willLink.length} (${willLink.filter((p) => p.hasTranscript).length} carry a transcript)`);
  log(`  create coaching-origin meeting: ${willCreate.length} (all transcribed)`);
  log(`  leave for the matching follow-up (no transcript, no clean match): ${skip.length}`);
  const totalTranscripts = plan.filter((p) => p.hasTranscript).length;
  log(`  transcripts moved into call_transcripts: ${willLink.filter((p) => p.hasTranscript).length + willCreate.length} of ${totalTranscripts}`);

  if (!APPLY) {
    log(`\nDry run only. Re-run with --apply.\n`);
    await sql.end();
    return;
  }

  await sql.unsafe(SCHEMA);

  // Which minute_tokens are already taken in call_transcripts (unique column).
  const taken = new Set(
    (await sql`select minute_token from company_os.call_transcripts where minute_token is not null`).map((r) => r.minute_token),
  );
  // Idempotency maps (read after the schema/meeting_id column exists).
  const linkMap = new Map(
    (await sql`select id, meeting_id from company_os.coaching_one_on_ones where meeting_id is not null`).map((r) => [r.id, r.meeting_id]),
  );
  const originMap = new Map(
    (await sql`select id, metadata->>'coaching_one_on_one_id' cid from company_os.meetings where source = 'coaching' and metadata ? 'coaching_one_on_one_id'`).map((r) => [r.cid, r.id]),
  );

  for (const p of plan) {
    if (!p.match && !p.hasTranscript) continue; // deferred to the matching task

    const title = p.c.full_name ? `1-1 ${p.c.full_name}` : `1-1 on ${p.day}`;
    let meetingId = linkMap.get(p.c.id) ?? p.match?.id ?? originMap.get(p.c.id) ?? null;

    if (!meetingId) {
      const [row] = await sql`
        insert into company_os.meetings (source, meeting_type, title, started_at, owner_id, metadata)
        values ('coaching', '1-1', ${title}, ${p.c.held_on}, ${p.c.coach_id},
                ${sql.json({ origin: "coaching", coaching_one_on_one_id: p.c.id })})
        returning id`;
      meetingId = row.id;
    }

    if (linkMap.get(p.c.id) !== meetingId) {
      await sql`update company_os.coaching_one_on_ones set meeting_id = ${meetingId}, updated_at = now() where id = ${p.c.id}`;
    }

    if (p.hasTranscript) {
      const token = p.c.minutes_token && !taken.has(p.c.minutes_token) ? p.c.minutes_token : null;
      if (token) taken.add(token);
      await sql`
        insert into company_os.call_transcripts (meeting_id, minute_token, title, started_at, source, call_type, transcript)
        values (${meetingId}, ${token}, ${title}, ${p.c.held_on}, 'coaching', 'internal', ${p.c.transcript})
        on conflict (meeting_id) do update set transcript = excluded.transcript, title = excluded.title, updated_at = now()`;
    }
    log(`  ${p.match ? "linked " : "created"} ${meetingId.slice(0, 8)}  ${title}${p.hasTranscript ? "  [+transcript]" : ""}`);
  }

  // Verify
  const [{ linked }] = await sql`select count(*) linked from company_os.coaching_one_on_ones where meeting_id is not null and archived_at is null`;
  const [{ ct }] = await sql`select count(*) ct from company_os.call_transcripts where source = 'coaching'`;
  const [{ orphan }] = await sql`
    select count(*) orphan from company_os.coaching_one_on_ones co
    where co.archived_at is null and co.transcript is not null and trim(co.transcript) <> ''
      and not exists (select 1 from company_os.call_transcripts c where c.meeting_id = co.meeting_id)`;
  log(`\nlinked coaching sessions: ${linked}, coaching transcripts in call_transcripts: ${ct}, transcribed-but-unmoved: ${orphan}`);
  log(`\nPR4 done. coaching_one_on_ones.transcript retained as a mirror (cleared in a later step).\n`);
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
