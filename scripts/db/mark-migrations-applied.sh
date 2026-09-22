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
# WHY IT NO LONGER MARKS EVERYTHING IT FINDS
#
# It used to glob supabase/migrations/*.sql and mark every version, with no
# reference to what the database actually holds. That is only correct when the
# database really was just rebuilt from the snapshot, and it is silently wrong
# everywhere else: run against a live database that is merely BEHIND, it writes
# "applied" against migrations whose objects are absent, and a missing table is
# then hidden permanently — the ledger says it arrived, so nothing will ever
# apply it and no drift check looks at the ledger.
#
# That is not hypothetical. On 2026-09-22 the ledger had drifted: seven
# migrations between 20260916110000 and 20260916160000 were applied and
# unrecorded. Running the old script would have been the right answer for six
# of them by luck, and if any one had genuinely been missing it would have
# buried it. Guessing correctly is not the same as knowing.
#
# So: this asks the database which versions it already has, marks only the
# difference, and refuses to mark anything unless you say which situation you
# are in.
#
# THE SNAPSHOT DOES NOT BUILD THE PAST — IT BUILDS THE SCHEMA
#
# Read the sentence above about the handoff with this next to it, because the
# two together are the whole reason --after-rebuild asks for confirmation.
#
# supabase/01-schema.sql is a --schema-only dump: tables, indexes, policies,
# grants, functions. No rows. But eleven of the eighteen migrations write rows,
# and two of them are almost nothing else:
#
#   20260916020000_payroll_iq_data.sql   9,389 data statements, 0 DDL
#   20260916040000_seed_grants.sql       5 statements, and they are every
#                                        company_os admin grant there is
#
# Marking those applied after a snapshot rebuild records as done something the
# rebuild did not do. The result is a database with the right 199 tables, all
# of them empty, a ledger that says the data arrived, and `db push` with
# nothing left to run — including no admin able to sign in. The tooling cannot
# detect it: check-schema-drift.sh compares table names, and finds no drift,
# because there is none. The schema is perfect and the contents are gone.
#
# There is no flag that fixes this. It is named here so that whoever rebuilds
# knows to restore the data separately, and the confirmation prompt exists to
# make them read it.
#
# USAGE
#   ./scripts/db/mark-migrations-applied.sh
#       Report only. Compares files against the ledger and marks nothing.
#       Start here; this is what tells you which situation you are in.
#
#   ./scripts/db/mark-migrations-applied.sh --after-rebuild
#       The post-rebuild handoff. Marks every unrecorded version, after
#       showing you which of them carry data the snapshot did not.
#
#   ./scripts/db/mark-migrations-applied.sh --repair <version>...
#       Mark specific versions you have VERIFIED are present in the live
#       schema — by checking the objects each one creates, not the file's
#       name. This is the safe answer to ledger drift.
#
#   Add --yes to skip the confirmation prompt, and put any extra supabase
#   flags after `--` (e.g. `-- --project-ref <ref>` from an unlinked worktree).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

mode="report"
assume_yes=0
requested=()
passthru=()

while (( $# )); do
  case "$1" in
    --after-rebuild) mode="after-rebuild"; shift ;;
    --repair)        mode="repair"; shift
                     while (( $# )) && [[ "$1" != --* ]]; do requested+=("$1"); shift; done ;;
    --yes|-y)        assume_yes=1; shift ;;
    --)              shift; passthru=("$@"); break ;;
    -h|--help)       sed -n '/^# USAGE/,/^set -euo/p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//; $d'; exit 0 ;;
    *)               echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

