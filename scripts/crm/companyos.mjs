// Company OS DB access for the operator scripts, via the Supabase client with
// the service (secret) key, the same way the app writes (lib/supabase.ts). This
// avoids needing the raw Postgres password: the secret key is displayed in the
// dashboard (Settings > API Keys) and bypasses RLS.
//
// Reads SUPABASE_URL and SUPABASE_SECRET_KEY from the environment, falling back
// to .env.local at the repo root. Secrets are never printed.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function fromEnvLocal(key) {
  const file = path.join(ROOT, '.env.local');
  if (!fs.existsSync(file)) return undefined;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(new RegExp(`^\\s*${key}\\s*=\\s*(.+)$`));
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  return undefined;
}

const url = process.env.SUPABASE_URL || fromEnvLocal('SUPABASE_URL');
const key = process.env.SUPABASE_SECRET_KEY || fromEnvLocal('SUPABASE_SECRET_KEY');
if (!url || !key) {
  throw new Error(
    'Missing SUPABASE_URL / SUPABASE_SECRET_KEY. Add them to .env.local at the repo ' +
    'root (the secret key is in the Supabase dashboard: Settings > API Keys).',
  );
}

// Scoped to the company_os schema, matching lib/supabase.ts `companyOs`.
export const companyOs = createClient(url, key, { auth: { persistSession: false } }).schema('company_os');
