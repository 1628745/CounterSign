import type { Mode } from "@/lib/pipeline";

/**
 * The accounts-payable agent (Vercel AI SDK v6 + Anthropic, AGENT_MODEL,
 * temperature 0, step limit ~40). See SPEC.md section 7 for the system
 * prompt and tool list.
 *
 * IMPORTANT (SPEC.md section 14, non-negotiable #1): this module, and
 * everything under src/lib/agent/**, must never import
 * src/lib/solana/signer and must never read a *_SECRET_KEY env var.
 * Enforced by the no-restricted-imports/no-restricted-syntax rule in
 * eslint.config.mjs and by tests/agent-isolation.test.ts.
 *
 * TODO(agent prompt): implement using ai.generateText / streamText with
 * buildAgentTools() from ./tools, writing an agent_events row per tool
 * call/result (write-then-show, non-negotiable #3).
 */
export interface RunAgentOptions {
  mode: Mode;
  pack: string;
  runId: string;
}

export async function runAgent(options: RunAgentOptions): Promise<void> {
  void options;
  throw new Error("TODO: implement runAgent — see SPEC.md section 7");
}
