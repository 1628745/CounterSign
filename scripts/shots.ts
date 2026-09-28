#!/usr/bin/env tsx
// npm run shots — visual QA for Mission Control (docs/DESIGN.md Part D).
// One real login, driven against the real dev server and real backend (no
// mocks): the naive run and the guarded run's approvals are genuine — the
// guarded run's first approval needs a real Guardian push approved or
// denied on the operator's phone before the script can continue.

import { config } from "dotenv";
config({ path: ".env.local" });

import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";

const BASE_URL = process.env.APP_BASE_URL ?? "http://localhost:3000";
const STATE_PATH = path.resolve("playwright/.auth/state.json");
const SHOTS_DIR = path.resolve("screenshots");
const VIEWPORTS = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1280x800", width: 1280, height: 800 },
];

async function ensureLogin(): Promise<void> {
  if (fs.existsSync(STATE_PATH)) return;

  console.log("No saved login found. Opening a headed browser — please log in with Auth0.");
  console.log("This script will detect the login and save your session, then exit.");
  console.log('Re-run "npm run shots" afterward to actually capture screenshots.\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(BASE_URL);
  await page.waitForSelector('[data-cs-app="mission-control"]', { timeout: 300_000 });
  await page.waitForTimeout(1000);

  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  await context.storageState({ path: STATE_PATH });
  await browser.close();

  console.log(`Saved login to ${STATE_PATH}.`);
  process.exit(0);
}

async function shootBothViewports(page: Page, name: string): Promise<void> {
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.waitForTimeout(150); // let layout settle after resize
    const filePath = path.join(SHOTS_DIR, `${name}-${viewport.name}.png`);
    await page.screenshot({ path: filePath });
    console.log(`saved ${filePath}`);
  }
  await page.setViewportSize({ width: VIEWPORTS[0].width, height: VIEWPORTS[0].height });
}

async function resetDemo(page: Page): Promise<void> {
  const res = await page.request.post(`${BASE_URL}/api/demo/reset`);
  if (!res.ok()) throw new Error(`POST /api/demo/reset failed (${res.status()})`);
  await page.reload();
  await page.waitForLoadState("networkidle");
}

async function main(): Promise<void> {
  await ensureLogin();
  fs.mkdirSync(SHOTS_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ storageState: STATE_PATH, viewport: VIEWPORTS[0] });
  const page = await context.newPage();

  await page.goto(BASE_URL);
  await page.waitForLoadState("networkidle");

  console.log("-- resetting demo to a clean baseline --");
  await resetDemo(page);
  await shootBothViewports(page, "01-empty");

  console.log("-- naive run (guard off) --");
  const guardSwitch = page.getByRole("switch", { name: "Toggle guard" });
  if (await guardSwitch.isChecked()) await guardSwitch.click();
  await page.getByRole("button", { name: "Run inbox" }).click();
  await page.waitForSelector("text=Run finished.", { timeout: 120_000 });
  await shootBothViewports(page, "02-after-naive-run");

  console.log("-- resetting, then guarded run (guard on) --");
  await resetDemo(page);
  if (!(await guardSwitch.isChecked())) await guardSwitch.click();
  await page.getByRole("button", { name: "Run inbox" }).click();

  console.log("waiting for the first approval to reach 'Waiting on you'...");
  await page.waitForSelector("text=Waiting on you", { timeout: 60_000 });
  await page.waitForSelector('[data-testid="approval-card"]', { timeout: 60_000 });
  await shootBothViewports(page, "03-guarded-run-approval-pending");

  console.log("\n>>> A real Guardian push is now pending. Approve or deny it on your phone. <<<\n");
  await page.waitForSelector("text=Run finished.", { timeout: 300_000 });
  await shootBothViewports(page, "04-after-guarded-run");

  console.log("-- document viewer with hidden text shown (E5) --");
  await page.locator('[data-cs-email-id="e5"]').click();
  await page.getByRole("button", { name: /Show hidden text/ }).click();
  await page.waitForTimeout(500); // let the scan-line animation finish
  await shootBothViewports(page, "05-document-hidden-text");

  await browser.close();
  console.log("\nDone. Open every screenshot in screenshots/ and check it yourself.");
}

main().catch((error) => {
  console.error("shots failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
