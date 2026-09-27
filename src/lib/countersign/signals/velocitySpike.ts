import type { PaymentIntent, PolicyContext, Signal } from "../types";

/** velocity_spike +20: vendor's spend today including this payment > 2x their max daily spend over 90 days (vendor_spend_daily). */
export function velocitySpike(intent: PaymentIntent, context: PolicyContext): Signal {
  const maxDailyMicros = context.vendorMaxDaily90d.result;
  const spendTodayMicros = context.vendorSpendToday.result;
  const projectedMicros = spendTodayMicros + Number(intent.amountMicros);
  const fired = maxDailyMicros != null && maxDailyMicros > 0 && projectedMicros > 2 * maxDailyMicros;

  const projectedDollars = projectedMicros / 1_000_000;
  const maxDailyDollars = maxDailyMicros != null ? maxDailyMicros / 1_000_000 : null;
  const vendorName = context.vendor?.name;

  let sentence: string;
  if (fired && vendorName) {
    sentence = `Today's spend with ${vendorName} including this payment ($${projectedDollars.toFixed(2)}) is more than 2x their 90-day daily max ($${maxDailyDollars!.toFixed(2)}).`;
  } else if (maxDailyDollars != null && vendorName) {
    sentence = `Today's spend including this payment ($${projectedDollars.toFixed(2)}) is within 2x of the 90-day daily max ($${maxDailyDollars.toFixed(2)}).`;
  } else {
    sentence = `No 90-day daily-spend history is available for this vendor.`;
  }

  return {
    key: "velocity_spike",
    label: "Velocity spike",
    weight: 20,
    fired,
    evidence: { sentence, data: { projectedDollars, maxDailyDollars } },
    query: context.vendorMaxDaily90d.query,
    result: maxDailyMicros,
  };
}