# ---------------------------------------------------------------------------
# What is on disk
# ---------------------------------------------------------------------------
local_versions=()
for f in supabase/migrations/*.sql; do
  [[ -e "$f" ]] || continue
  local_versions+=("$(basename "$f" | cut -d_ -f1)")
done

if (( ${#local_versions[@]} == 0 )); then
  echo "no migration files in supabase/migrations/ — nothing to do"; exit 0
fi

# ---------------------------------------------------------------------------
# What the database says it has.
#
# REFUSING IS THE POINT. If the ledger cannot be read we do not fall back to
# marking everything: that fallback is exactly the behaviour this script was
# rewritten to remove, and it fails toward "silently wrong" rather than
# "obviously stuck".
# ---------------------------------------------------------------------------
echo "Reading the migration ledger..."
if ! ledger_json="$(supabase migration list --linked --output-format json "${passthru[@]+"${passthru[@]}"}" 2>&1 \
                    | grep -m1 '^{"migrations"')"; then
  cat >&2 <<'ERR'

Could not read the migration ledger, so nothing was marked.

This script will not mark migrations it cannot check against the database —
an unverified "applied" hides a missing object permanently.

If this worktree is not linked, pass the project ref through:
  ./scripts/db/mark-migrations-applied.sh -- --project-ref <ref>
ERR
  exit 1
fi

# Read with a while-loop rather than `mapfile`: macOS ships bash 3.2, where
# mapfile does not exist, and this script has to run on the operator's Mac.
remote_versions=()
while IFS= read -r line; do
  [[ -n "$line" ]] && remote_versions+=("$line")
done < <(
  printf '%s' "$ledger_json" \
  | python3 -c 'import json,sys
for m in json.load(sys.stdin)["migrations"]:
    if m.get("remote"): print(m["remote"])'
)

is_remote() { local v="$1" r; for r in ${remote_versions[@]+"${remote_versions[@]}"}; do [[ "$r" == "$v" ]] && return 0; done; return 1; }
has_file()  { local v="$1"; compgen -G "supabase/migrations/${v}_*.sql" > /dev/null; }

# Migrations whose file exists but which the ledger does not record.
unrecorded=()
for v in "${local_versions[@]}"; do
  is_remote "$v" || unrecorded+=("$v")
done

# Recorded with no file here — usually a branch that predates the migration,
# worth saying out loud because it makes `db push` and this script disagree.
orphans=()
for r in ${remote_versions[@]+"${remote_versions[@]}"}; do
  has_file "$r" || orphans+=("$r")
done

# ---------------------------------------------------------------------------
# Which of a set write rows the snapshot cannot carry. Printed rather than
# blocked: the caller decides, but not without being told.
# ---------------------------------------------------------------------------
print_data_warning() {
  local v f n found=0
  for v in "$@"; do
    f="$(ls supabase/migrations/${v}_*.sql 2>/dev/null | head -1)" || true
    [[ -n "$f" ]] || continue
    n="$(grep -ciE '^[[:space:]]*(insert into|update )' "$f" || true)"
    if (( n > 0 )); then
      (( found == 0 )) && { echo; echo "  These write DATA, which supabase/01-schema.sql does NOT contain:"; found=1; }
      printf '    %-58s %s data statement(s)\n' "$(basename "$f")" "$n"
    fi
  done
  if (( found == 1 )); then
    echo
    echo "  A snapshot rebuild did not run them. Marking them applied means"
    echo "  nothing ever will. Restore that data separately."
  fi
}

echo "  ${#local_versions[@]} migration file(s), ${#remote_versions[@]} recorded in the ledger."
if (( ${#orphans[@]} )); then
  echo
  echo "  In the ledger with NO file on this branch:"
  printf '    %s\n' "${orphans[@]}"
  echo "    (normally a branch that predates the migration — check before pushing)"
fi

# ---------------------------------------------------------------------------
# Modes
# ---------------------------------------------------------------------------
case "$mode" in
  report)
    echo
    if (( ${#unrecorded[@]} == 0 )); then
      echo "Every migration file is recorded. Nothing to mark."
      exit 0
    fi
    echo "Unrecorded — a file exists, the ledger does not have it:"
    printf '  %s\n' "${unrecorded[@]}"
    print_data_warning "${unrecorded[@]}"
    cat <<'NEXT'

Nothing was marked. These are two different situations and only you can say
which one this is:

  You just rebuilt from 00-prereqs + 01-schema, so the schema is there and
  the ledger is blank:
      ./scripts/db/mark-migrations-applied.sh --after-rebuild

  The ledger has drifted on a live database:
      Check each one against the LIVE SCHEMA first — look for the objects it
      creates, not for its filename. Then mark only what you confirmed:
      ./scripts/db/mark-migrations-applied.sh --repair <version>...

      Anything you cannot find in the live schema is missing, not unrecorded.
      Apply it; do not mark it.
NEXT
    exit 1
    ;;

  after-rebuild)
    if (( ${#unrecorded[@]} == 0 )); then
      echo; echo "Every migration file is already recorded. Nothing to mark."; exit 0
    fi
    echo
    echo "About to mark ${#unrecorded[@]} version(s) as applied:"
    printf '  %s\n' "${unrecorded[@]}"
    print_data_warning "${unrecorded[@]}"
    echo
    echo "This is correct ONLY if this database was just rebuilt from"
    echo "supabase/00-prereqs.sql and supabase/01-schema.sql."
    if (( assume_yes == 0 )); then
      read -r -p "Was it? [y/N] " reply
      [[ "$reply" == [yY]* ]] || { echo "Nothing marked."; exit 1; }
    fi
    to_mark=("${unrecorded[@]}")
    ;;

  repair)
    if (( ${#requested[@]} == 0 )); then
      echo "--repair needs at least one version" >&2; exit 2
    fi
    to_mark=()
    for v in "${requested[@]}"; do
      if is_remote "$v"; then
        echo "  $v is already in the ledger — skipping"
      elif ! has_file "$v"; then
        echo "no migration file for version $v" >&2; exit 2
      else
        to_mark+=("$v")
      fi
    done
    if (( ${#to_mark[@]} == 0 )); then
      echo; echo "Nothing left to mark."; exit 0
    fi
    echo
    echo "Marking ${#to_mark[@]} version(s) you have verified against the live schema:"
    printf '  %s\n' "${to_mark[@]}"
    if (( assume_yes == 0 )); then
      read -r -p "Confirmed present in the live schema? [y/N] " reply
      [[ "$reply" == [yY]* ]] || { echo "Nothing marked."; exit 1; }
    fi
    ;;
esac

supabase migration repair --status applied "${to_mark[@]}" --linked "${passthru[@]+"${passthru[@]}"}"

echo
echo "Done. From here, schema changes are:"
echo "  1. write supabase/migrations/<new>.sql and 'supabase db push'"
echo "  2. ./scripts/db/regenerate-schema.sh    (keeps the rebuild path true)"
