#!/usr/bin/env bash
#
# Fail when supabase/01-schema.sql no longer matches the live database.
#
# The snapshot is the rebuild path, and its drift is SILENT: nothing breaks
# until someone rebuilds, and then the failure is a missing table at runtime
# rather than an error at apply time. On 2026-09-15 it had fallen 13 tables
# behind, 8 of which existed nowhere in the repo at all.
#
# SOFT MODE: with no database password this exits 0 and says so, matching
# check-prod-migrations.ts. A check that hard-fails where it cannot run just
# gets deleted; one that reports honestly gets kept.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SNAP="$ROOT/supabase/01-schema.sql"
PSQL="${PSQL:-/opt/homebrew/opt/libpq/bin/psql}"
REF="${SUPABASE_PROJECT_REF:-nubxrrzwcbhgpvvmbioh}"
HOST="${SUPABASE_DB_HOST:-aws-0-ap-southeast-2.pooler.supabase.com}"

PW="${APA_DB_PW:-}"
[[ -z "$PW" && -f "$ROOT/.env.local" ]] && \
  PW="$(grep -m1 '^APA_DB_PW=' "$ROOT/.env.local" | cut -d= -f2- | tr -d '\r')"

if [[ -z "$PW" ]]; then
  echo "[check-schema-drift] SOFT MODE — no APA_DB_PW, cannot reach the database. Exiting 0."
  exit 0
fi

live=$(PGPASSWORD="$PW" "$PSQL" -h "$HOST" -p 5432 -U "postgres.$REF" -d postgres -tAc "
  select table_schema||'.'||table_name
    from information_schema.tables
   where table_schema in ('app_security','company_os','htt','payroll_iq')
     and table_type='BASE TABLE'
   order by 1" 2>/dev/null)

if [[ -z "$live" ]]; then
  echo "[check-schema-drift] SOFT MODE — could not query the database. Exiting 0."
  exit 0
fi

snap=$(grep -oE '^CREATE TABLE "?[a-z_]+"?\."?[a-z_0-9]+"?' "$SNAP" \
       | sed 's/CREATE TABLE //; s/"//g' | sort -u)

missing=$(comm -23 <(echo "$live" | sort -u) <(echo "$snap"))
extra=$(comm -13 <(echo "$live" | sort -u) <(echo "$snap"))

status=0
if [[ -n "$missing" ]]; then
  echo "[check-schema-drift] ✗ live tables MISSING from supabase/01-schema.sql:"
  echo "$missing" | sed 's/^/    /'
  echo "    A rebuild from this repo would not create them. Run scripts/db/regenerate-schema.sh."
  status=1
fi
if [[ -n "$extra" ]]; then
  echo "[check-schema-drift] ✗ in the snapshot but NOT live (dropped without regenerating):"
  echo "$extra" | sed 's/^/    /'
  status=1
fi
(( status == 0 )) && echo "[check-schema-drift] OK — snapshot matches live ($(echo "$live" | wc -l | tr -d ' ') tables)."
exit $status
