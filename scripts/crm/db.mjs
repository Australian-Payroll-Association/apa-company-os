// Direct Postgres access to Company OS (Supabase project wwchefrgkkxmhlkntufm, schema company_os).
// One-time per machine, from the repo root: npm i --no-save postgres@3
// Then from any script: import { sql, normalizeJsonMeta } from './scripts/crm/db.mjs'
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const env = fs.readFileSync(path.join(root, '.env.local'), 'utf8');
const pw = env.match(/^SUPABASE Password:\s*(\S+)/m)?.[1];
if (!pw) throw new Error('No "SUPABASE Password:" line in .env.local');

export const sql = postgres(
  `postgresql://postgres.wwchefrgkkxmhlkntufm:${pw}@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`,
  { ssl: 'require', prepare: false, max: 3, idle_timeout: 5 },
);

// Inserting `${JSON.stringify(obj)}::jsonb` through this driver stores a
// double-encoded JSON string. Call this right after any such insert.
export const normalizeJsonMeta = (schemaTable, id, column = 'metadata') =>
  sql.unsafe(
    `update ${schemaTable} set ${column} = (${column} #>> '{}')::jsonb
     where id = $1 and jsonb_typeof(${column}) = 'string'`,
    [id],
  );
