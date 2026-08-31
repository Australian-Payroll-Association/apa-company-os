#!/usr/bin/env bash
#
# Build the public template tree from the allowlist, then refuse to hand it back
# if anything sensitive made it in.
#
#   usage: build-template.sh <output-dir>
#
# Two independent gates, in this order:
#
#   1. THE ALLOWLIST decides what is copied. Deny by default — a path that is
#      not named in .github/template-allowlist.txt is never read.
#   2. THE SCANNER decides whether the result may be published. It re-reads the
#      staged tree from scratch and fails the build on anything credential- or
#      person-shaped, no matter how it got there.
#
# Gate 2 exists because gate 1 is a human artefact. Someone adds `lib/` to the
# allowlist in a hurry, or a secret lands in an already-allowlisted file, and
# the allowlist alone would happily publish it. The scanner has no opinion about
# intent; it only ever fails closed.
#
# Runs identically in CI and locally, so the publish can be dry-run before it is
# ever wired to a remote:
#
#   .github/scripts/build-template.sh /tmp/template-preview
#
set -euo pipefail

OUT="${1:?usage: build-template.sh <output-dir>}"
ROOT="$(git rev-parse --show-toplevel)"
ALLOWLIST="$ROOT/.github/template-allowlist.txt"
OVERLAY="$ROOT/.github/template-overlay"

[ -f "$ALLOWLIST" ] || { echo "::error::missing $ALLOWLIST"; exit 1; }

rm -rf "$OUT"
mkdir -p "$OUT"

# ── 1. Copy allowlisted paths ────────────────────────────────────────────────
copied=0
missing=0
while IFS= read -r line || [ -n "$line" ]; do
  # strip comments and surrounding whitespace
  path="${line%%#*}"
  path="$(printf '%s' "$path" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  [ -z "$path" ] && continue

  # Reject anything that could escape the repo root.
  case "$path" in
    /*|*..*) echo "::error::allowlist entry must be a relative in-repo path: $path"; exit 1 ;;
  esac

  src="$ROOT/$path"
  if [ -d "$src" ]; then
    mkdir -p "$OUT/$path"
    # -a preserves structure; the trailing slashes copy contents, not the dir.
    cp -a "$src/." "$OUT/$path/"
    copied=$((copied + 1))
  elif [ -f "$src" ]; then
    mkdir -p "$OUT/$(dirname "$path")"
    cp -a "$src" "$OUT/$path"
    copied=$((copied + 1))
  else
    echo "::warning::allowlisted path does not exist, skipping: $path"
    missing=$((missing + 1))
  fi
done < "$ALLOWLIST"

if [ "$copied" -eq 0 ]; then
  echo "::error::allowlist produced an empty tree; refusing to publish nothing over an existing repo."
  exit 1
fi

# ── 2. Overlay template-only files (README, LICENSE, .env.example, ...) ──────
# These live in the source repo but belong only to the template, so they are
# kept out of the app's root.
if [ -d "$OVERLAY" ]; then
  cp -a "$OVERLAY/." "$OUT/"
fi

# Never publish VCS metadata or local build output, whatever the allowlist says.
find "$OUT" \( -name '.git' -o -name 'node_modules' -o -name '.next' \
            -o -name '.env' -o -name '.env.*' -o -name '*.tsbuildinfo' \) \
     -prune -exec rm -rf {} + 2>/dev/null || true
# .env.example is legitimate template material; restore it from the overlay.
[ -f "$OVERLAY/.env.example" ] && cp -a "$OVERLAY/.env.example" "$OUT/.env.example"

# ── 3. Scan the staged tree. Fail closed. ───────────────────────────────────
# Each rule is "name<TAB>regex". Anything matching stops the publish.
fail=0
scan() {
  local label="$1" pattern="$2" hits
  hits="$(grep -rInE "$pattern" "$OUT" 2>/dev/null | head -5 || true)"
  if [ -n "$hits" ]; then
    echo "::error::BLOCKED — $label found in the staged template tree:"
    printf '%s\n' "$hits" | sed "s#$OUT/#  #" >&2
    fail=1
  fi
}

# Credentials
scan "Anthropic API key"    'sk-ant-[A-Za-z0-9_-]{20}'
scan "OpenRouter API key"   'sk-or-v1-[A-Za-z0-9]{20}'
scan "OpenAI API key"       'sk-proj-[A-Za-z0-9_-]{20}'
scan "Stripe live key"      '(sk|rk)_live_[A-Za-z0-9]{20}'
scan "Stripe webhook secret" 'whsec_[A-Za-z0-9]{20}'
scan "Resend API key"       're_[A-Za-z0-9]{20,}'
scan "GitHub token"         '(ghp_[A-Za-z0-9]{30}|github_pat_[A-Za-z0-9_]{30})'
scan "JWT / Supabase key"   'eyJhbGciOi[A-Za-z0-9._-]{30}'
scan "Postgres URL with password" 'postgres(ql)?://[^:[:space:]]+:[^@[:space:]]+@'
scan "private key block"    'BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY'

# Personal data — the risk that actually blocked this repo from publishing.
scan "internal email address" '[A-Za-z0-9._%+-]+@edge8\.ai'
scan "coaching private tier"  '(privateSummary|sharedSummary|private_profile_markdown|summary_markdown)'
scan "personality profiling"  '(openness|conscientiousness|extraversion|agreeableness|neuroticism)[[:space:]]*:'
scan "compensation data"      '(salary_expectation|ai_salary|compensation_sensitive|candidate_sensitive)'
scan "transcript content"     '(transcript|call_transcripts)[[:space:]]*:[[:space:]]*[`"]'

if [ "$fail" -ne 0 ]; then
  echo "::error::Template publish blocked by the content scanner. Either the allowlist is too broad, or sensitive content landed in an allowlisted file. Nothing was pushed."
  exit 1
fi

files=$(find "$OUT" -type f | wc -l | tr -d ' ')
echo "Template tree built: ${files} files from ${copied} allowlist entries (${missing} missing)."
