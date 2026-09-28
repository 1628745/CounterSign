import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth0/session";
import { resetDemo } from "@/lib/demo/reset";

/**
 * POST /api/demo/reset — in SPEC.md's route list ("demo mode only"); not
 * built until Mission Control needed a "Reset demo" button (docs/DESIGN.md
 * section A6). Thin wrapper around the same resetDemo() npm run demo:reset
 * calls — no reset behavior is duplicated or changed. Needs a session;
 * src/proxy.ts already protects this route.
 */
export async function POST(): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (process.env.DEMO_MODE !== "true") {
    return NextResponse.json({ error: "DEMO_MODE is not enabled" }, { status: 403 });
  }

  try {
    const { swept } = await resetDemo();
    return NextResponse.json({ swept: swept.map((s) => ({ wallet: s.wallet, amountMicros: s.amountMicros.toString(), signature: s.signature })) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
