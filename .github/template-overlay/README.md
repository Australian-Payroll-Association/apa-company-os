# Claude API building blocks for Next.js

Two small modules that fix the things every Anthropic integration gets wrong the
first time. Extracted from a production Next.js 14 + Vercel app running ~20
Claude call sites.

This repo is generated. It is published from a private application repo by an
allowlist sync, so it carries no application history — see *Provenance* below.

## What's here

### `lib/ai/response.ts` — read the response properly

The bug this prevents: `stop_reason: "max_tokens"` is almost never checked. When
a structured-output call gets truncated, the JSON is invalid, and the bare
`JSON.parse` downstream throws a `SyntaxError` that looks exactly like an API
outage. You go looking for a network problem; the actual fix is a bigger
`max_tokens`.

```ts
const out = readTextOutput("resume-screen", MODEL, response);
if (!out.ok) return markFailed(id, out.error);
const parsed = JSON.parse(out.text);
```

`readTextOutput` logs usage, rejects `refusal` and `max_tokens` with a message
that names the cause, and hands back text only when there is text. Callers keep
their own failure contract — it returns a discriminated union, it does not throw
and does not decide how you record errors.

It also emits one greppable line per call:

```
[ai-usage] site=admin-chat model=claude-sonnet-5 in=412 out=380 cache_read=8934 cache_write=0
```

`response.usage` is the most commonly ignored field in the whole API. Without it
you cannot attribute cost to a feature, and you cannot tell whether your prompt
caching is working. `cache_read` is the number to watch.

### `lib/ai/cache.ts` — cache the conversation, not just the system prompt

Most agent loops put one `cache_control` breakpoint on `system`, which caches
tools + system and nothing else. Every tool iteration then re-sends the entire
accumulated message history at full input price — up to N times per user turn.

```ts
const stream = client.messages.stream({
  model,
  system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
  tools,
  messages: withHistoryCache(messages),
});
```

`withHistoryCache` puts breakpoints on the last two cacheable turns. Two, not
one: the newest turn is still being written to cache when the next request goes
out, so the second breakpoint gives that request an older boundary it can
actually read from. With `system` that is 3 of the API's 4 permitted
breakpoints.

It returns a copy. Marking the live array would accumulate a new breakpoint
every iteration and blow the limit inside a single turn. Thinking blocks are
never marked — they do not accept `cache_control`.

## Requirements

- Node 20+, Next.js 14+ (App Router), TypeScript 5
- `@anthropic-ai/sdk` ^0.111.0
- `ANTHROPIC_API_KEY` in the environment

Both files are dependency-free beyond the SDK's types. Copy them in; there is no
package to install.

## Provenance

Published by an allowlist sync from a private repo: only explicitly listed paths
are copied, the tree is re-scanned for credentials and personal data before every
push, and each publish is a single squashed commit. No upstream history, no
branches, no application code beyond what is listed above.

Pull requests here are overwritten by the next sync. Open an issue instead.

## License

MIT — see [LICENSE](LICENSE).
