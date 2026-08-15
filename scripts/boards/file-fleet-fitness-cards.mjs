// Fleet Fitness -> Operations board (task boards PR7, the "agents file cards"
// opener). Files one card per laptop below the 24GB/512GB floor onto the
// Operations board, and moves its own card to Done when a laptop passes or is
// retired. Idempotent: dedupe is by metadata.asset_tag, so re-runs don't
// duplicate. Agent-filed cards carry metadata.source='agent' (the board shows an
// AGENT badge) and metadata.evidence for "why does this card exist".
// Run from the repo root: node scripts/boards/file-fleet-fitness-cards.mjs
import { sql } from "../crm/db.mjs";

const RAM_FLOOR_GB = 24;
const SSD_FLOOR_GB = 512;

// "16GB" -> 16, "1TB" -> 1024, "512GB PCIE" -> 512, junk -> null.
function parseGb(raw) {
  if (!raw) return null;
  const m = String(raw).match(/(\d+(?:\.\d+)?)\s*(tb|gb|t|g)\b/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return /^t/i.test(m[2]) ? Math.round(n * 1024) : Math.round(n);
}

const [board] = await sql`select id from company_os.boards where slug = 'operations' and archived_at is null`;
if (!board) {
  console.error("No Operations board found; nothing to do.");
  await sql.end();
  process.exit(0);
}

const cols = await sql`
  select id, is_done, position from company_os.board_columns
  where board_id = ${board.id} order by position`;
const intake = cols.find((c) => !c.is_done) ?? cols[0];
const doneCol = cols.find((c) => c.is_done) ?? null;
if (!intake) {
  console.error("Operations board has no columns.");
  await sql.end();
  process.exit(0);
}

const laptops = await sql`
  select id, asset_tag, name, ram, storage, archived_at
  from company_os.equipment where type = 'laptop'`;

const cards = await sql`
  select id, board_column_id, metadata, archived_at
  from company_os.tasks
  where board_id = ${board.id}
    and metadata->>'source' = 'agent'
    and metadata->>'routine' = 'fleet-fitness'`;
const cardByTag = new Map();
for (const c of cards) {
  const tag = c.metadata?.asset_tag;
  if (tag) cardByTag.set(tag, c);
}

let filed = 0;
let cleared = 0;
for (const l of laptops) {
  const ram = parseGb(l.ram);
  const ssd = parseGb(l.storage);
  const fails =
    l.archived_at == null && ((ram != null && ram < RAM_FLOOR_GB) || (ssd != null && ssd < SSD_FLOOR_GB));
  const existing = cardByTag.get(l.asset_tag);

  if (fails && !existing) {
    const [{ position }] = await sql`
      select coalesce(max(position), 0) + 1 as position from company_os.tasks
      where board_id = ${board.id} and board_column_id = ${intake.id} and archived_at is null`;
    const meta = {
      source: "agent",
      routine: "fleet-fitness",
      asset_tag: l.asset_tag,
      evidence: { ram_gb: ram, ssd_gb: ssd, floor: `${RAM_FLOOR_GB}GB / ${SSD_FLOOR_GB}GB` },
    };
    const title = `Replace ${l.name} (${l.asset_tag}): ${ram ?? "?"}GB RAM / ${ssd ?? "?"}GB SSD below floor`;
    await sql`
      insert into company_os.tasks (board_id, board_column_id, title, priority, status, position, metadata)
      values (${board.id}, ${intake.id}, ${title}, 'p2', 'open', ${position}, ${sql.json(meta)})`;
    filed++;
  } else if (existing && !existing.archived_at && !fails && doneCol && existing.board_column_id !== doneCol.id) {
    // Laptop now passes (or was retired): the agent clears its own card.
    await sql`
      update company_os.tasks set board_column_id = ${doneCol.id}, status = 'done', completed_at = now()
      where id = ${existing.id}`;
    await sql`
      insert into company_os.task_stage_log (task_id, from_column_id, to_column_id, kind, note)
      values (${existing.id}, ${existing.board_column_id}, ${doneCol.id}, 'move',
              'Fleet fitness: laptop now meets the 24GB/512GB floor.')`;
    cleared++;
  }
}

console.log(`fleet-fitness -> Operations board: filed ${filed}, cleared ${cleared}.`);
await sql.end();
