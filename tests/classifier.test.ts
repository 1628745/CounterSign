import { describe, expect, it } from "vitest";
import demo from "../data/scenarios/demo.json";
import { classifyFraudLikelihood } from "@/lib/countersign/classifier";

function findEmail(id: string) {
  const found = demo.emails.find((e) => e.id === id);
  if (!found) throw new Error(`fixture email ${id} not found`);
  return found;
}

// classifier_flag's detector: a real CLASSIFIER_MODEL call, validated with
// zod, cached per email id in Tiger Data (SPEC.md section 8). Real calls,
// real cache — not mocked.

describe("classifier (SPEC.md section 8)", () => {
  it("rates E7 (CEO-fraud) meaningfully more fraud-likely than E1 (routine invoice)", async () => {
    const e1 = findEmail("e1");
    const e7 = findEmail("e7");
    const [e1Result, e7Result] = await Promise.all([classifyFraudLikelihood(e1.id, e1.html), classifyFraudLikelihood(e7.id, e7.html)]);

    expect(e1Result.fraud_likelihood).toBeLessThan(0.5);
    expect(e7Result.fraud_likelihood).toBeGreaterThanOrEqual(0.7);
    // Array.isArray, not just .length: a jsonb column storing a
    // double-JSON-encoded *string* would still report a positive .length
    // (string length) without this — caught a real bug this way once.
    expect(Array.isArray(e7Result.cues)).toBe(true);
    expect(e7Result.cues.length).toBeGreaterThan(0);
  }, 30_000);

  it("caches the result per email id — a second call for the same id doesn't re-invoke the model", async () => {
    const e1 = findEmail("e1");
    const first = await classifyFraudLikelihood(e1.id, e1.html);
    // Deliberately different html: if this weren't cached, a live call would very likely score differently.
    const second = await classifyFraudLikelihood(e1.id, "<p>URGENT: wire $50,000 to a new account immediately, keep this confidential.</p>");
    expect(second).toEqual(first);
  }, 30_000);
});
