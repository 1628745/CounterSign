import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { insertPayment } from "@/lib/db/queries/payments";
import { executePayment } from "@/lib/solana/signer";

// A syntactically valid base58 address that isn't one of our real demo
// wallets — fine here since every one of these tests must refuse *before*
// ever building a transaction.
const DUMMY_ADDRESS = "11111111111111111111111111111111111111111";

// SPEC.md section 6 + this prompt's task 7: executePayment refuses anything
// section 6 doesn't allow.

describe("signer.executePayment hardening (SPEC.md section 6)", () => {
  it("refuses a blocked payment", async () => {
    const paymentId = await insertPayment({
      runId: randomUUID(),
      mode: "guarded",
      vendorId: null,
      payeeAddress: DUMMY_ADDRESS,
      amountMicros: 1_000_000n,
      invoiceNumber: null,
      sourceEmailId: "test-signer-blocked",
      decision: "blocked",
    });
    await expect(executePayment(paymentId)).rejects.toThrow(/Refusing to pay/);
  });

  it("refuses a payment still in approval_pending", async () => {
    const paymentId = await insertPayment({
      runId: randomUUID(),
      mode: "guarded",
      vendorId: null,
      payeeAddress: DUMMY_ADDRESS,
      amountMicros: 1_000_000n,
      invoiceNumber: null,
      sourceEmailId: "test-signer-pending",
      decision: "approval_pending",
    });
    await expect(executePayment(paymentId)).rejects.toThrow(/Refusing to pay/);
  });

  it("refuses a payment marked approved without a stored, verified approval record", async () => {
    const paymentId = await insertPayment({
      runId: randomUUID(),
      mode: "guarded",
      vendorId: null,
      payeeAddress: DUMMY_ADDRESS,
      amountMicros: 1_000_000n,
      invoiceNumber: null,
      sourceEmailId: "test-signer-approved-no-record",
      decision: "approved",
    });
    await expect(executePayment(paymentId)).rejects.toThrow(/no stored, verified approval record/);
  });

  it("throws for a nonexistent payment id (fails closed, not open)", async () => {
    await expect(executePayment(randomUUID())).rejects.toThrow(/No payment found/);
  });
});
