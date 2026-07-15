// Server-only. Anthropic tool definitions for the admin database assistant.
// Read-only v1: the only tool is query_database, which runs a single SELECT
// through the restricted chatbot_reader role (lib/admin-chat/db.ts).

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

export function chatbotTools(): Anthropic.Tool[] {
  return [QUERY_TOOL];
}
