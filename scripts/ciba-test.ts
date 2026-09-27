#!/usr/bin/env tsx
// npm run test:ciba — sends a real CIBA push to APPROVER_SUB, polls with
// backoff, prints every state change. Exit codes: 0 approved, 2 denied,
// 3 expired/timed out, 1 on setup/error. See SPEC.md section 9.

import { config } from "dotenv";
config({ path: ".env.local" });

import { initiate, poll } from "../src/lib/auth0/ciba";

const BINDING_MESSAGE = "Countersign test 4812";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`${name} is not set — see .env.example`);
    process.exit(1);
  }
  return value;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const approverSub = requireEnv("APPROVER_SUB");

  console.log(`Sending CIBA push "${BINDING_MESSAGE}" to ${approverSub}...`);
  const { authReqId, interval, expiresIn } = await initiate(BINDING_MESSAGE, approverSub);
  console.log(`auth_req_id=${authReqId} interval=${interval}s expires_in=${expiresIn}s`);
  console.log("Check your phone for the Guardian push notification.\n");

  let waitS = interval || 5;
  const deadline = Date.now() + expiresIn * 1000;
  let lastStatus: string | null = null;

  while (Date.now() < deadline) {
    await sleep(waitS * 1000);
    const outcome = await poll(authReqId, approverSub);

    if (outcome.status !== lastStatus) {
      console.log(`[${new Date().toISOString()}] state -> ${outcome.status}`);
      lastStatus = outcome.status;
    }

    if (outcome.status === "approved") {
      console.log(`Approved. sub=${outcome.claims?.sub} scope=${outcome.claims?.scope}`);
      process.exit(0);
    }
    if (outcome.status === "denied") {
      console.log("Denied.");
      process.exit(2);
    }
    if (outcome.status === "expired") {
      console.log("Expired.");
      process.exit(3);
    }
    if (outcome.intervalS) {
      waitS = outcome.intervalS;
    }
  }

  console.log("Timed out waiting for a decision.");
  process.exit(3);
}

main().catch((error) => {
  console.error("ciba-test failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
