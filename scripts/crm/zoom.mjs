// Zoom Server-to-Server OAuth client, read-only. Lists cloud recordings across
// the account's users and downloads the full VTT transcript for a meeting.
// Used by scripts/crm/zoom-ingest.mjs to pull coaching-session transcripts into
// company_os.meetings. See docs/plans/2026-08-27-zoom-coaching-ingestion.md.
//
// Credentials come from the environment, falling back to ~/.claude/.env (the
// same S2S app that mints Zoom links). Never printed. Required keys:
//   ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET
// Optional:
//   ZOOM_HOST_EMAIL (a default host to scan; the account is scanned regardless)

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ENV_FILE = path.join(os.homedir(), '.claude', '.env');

export function loadZoomCreds() {
  const keys = ['ZOOM_ACCOUNT_ID', 'ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET', 'ZOOM_HOST_EMAIL'];
  const creds = {};
  for (const k of keys) if (process.env[k]) creds[k] = process.env[k];
  if (fs.existsSync(ENV_FILE)) {
    for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#') || !t.includes('=')) continue;
      const i = t.indexOf('=');
      const k = t.slice(0, i).trim();
      if (keys.includes(k) && !(k in creds)) creds[k] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    }
  }
  const missing = ['ZOOM_ACCOUNT_ID', 'ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET'].filter((k) => !creds[k]);
  if (missing.length) throw new Error(`Missing Zoom credentials: ${missing.join(', ')}`);
  return creds;
}

export async function getZoomToken(creds) {
  const basic = Buffer.from(`${creds.ZOOM_CLIENT_ID}:${creds.ZOOM_CLIENT_SECRET}`).toString('base64');
  const url = `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(creds.ZOOM_ACCOUNT_ID)}`;
  const res = await fetch(url, { method: 'POST', headers: { Authorization: `Basic ${basic}` } });
  if (!res.ok) throw new Error(`Zoom token failed: HTTP ${res.status}`);
  return (await res.json()).access_token;
}

async function api(token, pathAndQuery) {
  const res = await fetch(`https://api.zoom.us/v2${pathAndQuery}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`Zoom GET ${pathAndQuery} -> HTTP ${res.status} ${body.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// Every licensed user on the account (recordings live under the host, so we
// scan them all rather than assuming who hosted).
export async function listAccountUsers(token) {
  const out = [];
  let next = '';
  do {
    const page = await api(token, `/users?page_size=300${next ? `&next_page_token=${next}` : ''}`);
    out.push(...(page.users || []));
    next = page.next_page_token || '';
  } while (next);
  return out;
}

// Cloud recordings for one host from `from` (YYYY-MM-DD) to today.
export async function listRecordings(token, hostEmail, from) {
  const out = [];
  let next = '';
  do {
    const page = await api(
      token,
      `/users/${encodeURIComponent(hostEmail)}/recordings?from=${from}&page_size=100${next ? `&next_page_token=${next}` : ''}`,
    );
    out.push(...(page.meetings || []));
    next = page.next_page_token || '';
  } while (next);
  return out;
}

// Download the audio_transcript (VTT) for a recording. Zoom accepts the bearer
// token as a query param on download_url. Returns null when the meeting has no
// transcript file (recording still processing, or transcription was off).
export async function downloadTranscript(token, meeting) {
  const file = (meeting.recording_files || []).find((f) => f.recording_type === 'audio_transcript');
  if (!file || !file.download_url) return null;
  const res = await fetch(`${file.download_url}?access_token=${token}`);
  if (!res.ok) return null;
  return { vtt: await res.text(), downloadUrl: file.download_url };
}

// WebVTT -> readable transcript. Keeps the "Speaker: line" text and drops the
// WEBVTT header, cue indices, and timestamp lines. Mirrors the cleanup in
// lib/meeting-extract.ts so the DB and the model see the same shape.
export function vttToText(vtt) {
  return vtt
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^WEBVTT/i.test(l) && !/^\d+$/.test(l) && !/-->/.test(l))
    .join('\n')
    .trim();
}

// Distinct speaker labels from cleaned transcript lines ("Name: text").
// Zoom prefixes each cue with the real speaker name, so a label is only trusted
// when it looks like a name (1-4 capitalised words) AND appears on 2+ lines.
// That drops mid-sentence colons ("the plan is: ship it") that would otherwise
// masquerade as speakers and create bogus participant rows.
const NAME_LABEL = /^[A-Z][\p{L}.'-]*(?:\s+[A-Z][\p{L}.'-]*){0,3}$/u;

export function speakersFromText(text) {
  const counts = new Map();
  for (const line of text.split('\n')) {
    const m = line.match(/^([^:]{1,60}):\s+\S/);
    if (!m) continue;
    const label = m[1].trim();
    if (!NAME_LABEL.test(label)) continue;
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return [...counts.entries()].filter(([, n]) => n >= 2).map(([name]) => name);
}
