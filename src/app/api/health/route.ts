import { NextResponse } from "next/server";

/** The one route that never requires a session (SPEC.md sections 9-10). Excluded from src/proxy.ts's matcher. */
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
