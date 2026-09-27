#!/usr/bin/env tsx
// Re-runnable Auth0 tenant setup for Countersign. Uses the Auth0 CLI (assumes
// `auth0 login` has already run) for everything the CLI has a dedicated
// command for, and `auth0 api` for the rest (guardian factors, patching
// fields the create/apps commands don't expose). See SPEC.md section 9 and
// docs/PROGRESS.md for the "why" behind each choice.
//
// Prints what it changed. Never prints secret values — only that a secret
// was written/rotated. Secrets are written straight to .env.local.

import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const APP_NAME = "Countersign";
const CALLBACK_URL = "http://localhost:3000/auth/callback";
const LOGOUT_URL = "http://localhost:3000";
const WEB_ORIGIN = "http://localhost:3000";
const API_NAME = "Countersign API";
const API_IDENTIFIER = "https://countersign.demo/api";
const API_SCOPE = "payments:approve";
const ENV_LOCAL = path.resolve(__dirname, "..", ".env.local");

const changes: string[] = [];
function noted(message: string): void {
  changes.push(message);
  console.log(`  -> ${message}`);
}

function auth0Json<T = unknown>(args: string[]): T {
  const out = execFileSync("auth0", [...args, "--json"], {
    encoding: "utf-8",
    maxBuffer: 20 * 1024 * 1024,
  });
  return JSON.parse(out) as T;
}

function readEnvLocal(): string {
  return existsSync(ENV_LOCAL) ? readFileSync(ENV_LOCAL, "utf-8") : "";
}

function readEnvVar(name: string): string | undefined {
  const match = readEnvLocal().match(new RegExp(`^${name}=(.*)$`, "m"));
  const value = match?.[1]?.trim();
  return value && value.length > 0 ? value : undefined;
}

/** Writes/replaces a var in .env.local. Reports whether it actually changed, without ever printing the value. */
function setEnvVar(name: string, value: string, label = name): void {
  const before = readEnvVar(name);
  if (before === value) {
    noted(`${label} already set correctly in .env.local`);
    return;
  }
  let content = readEnvLocal();
  const line = `${name}=${value}`;
  const re = new RegExp(`^${name}=.*$`, "m");
  if (re.test(content)) {
    content = content.replace(re, line);
  } else {
    content += (content.length > 0 && !content.endsWith("\n") ? "\n" : "") + line + "\n";
  }
  writeFileSync(ENV_LOCAL, content);
  noted(`${before ? "updated" : "wrote"} ${label} in .env.local`);
}

function isSubscriptionUpgradeError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /upgrad|not included in your (current )?subscription|not available on your plan/i.test(message);
}

function ensureTenantDomain(): string {
  const tenants = auth0Json<{ name: string; active: boolean }[]>(["tenants", "list"]);
  const active = tenants.find((t) => t.active) ?? tenants[0];
  if (!active) {
    throw new Error("No Auth0 tenant found — run `auth0 login` first.");
  }
  setEnvVar("AUTH0_DOMAIN", active.name);
  return active.name;
}

interface AppSummary {
  client_id: string;
  name: string;
}

function ensureApp(): { clientId: string; clientSecret: string } {
  const desired = {
    callbacks: [CALLBACK_URL],
    allowed_logout_urls: [LOGOUT_URL],
    web_origins: [WEB_ORIGIN],
    token_endpoint_auth_method: "client_secret_post",
    grant_types: [
      "authorization_code",
      "implicit",
      "refresh_token",
      "client_credentials",
      "urn:openid:params:grant-type:ciba",
    ],
    async_approval_notification_channels: ["guardian-push"],
  };

  const apps = auth0Json<AppSummary[]>(["apps", "list"]);
  const existing = apps.find((a) => a.name === APP_NAME);

  let clientId: string;
  if (!existing) {
    try {
      const created = auth0Json<{ client_id: string; client_secret: string }>([
        "apps",
        "create",
        "--data",
        JSON.stringify({ name: APP_NAME, app_type: "regular_web", oidc_conformant: true, ...desired }),
        "--reveal-secrets",
      ]);
      noted(`created Auth0 application "${APP_NAME}" (${created.client_id})`);
      clientId = created.client_id;
    } catch (error) {
      if (isSubscriptionUpgradeError(error)) {
        console.error(
          "\nSTOP: enabling the CIBA grant on a new application was rejected as a subscription/plan limitation.\n" +
            "Create a new tenant from the Auth0 dashboard and re-run `npm run auth0:setup` against it (see SPEC.md section 9, step 1).",
        );
        process.exit(1);
      }
      throw error;
    }
  } else {
    clientId = existing.client_id;
    const current = auth0Json<Record<string, unknown>>(["api", "get", `clients/${clientId}`]);
    const changed = (Object.keys(desired) as (keyof typeof desired)[]).some(
      (key) => JSON.stringify(current[key]) !== JSON.stringify(desired[key]),
    );
    if (changed) {
      try {
        auth0Json(["api", "patch", `clients/${clientId}`, "--data", JSON.stringify(desired)]);
        noted(`updated Auth0 application "${APP_NAME}" (${clientId}) — callbacks/grant_types/CIBA channel`);
      } catch (error) {
        if (isSubscriptionUpgradeError(error)) {
          console.error(
            "\nSTOP: enabling the CIBA grant on the existing application was rejected as a subscription/plan limitation.\n" +
              "Create a new tenant from the Auth0 dashboard and re-run `npm run auth0:setup` against it (see SPEC.md section 9, step 1).",
          );
          process.exit(1);
        }
        throw error;
      }
    } else {
      noted(`Auth0 application "${APP_NAME}" (${clientId}) already configured correctly`);
    }
  }

  const withSecret = auth0Json<{ client_secret: string }>(["apps", "show", clientId, "--reveal-secrets"]);
  return { clientId, clientSecret: withSecret.client_secret };
}

