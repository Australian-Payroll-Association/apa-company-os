// Pull Zoom coaching-session transcripts into company_os.meetings, then write
// an actionable internal summary and its action items. This is the MVP of the
// Zoom -> Company OS pipeline described in
// docs/plans/2026-08-27-zoom-coaching-ingestion.md.
//
// It runs from an operator's machine. Zoom S2S creds come from ~/.claude/.env;
// the Company OS write path uses the Supabase service key via
// scripts/crm/companyos.mjs (the same way the app writes, no DB password
// needed); ANTHROPIC_API_KEY is read from the environment or .env.local. Nothing
// here needs to live in Vercel for the MVP; productionising as a cron is a
// follow-up in the plan doc.
//
// Usage:
//   node scripts/crm/zoom-ingest.mjs                     # dry run, last 30 days, topics matching /coaching/i
//   node scripts/crm/zoom-ingest.mjs --write             # insert into company_os.meetings
//   node scripts/crm/zoom-ingest.mjs --from=2026-08-01 --topic=aiolabz
//   node scripts/crm/zoom-ingest.mjs --host=dave@edge8.co
//   node scripts/crm/zoom-ingest.mjs --no-summary        # ingest transcript only, summarise later
//   node scripts/crm/zoom-ingest.mjs --resummarize=<meeting-uuid>  # regenerate summary for one row
//   node scripts/crm/zoom-ingest.mjs --skip-db           # Zoom + summarise only, touch no database
//
// Idempotent: a Zoom recording already present (source='zoom', external_id=uuid)
// is skipped. Re-running is safe. The transcript is stored inline in
// metadata.transcript so the summary can be regenerated any time the prompt
// improves, which Zoom's own summary can never do.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadZoomCreds,
  getZoomToken,
  listAccountUsers,
  listRecordings,
  downloadTranscript,
  vttToText,
  speakersFromText,
} from './zoom.mjs';
import { summarizeTranscript } from './meeting-summarize.mjs';

// A plain `node` run does not load .env.local. companyos.mjs reads the Supabase
// keys from it; here we source ANTHROPIC_API_KEY (and an optional model
// override) from the same file when the shell has not exported them, so the
// summariser works with no extra setup.
function loadEnvLocal() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const file = path.join(root, '.env.local');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*(OPENROUTER_API_KEY|OPENROUTER_MODEL)\s*=\s*(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}
loadEnvLocal();

// Fixed IDs, schema company_os (verified in .claude/skills/crm-call-to-proposal).
const OWNER_ID = 'a8bf026f-8c20-49c5-8a55-6fc5c580af64'; // Dave Hajdu (people.id)
const HOST_NAME_RE = /dave|hajdu/i; // maps a speaker to the 'host' role

// ---- args -------------------------------------------------------------------
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, dflt) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : dflt;
};
const WRITE = flag('write');
const SKIP_DB = flag('skip-db');
const NO_SUMMARY = flag('no-summary');
const RESUMMARIZE = opt('resummarize', null);
const TOPIC_RE = new RegExp(opt('topic', 'coaching'), 'i');
const SINGLE_HOST = opt('host', null);
const FROM = opt('from', new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10));

// companyos.mjs throws at import if the Supabase keys are missing, so import it
// lazily: --skip-db and the Zoom-only path must work without DB creds.
let companyOs = null;
async function getDb() {
  if (!companyOs) ({ companyOs } = await import('./companyos.mjs'));
  return companyOs;
}

const log = (...a) => console.log(...a);

// ---- write one meeting ------------------------------------------------------
async function insertMeeting(db, rec, transcript, summary, downloadUrl) {
  const durationSec = rec.duration ? rec.duration * 60 : null;
  const startedAt = rec.start_time || null;
  const endedAt =
    startedAt && durationSec ? new Date(new Date(startedAt).getTime() + durationSec * 1000).toISOString() : null;

  const title = summary?.title || rec.topic || 'Coaching session';
  const summaryMd = summary?.summary_markdown || null;
  const meetingDate = summary?.meeting_date || (startedAt ? startedAt.slice(0, 10) : null);
  const speakers = speakersFromText(transcript);

  const metadata = {
    source: 'zoom',
    source_file: downloadUrl,
    zoom_meeting_id: String(rec.id),
    zoom_uuid: rec.uuid,
    meeting_date: meetingDate,
    speakers,
    transcript,
    ...(summary ? { ai_model: summary.model } : { ai_status: 'pending' }),
  };

  const { data: row, error } = await db
    .from('meetings')
    .insert({
      source: 'zoom',
      external_id: rec.uuid,
      title,
      meeting_type: 'coaching',
      summary: summaryMd,
      summary_encrypted: false,
      recording_url: rec.share_url || null,
      owner_id: OWNER_ID,
      started_at: startedAt,
      ended_at: endedAt,
      duration_seconds: durationSec,
      metadata, // supabase-js serialises the object into jsonb natively
    })
    .select('id')
    .single();
  if (error) throw new Error(`meetings insert failed: ${error.message}`);
  const meetingId = row.id;

  // supabase-js has no multi-statement transaction, so if a child insert fails,
  // delete the meeting (and any children) so we never leave a half-written row
  // that the dedup would skip on the next run.
  try {
    if (speakers.length) {
      const { error: pErr } = await db.from('meeting_participants').insert(
        speakers.map((name) => ({
          meeting_id: meetingId,
          person_id: null,
          external_email: null,
          display_name: name,
          role: HOST_NAME_RE.test(name) ? 'host' : 'attendee',
          attended: true,
        })),
      );
      if (pErr) throw new Error(`participants insert failed: ${pErr.message}`);
    }
    if (summary?.action_items?.length) await insertActionItems(db, meetingId, summary.action_items);
  } catch (e) {
    await db.from('meeting_action_items').delete().eq('meeting_id', meetingId);
    await db.from('meeting_participants').delete().eq('meeting_id', meetingId);
    await db.from('meetings').delete().eq('id', meetingId);
    throw e;
  }
  return meetingId;
}

