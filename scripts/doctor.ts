#!/usr/bin/env tsx
// Environment doctor for Countersign. One line per check: PASS / FAIL / SKIP + a hint.
// SPEC.md section 14, non-negotiable #6: secrets live only in .env.local; mask them in all logs.

import { execFileSync } from "node:child_process";
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

/** Auth0 vars set by `npm run auth0:setup` — expected to be present from here on. */
const AUTH0_VARS: Record<string, string> = {
  AUTH0_DOMAIN: "run `npm run auth0:setup`",
  AUTH0_CLIENT_ID: "run `npm run auth0:setup`",
  AUTH0_CLIENT_SECRET: "run `npm run auth0:setup`",
  AUTH0_SECRET: "run `npm run auth0:setup`",
  AUTH0_AUDIENCE: "run `npm run auth0:setup`",
};

/** Vars deferred to later prompts — reported as SKIP with a hint, not FAIL. */
const DEFERRED_VARS: Record<string, string> = {
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

function checkAuth0EnvVars(): void {
  for (const [name, hint] of Object.entries(AUTH0_VARS)) {
    const value = process.env[name];
    if (value && value.length > 0) {
      report("PASS", `env ${name} present (${mask(value)})`);
    } else {
      report("FAIL", `env ${name} missing`, hint);
    }
  }

  const approverSub = process.env.APPROVER_SUB;
  if (approverSub && approverSub.length > 0) {
    report("PASS", `env APPROVER_SUB present (${mask(approverSub)})`);
  } else {
    report("FAIL", "env APPROVER_SUB missing", "log in once at http://localhost:3000, then run the Management API lookup step (SPEC.md section 9, step 3)");
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

async function checkAuth0DomainReachable(): Promise<void> {
  const domain = process.env.AUTH0_DOMAIN;
  if (!domain) {
    report("FAIL", "Auth0 domain reachable", "AUTH0_DOMAIN is not set");
    return;
  }
  try {
    const res = await fetch(`https://${domain}/.well-known/openid-configuration`);
    const body = await res.json();
    if (res.ok && typeof body.issuer === "string") {
      report("PASS", `Auth0 domain reachable (${domain})`);
    } else {
      report("FAIL", "Auth0 domain reachable", `unexpected response (HTTP ${res.status})`);
    }
  } catch (error) {
    report("FAIL", "Auth0 domain reachable", error instanceof Error ? error.message : String(error));
  }
}

async function checkAuth0ClientCredentials(): Promise<void> {
  const domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_CLIENT_ID;
  const clientSecret = process.env.AUTH0_CLIENT_SECRET;
  if (!domain || !clientId || !clientSecret) {
    report("FAIL", "Auth0 client credentials valid", "AUTH0_DOMAIN/AUTH0_CLIENT_ID/AUTH0_CLIENT_SECRET not fully set");
    return;
  }
  try {
    // A client_credentials probe against the Management API audience: Auth0
    // validates client_id/client_secret before it checks grants, so a wrong
    // secret comes back 401 "Unauthorized" while a *correct* secret without
    // a client-grant for this audience comes back 403 "is not authorized to
    // access resource server ... You need to create a client-grant". Either
    // 2xx or that specific 403 means the credentials themselves are valid.
    const res = await fetch(`https://${domain}/oauth/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        audience: `https://${domain}/api/v2/`,
      }),
    });
    const body = await res.json();
    const credentialsRejected = res.status === 401 || body.error === "unauthorized_client" || body.error === "invalid_client";
    if (!credentialsRejected) {
      report("PASS", "Auth0 client credentials valid");
    } else {
      report("FAIL", "Auth0 client credentials valid", `HTTP ${res.status} ${body.error ?? ""}: ${body.error_description ?? ""}`.trim());
    }
  } catch (error) {
    report("FAIL", "Auth0 client credentials valid", error instanceof Error ? error.message : String(error));
  }
}

/** Best-effort shell-out to the Auth0 CLI. Returns null (caller should SKIP) if the CLI itself is unusable. */
function auth0CliGet<T = unknown>(args: string[]): T | null {
  try {
    const out = execFileSync("auth0", [...args, "--json"], { encoding: "utf-8", maxBuffer: 20 * 1024 * 1024 });
    return JSON.parse(out) as T;
  } catch {
    return null;
  }
}

