#!/usr/bin/env bash
#
# Fail when supabase/01-schema.sql no longer matches the live database.
#
# The snapshot is the rebuild path, and its drift is SILENT: nothing breaks
# until someone rebuilds, and then the failure is a missing table at runtime
# rather than an error at apply time. On 2026-09-15 it had fallen 13 tables
# behind, 8 of which existed nowhere in the repo at all.
#
# WHAT THIS COMPARES, AND WHY IT IS NO LONGER JUST TABLES
#
# Until 2026-09-22 this compared table NAMES and nothing else, so it could only
# ever see a table appear or disappear. That is a small share of what a
# migration does. `supabase/migrations/20260916160000_module_video_health.sql`
# adds two columns and two partial indexes to an existing table and creates no
# table at all: this check reported OK whether or not it had been applied, and
# the migration sat unrecorded from 2026-09-16 to 2026-09-22 with nothing
# flagging it. The first run of the widened check found three more live
# examples the old one was blind to — two columns and a unique constraint on
# `payroll_iq.users`, and a changed body in
# `payroll_iq.assert_org_within_seats`, a SECURITY DEFINER function that
# enforces seat capacity.
#
# It now compares six classes, by name AND by definition:
#
#   table       existence
#   column      type, DEFAULT, NOT NULL, GENERATED expression
#   index       full pg_get_indexdef, so a redefinition under the same name shows
#   constraint  full pg_get_constraintdef (CHECK / PK / FK / UNIQUE)
#   policy      the whole CREATE POLICY, so a silently widened USING clause shows
#   function    signature, return type and body
#
# Not covered: grants, triggers, sequences, custom types, views, and comments.
# Those are real drift classes; they are absent because each needs its own
# validated live-vs-snapshot rendering and none has burned us yet. Add one by
# adding a UNION arm below and a rule to the awk parser — they share a format.
#
# WHY CATALOG QUERIES AND NOT A pg_dump DIFF
#
# The obvious alternative is to re-run what regenerate-schema.sh runs and diff
# the two files. It was rejected for three reasons:
#
#  1. pg_dump output is a function of the pg_dump VERSION, not just the schema.
#     This snapshot was written by pg_dump 18.6 against a 17.6 server. A CI
#     runner with postgresql-client-16 would produce a byte-different file for
#     an identical schema, and a check that cries wolf is a check that gets
#     deleted — the same reasoning as the SOFT MODE note below.
#  2. A diff of a 21,000-line file reports hunks, not names. Reporting what
#     drifted by name is the property this check exists to have.
#  3. It needs pg_dump in CI. This needs only psql, which the check already had.
#
# The catalog queries are cheap and exact because they call the SAME deparse
# functions pg_dump calls — pg_get_indexdef, pg_get_constraintdef, format_type —
# so no normalisation is needed to make the two sides comparable. Measured on
# 2026-09-22 against production: 4,072 objects compared, one round trip, ~4s,
# and zero false positives.
#
# SOFT MODE: with no database password this exits 0 and says so, matching
# check-prod-migrations.ts. A check that hard-fails where it cannot run just
# gets deleted; one that reports honestly gets kept.
set -uo pipefail

# comm and join require both inputs in the same collation as the sort that
# produced them. Pinning it here removes a locale-dependent false positive.
export LC_ALL=C

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SNAP="${SNAP:-$ROOT/supabase/01-schema.sql}"
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

if [[ ! -f "$SNAP" ]]; then
  echo "[check-schema-drift] ✗ $SNAP is missing. It is the rebuild path; do not improvise a substitute." >&2
  exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# ---------------------------------------------------------------------------
# The live side. One round trip, one row per object, as: class:identity<TAB>definition
#
# PGOPTIONS sets search_path empty for the same reason pg_dump does: it is what
# makes format_type schema-qualify user-defined types exactly as the snapshot
# spells them. Catalog references below are pg_catalog-qualified to survive it.
# ---------------------------------------------------------------------------
PGOPTIONS="-c search_path=" PGPASSWORD="$PW" "$PSQL" \
  -h "$HOST" -p 5432 -U "postgres.$REF" -d postgres -tA -F $'\t' -c "
