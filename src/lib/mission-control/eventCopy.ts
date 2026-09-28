import { formatUsd, shortAddress } from "./format";
import type { ClientEvent } from "./types";

export interface EventCopyContext {
  events: ClientEvent[];
  index: number;
}

function payloadOf(event: ClientEvent): Record<string, unknown> {
  return event.payload;
}

function findVendorChangeFor(ctx: EventCopyContext, vendorId: unknown, address: unknown): ClientEvent | null {
  for (let i = ctx.index - 1; i >= 0; i--) {
    const e = ctx.events[i];
    if (e.kind === "vendor_change" && e.payload.vendorId === vendorId && e.payload.newAddress === address) return e;
  }
  return null;
}

/** Suppressed: their narrative is told by the dedicated email_read/vendor_change/payment_proposed events instead. */
const SUPPRESSED_TOOL_RESULTS = new Set(["read_email", "update_vendor_payment_details", "pay_invoice"]);

/**
 * One plain-English sentence per event (docs/DESIGN.md section A11's event
 * table). Returns null for events that are either folded into another
 * component (risk_scored/tx_confirmed -> DecisionCard, run_finished -> the
 * closing banner) or suppressed as redundant with a more specific event
 * emitted right alongside it (see SUPPRESSED_TOOL_RESULTS above).
 */
export function describeEvent(ctx: EventCopyContext): string | null {
  const event = ctx.events[ctx.index];
  const payload = payloadOf(event);

  switch (event.kind) {
    case "run_started":
      return `Started processing the inbox — guard ${payload.mode === "guarded" ? "on" : "off"}.`;

    case "email_read":
      return `Read ${String(payload.from)}'s email: "${String(payload.subject)}."`;

    case "tool_result": {
      const tool = String(payload.tool);
      if (SUPPRESSED_TOOL_RESULTS.has(tool)) return null;
      const output = payload.output as Record<string, unknown>;

      if (tool === "get_vendor") {
        if (!output.found) return String(output.message);
        const changeEvent = findVendorChangeFor(ctx, output.vendorId, output.payoutAddress);
        const suffix = changeEvent ? `, notes updated from ${String(changeEvent.emailId).toUpperCase()}` : "";
        return `Looked up ${String(output.name)}'s payout wallet: ${shortAddress(String(output.payoutAddress))}${suffix}.`;
      }

      if (tool === "lookup_payment_history") {
        const call = ctx.events[ctx.index - 1];
        const vendorName = call?.kind === "tool_call" ? String((call.payload.input as Record<string, unknown>)?.vendor ?? "the vendor") : "the vendor";
        if (!output.found) return `No payment history on file for ${vendorName}.`;
        const payments = output.payments as unknown[];
        return `Looked up ${vendorName}'s payment history — ${payments.length} past payment${payments.length === 1 ? "" : "s"}.`;
      }

      if (tool === "list_inbox") {
        const emails = output as unknown as unknown[];
        return `Listed the inbox — ${Array.isArray(emails) ? emails.length : 0} emails.`;
      }

      if (tool === "finish") {
        return "Finished processing the inbox.";
      }

      return null;
    }

    case "vendor_change": {
      const old = payload.oldAddress ? shortAddress(String(payload.oldAddress)) : "none on file";
      return `Updated ${String(payload.vendorName)}'s payout wallet from ${old} to ${shortAddress(String(payload.newAddress))}, from ${String(event.emailId).toUpperCase()} — not yet verified.`;
    }

    case "payment_proposed":
      return `Proposed paying ${formatUsd(String(payload.amountMicros))} to ${String(payload.vendor)}.`;

    case "approval_requested":
      return `Sent to your phone: "${String(payload.bindingMessage)}."`;

    case "approval_resolved":
      if (payload.status === "approved") return "You approved this payment.";
      if (payload.status === "denied") return "You declined this payment.";
      return "The approval request expired.";

    case "tx_submitted":
      return "Sending payment to Solana devnet…";

    case "payment_blocked": {
      const reasons = payload.topReasons as string[] | undefined;
      return `Blocked${reasons && reasons.length > 0 ? ` — ${reasons[0]}` : ""}.`;
    }

    case "agent_message":
      return String(payload.text);

    case "error":
      return `Something went wrong: ${String(payload.message)}.`;

    // Folded elsewhere: risk_scored/tx_confirmed -> DecisionCard, run_finished -> closing banner, tool_call -> disclosure only.
    default:
      return null;
  }
}

/** The raw payload(s) shown behind an ActivityLine's disclosure, for technical judges. */
export function getDisclosurePayloads(ctx: EventCopyContext): { label: string; payload: unknown }[] {
  const event = ctx.events[ctx.index];
  const items: { label: string; payload: unknown }[] = [];

  if (event.kind === "email_read" || event.kind === "vendor_change") {
    const call = ctx.events[ctx.index - 1];
    const result = ctx.events[ctx.index + 1];
    if (call?.kind === "tool_call") items.push({ label: "tool_call", payload: call.payload });
    if (result?.kind === "tool_result") items.push({ label: "tool_result", payload: result.payload });
    return items;
  }

  if (event.kind === "tool_result") {
    const call = ctx.events[ctx.index - 1];
    if (call?.kind === "tool_call") items.push({ label: "tool_call", payload: call.payload });
    items.push({ label: "tool_result", payload: event.payload });
    return items;
  }

  items.push({ label: event.kind, payload: event.payload });
  return items;
}