function checkAuth0CibaConfig(): void {
  const clientId = process.env.AUTH0_CLIENT_ID;
  if (!clientId) {
    report("FAIL", "Auth0 CIBA grant + guardian-push channel", "AUTH0_CLIENT_ID is not set");
    return;
  }
  const client = auth0CliGet<{ grant_types?: string[]; async_approval_notification_channels?: string[] }>([
    "api",
    "get",
    `clients/${clientId}`,
  ]);
  if (!client) {
    report("SKIP", "Auth0 CIBA grant + guardian-push channel", "requires the Auth0 CLI logged in (`auth0 login`) to inspect the client — run `npm run auth0:setup`");
    return;
  }
  const hasCiba = (client.grant_types ?? []).includes("urn:openid:params:grant-type:ciba");
  const hasPushChannel = (client.async_approval_notification_channels ?? []).includes("guardian-push");
  if (hasCiba && hasPushChannel) {
    report("PASS", "Auth0 CIBA grant + guardian-push channel configured");
  } else {
    report(
      "FAIL",
      "Auth0 CIBA grant + guardian-push channel",
      `grant_types ciba=${hasCiba} async_approval_notification_channels guardian-push=${hasPushChannel} — run npm run auth0:setup`,
    );
  }

  const factors = auth0CliGet<{ name: string; enabled: boolean }[]>(["api", "get", "guardian/factors"]);
  if (!factors) {
    report("SKIP", "Guardian push factor enabled (tenant)", "requires the Auth0 CLI logged in — run `npm run auth0:setup`");
    return;
  }
  const pushEnabled = factors.find((f) => f.name === "push-notification")?.enabled ?? false;
  report(pushEnabled ? "PASS" : "FAIL", "Guardian push factor enabled (tenant)", pushEnabled ? undefined : "run npm run auth0:setup");
}

function checkApproverGuardianEnrollment(): void {
  const approverSub = process.env.APPROVER_SUB;
  if (!approverSub) {
    report("SKIP", "Approver enrolled in Guardian", "APPROVER_SUB is not set yet (SPEC.md section 9, step 3)");
    return;
  }
  const enrollments = auth0CliGet<{ status: string }[]>(["api", "get", `users/${approverSub}/enrollments`]);
  if (enrollments === null) {
    report("SKIP", "Approver enrolled in Guardian", "requires the Auth0 CLI logged in (`auth0 login`) to check enrollments");
    return;
  }
  const confirmed = enrollments.some((e) => e.status === "confirmed");
  if (confirmed) {
    report("PASS", `Approver enrolled in Guardian (${enrollments.length} enrollment(s))`);
  } else {
    report("FAIL", "Approver enrolled in Guardian", "no confirmed enrollment — open the enrollment ticket URL on your phone (SPEC.md section 9, step 3)");
  }
}

function checkDeferredSubsystems(): void {
  report("SKIP", "Tiger Data connectivity", "implemented in the Tiger Data prompt — will run `select 1` against DATABASE_URL");
  report("SKIP", "Solana devnet connectivity + wallet balances", "implemented in the Solana prompt — will check getVersion() and treasury balance");
}

async function main(): Promise<void> {
  console.log("Countersign doctor\n");

  console.log("-- runtime --");
  checkNodeVersion();

  console.log("\n-- core env vars --");
  checkCoreEnvVars();

  console.log("\n-- Auth0 env vars --");
  checkAuth0EnvVars();

  console.log("\n-- deferred env vars (Tiger Data / Solana) --");
  checkDeferredEnvVars();

  console.log("\n-- live checks --");
  await checkAnthropicKey();
  checkDevnetGuard();
  await checkAuth0DomainReachable();
  await checkAuth0ClientCredentials();
  checkAuth0CibaConfig();
  checkApproverGuardianEnrollment();
  checkDeferredSubsystems();

  console.log(`\n${failCount === 0 ? "All required checks passed." : `${failCount} check(s) failed.`}`);
  process.exit(failCount === 0 ? 0 : 1);
}

main();