with sch(nspname) as (values ('app_security'),('company_os'),('htt'),('payroll_iq'))
select 'table:'||n.nspname||'.'||c.relname, ''
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  join sch on sch.nspname = n.nspname
 where c.relkind in ('r','p')
union all
select 'column:'||n.nspname||'.'||c.relname||'.'||a.attname,
       pg_catalog.regexp_replace(
         pg_catalog.format_type(a.atttypid, a.atttypmod)
         || case when a.attgenerated = 's'
                 then ' GENERATED ALWAYS AS ('||pg_catalog.pg_get_expr(d.adbin, d.adrelid)||') STORED'
                 when d.adbin is not null
                 then ' DEFAULT '||pg_catalog.pg_get_expr(d.adbin, d.adrelid)
                 else '' end
         || case when a.attnotnull then ' NOT NULL' else '' end,
         '[[:space:]]+', ' ', 'g')
  from pg_catalog.pg_attribute a
  join pg_catalog.pg_class c on c.oid = a.attrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  join sch on sch.nspname = n.nspname
  left join pg_catalog.pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
 where c.relkind in ('r','p') and a.attnum > 0 and not a.attisdropped
union all
-- Indexes that back a constraint are dumped as ALTER TABLE ADD CONSTRAINT, not
-- CREATE INDEX, so they are excluded here and counted in the constraint class.
select 'index:'||n.nspname||'.'||c.relname||'.'||i.relname,
       pg_catalog.regexp_replace(pg_catalog.pg_get_indexdef(x.indexrelid), '[[:space:]]+', ' ', 'g')
  from pg_catalog.pg_index x
  join pg_catalog.pg_class i on i.oid = x.indexrelid
  join pg_catalog.pg_class c on c.oid = x.indrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  join sch on sch.nspname = n.nspname
 where not exists (select 1 from pg_catalog.pg_constraint k where k.conindid = x.indexrelid)
union all
select 'constraint:'||n.nspname||'.'||c.relname||'.'||k.conname,
       pg_catalog.regexp_replace(pg_catalog.pg_get_constraintdef(k.oid), '[[:space:]]+', ' ', 'g')
  from pg_catalog.pg_constraint k
  join pg_catalog.pg_class c on c.oid = k.conrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  join sch on sch.nspname = n.nspname
union all
-- No pg_get_policydef exists, so this reassembles the statement the way pg_dump
-- does. The roles keep polroles' array order: sorting them alphabetically here
-- was the only false positive the widened check ever produced.
select 'policy:'||n.nspname||'.'||c.relname||'.'||p.polname,
       pg_catalog.regexp_replace(
         'CREATE POLICY '||p.polname||' ON '||n.nspname||'.'||c.relname
         || case p.polcmd when 'r' then ' FOR SELECT' when 'a' then ' FOR INSERT'
                          when 'w' then ' FOR UPDATE' when 'd' then ' FOR DELETE' else '' end
         || case when p.polroles = '{0}'::oid[] then ''
                 else ' TO '||(select pg_catalog.string_agg(pg_catalog.quote_ident(r.rolname), ', ' order by u.ord)
                                 from pg_catalog.unnest(p.polroles) with ordinality as u(roleoid, ord)
                                 join pg_catalog.pg_roles r on r.oid = u.roleoid) end
         || case when p.polqual is null then ''
                 else ' USING ('||pg_catalog.pg_get_expr(p.polqual, p.polrelid)||')' end
         || case when p.polwithcheck is null then ''
                 else ' WITH CHECK ('||pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid)||')' end,
         '[[:space:]]+', ' ', 'g')
  from pg_catalog.pg_policy p
  join pg_catalog.pg_class c on c.oid = p.polrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  join sch on sch.nspname = n.nspname
