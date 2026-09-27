/**
 * Quarantined LLM classifier: sees only the raw email (no tools, no other
 * context) and rates fraud likelihood 0-1. Feeds the classifier_flag signal
 * (+10 if >= 0.7). Result is cached per email id (SPEC.md section 8).
 * Uses CLASSIFIER_MODEL, not AGENT_MODEL.
 *
 * TODO(policy prompt): implement with @ai-sdk/anthropic + ai generateObject.
 */
export async function classifyFraudLikelihood(emailId: string, html: string): Promise<number> {
  void emailId;
  void html;
  throw new Error("TODO: implement classifyFraudLikelihood — see SPEC.md section 8");
}
