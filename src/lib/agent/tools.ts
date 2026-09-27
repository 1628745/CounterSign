import { tool } from "ai";
import { z } from "zod";
import { renderNaiveEmail } from "@/lib/countersign/htmlText";
import type { PaymentIntent } from "@/lib/countersign/types";
import { getInboxEmailById, listInboxEmails } from "@/lib/db/queries/emails";
import { lookupPaymentHistory } from "@/lib/db/queries/payments";
import { findVendorByName, getVendorByName, updateVendorPaymentDetails } from "@/lib/db/queries/vendors";
import { submitPayment, type Mode } from "@/lib/pipeline";
import { emitEvent } from "@/lib/runs/eventBus";

/**
 * Tool names available to the AP agent, identical in both modes (SPEC.md
 * section 7).
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

export interface AgentToolContext {
  runId: string;
  mode: Mode;
  pack: string;
  /** Dry run (scripts/doctor.ts): reads are real, but no event/DB writes and no chain calls happen. */
  simulate?: boolean;
}

function formatDollars(micros: bigint): string {
  return `$${(Number(micros) / 1_000_000).toFixed(2)}`;
}

/**
 * Wraps a tool's business logic with the generic tool_call/tool_result
 * (and error) events every tool call produces. Domain-specific events
 * (email_read, vendor_change, payment_proposed) are emitted separately,
 * inline, by the tools that produce them (SPEC.md section 10).
 */
async function withToolEvents<I extends Record<string, unknown>, O>(
  ctx: AgentToolContext,
  toolName: AgentToolName,
  input: I,
  run: () => Promise<O>,
): Promise<O> {
  if (ctx.simulate) {
    return run();
  }
  await emitEvent({ runId: ctx.runId, kind: "tool_call", payload: { tool: toolName, input } });
  try {
    const output = await run();
    await emitEvent({ runId: ctx.runId, kind: "tool_result", payload: { tool: toolName, output: output as unknown } });
    return output;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await emitEvent({ runId: ctx.runId, kind: "error", payload: { tool: toolName, input, message } });
    throw error;
  }
}

// Schemas and descriptions are module-level constants, reused verbatim for
// every mode — this is what makes the honesty-guard test in
// tests/honesty-guard.test.ts a meaningful check rather than a tautology.

const listInboxSchema = z.object({});
const readEmailSchema = z.object({ id: z.string().describe("The email id, as returned by list_inbox.") });
const getVendorSchema = z.object({ name: z.string().describe("Vendor company name, as it appears in the email.") });
const updateVendorPaymentDetailsSchema = z.object({
  vendor: z.string().describe("Vendor company name."),
  new_address: z.string().describe("The new payout wallet address to use for this vendor."),
  reason: z.string().describe("Why the payout details are being updated."),
  source_email_id: z.string().describe("The id of the email that requested this change."),
});
const lookupPaymentHistorySchema = z.object({ vendor: z.string().describe("Vendor company name.") });
const payInvoiceSchema = z.object({
  vendor: z.string().describe("Vendor company name, or a short description if this isn't a known vendor."),
  payee_address: z.string().describe("The wallet address to send payment to."),
  amount: z.number().positive().describe("Amount in mUSDC dollars, e.g. 412.50."),
  invoice_number: z.string().nullable().optional().describe("Invoice number, if the email has one."),
  source_email_id: z.string().describe("The id of the email this payment is for."),
});
const finishSchema = z.object({ summary: z.string().describe("A short summary of what you did across the inbox.") });

const DESCRIPTIONS: Record<AgentToolName, string> = {
  list_inbox: "List every email currently in the inbox, in arrival order.",
  read_email: "Read the full plain-text content of one email by id.",
  get_vendor: "Look up a vendor's current payout wallet address and details by name.",
  update_vendor_payment_details:
    "Update a vendor's payout wallet address on file, e.g. after receiving a remittance-change notice from them.",
  lookup_payment_history: "List past payments made to a vendor, most recent first.",
  pay_invoice: "Pay an invoice by sending payment to a wallet address. This is the only way money moves.",
  finish: "Call this once every email in the inbox has been processed, with a short summary of what you did.",
};

/**
 * Builds the Vercel AI SDK v6 tool set for the agent. pay_invoice calls
 * src/lib/pipeline.submitPayment — never the signer directly (SPEC.md
 * section 14, #1). Identical tool names/descriptions/schemas in every mode;
 * only pay_invoice's downstream routing (via ctx.mode) differs.
 */
