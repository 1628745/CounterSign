/**
 * Tool names available to the AP agent, identical in both modes (SPEC.md
 * section 7). Kept as a plain list here so other modules (events, UI) can
 * reference tool names without importing tool implementations.
 */
export const AGENT_TOOL_NAMES = [
  "list_inbox",
  "read_email",
  "get_vendor",
  "update_vendor_payment_details",
  "lookup_payment_history",
  "pay_invoice",
  "finish",
] as const;

export type AgentToolName = (typeof AGENT_TOOL_NAMES)[number];

/**
 * Builds the Vercel AI SDK v6 tool set for the agent. pay_invoice calls
 * src/lib/pipeline.submitPayment — never the signer directly (SPEC.md
 * section 14, #1).
 *
 * TODO(agent prompt): implement with `tool()` from the `ai` package + zod
 * schemas for each tool in AGENT_TOOL_NAMES.
 */
export function buildAgentTools(): Record<string, unknown> {
  throw new Error("TODO: implement buildAgentTools — see SPEC.md section 7");
}
