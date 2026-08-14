---
name: publish-doc
description: Publish an HTML document into the private workflows library at edge8.ai/workflows/private/e8. Use when the operator says "publish this", "put this on edge8", "share this with the team", or hands over an HTML file to be given a link. Uploads to Supabase Storage; no commit, no deploy.
---

# Publish a document

Documents live in Supabase Storage, not in this repo. Publishing is an upload, so it takes seconds and never triggers a build. Republishing the same slug overwrites it, so the link the team already has keeps working and always shows the current version.

## The one command

```bash
node scripts/docs/publish.mjs ~/code-projects/edge8-docs/<file>.html
```

The filename is the slug: `stack-governance.html` becomes `https://www.edge8.ai/workflows/private/e8/stack-governance`. Override with `--slug <slug>`. The `<title>` tag becomes the name shown in the index at `/docs`.

Test against a preview deployment first with `--base https://<preview-url>` when the route itself has changed.

## Where things live

| What | Where |
|---|---|
| The operator's working copies | `~/code-projects/edge8-docs/` (a plain folder, not a repo) |
| The published file | Supabase Storage, private bucket `documents`, as `<slug>.html` |
| The link | `https://www.edge8.ai/workflows/private/e8/<slug>` |
| The index | `https://www.edge8.ai/workflows/private/e8`, the private workflows library, which lists published documents automatically |

## Rules

- Documents must be self-contained HTML: everything inline, no external requests. There is no asset pipeline here.
- Never publish a document containing credentials, client PII, or anything that would be damaging if the access code leaked. The gate is a speed bump, not a security boundary: the code ships in the client bundle, exactly as it does for the private workflows library.
- Keep one slug per document forever. A new slug means a new link the team has to be told about, which is the problem this replaces.
- Do not add published documents to the repo. If a file needs to be in git, it belongs somewhere else.

## Setup (once per machine)

`DOCS_PUBLISH_TOKEN` must be readable by the script, either in the environment or as a line in `~/.claude/.env`. It must match the value set in the Vercel project. Ask the operator for it; never invent one, and never commit it.
