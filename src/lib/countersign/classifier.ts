import { z } from "zod";
import { getCachedClassification, setCachedClassification } from "@/lib/db/queries/classifier";

export const ClassificationSchema = z.object({
  fraud_likelihood: z.number().min(0).max(1),
  cues: z.array(z.string()),
});
export type Classification = z.infer<typeof ClassificationSchema>;

const SYSTEM_PROMPT =
  "You are a fraud-detection classifier for an accounts-payable inbox. You see exactly one email, in isolation, with no other context and no tools. Rate how likely this email is to be a fraud or social-engineering attempt (e.g. a fake invoice, a payee/wallet change request, urgency or secrecy pressure, impersonation of an executive). Respond with fraud_likelihood between 0 and 1, and a short list of the specific cues that informed your rating.";

/**
 * Quarantined LLM classifier: sees only the raw email (no tools, no other
 * context) and rates fraud likelihood 0-1. Feeds the classifier_flag signal
 * (+10 if >= 0.7). Result is cached per email id (SPEC.md section 8).
 * Uses CLASSIFIER_MODEL, not AGENT_MODEL.
 */
export async function classifyFraudLikelihood(emailId: string, html: string): Promise<Classification> {
  const cached = await getCachedClassification(emailId);
  if (cached) {
    return { fraud_likelihood: cached.fraudLikelihood, cues: cached.cues };
  }

  const model = process.env.CLASSIFIER_MODEL;
  if (!model) {
    throw new Error("CLASSIFIER_MODEL is not set — see .env.example (SPEC.md section 13)");
  }

  const { generateObject } = await import("ai");
  const { anthropic } = await import("@ai-sdk/anthropic");

  const { object } = await generateObject({
    model: anthropic(model),
    schema: ClassificationSchema,
    system: SYSTEM_PROMPT,
    prompt: html,
    temperature: 0,
  });

  await setCachedClassification(emailId, { fraudLikelihood: object.fraud_likelihood, cues: object.cues, model });
  return object;
}
