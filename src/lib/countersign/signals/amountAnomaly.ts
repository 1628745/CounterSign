import type { PaymentIntent, PolicyContext, Signal } from "../types";

/** amount_anomaly +20: amount > 3x the vendor's 90-day median (Tiger Data). */
export function amountAnomaly(intent: PaymentIntent, context: PolicyContext): Signal {
  const medianMicros = context.vendorMedian90d.result;
  const amountDollars = Number(intent.amountMicros) / 1_000_000;
  const medianDollars = medianMicros != null ? medianMicros / 1_000_000 : null;
  const fired = medianMicros != null && Number(intent.amountMicros) > 3 * medianMicros;
  const multiple = medianDollars ? amountDollars / medianDollars : null;
  const vendorName = context.vendor?.name;

  let sentence: string;
  if (fired && multiple != null && vendorName) {
    sentence = `Amount is ${multiple.toFixed(1)}x ${vendorName}'s 90-day median ($${medianDollars!.toFixed(2)}).`;
  } else if (medianDollars != null && vendorName) {
    sentence = `Amount is within 3x of ${vendorName}'s 90-day median ($${medianDollars.toFixed(2)}).`;
  } else {
    sentence = `No 90-day payment history is available to establish a median for this vendor.`;
  }

  return {
    key: "amount_anomaly",
    label: "Amount anomaly",
    weight: 20,
    fired,
    evidence: { sentence, data: { amountDollars, medianDollars } },
    query: context.vendorMedian90d.query,
    result: medianMicros,
  };
}
