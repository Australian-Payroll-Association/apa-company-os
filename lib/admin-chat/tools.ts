// Server-only. Anthropic tool definitions for the admin database assistant.
// Every admin gets query_database (read-only, chatbot_reader role). Privileged
// admins (lib/admin-chat/privileged.ts) also get execute_write and send_email;
// both pause for an explicit Approve click in the chat UI before anything runs
// (app/api/admin/chat/route.ts).

import type Anthropic from "@anthropic-ai/sdk";

export const QUERY_TOOL: Anthropic.Tool = {
  name: "query_database",
  description:
    "Run a single read-only SQL SELECT against the Edge8 Company OS database " +
    "(schema company_os). Use this for every question about business data — " +
    "contacts, deals, leads, invoices, expenses, hiring, staff, time off, " +
    "events, surveys. Also use it to introspect information_schema.columns when " +
    "you are unsure of a table's columns. Results are capped at 200 rows; add " +
    "ORDER BY and LIMIT, and aggregate in SQL for counts and sums.",
  input_schema: {
    type: "object",
    properties: {
      sql: {
        type: "string",
        description: "One SELECT (or WITH) statement. No semicolons.",
      },
    },
    required: ["sql"],
  },
};

export const WRITE_TOOL: Anthropic.Tool = {
  name: "execute_write",
  description:
    "Propose a single INSERT or UPDATE against company_os. The statement is " +
    "shown to the admin, who must approve it before it runs — so first agree " +
    "the change in conversation, and SELECT the target rows to verify ids " +
    "before proposing an UPDATE. UPDATE must have a WHERE clause. There is no " +
    "DELETE: archive rows by setting archived_at. Add RETURNING id (or the " +
    "changed columns) so you can report exactly what changed. Call this tool " +
    "on its own, never alongside other tool calls.",
  input_schema: {
    type: "object",
    properties: {
      sql: {
        type: "string",
        description: "One INSERT or UPDATE statement. No semicolons, no DELETE.",
      },
    },
    required: ["sql"],
  },
};

export const EMAIL_TOOL: Anthropic.Tool = {
  name: "send_email",
  description:
    "Send an email to one recipient from notifications@edge8.ai (replies go to " +
    "the admin). The full email is shown to the admin, who must approve it " +
    "before it sends — draft it in conversation first. Plain text only: blank " +
    "lines separate paragraphs. One recipient per call, no bulk sends; look " +
    "the address up in the database rather than guessing it. Sent emails are " +
    "logged to interactions. Call this tool on its own, never alongside other " +
    "tool calls.",
  input_schema: {
    type: "object",
    properties: {
      to: { type: "string", description: "Recipient email address (exactly one)." },
      subject: { type: "string", description: "Subject line." },
      body: {
        type: "string",
        description:
          "Plain-text body. Blank lines separate paragraphs. Include the greeting and sign-off.",
      },
    },
    required: ["to", "subject", "body"],
  },
};

export const PRIVILEGED_TOOL_NAMES = new Set([WRITE_TOOL.name, EMAIL_TOOL.name]);

export function chatbotTools(opts: { canWrite: boolean }): Anthropic.Tool[] {
  return opts.canWrite ? [QUERY_TOOL, WRITE_TOOL, EMAIL_TOOL] : [QUERY_TOOL];
}
