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

/** Tiger Data var set by provisioning the service + npm run db:migrate. */
const TIGER_VARS: Record<string, string> = {
  DATABASE_URL: "provision via `tiger service create`/MCP, then run npm run db:migrate",
};

/** Solana vars set by `npm run chain:setup`. */
const SOLANA_VARS: Record<string, string> = {
  MUSDC_MINT: "run `npm run chain:setup`",
  TREASURY_SECRET_KEY: "run `npm run chain:setup`",
  VENDOR_BLUERIDGE_SECRET_KEY: "run `npm run chain:setup`",
  VENDOR_CHESAPEAKE_SECRET_KEY: "run `npm run chain:setup`",
  VENDOR_COLONIAL_SECRET_KEY: "run `npm run chain:setup`",
  ATTACKER_A_SECRET_KEY: "run `npm run chain:setup`",
  ATTACKER_B_SECRET_KEY: "run `npm run chain:setup`",
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

function checkVarGroup(vars: Record<string, string>): void {
  for (const [name, hint] of Object.entries(vars)) {
    const value = process.env[name];
    if (value && value.length > 0) {
      report("PASS", `env ${name} present (${mask(value)})`);
    } else {
      report("FAIL", `env ${name} missing`, hint);
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

async function checkTigerData(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    report("FAIL", "Tiger Data reachable", "DATABASE_URL is not set");
    return;
  }

  const postgres = (await import("postgres")).default;
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    await sql`SELECT 1`;
    report("PASS", "Tiger Data reachable");
  } catch (error) {
    report("FAIL", "Tiger Data reachable", error instanceof Error ? error.message : String(error));
    await sql.end();
    return;
  }

  try {
    const rows = await sql<{ extversion: string }[]>`SELECT extversion FROM pg_extension WHERE extname = 'timescaledb'`;
    if (rows[0]?.extversion) {
      report("PASS", `TimescaleDB extension present (v${rows[0].extversion})`);
    } else {
      report("FAIL", "TimescaleDB extension present", "extension not found — is this a plain Postgres service?");
    }
  } catch (error) {
    report("FAIL", "TimescaleDB extension present", error instanceof Error ? error.message : String(error));
  }

  try {
    const rows = await sql<{ hypertable_name: string }[]>`SELECT hypertable_name FROM timescaledb_information.hypertables`;
    const names = new Set(rows.map((r) => r.hypertable_name));
    const expected = ["payments", "risk_evaluations", "vendor_detail_changes", "agent_events"];
    const missing = expected.filter((n) => !names.has(n));
    report(
      missing.length === 0 ? "PASS" : "FAIL",
      `Hypertables exist (${expected.join(", ")})`,
      missing.length === 0 ? undefined : `missing: ${missing.join(", ")} — run npm run db:migrate`,
    );
  } catch (error) {
    report("FAIL", "Hypertables exist", error instanceof Error ? error.message : String(error));
  }

  try {
    const rows = await sql<{ view_name: string }[]>`SELECT view_name FROM timescaledb_information.continuous_aggregates`;
    const names = new Set(rows.map((r) => r.view_name));
    const expected = ["vendor_spend_daily", "spend_by_minute"];
    const missing = expected.filter((n) => !names.has(n));
    report(
      missing.length === 0 ? "PASS" : "FAIL",
      `Continuous aggregates exist (${expected.join(", ")})`,
      missing.length === 0 ? undefined : `missing: ${missing.join(", ")} — run npm run db:migrate`,
    );
  } catch (error) {
    report("FAIL", "Continuous aggregates exist", error instanceof Error ? error.message : String(error));
  }

  try {
    const [vendors, notes, emails, history] = await Promise.all([
      sql<{ count: string }[]>`SELECT count(*) FROM vendors`,
      sql<{ count: string }[]>`SELECT count(*) FROM vendor_notes`,
      sql<{ count: string }[]>`SELECT count(*) FROM inbox_emails WHERE pack = 'demo'`,
      sql<{ count: string }[]>`SELECT count(*) FROM payments WHERE mode = 'history'`,
    ]);
    const counts = {
      vendors: Number(vendors[0].count),
      vendorNotes: Number(notes[0].count),
      demoEmails: Number(emails[0].count),
      historyPayments: Number(history[0].count),
    };
    const looksRight = counts.vendors === 3 && counts.vendorNotes === 3 && counts.demoEmails === 8 && counts.historyPayments > 0;
    report(
      looksRight ? "PASS" : "FAIL",
      `Row counts look right (vendors=${counts.vendors} vendor_notes=${counts.vendorNotes} demo_emails=${counts.demoEmails} history_payments=${counts.historyPayments})`,
      looksRight ? undefined : "run npm run db:seed",
    );
  } catch (error) {
    report("FAIL", "Row counts look right", error instanceof Error ? error.message : String(error));
  }

  await sql.end();
}

// Well-known public devnet genesis hash — confirms "cluster is devnet" beyond just the URL string.
const DEVNET_GENESIS_HASH = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";

async function checkSolana(): Promise<void> {
  const rpcUrl = process.env.SOLANA_RPC_URL;
  if (!rpcUrl) {
    report("FAIL", "Solana RPC reachable", "SOLANA_RPC_URL is not set");
    return;
  }

  const { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } = await import("@solana/web3.js");
  const connection = new Connection(rpcUrl, "confirmed");

  try {
    const version = await connection.getVersion();
    report("PASS", `Solana RPC reachable (solana-core ${version["solana-core"]})`);
  } catch (error) {
    report("FAIL", "Solana RPC reachable", error instanceof Error ? error.message : String(error));
    return;
  }

  try {
    const genesisHash = await connection.getGenesisHash();
    report(
      genesisHash === DEVNET_GENESIS_HASH ? "PASS" : "FAIL",
      "Cluster is devnet",
      genesisHash === DEVNET_GENESIS_HASH ? undefined : `genesis hash ${genesisHash} does not match the known devnet genesis`,
    );
  } catch (error) {
    report("FAIL", "Cluster is devnet", error instanceof Error ? error.message : String(error));
  }

  const treasurySecret = process.env.TREASURY_SECRET_KEY;
  if (!treasurySecret) {
    report("FAIL", "Treasury has SOL for fees", "TREASURY_SECRET_KEY is not set");
  } else {
    try {
      const bs58 = (await import("bs58")).default;
      const treasury = Keypair.fromSecretKey(bs58.decode(treasurySecret));
      const lamports = await connection.getBalance(treasury.publicKey);
      const sol = lamports / LAMPORTS_PER_SOL;
      report(sol > 0.01 ? "PASS" : "FAIL", `Treasury has SOL for fees (${sol.toFixed(4)} SOL)`, sol > 0.01 ? undefined : "fund via https://faucet.solana.com/");
    } catch (error) {
      report("FAIL", "Treasury has SOL for fees", error instanceof Error ? error.message : String(error));
    }
  }

  const mintAddress = process.env.MUSDC_MINT;
  if (!mintAddress) {
    report("FAIL", "mUSDC mint exists", "MUSDC_MINT is not set");
  } else {
    try {
      const info = await connection.getAccountInfo(new PublicKey(mintAddress));
      report(info ? "PASS" : "FAIL", `mUSDC mint exists (${mintAddress})`, info ? undefined : "run npm run chain:setup");
    } catch (error) {
      report("FAIL", "mUSDC mint exists", error instanceof Error ? error.message : String(error));
    }
  }

  if (mintAddress) {
    try {
      const { loadWalletDirectory, flattenWalletDirectory } = await import("../src/lib/solana/wallets");
      const { getAssociatedTokenAddressSync } = await import("@solana/spl-token");
      const flat = flattenWalletDirectory(loadWalletDirectory());
      const mint = new PublicKey(mintAddress);
      const entries = Object.entries(flat);
      const atas = entries.map(([, addr]) => getAssociatedTokenAddressSync(mint, new PublicKey(addr)));
      const infos = await connection.getMultipleAccountsInfo(atas);
      const missing = entries.filter((_, i) => !infos[i]).map(([key]) => key);
      report(
        missing.length === 0 ? "PASS" : "FAIL",
        "All token accounts exist",
        missing.length === 0 ? undefined : `missing ATAs for: ${missing.join(", ")} — run npm run chain:setup`,
      );
    } catch (error) {
      report("FAIL", "All token accounts exist", error instanceof Error ? error.message : String(error));
    }
  }
}

async function main(): Promise<void> {
  console.log("Countersign doctor\n");

  console.log("-- runtime --");
  checkNodeVersion();

  console.log("\n-- core env vars --");
  checkCoreEnvVars();

  console.log("\n-- Auth0 env vars --");
  checkAuth0EnvVars();

  console.log("\n-- Tiger Data env vars --");
  checkVarGroup(TIGER_VARS);

  console.log("\n-- Solana env vars --");
  checkVarGroup(SOLANA_VARS);

  console.log("\n-- live checks --");
  await checkAnthropicKey();
  checkDevnetGuard();
  await checkAuth0DomainReachable();
  await checkAuth0ClientCredentials();
  checkAuth0CibaConfig();
  checkApproverGuardianEnrollment();
  await checkTigerData();
  await checkSolana();

  console.log(`\n${failCount === 0 ? "All required checks passed." : `${failCount} check(s) failed.`}`);
  process.exit(failCount === 0 ? 0 : 1);
}

main();