export function buildAgentTools(ctx: AgentToolContext) {
  return {
    list_inbox: tool({
      description: DESCRIPTIONS.list_inbox,
      inputSchema: listInboxSchema,
      execute: async (input) =>
        withToolEvents(ctx, "list_inbox", input, async () => {
          const emails = await listInboxEmails(ctx.pack);
          return emails.map((e) => ({
            id: e.id,
            from: `${e.fromName} <${e.fromAddress}>`,
            subject: e.subject,
            position: e.position,
          }));
        }),
    }),

    read_email: tool({
      description: DESCRIPTIONS.read_email,
      inputSchema: readEmailSchema,
      execute: async (input) =>
        withToolEvents(ctx, "read_email", input, async () => {
          const email = await getInboxEmailById(input.id);
          if (!email) {
            throw new Error(`No email with id "${input.id}"`);
          }
          const { text } = renderNaiveEmail(email.html);
          if (!ctx.simulate) {
            await emitEvent({
              runId: ctx.runId,
              kind: "email_read",
              emailId: email.id,
              payload: { subject: email.subject, from: email.fromAddress },
            });
          }
          return {
            id: email.id,
            from: `${email.fromName} <${email.fromAddress}>`,
            subject: email.subject,
            receivedAt: email.receivedAt.toISOString(),
            text,
          };
        }),
    }),

    get_vendor: tool({
      description: DESCRIPTIONS.get_vendor,
      inputSchema: getVendorSchema,
      execute: async (input) =>
        withToolEvents(ctx, "get_vendor", input, async () => {
          const vendor = await getVendorByName(input.name);
          if (!vendor) {
            return { found: false, message: `No vendor on file matching "${input.name}".` };
          }
          return {
            found: true,
            vendorId: vendor.id,
            name: vendor.name,
            domain: vendor.domain,
            payoutAddress: vendor.payoutAddress,
            lastUpdatedAt: vendor.notesUpdatedAt.toISOString(),
          };
        }),
    }),

    update_vendor_payment_details: tool({
      description: DESCRIPTIONS.update_vendor_payment_details,
      inputSchema: updateVendorPaymentDetailsSchema,
      execute: async (input) =>
        withToolEvents(ctx, "update_vendor_payment_details", input, async () => {
          const vendor = await findVendorByName(input.vendor);
          if (!vendor) {
            return { updated: false, message: `No vendor on file matching "${input.vendor}" — nothing to update.` };
          }
          if (ctx.simulate) {
            const current = await getVendorByName(input.vendor);
            return { updated: true, simulated: true, vendorId: vendor.id, oldAddress: current?.payoutAddress ?? null, newAddress: input.new_address };
          }
          const { oldAddress } = await updateVendorPaymentDetails({
            vendorId: vendor.id,
            newAddress: input.new_address,
            sourceEmailId: input.source_email_id,
            runId: ctx.runId,
          });
          await emitEvent({
            runId: ctx.runId,
            kind: "vendor_change",
            emailId: input.source_email_id,
            payload: { vendorId: vendor.id, vendorName: vendor.name, oldAddress, newAddress: input.new_address, reason: input.reason },
          });
          return { updated: true, vendorId: vendor.id, oldAddress, newAddress: input.new_address };
        }),
    }),

    lookup_payment_history: tool({
      description: DESCRIPTIONS.lookup_payment_history,
      inputSchema: lookupPaymentHistorySchema,
      execute: async (input) =>
        withToolEvents(ctx, "lookup_payment_history", input, async () => {
          const vendor = await findVendorByName(input.vendor);
          if (!vendor) {
            return { found: false, message: `No vendor on file matching "${input.vendor}".`, payments: [] };
          }
          const history = await lookupPaymentHistory(vendor.id);
          return {
            found: true,
            vendorId: vendor.id,
            payments: history.slice(0, 20).map((p) => ({
              ts: p.ts.toISOString(),
              invoiceNumber: p.invoiceNumber,
              amount: formatDollars(p.amountMicros),
              decision: p.decision,
            })),
          };
        }),
    }),

    pay_invoice: tool({
      description: DESCRIPTIONS.pay_invoice,
      inputSchema: payInvoiceSchema,
      execute: async (input) =>
        withToolEvents(ctx, "pay_invoice", input, async () => {
          const vendor = await findVendorByName(input.vendor);
          const amountMicros = BigInt(Math.round(input.amount * 1_000_000));
          if (ctx.simulate) {
            return {
              paymentId: "simulated",
              decision: "simulated_dry_run",
              vendorId: vendor?.id ?? null,
              payeeAddress: input.payee_address,
              amountMicros: amountMicros.toString(),
            };
          }
          const intent: PaymentIntent = {
            vendor: vendor?.id ?? null,
            payeeAddress: input.payee_address,
            amountMicros,
            invoiceNumber: input.invoice_number ?? null,
            sourceEmailId: input.source_email_id,
          };
          await emitEvent({
            runId: ctx.runId,
            kind: "payment_proposed",
            emailId: input.source_email_id,
            payload: {
              vendor: input.vendor,
              vendorId: vendor?.id ?? null,
              payeeAddress: input.payee_address,
              amountMicros: amountMicros.toString(),
              invoiceNumber: input.invoice_number ?? null,
            },
          });
          const result = await submitPayment(intent, ctx.mode, { runId: ctx.runId, pack: ctx.pack });
          return {
            paymentId: result.paymentId,
            decision: result.decision,
            message: result.message,
            signature: result.signature,
            explorerUrl: result.explorerUrl,
          };
        }),
    }),

    finish: tool({
      description: DESCRIPTIONS.finish,
      inputSchema: finishSchema,
      execute: async (input) =>
        withToolEvents(ctx, "finish", input, async () => {
          return { acknowledged: true };
        }),
    }),
  };
}
