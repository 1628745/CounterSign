#!/usr/bin/env tsx
// Environment doctor for Countersign. One line per check: PASS / FAIL / SKIP + a hint.
// SPEC.md section 14, non-negotiable #6: secrets live only in .env.local; mask them in all logs.

import { config } from "dotenv";
config({ path: ".env.local" });

type Status = "PASS" | "FAIL" | "SKIP";

let failCount = 0;

function report(status: Status, name: string, hint?: string): void {
  const icon = status === "PASS" ? "✅" : status === "FAIL" ? "❌" : "⏭️ ";
  const suffix = hint ? ` — ${hint}` : "";
  console.log(`${icon} ${status.padEnd(4)} ${name}${suffix}`);
  if (status === "FAIL") failCount += 1;
}

/** Masks a secret for logging: keeps a few chars on each end, hides the rest. */
function mask(value: string): string {
  if (value.length <= 8) return "*".repeat(value.length);
  return `${value.slice(0, 4)}${"*".repeat(Math.max(4, value.length - 8))}${value.slice(-4)}`;
}

function checkNodeVersion(): void {
  const major = Number(process.versions.node.split(".")[0]);
  if (major >= 20) {
    report("PASS", `Node ${process.versions.node} >= 20`);
  } else {
    report("FAIL", `Node ${process.versions.node} < 20`, "install Node 20+ (see https://nodejs.org)");
  }
}

/** Vars that should already be set at this stage of the build. */
const CORE_VARS = ["ANTHROPIC_API_KEY", "AGENT_MODEL", "CLASSIFIER_MODEL", "APP_BASE_URL", "SOLANA_RPC_URL", "DEMO_MODE"];

/** Vars deferred to later prompts — reported as SKIP with a hint, not FAIL. */
const DEFERRED_VARS: Record<string, string> = {
  AUTH0_DOMAIN: "set up in the Auth0 prompt (auth0 login / auth0 apps create)",
  AUTH0_CLIENT_ID: "set up in the Auth0 prompt",
  AUTH0_CLIENT_SECRET: "set up in the Auth0 prompt",
  AUTH0_SECRET: "set up in the Auth0 prompt (32+ random bytes)",
  AUTH0_AUDIENCE: "set up in the Auth0 prompt (create an API with scope payments:approve)",
  APPROVER_SUB: "set up in the Auth0 prompt (your Auth0 user sub)",
  DATABASE_URL: "provision via `tiger service_create`/MCP, then run npm run db:migrate",
  MUSDC_MINT: "set by npm run chain:setup in the Solana prompt",
  TREASURY_SECRET_KEY: "set by npm run chain:setup in the Solana prompt",
  VENDOR_BLUERIDGE_SECRET_KEY: "set by npm run chain:setup in the Solana prompt",
  VENDOR_CHESAPEAKE_SECRET_KEY: "set by npm run chain:setup in the Solana prompt",
  VENDOR_COLONIAL_SECRET_KEY: "set by npm run chain:setup in the Solana prompt",
  ATTACKER_A_SECRET_KEY: "set by npm run chain:setup in the Solana prompt",
  ATTACKER_B_SECRET_KEY: "set by npm run chain:setup in the Solana prompt",
};

function checkCoreEnvVars(): void {
  for (const name of CORE_VARS) {
    const value = process.env[name];
    if (value && value.length > 0) {
      report("PASS", `env ${name} present (${mask(value)})`);
    } else {
      report("FAIL", `env ${name} missing`, "add it to .env.local (see .env.example)");
    }
  }
}

function checkDeferredEnvVars(): void {
  for (const [name, hint] of Object.entries(DEFERRED_VARS)) {
    const value = process.env[name];
    if (value && value.length > 0) {
      report("PASS", `env ${name} present (${mask(value)})`);
    } else {
      report("SKIP", `env ${name} not set yet`, hint);
    }
  }
}

async function checkAnthropicKey(): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.AGENT_MODEL;
  if (!apiKey) {
    report("FAIL", "Anthropic API call", "ANTHROPIC_API_KEY is not set");
    return;
  }
  if (!model) {
    report("FAIL", "Anthropic API call", "AGENT_MODEL is not set");
    return;
  }
  try {
    const { generateText } = await import("ai");
    const { anthropic } = await import("@ai-sdk/anthropic");
    const result = await generateText({
      model: anthropic(model),
      prompt: "Reply with exactly the word: OK",
      maxOutputTokens: 8,
      temperature: 0,
    });
    if (result.text.trim().length > 0) {
      report("PASS", `Anthropic API call to ${model} succeeded`, `reply: ${JSON.stringify(result.text.trim().slice(0, 20))}`);
    } else {
      report("FAIL", `Anthropic API call to ${model}`, "empty response");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    report("FAIL", `Anthropic API call to ${model}`, message.slice(0, 160));
  }
}

function checkDevnetGuard(): void {
  const rpcUrl = process.env.SOLANA_RPC_URL ?? "";
  if (!rpcUrl) {
    report("FAIL", "Devnet-only guard", "SOLANA_RPC_URL is not set");
    return;
  }
  if (rpcUrl.toLowerCase().includes("mainnet")) {
    report("FAIL", "Devnet-only guard", `SOLANA_RPC_URL contains "mainnet" — devnet only (SPEC.md section 6/14)`);
    return;
  }
  report("PASS", `Devnet-only guard (${rpcUrl})`);
}

function checkDeferredSubsystems(): void {
  report("SKIP", "Auth0 connectivity", "implemented in the Auth0 prompt — will check bc-authorize reachability");
  report("SKIP", "Tiger Data connectivity", "implemented in the Tiger Data prompt — will run `select 1` against DATABASE_URL");
  report("SKIP", "Solana devnet connectivity + wallet balances", "implemented in the Solana prompt — will check getVersion() and treasury balance");
}

async function main(): Promise<void> {
  console.log("Countersign doctor\n");

  console.log("-- runtime --");
  checkNodeVersion();

  console.log("\n-- core env vars --");
  checkCoreEnvVars();

  console.log("\n-- deferred env vars (Auth0 / Tiger Data / Solana) --");
  checkDeferredEnvVars();

  console.log("\n-- live checks --");
  await checkAnthropicKey();
  checkDevnetGuard();
  checkDeferredSubsystems();

  console.log(`\n${failCount === 0 ? "All required checks passed." : `${failCount} check(s) failed.`}`);
  process.exit(failCount === 0 ? 0 : 1);
}

main();
