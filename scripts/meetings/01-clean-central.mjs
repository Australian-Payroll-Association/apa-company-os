// PR1: clean company_os.meetings and lock in the 7-type taxonomy.
//
//   1. Install normalize_meeting_type() + the coercing trigger (taxonomy.mjs).
//   2. Delete obvious ThoughtFlow test rows and empty import shells (0 refs).
//   3. Merge exact-duplicate rows (same title + same started_at), keeping the
//      richest and only if the losers carry no references.
//   4. Canonicalize every existing meeting_type through the trigger, preserving
//      the raw label in metadata.source_meeting_type.
//
// Idempotent: safe to re-run. Pass --apply to write; default is a dry run.
import { sql } from "../crm/db.mjs";
import { NORMALIZE_FN_SQL, TRIGGER_SQL } from "./taxonomy.mjs";

const APPLY = process.argv.includes("--apply");
const log = (...a) => console.log(...a);

// Every table that points at company_os.meetings (from the FK audit).
async function refCount(id) {
  const [r] = await sql`
    select
      (select count(*) from company_os.meeting_participants where meeting_id = ${id})
      + (select count(*) from company_os.meeting_associations where meeting_id = ${id})
      + (select count(*) from company_os.meeting_action_items where meeting_id = ${id})
      + (select count(*) from company_os.interviews where meeting_id = ${id})
      + (select count(*) from company_os.call_transcripts where meeting_id = ${id})
      + (select count(*) from company_os.content_ideas where source_meeting_id = ${id})
      + (select count(*) from company_os.one_on_one_sessions where meeting_id = ${id}) n`;
  return Number(r.n);
}

const JUNK_WHERE = sql`(title ilike '%test%' or title like '1758709276515%' or title is null)`;

async function main() {
  log(`\n=== PR1 clean central meetings  (${APPLY ? "APPLY" : "DRY RUN"}) ===\n`);

  // --- Junk rows ---
  const junk = await sql`select id, title from company_os.meetings where ${JUNK_WHERE} order by title`;
  let junkRefd = 0;
  for (const r of junk) if ((await refCount(r.id)) > 0) junkRefd++;
  log(`Junk test/empty rows: ${junk.length} (${junkRefd} have references and will be skipped)`);

  // --- Exact duplicates: same title + exact started_at ---
  const dupRows = await sql`
    with grp as (
      select coalesce(title,'') t, started_at
      from company_os.meetings
      where not ${JUNK_WHERE}
      group by 1, 2 having count(*) > 1
    )
    select m.id, m.title, m.started_at,
      length(coalesce(m.summary,'')) + length(coalesce(m.summary_ciphertext,'')) content,
      coalesce(m.duration_seconds, 0) dur, m.created_at
    from company_os.meetings m
    join grp on coalesce(m.title,'') = grp.t and m.started_at = grp.started_at
    where not ${JUNK_WHERE}`;
  const groups = {};
  for (const r of dupRows) (groups[`${r.title}|${r.started_at}`] ||= []).push(r);
  const losers = [];
  for (const [k, rows] of Object.entries(groups)) {
    rows.sort((a, b) =>
      b.content - a.content || b.dur - a.dur || new Date(a.created_at) - new Date(b.created_at));
    const [keep, ...drop] = rows;
    log(`Dup "${keep.title}" @ ${String(keep.started_at).slice(0, 16)}: keep ${keep.id.slice(0, 8)} (content ${keep.content}), drop ${drop.map((d) => d.id.slice(0, 8)).join(", ")}`);
    for (const d of drop) losers.push({ ...d, keeper: keep.id });
  }
  let loserRefd = 0;
  for (const d of losers) if ((await refCount(d.id)) > 0) { loserRefd++; d.blocked = true; }
  log(`Exact-duplicate losers: ${losers.length} (${loserRefd} carry references -> skipped, reported for manual review)`);

  if (!APPLY) {
    log(`\nDry run only. Re-run with --apply to write.\n`);
    await sql.end();
    return;
  }

  // --- Write ---
  log(`\nInstalling normalize_meeting_type() + trigger...`);
  await sql.unsafe(NORMALIZE_FN_SQL);
  await sql.unsafe(TRIGGER_SQL);

  const junkIds = [];
  for (const r of junk) if ((await refCount(r.id)) === 0) junkIds.push(r.id);
  if (junkIds.length) {
    await sql`delete from company_os.meetings where id in ${sql(junkIds)}`;
    log(`Deleted ${junkIds.length} junk rows.`);
  }

  const loserIds = losers.filter((d) => !d.blocked).map((d) => d.id);
  if (loserIds.length) {
    await sql`delete from company_os.meetings where id in ${sql(loserIds)}`;
    log(`Deleted ${loserIds.length} exact-duplicate rows.`);
  }
  const blocked = losers.filter((d) => d.blocked);
  if (blocked.length) log(`SKIPPED (had refs): ${blocked.map((d) => d.id).join(", ")}`);

  // Canonicalize types: touch each typed row so the trigger normalizes it and
  // records the original label in metadata.source_meeting_type.
  await sql`update company_os.meetings set meeting_type = meeting_type where meeting_type is not null`;
  log(`Canonicalized meeting_type on all typed rows.`);

  // --- Verify ---
  const [{ total }] = await sql`select count(*) total from company_os.meetings`;
  const bad = await sql`
    select distinct meeting_type from company_os.meetings
    where meeting_type is not null
      and meeting_type not in ('Sales','1-1','Leadership Sync','Vendor Call','General','Performance','Team Ceremony')`;
  const dist = await sql`select meeting_type, count(*) n from company_os.meetings group by 1 order by n desc`;
  log(`\nRows now: ${total}. Non-canonical types remaining: ${bad.length}`);
  log(`Type distribution:`);
  for (const r of dist) log(`  ${r.meeting_type ?? "(null / untyped)"}: ${r.n}`);
  if (bad.length) throw new Error(`Non-canonical types remain: ${bad.map((b) => b.meeting_type).join(", ")}`);
  log(`\nPR1 done.\n`);
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