union all
-- Identity is the full argument signature because Postgres treats an overload
-- as a different function; adding an argument is a new function, not a change.
select 'function:'||pg_catalog.regexp_replace(
         n.nspname||'.'||p.proname||'('||pg_catalog.pg_get_function_arguments(p.oid)||')',
         '[[:space:]]+', ' ', 'g'),
       pg_catalog.regexp_replace(
         'RETURNS '||pg_catalog.pg_get_function_result(p.oid)||' >> '||p.prosrc,
         '[[:space:]]+', ' ', 'g')
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  join sch on sch.nspname = n.nspname
" 2>/dev/null | sed -E 's/ >> +/ >> /; s/[[:space:]]+$//' | sort -u > "$TMP/live"

if [[ ! -s "$TMP/live" ]]; then
  echo "[check-schema-drift] SOFT MODE — could not query the database. Exiting 0."
  exit 0
fi

# ---------------------------------------------------------------------------
# The snapshot side. One pass, same format. Every rule here tracks a shape that
# pg_dump emits, which is why regenerate-schema.sh's two post-processing edits
# do not matter: neither touches a line this parser reads.
# ---------------------------------------------------------------------------
awk '
function unq(s) { gsub(/"/, "", s); return s }
function squeeze(s) { gsub(/[[:space:]]+/, " ", s); sub(/^ /, "", s); sub(/ $/, "", s); return s }

# A CREATE TABLE body: one column or one inline CONSTRAINT per line, four-space
# indented, terminated by ");" at column 0. A CHECK can wrap, so lines are
# joined until the parens balance.
/^CREATE TABLE / {
  tbl = unq($3); sub(/\($/, "", tbl); intbl = 1
  print "table:" tbl "\t"
  next
}
intbl && /^\);/ { intbl = 0; next }
intbl {
  acc = $0; sub(/^    /, "", acc)
  o = gsub(/\(/, "(", acc); c = gsub(/\)/, ")", acc)
  while (o > c && (getline nl) > 0) {
    acc = acc " " nl; o += gsub(/\(/, "(", nl); c += gsub(/\)/, ")", nl)
  }
  sub(/,$/, "", acc); acc = squeeze(acc)
  if (acc ~ /^CONSTRAINT /) {
    nm = acc; sub(/^CONSTRAINT /, "", nm); sub(/ .*/, "", nm)
    def = acc; sub(/^CONSTRAINT [^ ]+ /, "", def)
    print "constraint:" tbl "." unq(nm) "\t" def
  } else {
    nm = acc; sub(/ .*/, "", nm)
    def = acc; sub(/^[^ ]+ /, "", def)
    print "column:" tbl "." unq(nm) "\t" def
  }
  next
}

# PK / FK / UNIQUE arrive as a two-line ALTER TABLE ONLY ... / ADD CONSTRAINT.
# The table is only remembered from an ALTER TABLE line with no semicolon, so a
# one-line "ALTER TABLE x ENABLE ROW LEVEL SECURITY;" cannot be mistaken for one.
/^ALTER TABLE / { if ($0 !~ /;[[:space:]]*$/) at = unq($NF); next }
/^    ADD CONSTRAINT / {
  acc = $0; sub(/^    ADD CONSTRAINT /, "", acc)
  while (acc !~ /;[[:space:]]*$/ && (getline nl) > 0) acc = acc " " nl
  sub(/;[[:space:]]*$/, "", acc); acc = squeeze(acc)
  nm = acc; sub(/ .*/, "", nm)
  def = acc; sub(/^[^ ]+ /, "", def)
  if (at != "") print "constraint:" at "." unq(nm) "\t" def
  next
}

/^CREATE (UNIQUE )?INDEX / {
  acc = $0
  while (acc !~ /;[[:space:]]*$/ && (getline nl) > 0) acc = acc " " nl
  sub(/;[[:space:]]*$/, "", acc); acc = squeeze(acc)
  n = split(acc, f, " ")
  if (f[2] == "UNIQUE") { nm = unq(f[4]); tb = unq(f[6]) } else { nm = unq(f[3]); tb = unq(f[5]) }
  print "index:" tb "." nm "\t" acc
  next
}

# A policy USING clause containing a subquery is deparsed across several lines
# by Postgres, on both sides, so the statement is joined and squeezed to one.
/^CREATE POLICY / {
  acc = $0
  while (acc !~ /;[[:space:]]*$/ && (getline nl) > 0) acc = acc " " nl
  sub(/;[[:space:]]*$/, "", acc); acc = squeeze(acc)
  split(acc, f, " ")
  print "policy:" unq(f[5]) "." unq(f[3]) "\t" acc
  next
}

# CREATE FUNCTION sig RETURNS t / attributes / AS $tag$ body $tag$;
# The body is read verbatim between the dollar quotes, which is exactly what
# pg_proc.prosrc holds, so the two sides compare without further translation.
/^CREATE FUNCTION / {
  sig = $0; sub(/^CREATE FUNCTION /, "", sig)
  guard = 0
  while (index(sig, ") RETURNS ") == 0 && guard++ < 20 && (getline nl) > 0) sig = sig " " nl
  sig = squeeze(sig)
  r = index(sig, ") RETURNS ")
  if (r == 0) next
  fn = substr(sig, 1, r); ret = substr(sig, r + 2)
  tag = ""; body = ""
  while ((getline nl) > 0) {
    if (tag == "") {
      if (match(nl, /AS \$[A-Za-z_]*\$/)) {
        tag = substr(nl, RSTART + 3, RLENGTH - 3)
        rest = substr(nl, RSTART + RLENGTH)
        if (index(rest, tag) > 0) { body = substr(rest, 1, index(rest, tag) - 1); break }
        body = rest
      }
      continue
    }
    if (index(nl, tag) > 0) { body = body " " substr(nl, 1, index(nl, tag) - 1); break }
    body = body " " nl
  }
  print "function:" fn "\t" ret " >> " squeeze(body)
  next
}
' "$SNAP" | sed -E 's/ >> +/ >> /; s/[[:space:]]+$//' | sort -u > "$TMP/snap"

# ---------------------------------------------------------------------------
# Is the PARSER broken, or is the SCHEMA drifted? A parser that silently stopped
# understanding pg_dump's output would report thousands of missing objects and
# look exactly like catastrophic drift. These counts are taken from the snapshot
# itself rather than hard-coded, so they never go stale as the schema grows.
# ---------------------------------------------------------------------------
parse_fail=""
for pair in "table:^CREATE TABLE " "policy:^CREATE POLICY " "function:^CREATE FUNCTION " "index:^CREATE (UNIQUE )?INDEX "; do
  cls="${pair%%:*}"; pat="${pair#*:}"
  want=$(grep -cE "$pat" "$SNAP")
  got=$(grep -c "^$cls:" "$TMP/snap")
  (( want == got )) || parse_fail+=$'\n'"    $cls: $got parsed, but the file holds $want"
done
ntbl=$(grep -c '^table:' "$TMP/snap"); ncol=$(grep -c '^column:' "$TMP/snap")
(( ncol >= ntbl * 2 )) || parse_fail+=$'\n'"    column: only $ncol parsed across $ntbl tables"

if [[ -n "$parse_fail" ]]; then
  echo "[check-schema-drift] ✗ the snapshot parser is out of step with supabase/01-schema.sql:$parse_fail"
  echo "    This is a bug in THIS SCRIPT, not schema drift. pg_dump's output shape"
  echo "    has probably changed. Fix the awk rules before trusting any result."
  exit 1
fi

# ---------------------------------------------------------------------------
# Compare. Three questions per class: what is live and not in the snapshot, what
# is in the snapshot and not live, and what exists in both under a different
# definition.
# ---------------------------------------------------------------------------
cut -f1 "$TMP/live" > "$TMP/live.k"
cut -f1 "$TMP/snap" > "$TMP/snap.k"
comm -23 "$TMP/live.k" "$TMP/snap.k" > "$TMP/missing.raw"
comm -13 "$TMP/live.k" "$TMP/snap.k" > "$TMP/extra.raw"
join -t$'\t' "$TMP/live" "$TMP/snap" | awk -F'\t' '$2 != $3' > "$TMP/changed"

# A whole table appearing or disappearing takes its columns, indexes, policies
# and constraints with it. Reporting all of them would bury the one fact that
# matters under twenty that follow from it, so the children are rolled up.
rollup() {
  awk -F'\t' '
    NR == FNR { if ($0 ~ /^table:/) drop[substr($0, 7)] = 1; next }
    {
      cls = $0; sub(/:.*/, "", cls)
      if (cls == "column" || cls == "index" || cls == "policy" || cls == "constraint") {
        id = substr($0, length(cls) + 2)
        n = split(id, q, ".")
        if ((q[1] "." q[2]) in drop) next
      }
      print
    }' "$1" "$1"
}
rollup "$TMP/missing.raw" > "$TMP/missing"
rollup "$TMP/extra.raw"   > "$TMP/extra"

status=0

# Names per class before the listing is truncated. The cap is not cosmetic: the
# worst realistic failure of the awk parser is the CREATE TABLE state machine
# not terminating, which swallows every later statement and reports the entire
# schema as drifted. Printing 400 lines for that is how a check earns its
# deletion, so a class that has lost most of its objects is called out as the
# parser fault it almost certainly is.
CAP=40

report() { # $1 = file of class:identity lines, $2 = headline
  local cls names plural noun n live_n
  for cls in table column index constraint policy function; do
    names=$(grep "^$cls:" "$1" 2>/dev/null | sed "s/^$cls://")
    [[ -z "$names" ]] && continue
    n=$(printf '%s\n' "$names" | wc -l | tr -d ' ')
    live_n=$(grep -c "^$cls:" "$TMP/live")
    case "$cls" in
      index)  plural="indexes"  ;;
      policy) plural="policies" ;;
      *)      plural="${cls}s"  ;;
    esac
    (( n == 1 )) && noun="$cls" || noun="$plural"
    echo "[check-schema-drift] ✗ $n $noun $2:"
    printf '%s\n' "$names" | head -n "$CAP" | cut -c1-200 | sed 's/^/    /'
    (( n > CAP )) && echo "    ... and $(( n - CAP )) more"
    if (( live_n > 0 && n * 2 > live_n )); then
      echo "    NOTE: that is $n of $live_n live ${plural}. Drift on this scale is far more"
      echo "    likely to be a bug in this script's snapshot parser, or a partial query"
      echo "    result, than a real schema change. Check the parser before acting on it."
    fi
    status=1
  done
}