interface ApiSummary {
  id: string;
  identifier: string;
  scopes?: { value: string; description?: string }[];
}

function ensureApi(): void {
  const apis = auth0Json<ApiSummary[]>(["apis", "list"]);
  const existing = apis.find((a) => a.identifier === API_IDENTIFIER);

  if (!existing) {
    auth0Json(["apis", "create", "--name", API_NAME, "--identifier", API_IDENTIFIER, "--scopes", API_SCOPE]);
    noted(`created Auth0 API "${API_NAME}" (${API_IDENTIFIER}) with scope ${API_SCOPE}`);
    return;
  }

  const hasScope = (existing.scopes ?? []).some((s) => s.value === API_SCOPE);
  if (hasScope) {
    noted(`Auth0 API "${API_NAME}" (${API_IDENTIFIER}) already has scope ${API_SCOPE}`);
    return;
  }
  const newScopes = [...(existing.scopes ?? []), { value: API_SCOPE, description: API_SCOPE }];
  auth0Json(["api", "patch", `resource-servers/${existing.id}`, "--data", JSON.stringify({ scopes: newScopes })]);
  noted(`added scope ${API_SCOPE} to existing Auth0 API "${API_NAME}"`);
}

function ensureGuardianPush(): void {
  const factors = auth0Json<{ name: string; enabled: boolean }[]>(["api", "get", "guardian/factors"]);
  const push = factors.find((f) => f.name === "push-notification");
  if (push?.enabled) {
    noted("MFA push (Guardian) factor already enabled for the tenant");
    return;
  }
  try {
    auth0Json(["api", "put", "guardian/factors/push-notification", "--data", JSON.stringify({ enabled: true })]);
    noted("enabled MFA push (Guardian) factor for the tenant");
  } catch (error) {
    if (isSubscriptionUpgradeError(error)) {
      console.error(
        "\nSTOP: enabling the Guardian push MFA factor was rejected as a subscription/plan limitation.\n" +
          "Create a new tenant from the Auth0 dashboard and re-run `npm run auth0:setup` against it (see SPEC.md section 9, step 1).",
      );
      process.exit(1);
    }
    throw error;
  }
}

function ensureAuthSecret(): void {
  if (readEnvVar("AUTH0_SECRET")) {
    noted("AUTH0_SECRET already set in .env.local");
    return;
  }
  setEnvVar("AUTH0_SECRET", randomBytes(32).toString("hex"));
}

async function main(): Promise<void> {
  console.log("Countersign Auth0 setup\n");

  console.log("-- tenant --");
  ensureTenantDomain();

  console.log("\n-- application --");
  const { clientId, clientSecret } = ensureApp();
  setEnvVar("AUTH0_CLIENT_ID", clientId);
  setEnvVar("AUTH0_CLIENT_SECRET", clientSecret);
  ensureAuthSecret();
  setEnvVar("APP_BASE_URL", "http://localhost:3000");

  console.log("\n-- API --");
  ensureApi();
  setEnvVar("AUTH0_AUDIENCE", API_IDENTIFIER);

  console.log("\n-- MFA / Guardian --");
  ensureGuardianPush();

  console.log(`\nDone. ${changes.length} item(s) checked.`);
}

main().catch((error) => {
  console.error("auth0-setup failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
