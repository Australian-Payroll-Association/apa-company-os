#!/usr/bin/env bash
#
# After rebuilding from 00-prereqs + 01-schema, tell Supabase the existing
# migrations are already in the database.
#
# WHY THIS STEP EXISTS
# The snapshot and the migration ledger are two records of the same schema, and
# a rebuild satisfies one while leaving the other blank. `supabase db push`
# then tries to replay everything from the beginning — starting with
# 20260916000000_payroll_iq_baseline.sql, which is 340 DDL statements and
# almost none of them idempotent, so it fails on the first CREATE TABLE and
# leaves you unsure which half of the schema is real.
#
# Marking them applied is the handoff: the snapshot built the past, migrations
# carry the future.
#
# USAGE (from the repo root, after the two SQL files):
#   ./scripts/db/mark-migrations-applied.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

versions=()
for f in supabase/migrations/*.sql; do
  [[ -e "$f" ]] || continue
  versions+=("$(basename "$f" | cut -d_ -f1)")
done

if (( ${#versions[@]} == 0 )); then
  echo "no migrations to mark"; exit 0
fi

echo "Marking ${#versions[@]} migration(s) as already applied:"
printf '  %s\n' "${versions[@]}"
supabase migration repair --status applied "${versions[@]}"
echo
echo "Done. From here, schema changes are:"
echo "  1. write supabase/migrations/<new>.sql and 'supabase db push'"
echo "  2. ./scripts/db/regenerate-schema.sh    (keeps the rebuild path true)"
