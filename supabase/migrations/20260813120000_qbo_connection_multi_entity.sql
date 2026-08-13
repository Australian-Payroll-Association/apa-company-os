-- Multi-company QuickBooks: the qbo_connection table already allows many rows
-- (id is the primary key), but the single existing row used id='default' and
-- lib/qbo.ts hardcoded that. Re-key connections by entity so a second company
-- (AIO — public retreats) can be connected alongside Talent Edge LLC without
-- either connection's rotating refresh token clobbering the other.
--
--   'edge8' = Talent Edge LLC (private retreats + client work billing)
--   'aio'   = public retreats
--
-- Rename the live row in place (id is text, not referenced by any FK) and move
-- the column default to 'edge8' so a bare insert still lands on the original
-- company. Idempotent-safe: only touches the legacy 'default' id.

update company_os.qbo_connection set id = 'edge8' where id = 'default';

alter table company_os.qbo_connection alter column id set default 'edge8';