async function insertActionItems(db, meetingId, items) {
  const rows = items.map((it, i) => {
    const detail = [it.detail, it.owner && it.owner !== 'Unassigned' ? `Owner: ${it.owner}` : null]
      .filter(Boolean)
      .join('. ');
    return {
      meeting_id: meetingId,
      title: it.title,
      detail: detail || null,
      assignee_id: null,
      due_date: it.due_date || null,
      status: 'open',
      position: i,
    };
  });
  const { error } = await db.from('meeting_action_items').insert(rows);
  if (error) throw new Error(`action items insert failed: ${error.message}`);
}

// ---- resummarize an existing row -------------------------------------------
async function resummarizeOne(uuid) {
  const db = await getDb();
  const { data: m, error } = await db
    .from('meetings')
    .select('id, metadata')
    .eq('source', 'zoom')
    .eq('external_id', uuid)
    .maybeSingle();
  if (error) return log(`Query failed: ${error.message}`);
  if (!m) return log(`No zoom meeting with external_id ${uuid}.`);
  const transcript = m.metadata?.transcript;
  if (!transcript) return log(`Meeting ${m.id} has no metadata.transcript to summarise.`);

  const summary = await summarizeTranscript(transcript);
  if (!WRITE) {
    return log(`[dry-run] would update ${m.id}:\n${summary.summary_markdown}\n(${summary.action_items.length} action items)`);
  }

  // Merge metadata: stamp ai_model, drop any stale ai_status:'pending'.
  const metadata = { ...(m.metadata || {}), ai_model: summary.model };
  delete metadata.ai_status;

  const update = {
    summary: summary.summary_markdown,
    summary_encrypted: false,
    metadata,
    updated_at: new Date().toISOString(),
  };
  if (summary.title?.trim()) update.title = summary.title.trim();

  const { error: uErr } = await db.from('meetings').update(update).eq('id', m.id);
  if (uErr) return log(`Update failed: ${uErr.message}`);
  await db.from('meeting_action_items').delete().eq('meeting_id', m.id);
  if (summary.action_items.length) await insertActionItems(db, m.id, summary.action_items);
  log(`Updated ${m.id}: "${summary.title}" (${summary.action_items.length} action items).`);
}

// ---- main -------------------------------------------------------------------
async function main() {
  if (RESUMMARIZE) {
    await resummarizeOne(RESUMMARIZE);
    return;
  }

  const creds = loadZoomCreds();
  const token = await getZoomToken(creds);

  const hosts = SINGLE_HOST
    ? [SINGLE_HOST]
    : (await listAccountUsers(token)).map((u) => u.email).filter(Boolean);
  log(`Scanning ${hosts.length} host(s) from ${FROM}, topics matching ${TOPIC_RE}...`);

  // Collect candidate recordings across hosts, filtered by topic.
  const candidates = [];
  for (const host of hosts) {
    let recs = [];
    try {
      recs = await listRecordings(token, host, FROM);
    } catch (e) {
      log(`  ! ${host}: ${e.message}`);
      continue;
    }
    for (const r of recs) if (TOPIC_RE.test(r.topic || '')) candidates.push(r);
  }
  log(`Found ${candidates.length} recording(s) matching the topic filter.`);

  let ingested = 0, skipped = 0, failed = 0;
  for (const rec of candidates) {
    const tag = `${rec.start_time} "${rec.topic}" (${rec.uuid})`;

    // Dedup.
    if (!SKIP_DB) {
      const db = await getDb();
      const { data: dupe, error } = await db
        .from('meetings')
        .select('id')
        .eq('source', 'zoom')
        .eq('external_id', rec.uuid)
        .limit(1)
        .maybeSingle();
      if (error) { failed++; log(`  ! dedup query failed: ${tag}\n    ${error.message}`); continue; }
      if (dupe) { skipped++; log(`  = skip (already ingested): ${tag}`); continue; }
    }

    // Transcript.
    const t = await downloadTranscript(token, rec);
    if (!t) { skipped++; log(`  = skip (no transcript yet): ${tag}`); continue; }
    const transcript = vttToText(t.vtt);
    if (!transcript.trim()) { skipped++; log(`  = skip (empty transcript): ${tag}`); continue; }

    // Summary (failure-isolated: a transcript still lands without it).
    let summary = null;
    if (!NO_SUMMARY) {
      try {
        summary = await summarizeTranscript(transcript);
      } catch (e) {
        failed++;
        log(`  ! summary failed, will ingest transcript only: ${tag}\n    ${e.message}`);
      }
    }

    if (!WRITE || SKIP_DB) {
      log(`  + [dry-run] ${tag}`);
      log(`      title: ${summary?.title || rec.topic}`);
      log(`      speakers: ${speakersFromText(transcript).join(', ') || '(none detected)'}`);
      log(`      transcript chars: ${transcript.length}`);
      if (summary) log(`      action items: ${summary.action_items.length}`);
      ingested++;
      continue;
    }

    const db = await getDb();
    const id = await insertMeeting(db, rec, transcript, summary, t.downloadUrl);
    ingested++;
    log(`  + ingested ${id}: ${tag}${summary ? '' : ' (transcript only)'}`);
  }

  log(`\nDone. ingested=${ingested} skipped=${skipped} summary-failures=${failed}` + (WRITE ? '' : '  (dry run, nothing written)'));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
