import { describe, expect, it } from "vitest";
import { evaluate } from "@/lib/countersign/policy";
import type { PolicyContext } from "@/lib/countersign/types";
import { ADDR, SCENARIOS } from "./fixtures/policyScenarios";

// SPEC.md section 14, non-negotiable #2: policy.evaluate is pure and
// deterministic; scenario tests cover E1-E8 (SPEC.md section 2, section 8).

describe("policy.evaluate scenarios (SPEC.md section 2)", () => {
  for (const scenario of SCENARIOS) {
    it(scenario.name, () => {
      const result = evaluate(scenario.intent, scenario.context);
      expect(result.decision).toBe(scenario.expectedDecision);
    });
  }

  it("E4 scores ~120 via payee_unverified + untrusted_provenance + lookalike_sender + recent_unverified_change + new_payee", () => {
    const e4 = SCENARIOS.find((s) => s.name.startsWith("E4"))!;
    const result = evaluate(e4.intent, e4.context);
    expect(result.score).toBe(120);
  });

  it("E5 (bait taken) hard-blocks via hidden_only_payee, not the score", () => {
    const e5 = SCENARIOS.find((s) => s.name.includes("bait taken"))!;
    const result = evaluate(e5.intent, e5.context);
    expect(result.hardBlockReasons.length).toBeGreaterThan(0);
    const hiddenOnly = result.signals.find((s) => s.key === "hidden_only_payee");
    expect(hiddenOnly?.fired).toBe(true);
  });

  it("E5 (bait ignored) scores ~25 via hidden_text alone", () => {
    const e5 = SCENARIOS.find((s) => s.name.includes("bait ignored"))!;
    const result = evaluate(e5.intent, e5.context);
    expect(result.score).toBe(25);
    expect(result.hardBlockReasons).toEqual([]);
  });

  it("E6 scores exactly 40 via amount_anomaly + velocity_spike", () => {
    const e6 = SCENARIOS.find((s) => s.name.startsWith("E6"))!;
    const result = evaluate(e6.intent, e6.context);
    expect(result.score).toBe(40);
  });

  it("E7 scores ~95 via payee_unverified + untrusted_provenance + new_payee + exec_impersonation + pressure_language + classifier_flag", () => {
    const e7 = SCENARIOS.find((s) => s.name.startsWith("E7"))!;
    const result = evaluate(e7.intent, e7.context);
    expect(result.score).toBe(95);
  });

  it("E8 hard-blocks via duplicate_invoice regardless of score", () => {
    const e8 = SCENARIOS.find((s) => s.name.startsWith("E8"))!;
    const result = evaluate(e8.intent, e8.context);
    expect(result.hardBlockReasons.length).toBeGreaterThan(0);
    expect(result.signals.find((s) => s.key === "duplicate_invoice")?.fired).toBe(true);
  });
});

describe("policy.evaluate edge cases (SPEC.md section 8)", () => {
  const chesapeakeVerified: PolicyContext = SCENARIOS.find((s) => s.name.startsWith("E1"))!.context;

  it("score of exactly 30 -> approval_required (not auto-pay)", () => {
    // Isolate lookalike_sender (+30) as the only firing signal: mark the
    // payee address as verified (so payee_unverified/untrusted_provenance
    // don't fire) and give it prior successful payments (so new_payee
    // doesn't fire either).
    const context: PolicyContext = {
      ...chesapeakeVerified,
      vendor: null,
      verifiedAddresses: [ADDR.attackerA],
      hasSuccessfulPaymentTo: { result: true, query: "hasSuccessfulPaymentTo" },
      provenance: { payeeAddress: ADDR.attackerA, hits: [{ source: "registry", visible: true, receivedAt: new Date("2025-01-01") }] },
      firstAppearanceLookalike: { isLookalike: true, imitates: "blueridgegreencoffee.com", technique: "tld-swap" },
    };
    const intent = { vendor: null, payeeAddress: ADDR.attackerA, amountMicros: 100_000_000n, invoiceNumber: null, sourceEmailId: "edge-30" };
    const result = evaluate(intent, context);
    expect(result.score).toBe(30);
    expect(result.decision).toBe("approval_required");
  });

  it("score of exactly 110 -> blocked (not approval_required)", () => {
    // payee_unverified(40) + untrusted_provenance(15) + lookalike_sender(30) + new_payee(10) + exec_impersonation(15) = 110
    const context: PolicyContext = {
      ...chesapeakeVerified,
      vendor: null,
      verifiedAddresses: [],
      provenance: {
        payeeAddress: ADDR.attackerB,
        hits: [{ source: "email", emailId: "edge-110", visible: true, offsetStart: 0, offsetEnd: 10, receivedAt: new Date("2026-01-01") }],
      },
      firstAppearanceLookalike: { isLookalike: true, imitates: "chesapeakedairy.com", technique: "edit-distance" },
      hasSuccessfulPaymentTo: { result: false, query: "hasSuccessfulPaymentTo" },
      execImpersonation: { fired: true, claimedName: "Dana Whitfield", senderDomain: "example.com" },
    };
    const intent = { vendor: null, payeeAddress: ADDR.attackerB, amountMicros: 100_000_000n, invoiceNumber: null, sourceEmailId: "edge-110" };
    const result = evaluate(intent, context);
    expect(result.score).toBe(110);
    expect(result.decision).toBe("blocked");
  });

  it("verified payee with hidden text elsewhere in the email -> auto-pay with a warning (score 25, no hard block)", () => {
    const context: PolicyContext = {
      ...chesapeakeVerified,
      sourceEmail: { ...chesapeakeVerified.sourceEmail!, hiddenSpans: [{ offsetStart: 0, offsetEnd: 5 }] },
    };
    const intent = SCENARIOS.find((s) => s.name.startsWith("E1"))!.intent;
    const result = evaluate(intent, context);
    expect(result.decision).toBe("auto_pay");
    expect(result.score).toBe(25);
    expect(result.signals.find((s) => s.key === "hidden_text")?.fired).toBe(true);
  });
});
