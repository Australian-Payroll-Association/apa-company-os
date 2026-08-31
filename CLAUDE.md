# Operating instructions for this repo

You are setting up a Next.js + Supabase + Vercel operations platform for the
person who just handed you this repo. **`README.md` is the runbook — follow it
top to bottom.** This file is the contract for *how* to work through it.

## Your job

Take the operator from a bare repo to a working production URL, then hand them
the URL. They should not need to research anything, install anything, or read
the code. Assume they know what they want but not how any of this fits
together.

## Install anything that is missing. Do not ask permission first.

If a tool the runbook needs is absent, install it and carry on. Report what you
installed at the end, not as a question up front.

| Missing | macOS | Linux |
|---|---|---|
| Node 20+ | `brew install node@20` | `curl -fsSL https://deb.nodesource.com/setup_20.x \| sudo -E bash - && sudo apt-get install -y nodejs` |
| `gh` | `brew install gh` | `sudo apt-get install -y gh` |
| `vercel` | `npm install -g vercel` | same |
| `supabase` | `npm install -g supabase` | same |
| `psql` / `pg_dump` | `brew install libpq` then use `/opt/homebrew/opt/libpq/bin/psql` | `sudo apt-get install -y postgresql-client` |

Notes that will save you time:

- **`psql` from `libpq` is not symlinked into PATH by Homebrew.** Call it by
  absolute path, or `brew link --force libpq`. Do not conclude it failed to
  install.
- **Do not use `supabase db dump` or `supabase start`.** Both shell out to
  Docker and fail with *"failed to run docker"* on a machine without Docker
  Desktop. Nothing in this runbook needs Docker — use `psql` directly.
- If `npm install` fails on peer dependencies, report the actual error. Do not
  add `--force` or `--legacy-peer-deps` to make it pass.

## Ask the operator for these, at the point you need them

Ask in plain language, one at a time, and explain what each is for. Do not
batch them into a wall of questions at the start, and do not proceed with a
placeholder.

1. **A project name** (Step 1). Used for the Supabase project, the Vercel
   project and the forked repo. Do not invent one.
2. **Which optional integrations they want** (Step 4). Email, payments, and
   image generation each need a key. Ask once, accept "none", and skip the
   corresponding variables — the app is built to run without them.
3. **Their admin email address** (Step 5). This becomes the first admin
   account. It must be an address they can receive mail at.
4. **Their Anthropic API key** — but see the rule below. You do **not** collect
   this one.

## Credential rules — these are not negotiable

- **Never ask the operator to paste an API key, token, or password into the
  chat.** Secrets belong in Vercel's encrypted environment settings or in a
  gitignored `.env.local`, entered by their owner.
- **The Anthropic API key is theirs to enter.** Step 8 gives them
  click-by-click instructions for adding it in the Vercel dashboard and
  redeploying. Follow that step as written. Do not offer to do it for them,
  and do not ask them to send you the key so you can set it.
- **Generate the Supabase database password yourself** (`openssl rand -base64
  24`), use it, and then tell them the value once and instruct them to save it
  in their password manager. They will need it for `psql` later and there is no
  way to recover it.
- **Generate `CRON_SECRET` yourself** (`openssl rand -hex 32`). It is not a
  credential they need to know.
- Never commit any of these. `.env.local` is gitignored — keep it that way.

## Hard rules about the database

- Apply `supabase/00-prereqs.sql` **then** `supabase/01-schema.sql`. That
  order is load-bearing; the README explains why.
- **Never use `supabase/migrations/` to build the database.** It is incomplete
  — 94 of 136 tables, 7 of 325 row-level-security policies. It exists for
  history, not for setup. An agent that runs the migrations and reports success
  has not set this up.
- **Never reconstruct missing schema** from `information_schema` queries or by
  reading the application code. Custom types, 325 policies, foreign keys,
  grants and three purpose-built Postgres roles do not survive that, and the
  result fails at runtime in ways that are very hard to trace.
- If `supabase/01-schema.sql` is absent from this repo, **stop and say so.** Do
  not improvise a substitute.

## When you are done

1. Give them the production URL. That is the deliverable.
2. Walk them through Step 8 — adding their Anthropic key and redeploying.
3. List what you installed, what you created (Supabase project, Vercel
   project, forked repo), and the database password they must save.
4. Say plainly what is **not** working and why — any optional integration they
   declined, and the AI features until their key is in.

Do not report success on a green build alone. Step 7 has the checks that
matter. In particular: if `/admin` renders while signed out, treat that as a
security problem and stop rather than working around it.
