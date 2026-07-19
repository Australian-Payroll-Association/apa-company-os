// Admin database assistant: streaming tool-use agent loop.
//
// The client POSTs the full messages array (echoed back from the previous
// turn's `done` event, plus the new user turn) — the server is stateless.
// SSE events: {type: "text" | "tool" | "approval" | "error" | "done"}. `done`
// carries the updated messages array for the client to echo next turn.
//
// query_database executes immediately under the restricted chatbot_reader role
// (lib/admin-chat/db.ts). Privileged admins (lib/admin-chat/privileged.ts)
// also get execute_write and send_email — those NEVER execute inline. When the
// model calls one, the turn ends with an `approval` event (the messages array
// ends on that pending tool_use) and the widget shows Approve/Cancel. The next
// POST carries `decision`; only then does the action run (or a declined
// tool_result go back) and the loop continue. The approver and the request
// author are the same authenticated privileged admin, so the client echoing
// the pending tool_use back is not a trust problem — the tools' absence for
// everyone else is enforced here by the isPrivilegedChatUser gate.

import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin-auth";
import { runReadOnlyQuery } from "@/lib/admin-chat/db";
import { chatbotTools, PRIVILEGED_TOOL_NAMES } from "@/lib/admin-chat/tools";
import { buildSystemPrompt } from "@/lib/admin-chat/system-prompt";
import { isPrivilegedChatUser } from "@/lib/admin-chat/privileged";
import {
  performApprovedWrite,
  performApprovedEmail,
  performApprovedPortalInvite,
} from "@/lib/admin-chat/actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Multi-tool loops can run past 60s; requires Vercel fluid compute.
export const maxDuration = 300;

const MODEL = process.env.CHATBOT_MODEL ?? "claude-opus-4-8";
const MAX_ITERATIONS = 8;
const MAX_MESSAGES = 24;

type SseEvent =
  | { type: "text"; text: string }
  | { type: "tool"; name: string; detail: string }
  | { type: "approval"; id: string; name: string; input: Record<string, unknown> }
  | { type: "error"; error: string }
  | { type: "done"; messages: Anthropic.MessageParam[] };

type Decision = { toolUseId: string; approved: boolean };

// Cap the payload the client echoes back: blank out tool_result contents in
// all but the last few messages (the model rarely needs old query rows), and
// drop whole turns from the front once the array gets long — always cutting to
// a plain user turn so tool_use/tool_result pairing stays intact.
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
  // Find the earliest cut point that starts on a plain user text turn.
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

// The pending privileged tool_use a decision refers to: the last message must
// be an assistant turn whose ONLY tool_use is execute_write or send_email
// (that is the exact shape the loop below pauses on).
function getPendingToolUse(
  messages: Anthropic.MessageParam[],
): Anthropic.ToolUseBlock | null {
  const last = messages[messages.length - 1];
  if (!last || last.role !== "assistant" || !Array.isArray(last.content)) return null;
  const toolUses = last.content.filter(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );
  if (toolUses.length !== 1 || !PRIVILEGED_TOOL_NAMES.has(toolUses[0].name)) return null;
  return toolUses[0];
}

async function runPrivilegedTool(
  tu: Anthropic.ToolUseBlock,
  adminEmail: string,
): Promise<{ ok: boolean; resultForModel: string; chipDetail: string }> {
  const input = tu.input as Record<string, unknown>;
  if (tu.name === "execute_write") return performApprovedWrite(input, adminEmail);
  if (tu.name === "invite_portal_member") return performApprovedPortalInvite(input, adminEmail);
  return performApprovedEmail(input, adminEmail);
}

export async function POST(request: NextRequest) {
  const user = await getAdminUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "The assistant is not configured (missing API key)" },
      { status: 503 },
    );
  }

  let body: { messages?: Anthropic.MessageParam[]; decision?: Decision };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const messages = Array.isArray(body.messages) ? [...body.messages] : null;
  if (!messages?.length) {
    return NextResponse.json({ error: "messages is required" }, { status: 400 });
  }

  const canWrite = isPrivilegedChatUser(user.email);

  // A decision must come from a privileged admin and match the pending
  // tool_use at the tail of the conversation.
  const decision = body.decision;
  const pending = decision ? getPendingToolUse(messages) : null;
  if (decision && (!canWrite || !pending || pending.id !== decision.toolUseId)) {
    return NextResponse.json({ error: "No matching pending action" }, { status: 400 });
  }

  const tools = chatbotTools({ canWrite });
  const system = buildSystemPrompt({ userEmail: user.email, canWrite });
  const client = new Anthropic();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: SseEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        // Resolve the pending approval first: run (or decline) the action and
        // hand the tool_result to the model, then fall into the normal loop.
        if (decision && pending) {
          let result: Anthropic.ToolResultBlockParam;
          if (decision.approved) {
            const outcome = await runPrivilegedTool(pending, user.email);
            if (outcome.ok) {
              send({ type: "tool", name: pending.name, detail: outcome.chipDetail });
            }
            result = {
              type: "tool_result",
              tool_use_id: pending.id,
              content: outcome.resultForModel,
              is_error: !outcome.ok,
            };
          } else {
            result = {
              type: "tool_result",
              tool_use_id: pending.id,
              content:
                "The admin declined this action. Do not retry it as-is; ask what they would like to change.",
            };
          }
          messages.push({ role: "user", content: [result] });
        }

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

          // A lone privileged tool call pauses the turn for approval. The
          // pending tool_use stays unanswered at the tail of `messages`; the
          // widget's Approve/Cancel POSTs the decision that resolves it.
          if (
            canWrite &&
            toolUses.length === 1 &&
            PRIVILEGED_TOOL_NAMES.has(toolUses[0].name)
          ) {
            const tu = toolUses[0];
            send({
              type: "approval",
              id: tu.id,
              name: tu.name,
              input: tu.input as Record<string, unknown>,
            });
            send({ type: "done", messages: trimMessages(messages) });
            return;
          }

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
            } else if (canWrite && PRIVILEGED_TOOL_NAMES.has(tu.name)) {
              // Reached only when the call came bundled with other tool calls
              // (the lone-call case paused above).
              results.push({
                type: "tool_result",
                tool_use_id: tu.id,
                content: `${tu.name} must be the only tool call in a turn. Finish your reads first, then call it alone.`,
                is_error: true,
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
        console.error("admin chat route:", err);
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