report "$TMP/missing" "live but MISSING from supabase/01-schema.sql"
report "$TMP/extra"   "in the snapshot but NOT live (dropped without regenerating)"

if [[ -s "$TMP/changed" ]]; then
  status=1
  nchanged=$(wc -l < "$TMP/changed" | tr -d ' ')
  (( nchanged == 1 )) && cnoun="object" || cnoun="objects"
  echo "[check-schema-drift] ✗ $nchanged $cnoun present in both, but DEFINED differently:"
  head -n "$CAP" "$TMP/changed" \
    | awk -F'\t' '{ printf "    %s\n        live: %.160s\n        snap: %.160s\n", $1, $2, $3 }'
  (( nchanged > CAP )) && echo "    ... and $(( nchanged - CAP )) more"
  if (( nchanged * 2 > $(wc -l < "$TMP/live") )); then
    echo "    NOTE: most of the schema reports as redefined. Suspect this script's"
    echo "    definition rendering before you suspect the database."
  fi
fi

if (( status == 1 )); then
  echo "[check-schema-drift] A rebuild from this repo would not reproduce the live database."
  echo "    Run scripts/db/regenerate-schema.sh and commit supabase/01-schema.sql."
  echo "    If this is a change you are making, the migration in supabase/migrations/"
  echo "    is the reviewable record of it and must land too — the snapshot alone is not enough."
else
  printf '[check-schema-drift] OK — snapshot matches live (%s tables, %s columns, %s indexes, %s constraints, %s policies, %s functions).\n' \
    "$(grep -c '^table:' "$TMP/live")"      "$(grep -c '^column:' "$TMP/live")" \
    "$(grep -c '^index:' "$TMP/live")"      "$(grep -c '^constraint:' "$TMP/live")" \
    "$(grep -c '^policy:' "$TMP/live")"     "$(grep -c '^function:' "$TMP/live")"
fi
exit $status
