// PR3 (data + schema): make company_os.meetings the one meetings table by
// absorbing the client-notes feature that lived in meeting_notes.
//
// meeting_notes backed a distinct workflow (upload a client transcript ->
// AI-summarize -> publish to the client portal), modeled with denormalized
// columns. We keep that workflow but move its rows onto meetings, marked
// source='notes', so the admin notes list and the portal stay a client-notes
// LENS over the central table rather than the raw ThoughtFlow call log.
//
//   - Adds the notes-feature columns to meetings (additive, safe for old code).
//   - Copies each meeting_notes row into meetings, PRESERVING its id (so
//     /portal/meetings/<id> and /admin/revenue/meetings/<id> keep resolving),
//     with the transcript going into call_transcripts.
//   - Does NOT drop meeting_notes. The drop is a separate, confirmed step once
//     the repointed UI is verified in preview.
//
// Idempotent: re-running re-syncs the rows, never duplicates. Pass --apply.
import { sql } from "../crm/db.mjs";

const APPLY = process.argv.includes("--apply");
const log = (...a) => console.log(...a);

const ADD_COLUMNS = `
-- Allow source='notes' (the folded client-notes rows) alongside the import sources.
alter table company_os.meetings drop constraint if exists meetings_source_check;
alter table company_os.meetings add constraint meetings_source_check
  check (source = any (array['lark','thoughtflow','manual','zoom','google','other','notes']));

alter table company_os.meetings
  add column if not exists company_id       uuid references company_os.companies(id),
  add column if not exists attendees         text[],
  add column if not exists published_at      timestamptz,
  add column if not exists ai_status         text,
  add column if not exists ai_error          text,
  add column if not exists ai_model          text,
  add column if not exists source_file_path  text,
  add column if not exists source_file_name  text,
  add column if not exists created_by        text,
  add column if not exists archived_at       timestamptz;

create index if not exists meetings_notes_company_idx
  on company_os.meetings (company_id) where source = 'notes';
create index if not exists meetings_notes_published_idx
  on company_os.meetings (published_at) where source = 'notes';
`;

async function main() {
  log(`\n=== PR3 fold meeting_notes -> meetings  (${APPLY ? "APPLY" : "DRY RUN"}) ===\n`);

  const notes = await sql`select * from company_os.meeting_notes`;
  log(`meeting_notes rows to fold: ${notes.length}`);
  for (const n of notes) {
    log(`  ${n.id.slice(0, 8)} "${n.title}" company=${n.company_id?.slice(0, 8)} published=${!!n.published_at} transcript=${(n.transcript ?? "").length}b`);
  }

  if (!APPLY) {
    log(`\nDry run only. Re-run with --apply.\n`);
    await sql.end();
    return;
  }

  log(`\nAdding notes-feature columns to meetings...`);
  await sql.unsafe(ADD_COLUMNS);

  for (const n of notes) {
    // Upsert the meeting row by the ORIGINAL id so URLs survive and re-runs
    // are idempotent. meeting_type defaults to General (the notes UI does not
    // surface a type); the trigger keeps it canonical.
    await sql`
      insert into company_os.meetings (
        id, source, title, meeting_type, summary, summary_encrypted,
        company_id, attendees, started_at, published_at,
        ai_status, ai_error, ai_model, source_file_path, source_file_name,
        created_by, archived_at, created_at, updated_at
      ) values (
        ${n.id}, 'notes', ${n.title}, 'General', ${n.ai_summary}, false,
        ${n.company_id}, ${n.attendees}, ${n.meeting_date}, ${n.published_at},
        ${n.ai_status}, ${n.ai_error}, ${n.ai_model}, ${n.source_file_path}, ${n.source_file_name},
        ${n.created_by}, ${n.archived_at}, ${n.created_at}, ${n.updated_at}
      )
      on conflict (id) do update set
        source = 'notes', title = excluded.title, summary = excluded.summary,
        summary_encrypted = false, company_id = excluded.company_id,
        attendees = excluded.attendees, started_at = excluded.started_at,
        published_at = excluded.published_at, ai_status = excluded.ai_status,
        ai_error = excluded.ai_error, ai_model = excluded.ai_model,
        source_file_path = excluded.source_file_path,
        source_file_name = excluded.source_file_name,
        created_by = excluded.created_by, archived_at = excluded.archived_at,
        updated_at = excluded.updated_at`;

    // Transcript -> call_transcripts (unique on meeting_id). No minute_token
    // for a manual upload. Re-run refreshes the text.
    if ((n.transcript ?? "").trim()) {
      await sql`
        insert into company_os.call_transcripts (
          meeting_id, title, started_at, source, call_type, transcript
        ) values (
          ${n.id}, ${n.title ?? "Untitled meeting"}, ${n.meeting_date}, 'notes', 'client', ${n.transcript}
        )
        on conflict (meeting_id) do update set
          transcript = excluded.transcript, title = excluded.title,
          updated_at = now()`;
    }
    log(`  folded ${n.id.slice(0, 8)}`);
  }

  // Verify: every folded row is now a source='notes' meeting, published ones
  // resolve, and the transcript landed in call_transcripts.
  const [{ n: foldedCount }] = await sql`select count(*) n from company_os.meetings where source = 'notes'`;
  const [{ n: ctCount }] = await sql`select count(*) n from company_os.call_transcripts where source = 'notes'`;
  const check = await sql`
    select m.id, m.title, m.published_at is not null published, c.id is not null has_transcript
    from company_os.meetings m
    left join company_os.call_transcripts c on c.meeting_id = m.id
    where m.source = 'notes'`;
  log(`\nsource='notes' meetings: ${foldedCount}, notes transcripts: ${ctCount}`);
  for (const r of check) log(`  ${r.id.slice(0, 8)} "${r.title}" published=${r.published} transcript=${r.has_transcript}`);
  log(`\nPR3 data/schema done. meeting_notes table retained (drop after preview).\n`);
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
