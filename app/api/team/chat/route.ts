// Team portal assistant: streaming, read-only tool-use agent loop.
//
// The client POSTs the full messages array (echoed back from the previous turn's
// `done` event, plus the new user turn) — the server is stateless. SSE events:
// {type: "text" | "tool" | "error" | "done"}. `done` carries the updated messages
// array for the client to echo next turn.
//
// This assistant is answer-only. Its single tool, query_database, executes
// immediately under the restricted team_chatbot_reader role (lib/team-chat/db.ts),
// whose grants are the hard boundary on what staff can see. There are no write,
// email, or approval paths here — that surface exists only in the admin assistant.

import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { getTeamActor } from "@/lib/team-auth";
import { runReadOnlyQuery } from "@/lib/team-chat/db";
import { chatbotTools } from "@/lib/team-chat/tools";
import { buildSystemPrompt } from "@/lib/team-chat/system-prompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Multi-query loops can run past 60s; requires Vercel fluid compute.
export const maxDuration = 300;

const MODEL = process.env.CHATBOT_MODEL ?? "claude-opus-4-8";
const MAX_ITERATIONS = 8;
const MAX_MESSAGES = 24;

type SseEvent =
  | { type: "text"; text: string }
  | { type: "tool"; name: string; detail: string }
  | { type: "error"; error: string }
  | { type: "done"; messages: Anthropic.MessageParam[] };

// Cap the payload the client echoes back: blank out tool_result contents in all
// but the last few messages (the model rarely needs old query rows), and drop
// whole turns from the front once the array gets long — always cutting to a
// plain user turn so tool_use/tool_result pairing stays intact.
function trimMessages(messages: Anthropic.MessageParam[]): Anthropic.MessageParam[] {
  const KEEP_RECENT = 6;
  const out: Anthropic.MessageParam[] = messages.map((m, i) => {
    if (m.role !== "user" || !Array.isArray(m.content)) return m;
    if (i >= messages.length - KEEP_RECENT) return m;
    return {
      ...m,
      content: m.content.map((block) =>
        block.type === "tool_result"
          ? { ...block, content: "[old query results omitted]" }
          : block,
      ),
    };
  });

  if (out.length <= MAX_MESSAGES) return out;
  for (let i = out.length - MAX_MESSAGES; i < out.length; i++) {
    const m = out[i];
    const isPlainUser =
      m.role === "user" &&
      (typeof m.content === "string" ||
        (Array.isArray(m.content) && m.content.every((b) => b.type === "text")));
    if (isPlainUser) return out.slice(i);
  }
  return out;
}

export async function POST(request: NextRequest) {
  const { actor } = await getTeamActor();
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "The assistant is not configured (missing API key)" },
      { status: 503 },
    );
  }

  let body: { messages?: Anthropic.MessageParam[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const messages = Array.isArray(body.messages) ? [...body.messages] : null;
  if (!messages?.length) {
    return NextResponse.json({ error: "messages is required" }, { status: 400 });
  }

  const tools = chatbotTools();
  const system = buildSystemPrompt({ userName: actor.displayName });
  const client = new Anthropic();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: SseEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        for (let i = 0; i < MAX_ITERATIONS; i++) {
          const msgStream = client.messages.stream({
            model: MODEL,
            max_tokens: 4096,
            thinking: { type: "adaptive" },
            system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
            tools,
            messages,
          });
          msgStream.on("text", (delta) => send({ type: "text", text: delta }));
          const msg = await msgStream.finalMessage();

          messages.push({ role: "assistant", content: msg.content });
          if (msg.stop_reason !== "tool_use") break;

          const toolUses = msg.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
          );

          const results: Anthropic.ToolResultBlockParam[] = [];
          for (const tu of toolUses) {
            const input = tu.input as Record<string, unknown>;
            if (tu.name === "query_database") {
              const sql = typeof input.sql === "string" ? input.sql : "";
              send({
                type: "tool",
                name: "query_database",
                detail: sql.replace(/\s+/g, " ").slice(0, 120),
              });
              const res = await runReadOnlyQuery(sql);
              results.push({
                type: "tool_result",
                tool_use_id: tu.id,
                content: res.ok
                  ? JSON.stringify({
                      rows: res.rows,
                      rowCount: res.rowCount,
                      ...(res.truncated ? { note: "truncated at 200 rows" } : {}),
                    })
                  : res.error,
                is_error: !res.ok,
              });
            } else {
              results.push({
                type: "tool_result",
                tool_use_id: tu.id,
                content: `Unknown tool: ${tu.name}`,
                is_error: true,
              });
            }
          }

          messages.push({ role: "user", content: results });
        }

        send({ type: "done", messages: trimMessages(messages) });
      } catch (err) {
        console.error("team chat route:", err);
        send({
          type: "error",
          error:
            err instanceof Anthropic.APIError
              ? `The assistant hit an API error (${err.status ?? "network"}). Try again.`
              : "The assistant hit an unexpected error. Try again.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
